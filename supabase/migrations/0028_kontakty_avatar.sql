-- Avatar externích kontaktů (duchů): vlastní iniciály a barva, stejně jako
-- u členů (profiles.avatar_initials/avatar_color z 0010). Prázdné = šedé
-- kolečko s iniciálami odvozenými ze jména.

alter table public.contacts
  add column avatar_initials text not null default '',
  add column avatar_color text not null default '';
