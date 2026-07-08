-- Přílohy karet: soubory nahrané do Supabase Storage. První využití Storage
-- v projektu — zakládáme privátní bucket a metadata tabulku. Stahování běží
-- přes krátkodobě podepsané URL (bucket je privátní).

-- ============================================================ bucket

-- privátní bucket, limit 20 MB na soubor
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 20971520)
on conflict (id) do nothing;

-- ============================================================ metadata

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  file_name text not null,
  object_path text not null,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments (task_id);

alter table public.task_attachments enable row level security;

-- čte, kdo vidí kartu (exists respektuje RLS tasks)
create policy task_attachments_select on public.task_attachments for select
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- nahrává člen workspace; přílohu smí evidovat jen sám za sebe
create policy task_attachments_insert on public.task_attachments for insert
  with check (
    public.is_ws_member(workspace_id)
    and uploaded_by = auth.uid()
    and exists (select 1 from public.tasks t
                where t.id = task_attachments.task_id
                  and t.workspace_id = task_attachments.workspace_id)
  );

-- maže autor nahrání nebo admin workspace
create policy task_attachments_delete on public.task_attachments for delete
  using (uploaded_by = auth.uid() or public.is_ws_admin(workspace_id));

-- ============================================================ Storage RLS
-- Cesta objektu: {workspace_id}/{task_id}/{uuid}-{název}. První segment je
-- workspace → práva odvozujeme z členství v něm.

create policy task_attachments_obj_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and public.is_ws_member(((storage.foldername(name))[1])::uuid)
  );

create policy task_attachments_obj_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and public.is_ws_member(((storage.foldername(name))[1])::uuid)
  );

create policy task_attachments_obj_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      owner = auth.uid()
      or public.is_ws_admin(((storage.foldername(name))[1])::uuid)
    )
  );
