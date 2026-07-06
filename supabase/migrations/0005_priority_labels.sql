-- Todoist parita, 1. vlna: priority karet (P1–P4) a štítky.

-- ============================================================ priorita

alter table public.tasks
  add column priority smallint not null default 4 check (priority between 1 and 4);

-- ============================================================ štítky

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);

create index task_labels_label_idx on public.task_labels (label_id);

-- ============================================================ RLS

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

-- štítky: kolaborativní v rámci workspace (jako sloupce), maže admin
create policy labels_select on public.labels for select
  using (public.is_ws_member(workspace_id));
create policy labels_insert on public.labels for insert
  with check (public.is_ws_member(workspace_id));
create policy labels_update on public.labels for update
  using (public.is_ws_member(workspace_id));
create policy labels_delete on public.labels for delete
  using (public.is_ws_admin(workspace_id));

-- vazby: štítkuje ten, kdo vidí kartu (exists respektuje RLS tasks);
-- štítek musí být ze stejného workspace jako karta
create policy task_labels_select on public.task_labels for select
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy task_labels_insert on public.task_labels for insert
  with check (exists (select 1 from public.tasks t
                      join public.labels l on l.workspace_id = t.workspace_id
                      where t.id = task_labels.task_id
                        and l.id = task_labels.label_id));
create policy task_labels_delete on public.task_labels for delete
  using (exists (select 1 from public.tasks t where t.id = task_id));
