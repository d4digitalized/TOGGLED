-- Todoist parita, 3. vlna: e-mailové notifikace.
-- Triggery zapisují do fronty public.notifications; odesílání řeší
-- cron endpoint aplikace přes service role (Resend). Tabulka fronty
-- nemá žádné RLS politiky pro authenticated — je čistě serverová.

-- ============================================================ preference

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  on_assign boolean not null default true,
  on_comment boolean not null default true,
  daily_digest boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

create policy prefs_select on public.notification_prefs for select
  using (user_id = auth.uid());
create policy prefs_insert on public.notification_prefs for insert
  with check (user_id = auth.uid());
create policy prefs_update on public.notification_prefs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================ fronta

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('assigned', 'comment')),
  workspace_id uuid not null,
  project_id uuid,
  task_id uuid,
  task_title text not null default '',
  actor_name text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  emailed_at timestamptz
);

create index notifications_unsent_idx on public.notifications (created_at)
  where emailed_at is null;

alter table public.notifications enable row level security;
-- záměrně žádné politiky: čte a značí jen service role (cron)

-- ============================================================ triggery
-- security definer → smí zapsat do fronty bez ohledu na RLS

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor text;
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or old.assignee_id is distinct from new.assignee_id) then
    select coalesce(nullif(full_name, ''), email) into actor
    from profiles where id = auth.uid();
    insert into notifications
      (user_id, kind, workspace_id, project_id, task_id, task_title, actor_name)
    values
      (new.assignee_id, 'assigned', new.workspace_id, new.project_id,
       new.id, new.title, coalesce(actor, ''));
  end if;
  return new;
end;
$$;

create trigger on_task_assigned
  after insert or update on public.tasks
  for each row execute function public.notify_task_assigned();

create or replace function public.notify_task_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  t record;
  actor text;
  recipient uuid;
begin
  select project_id, title, assignee_id, created_by into t
  from tasks where id = new.task_id;
  select coalesce(nullif(full_name, ''), email) into actor
  from profiles where id = new.author_id;

  -- příjemci: řešitel a autor karty (bez autora komentáře, bez duplicit)
  for recipient in
    select distinct u from unnest(array[t.assignee_id, t.created_by]) as u
    where u is not null and u <> new.author_id
  loop
    insert into notifications
      (user_id, kind, workspace_id, project_id, task_id, task_title, actor_name, body)
    values
      (recipient, 'comment', new.workspace_id, t.project_id, new.task_id,
       t.title, coalesce(actor, ''), left(new.body, 300));
  end loop;
  return new;
end;
$$;

create trigger on_task_commented
  after insert on public.task_comments
  for each row execute function public.notify_task_comment();
