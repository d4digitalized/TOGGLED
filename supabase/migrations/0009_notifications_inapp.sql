-- In-app notifikace (zvoneček + obrazovka). Uživatel čte a označuje
-- jako přečtené jen svoje řádky; zápis do fronty dál dělají výhradně
-- triggery (security definer) a e-maily značí service role.

alter table public.notifications
  add column read_at timestamptz;

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

create policy notifications_select on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
