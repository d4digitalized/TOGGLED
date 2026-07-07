-- Práva zadávat úkoly: běžný člen přiřazuje úkoly jen sám sobě.
-- Admin může jednotlivcům povolit přiřazování dalším lidem
-- (grant user → target, per workspace). Admini přiřazují komukoli.

create table public.assign_grants (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id, target_id)
);

alter table public.assign_grants enable row level security;

create policy grants_select on public.assign_grants for select
  using (public.is_ws_member(workspace_id));
create policy grants_insert on public.assign_grants for insert
  with check (public.is_ws_admin(workspace_id));
create policy grants_delete on public.assign_grants for delete
  using (public.is_ws_admin(workspace_id));

-- přiřazení: admin | sám sebe | s grantem; řešitel musí projekt vidět
drop policy ta_insert on public.task_assignees;
create policy ta_insert on public.task_assignees for insert
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_assignees.task_id
      and (public.is_ws_admin(t.workspace_id)
        or task_assignees.user_id = auth.uid()
        or exists (select 1 from public.assign_grants g
                   where g.workspace_id = t.workspace_id
                     and g.user_id = auth.uid()
                     and g.target_id = task_assignees.user_id))
      and (exists (select 1 from public.project_members pm
                   where pm.project_id = t.project_id
                     and pm.user_id = task_assignees.user_id)
        or exists (select 1 from public.workspace_members wm
                   where wm.workspace_id = t.workspace_id
                     and wm.user_id = task_assignees.user_id
                     and wm.role = 'admin'))));

-- odebrání řešitele: stejná pravidla (sebe | admin | grant)
drop policy ta_delete on public.task_assignees;
create policy ta_delete on public.task_assignees for delete
  using (user_id = auth.uid()
    or exists (select 1 from public.tasks t
               where t.id = task_assignees.task_id
                 and (public.is_ws_admin(t.workspace_id)
                   or exists (select 1 from public.assign_grants g
                              where g.workspace_id = t.workspace_id
                                and g.user_id = auth.uid()
                                and g.target_id = task_assignees.user_id))));
