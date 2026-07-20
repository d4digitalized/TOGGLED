-- Inbox bere i úkoly, kde jsem jediný řešitel já (typicky rychlé zachycení
-- „udělám si sám"). Aby takový úkol z Inboxu někdy zmizel, potřebuje razítko
-- roztřídění — samotné přiřazení sebe totiž nic nemění.
-- „Utříděno ✓" v Inboxu nastaví triaged_at; úkol pak žije jen v Moje úkoly.

alter table public.tasks
  add column triaged_at timestamptz;

-- staré úkoly neotravují: co už dnes v Inboxu není, ber jako roztříděné
update public.tasks t
set triaged_at = now()
where t.project_id is not null
   or exists (select 1 from public.task_assignees a where a.task_id = t.id)
   or exists (select 1 from public.task_contact_assignees c where c.task_id = t.id)
   or exists (select 1 from public.task_followups f where f.task_id = t.id);
