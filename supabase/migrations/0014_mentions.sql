-- @zmínky v komentářích: `@tag` v textu notifikuje zmíněného uživatele
-- (zvoneček + e-mail dle preferencí), i když není řešitel ani autor karty.

-- nový druh notifikace
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('assigned', 'comment', 'mention'));

-- preference
alter table public.notification_prefs
  add column on_mention boolean not null default true;

-- komentářový trigger: nejdřív zmínky, pak řešitelé + autor karty
-- (zmínění nedostanou duplicitní „comment" notifikaci)
create or replace function public.notify_task_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  t record;
  actor text;
  recipient uuid;
  mentioned uuid[];
begin
  select project_id, title, created_by into t from tasks where id = new.task_id;
  select coalesce(nullif(full_name, ''), email) into actor
  from profiles where id = new.author_id;

  -- @tagy z textu → uživatelé se shodným tag_name, členové stejného workspace
  select coalesce(array_agg(distinct p.id), '{}') into mentioned
  from regexp_matches(new.body, '@([a-z0-9_.]{2,30})', 'g') as m
  join profiles p on p.tag_name <> '' and lower(p.tag_name) = lower(m[1])
  join workspace_members wm
    on wm.workspace_id = new.workspace_id and wm.user_id = p.id
  where p.id <> new.author_id;

  foreach recipient in array mentioned loop
    insert into notifications
      (user_id, kind, workspace_id, project_id, task_id, task_title, actor_name, body)
    values
      (recipient, 'mention', new.workspace_id, t.project_id, new.task_id,
       t.title, coalesce(actor, ''), left(new.body, 300));
  end loop;

  for recipient in
    select distinct u from (
      select user_id as u from task_assignees where task_id = new.task_id
      union
      select t.created_by
    ) s
    where u is not null and u <> new.author_id and u <> all(mentioned)
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
