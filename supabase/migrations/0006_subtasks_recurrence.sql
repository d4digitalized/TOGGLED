-- Todoist parita, 2. vlna: podúkoly a opakované karty.

-- ============================================================ sloupce

alter table public.tasks
  add column parent_id uuid references public.tasks (id) on delete cascade,
  add column recurrence text
    check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly', 'yearly'));

create index tasks_parent_idx on public.tasks (parent_id);

-- ============================================================ opakování
-- Dokončením karty s pravidlem vznikne další výskyt (klon se štítky,
-- bez podúkolů). Termín se posouvá od původního due_date (nebo ode dneška).
-- security definer → klon vzniká i když dokončil někdo jiný než autor.

create or replace function public.handle_recurring_task()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  base date;
  next_due date;
  new_id uuid;
begin
  if new.completed_at is not null and old.completed_at is null
     and new.recurrence is not null and new.parent_id is null then
    base := coalesce(new.due_date, current_date);
    next_due := case new.recurrence
      when 'daily' then base + 1
      when 'weekdays' then case extract(isodow from base)::int
        when 5 then base + 3  -- pá → po
        when 6 then base + 2  -- so → po
        else base + 1 end
      when 'weekly' then base + 7
      when 'monthly' then (base + interval '1 month')::date
      when 'yearly' then (base + interval '1 year')::date
    end;

    insert into tasks (workspace_id, project_id, column_id, position, title,
                       description, assignee_id, due_date, created_by,
                       priority, recurrence)
    values (new.workspace_id, new.project_id, new.column_id, new.position,
            new.title, new.description, new.assignee_id, next_due,
            new.created_by, new.priority, new.recurrence)
    returning id into new_id;

    insert into task_labels (task_id, label_id)
    select new_id, label_id from task_labels where task_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_task_completed_recur
  after update on public.tasks
  for each row execute function public.handle_recurring_task();
