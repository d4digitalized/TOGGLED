-- Seznamy (checklisty) na kartě — nad rámec podúkolů. Karta může mít víc
-- pojmenovaných seznamů, každý s odškrtávatelnými položkami. Kolaborativní:
-- edituje každý, kdo vidí kartu (jako štítky/komentáře).

-- ============================================================ tabulky

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null default 'Seznam',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index checklists_task_idx on public.checklists (task_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  content text not null,
  completed_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index checklist_items_list_idx on public.checklist_items (checklist_id);

-- ============================================================ RLS

alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;

-- seznamy: kdo vidí kartu, ten je i spravuje
create policy checklists_select on public.checklists for select
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy checklists_insert on public.checklists for insert
  with check (exists (select 1 from public.tasks t
                      where t.id = checklists.task_id
                        and t.workspace_id = checklists.workspace_id));
create policy checklists_update on public.checklists for update
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy checklists_delete on public.checklists for delete
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- položky: práva se odvozují ze seznamu → karty
create policy checklist_items_select on public.checklist_items for select
  using (exists (select 1 from public.checklists c
                 join public.tasks t on t.id = c.task_id
                 where c.id = checklist_id));
create policy checklist_items_insert on public.checklist_items for insert
  with check (exists (select 1 from public.checklists c
                      join public.tasks t on t.id = c.task_id
                      where c.id = checklist_items.checklist_id));
create policy checklist_items_update on public.checklist_items for update
  using (exists (select 1 from public.checklists c
                 join public.tasks t on t.id = c.task_id
                 where c.id = checklist_id));
create policy checklist_items_delete on public.checklist_items for delete
  using (exists (select 1 from public.checklists c
                 join public.tasks t on t.id = c.task_id
                 where c.id = checklist_id));
