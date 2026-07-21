-- Osobní poznámky (scratchpad) v sekci Master. Per uživatel a firma jedna
-- plain textová plocha. Funkci odemyká admin flagem can_notes — default
-- vypnuto všem (i adminům; není to pravomoc, ale osobní nástroj).

alter table public.workspace_members
  add column can_notes boolean not null default false;

-- jedna poznámka na uživatele a firmu (PK = dvojice)
create table public.user_notes (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.user_notes enable row level security;

-- poznámky jsou soukromé: vidí a mění je jen jejich vlastník
create policy user_notes_select on public.user_notes for select
  using (user_id = auth.uid());
create policy user_notes_insert on public.user_notes for insert
  with check (user_id = auth.uid() and public.is_ws_member(workspace_id));
create policy user_notes_update on public.user_notes for update
  using (user_id = auth.uid());
create policy user_notes_delete on public.user_notes for delete
  using (user_id = auth.uid());
