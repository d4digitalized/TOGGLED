-- 4. kolo konceptu: projekt = kanban nástěnka, komentáře na kartě,
-- timer spustitelný i bez karty (vždy s projektem).

-- ============================================================ sloupce nástěnky

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index board_columns_project_idx on public.board_columns (project_id, position);

alter table public.tasks
  add column column_id uuid references public.board_columns (id) on delete set null,
  add column position double precision not null default 0;

create index tasks_column_idx on public.tasks (column_id, position);

-- ============================================================ komentáře

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- ============================================================ volný timer

alter table public.time_entries
  alter column task_id drop not null,
  add column project_id uuid references public.projects (id) on delete cascade,
  add column description text not null default '';

-- backfill projektů u existujících záznamů (project se dědil z úkolu)
update public.time_entries e
set project_id = t.project_id
from public.tasks t
where e.task_id = t.id and e.project_id is null;

alter table public.time_entries alter column project_id set not null;

create index time_entries_project_idx on public.time_entries (project_id, started_at);

-- ============================================================ RLS

alter table public.board_columns enable row level security;
alter table public.task_comments enable row level security;

-- sloupce: nástěnka je kolaborativní — spravuje kterýkoli člen workspace
create policy columns_select on public.board_columns for select
  using (public.is_ws_member(workspace_id));
create policy columns_insert on public.board_columns for insert
  with check (public.is_ws_member(workspace_id)
    and exists (select 1 from public.projects p
                where p.id = project_id and p.workspace_id = board_columns.workspace_id));
create policy columns_update on public.board_columns for update
  using (public.is_ws_member(workspace_id));
create policy columns_delete on public.board_columns for delete
  using (public.is_ws_member(workspace_id));

-- komentáře: čte člen, zakládá člen pod svým jménem, maže autor nebo admin
create policy comments_select on public.task_comments for select
  using (public.is_ws_member(workspace_id));
create policy comments_insert on public.task_comments for insert
  with check (public.is_ws_member(workspace_id)
    and author_id = auth.uid()
    and exists (select 1 from public.tasks t
                where t.id = task_id and t.workspace_id = task_comments.workspace_id));
create policy comments_update on public.task_comments for update
  using (author_id = auth.uid());
create policy comments_delete on public.task_comments for delete
  using (author_id = auth.uid() or public.is_ws_admin(workspace_id));

-- karty: sloupec musí patřit stejnému projektu
drop policy tasks_insert on public.tasks;
drop policy tasks_update on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (public.is_ws_member(workspace_id)
    and created_by = auth.uid()
    and exists (select 1 from public.projects p
                where p.id = project_id and p.workspace_id = tasks.workspace_id)
    and (column_id is null or exists
      (select 1 from public.board_columns c
       where c.id = column_id and c.project_id = tasks.project_id)));
create policy tasks_update on public.tasks for update
  using (public.is_ws_member(workspace_id))
  with check (public.is_ws_member(workspace_id)
    and exists (select 1 from public.projects p
                where p.id = project_id and p.workspace_id = tasks.workspace_id)
    and (column_id is null or exists
      (select 1 from public.board_columns c
       where c.id = column_id and c.project_id = tasks.project_id)));

-- záznamy času: projekt povinný a z workspace, karta volitelná a z workspace
drop policy entries_insert on public.time_entries;
create policy entries_insert on public.time_entries for insert
  with check (user_id = auth.uid()
    and public.is_ws_member(workspace_id)
    and exists (select 1 from public.projects p
                where p.id = project_id and p.workspace_id = time_entries.workspace_id)
    and (task_id is null or exists
      (select 1 from public.tasks t
       where t.id = task_id and t.workspace_id = time_entries.workspace_id)));
