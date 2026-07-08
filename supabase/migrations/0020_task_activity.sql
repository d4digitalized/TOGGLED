-- Feed aktivit karty (audit log). Systémové záznamy o změnách karty: přesun
-- mezi sloupci/projekty, termín, priorita, dokončení, přiřazení. Zapisují je
-- triggery (security definer) — klient do tabulky nezapisuje, jen čte.

-- ============================================================ tabulka

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index task_activity_task_idx on public.task_activity (task_id, created_at);

alter table public.task_activity enable row level security;

-- jen čtení pro toho, kdo vidí kartu; zápis obstarávají triggery
create policy task_activity_select on public.task_activity for select
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- ============================================================ triggery

-- vznik karty (jen top-level, ne podúkoly)
create or replace function public.log_task_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is null then
    insert into task_activity (workspace_id, task_id, actor_id, kind)
    values (new.workspace_id, new.id, coalesce(new.created_by, auth.uid()), 'created');
  end if;
  return new;
end;
$$;

create trigger on_task_created_activity
  after insert on public.tasks
  for each row execute function public.log_task_created();

-- změny karty
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  from_name text;
  to_name text;
  project_moved boolean;
begin
  if new.parent_id is not null then
    return new; -- podúkoly neaudituje
  end if;

  project_moved := new.project_id is distinct from old.project_id;

  -- přesun mezi sloupci (mimo případ, kdy je jen důsledkem přesunu projektu)
  if new.column_id is distinct from old.column_id and not project_moved then
    select name into from_name from board_columns where id = old.column_id;
    select name into to_name from board_columns where id = new.column_id;
    insert into task_activity (workspace_id, task_id, actor_id, kind, meta)
    values (new.workspace_id, new.id, auth.uid(), 'moved_column',
            jsonb_build_object('from', from_name, 'to', to_name));
  end if;

  -- přesun mezi projekty
  if project_moved then
    select name into from_name from projects where id = old.project_id;
    select name into to_name from projects where id = new.project_id;
    insert into task_activity (workspace_id, task_id, actor_id, kind, meta)
    values (new.workspace_id, new.id, auth.uid(), 'moved_project',
            jsonb_build_object('from', from_name, 'to', to_name));
  end if;

  -- termín
  if new.due_date is distinct from old.due_date then
    insert into task_activity (workspace_id, task_id, actor_id, kind, meta)
    values (new.workspace_id, new.id, auth.uid(), 'due_changed',
            jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;

  -- priorita
  if new.priority is distinct from old.priority then
    insert into task_activity (workspace_id, task_id, actor_id, kind, meta)
    values (new.workspace_id, new.id, auth.uid(), 'priority_changed',
            jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  -- dokončení / znovuotevření
  if new.completed_at is not null and old.completed_at is null then
    insert into task_activity (workspace_id, task_id, actor_id, kind)
    values (new.workspace_id, new.id, auth.uid(), 'completed');
  elsif new.completed_at is null and old.completed_at is not null then
    insert into task_activity (workspace_id, task_id, actor_id, kind)
    values (new.workspace_id, new.id, auth.uid(), 'reopened');
  end if;

  return new;
end;
$$;

create trigger on_task_update_activity
  after update on public.tasks
  for each row execute function public.log_task_activity();

-- přiřazení / odebrání řešitele
create or replace function public.log_assignee_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  uname text;
begin
  if tg_op = 'INSERT' then
    select workspace_id into ws from tasks where id = new.task_id;
    if ws is null then return new; end if;
    select coalesce(nullif(full_name, ''), email) into uname
    from profiles where id = new.user_id;
    insert into task_activity (workspace_id, task_id, actor_id, kind, meta)
    values (ws, new.task_id, auth.uid(), 'assigned', jsonb_build_object('user', uname));
    return new;
  else
    -- při mazání karty (cascade) už karta nemusí existovat → nelogovat
    select workspace_id into ws from tasks where id = old.task_id;
    if ws is null then return old; end if;
    select coalesce(nullif(full_name, ''), email) into uname
    from profiles where id = old.user_id;
    insert into task_activity (workspace_id, task_id, actor_id, kind, meta)
    values (ws, old.task_id, auth.uid(), 'unassigned', jsonb_build_object('user', uname));
    return old;
  end if;
end;
$$;

create trigger on_assignee_activity
  after insert or delete on public.task_assignees
  for each row execute function public.log_assignee_activity();
