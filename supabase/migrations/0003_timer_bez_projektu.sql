-- Volný timer: spustí se okamžitě, projekt a popis se doplní až za běhu.
-- Záznam proto smí dočasně (i trvale) existovat bez projektu.

alter table public.time_entries alter column project_id drop not null;

drop policy entries_insert on public.time_entries;
create policy entries_insert on public.time_entries for insert
  with check (user_id = auth.uid()
    and public.is_ws_member(workspace_id)
    and (project_id is null or exists
      (select 1 from public.projects p
       where p.id = project_id and p.workspace_id = time_entries.workspace_id))
    and (task_id is null or exists
      (select 1 from public.tasks t
       where t.id = task_id and t.workspace_id = time_entries.workspace_id)));
