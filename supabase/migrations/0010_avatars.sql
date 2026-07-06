-- Avatary uživatelů: dvě písmena + barva kolečka. Spravuje je admin
-- (spolu se jménem a příjmením člena); prázdné hodnoty = odvodit
-- automaticky ze jména a ID.

alter table public.profiles
  add column avatar_initials text not null default ''
    check (char_length(avatar_initials) <= 3),
  add column avatar_color text not null default ''
    check (avatar_color = '' or avatar_color ~ '^#[0-9a-fA-F]{6}$');

-- admin smí upravit profil člena workspace, který spravuje
create or replace function public.admin_shares_workspace(target uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from workspace_members a
    join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and a.role = 'admin' and b.user_id = target)
$$;

drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.admin_shares_workspace(id))
  with check (id = auth.uid() or public.admin_shares_workspace(id));

-- sloupcová práva: jméno + avatar; is_super_admin zůstává přes API zamčený
grant update (full_name, avatar_initials, avatar_color)
  on public.profiles to authenticated;
