-- Ranní denní přehled se ve výchozím stavu neposílá — stejně jako maily
-- o přiřazení (0034). E-mailem zůstávají jen komentáře a zmínky, tedy věci,
-- kde někdo čeká na reakci. Kdo o přehled stojí, zapne si ho v Nastavení.

alter table public.notification_prefs
  alter column daily_digest set default false;

update public.notification_prefs set daily_digest = false where daily_digest;
