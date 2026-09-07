-- MAJA 13 — installation Supabase complète
-- À exécuter une seule fois dans une NOUVELLE instance Supabase.
-- Les droits sensibles sont décidés ici, jamais dans le JavaScript du navigateur.

create extension if not exists pgcrypto;

-- ──────────────────────────────────────────────────────────────────────────
-- Comptes, profils et fonctions d'autorisation
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.comptes (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  approuve boolean not null default false,
  acces text not null default 'complet' check (acces in ('complet', 'taxes')),
  role text not null default 'soldado' check (role in (
    'soldado', 'sicario', 'commandante', 'palabrero', 'segundo', 'jefe'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text,
  rang text,
  specialite text,
  citation text,
  bio text,
  photo_url text,
  matricule text,
  updated_at timestamptz not null default now()
);

create or replace function public.role_niveau(p_role text)
returns integer language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select case p_role
    when 'jefe' then 60 when 'segundo' then 50
    when 'palabrero' then 40 when 'commandante' then 30
    when 'sicario' then 20 when 'soldado' then 10 else 0 end;
$$;

create or replace function public.est_approuve()
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce((select c.approuve from public.comptes c where c.id = auth.uid()), false);
$$;

create or replace function public.a_role_minimum(p_role text)
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce((
    select c.approuve and public.role_niveau(c.role) >= public.role_niveau(p_role)
    from public.comptes c where c.id = auth.uid()
  ), false);
$$;

create or replace function public.est_admin()
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$ select public.a_role_minimum('jefe'); $$;

create or replace function public.mon_discord_id()
returns text language sql stable security definer
set search_path = auth, public, pg_temp
as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  order by i.last_sign_in_at desc nulls last limit 1;
$$;

create or replace function public.creer_compte_auth()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.comptes (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_creer_compte_auth on auth.users;
create trigger trg_creer_compte_auth after insert or update of email on auth.users
for each row execute function public.creer_compte_auth();

create or replace function public.proteger_compte()
returns trigger language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is not null and not public.est_admin() then
    new.email := coalesce(auth.jwt() ->> 'email', old.email, new.email);
    new.approuve := old.approuve;
    new.acces := old.acces;
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proteger_compte on public.comptes;
create trigger trg_proteger_compte before update on public.comptes
for each row execute function public.proteger_compte();

-- ──────────────────────────────────────────────────────────────────────────
-- Contenu, planning, galerie et carte
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.site_contenu (
  cle text primary key,
  valeur jsonb not null default '{}'::jsonb,
  est_public boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  discord_id text unique,
  jour text,
  mois text,
  titre text not null,
  heure text,
  texte text,
  type text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.participations (
  event_id uuid references public.evenements(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.galerie_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  url text not null,
  caption text,
  publiee boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.carte_points (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type text not null default 'autre' check (type in ('qg','zone','planque','event','vente','autre')),
  x numeric not null check (x between 0 and 100),
  y numeric not null check (y between 0 and 100),
  zone_liee text,
  notes text,
  updated_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- Économie et activité RP
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text,
  quantite integer not null default 0 check (quantite between 0 and 100000),
  argent_sale integer not null default 0 check (argent_sale between 0 and 100000000),
  created_at timestamptz not null default now()
);

create table if not exists public.prix_drogues (
  item text primary key,
  prix numeric not null default 0 check (prix >= 0),
  base_min numeric check (base_min is null or base_min >= 0),
  base_max numeric check (base_max is null or base_max >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.bareme_drogues (
  item text not null,
  purete smallint not null default 0 check (purete between 0 and 100),
  prix_min numeric not null check (prix_min >= 0),
  prix_max numeric not null check (prix_max >= prix_min),
  ordre smallint not null default 100,
  updated_at timestamptz not null default now(),
  primary key (item, purete)
);

create table if not exists public.import_taxes (
  id uuid primary key default gen_random_uuid(),
  cree_par uuid not null references auth.users(id) on delete cascade,
  cree_le timestamptz not null default now(),
  fichier text,
  statut text not null default 'en_attente' check (statut in ('en_attente','traite','erreur')),
  lignes jsonb not null,
  rapport jsonb,
  traite_le timestamptz
);

create table if not exists public.bot_taxes_types (
  type text primary key,
  label text not null,
  ordre integer not null default 100
);

create table if not exists public.push_abonnements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  sub jsonb not null,
  maj timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- Hiérarchie, économie et modules terrain MAJA 13
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.grades_config (
  role text primary key check (role in ('soldado', 'sicario', 'commandante', 'palabrero', 'segundo', 'jefe')),
  label text not null,
  couleur text not null default '#ad8a4e',
  ordre integer not null default 0,
  quota_pf_hebdo integer not null default 0 check (quota_pf_hebdo >= 0),
  pourcentage_paie numeric not null default 0 check (pourcentage_paie between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.pf_config (
  id integer primary key default 1 check (id = 1),
  nom text not null default 'Petite Frappe',
  gain_min integer not null default 0 check (gain_min >= 0),
  gain_max integer not null default 0 check (gain_max >= gain_min),
  cooldown_minutes integer not null default 0 check (cooldown_minutes >= 0),
  limite_semaine integer not null default 0 check (limite_semaine >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_armes (
  arme text primary key,
  quantite integer not null default 0 check (quantite >= 0),
  categorie text,
  seuil_alerte integer not null default 0 check (seuil_alerte >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.labos (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  statut text not null default 'libre' check (statut in ('libre', 'occupe', 'maintenance')),
  occupe_par text,
  dispo_a timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.disponibilites_gros_braquage (
  event_id uuid not null references public.evenements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  statut text not null default 'incertain' check (statut in ('dispo', 'indispo', 'incertain')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.prison (
  user_id uuid primary key references auth.users(id) on delete cascade,
  actif boolean not null default false,
  motif text,
  depuis timestamptz not null default now(),
  jusqua timestamptz,
  par uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- Miroirs du bot Discord/FiveM. La service_role écrit, les membres lisent.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.bot_stocks (item text primary key, quantite bigint not null default 0);
create table if not exists public.bot_stats (user_id text not null, action text not null, count real not null default 0, points real not null default 0, primary key (user_id, action));
create table if not exists public.bot_user_mapping (
  game_name text not null, discord_id text not null,
  is_admin boolean not null default false,
  is_taxes_manager boolean not null default false,
  primary key (game_name, discord_id)
);
-- Grade suggéré côté Discord (rôle du serveur), à titre indicatif : l'admin
-- garde la main dans l'écran Inscriptions, cette table ne fait que proposer.
create table if not exists public.bot_grade_mapping (
  discord_id text primary key,
  grade text,
  updated_at timestamptz not null default now()
);
create table if not exists public.bot_armurerie (id bigint primary key, nom text, reference text, statut text, pretee_a text);
create table if not exists public.bot_taxes (id bigint primary key, nom text, type text, echeance timestamptz, actif boolean not null default true, paye boolean not null default false);
create table if not exists public.bot_meta (key text primary key, value text);
create table if not exists public.bot_stock_history (id bigint primary key, ts timestamptz, joueur text, action text, item text, quantite bigint, stock_avant bigint, stock_apres bigint);
create table if not exists public.bot_braquages (id bigint primary key, user_id text, action text, ts timestamptz);
create table if not exists public.bot_cooldowns (user_id text not null, action text not null, expires_at timestamptz, primary key (user_id, action));
create table if not exists public.bot_ventes (id bigint primary key, joueur text, discord_id text, item text, quantite bigint, ts timestamptz, statut text, montant bigint, prix_pochon real, confirmed boolean not null default false);
create table if not exists public.bot_bilans (semaine text not null, user_id text not null, ventes real not null default 0, recolte real not null default 0, activites real not null default 0, points real not null default 0, primary key (semaine, user_id));
create table if not exists public.bot_annonces (id text primary key, auteur text, texte text, ts timestamptz);
create table if not exists public.bot_presences (id text primary key, auteur text, titre text, texte text, date_evt timestamptz);
create table if not exists public.bot_drogue_bourse (id bigint primary key, item text not null, prix_actuel_min numeric, prix_actuel_max numeric, ts timestamptz not null default now());
create table if not exists public.bot_zone_bonus (id bigint primary key, categorie text not null, zone text not null, bonus numeric not null default 0, ts timestamptz not null default now());

create or replace function public.est_gerant_taxes()
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce((select c.approuve and c.acces = 'taxes' from public.comptes c where c.id = auth.uid()), false)
      or coalesce((select m.is_taxes_manager from public.bot_user_mapping m where m.discord_id = public.mon_discord_id() limit 1), false);
$$;

create or replace function public.peut_importer_taxes()
returns boolean language sql stable security definer
set search_path = public, auth, pg_temp
as $$ select public.est_admin() or public.est_gerant_taxes() or public.a_role_minimum('commandante'); $$;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array[
    'comptes','profils','site_contenu','evenements','participations','galerie_photos','carte_points',
    'declarations','prix_drogues','bareme_drogues','import_taxes','bot_taxes_types','push_abonnements',
    'grades_config','pf_config','stock_armes','labos','disponibilites_gros_braquage','prison',
    'bot_stocks','bot_stats','bot_user_mapping','bot_grade_mapping','bot_armurerie','bot_taxes','bot_meta','bot_stock_history',
    'bot_braquages','bot_cooldowns','bot_ventes','bot_bilans','bot_annonces','bot_presences',
    'bot_drogue_bourse','bot_zone_bonus'
  ] loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

create policy comptes_lire_soi on public.comptes for select to authenticated using (id = auth.uid());
create policy comptes_creer_soi on public.comptes for insert to authenticated
  with check (id = auth.uid() and email = (auth.jwt() ->> 'email') and not approuve and role = 'soldado');
create policy comptes_modifier_soi on public.comptes for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy comptes_admin_tout on public.comptes for all to authenticated using (public.est_admin()) with check (public.est_admin());

create policy profils_publics on public.profils for select using (true);
create policy profils_ecrire_soi on public.profils for insert to authenticated with check (id = auth.uid() and public.est_approuve());
create policy profils_modifier_soi on public.profils for update to authenticated using (id = auth.uid() and public.est_approuve()) with check (id = auth.uid());
create policy profils_admin_supprime on public.profils for delete to authenticated using (public.est_admin());

create policy contenu_public on public.site_contenu for select using (est_public or public.est_approuve());
create policy contenu_edition on public.site_contenu for all to authenticated using (public.a_role_minimum('commandante')) with check (public.a_role_minimum('commandante'));

create policy evenements_lecture on public.evenements for select to authenticated using (public.est_approuve());
create policy evenements_gestion on public.evenements for all to authenticated using (public.a_role_minimum('commandante')) with check (public.a_role_minimum('commandante'));
create policy participations_lecture on public.participations for select to authenticated using (public.est_approuve());
create policy participations_soi_insert on public.participations for insert to authenticated with check (user_id = auth.uid() and public.est_approuve());
create policy participations_soi_delete on public.participations for delete to authenticated using (user_id = auth.uid() or public.a_role_minimum('commandante'));

create policy galerie_publique on public.galerie_photos for select using (publiee or public.a_role_minimum('commandante'));
create policy galerie_ajout on public.galerie_photos for insert to authenticated with check (user_id = auth.uid() and public.est_approuve());
create policy galerie_suppression on public.galerie_photos for delete to authenticated using (user_id = auth.uid() or public.a_role_minimum('commandante'));

create policy carte_lecture on public.carte_points for select to authenticated using (public.est_approuve());
create policy carte_gestion on public.carte_points for all to authenticated using (public.a_role_minimum('commandante')) with check (public.a_role_minimum('commandante'));
create policy declarations_soi on public.declarations for select to authenticated using (user_id = auth.uid() or public.a_role_minimum('commandante'));
create policy declarations_ajout on public.declarations for insert to authenticated with check (user_id = auth.uid() and public.est_approuve());

create policy prix_lecture on public.prix_drogues for select to authenticated using (public.est_approuve());
create policy prix_gestion on public.prix_drogues for all to authenticated using (public.a_role_minimum('segundo')) with check (public.a_role_minimum('segundo'));
create policy bareme_lecture on public.bareme_drogues for select to authenticated using (public.est_approuve());
create policy bareme_gestion on public.bareme_drogues for all to authenticated using (public.a_role_minimum('segundo')) with check (public.a_role_minimum('segundo'));

create policy taxes_types_lecture on public.bot_taxes_types for select to authenticated using (public.est_approuve());
create policy imports_ajout on public.import_taxes for insert to authenticated with check (cree_par = auth.uid() and public.peut_importer_taxes());
create policy imports_lecture on public.import_taxes for select to authenticated using ((cree_par = auth.uid() and public.peut_importer_taxes()) or public.est_admin());
create policy push_soi on public.push_abonnements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy grades_lecture on public.grades_config for select to authenticated using (public.est_approuve());
create policy grades_gestion on public.grades_config for all to authenticated using (public.a_role_minimum('segundo')) with check (public.a_role_minimum('segundo'));

create policy pf_lecture on public.pf_config for select to authenticated using (public.est_approuve());
create policy pf_gestion on public.pf_config for all to authenticated using (public.a_role_minimum('segundo')) with check (public.a_role_minimum('segundo'));

create policy armes_lecture on public.stock_armes for select to authenticated using (public.est_approuve());
create policy armes_gestion on public.stock_armes for all to authenticated using (public.a_role_minimum('commandante')) with check (public.a_role_minimum('commandante'));

create policy labos_lecture on public.labos for select to authenticated using (public.est_approuve());
create policy labos_gestion on public.labos for all to authenticated using (public.a_role_minimum('commandante')) with check (public.a_role_minimum('commandante'));

create policy dispo_gb_lecture on public.disponibilites_gros_braquage for select to authenticated using (public.est_approuve());
create policy dispo_gb_soi on public.disponibilites_gros_braquage for insert to authenticated with check (user_id = auth.uid() and public.est_approuve());
create policy dispo_gb_maj_soi on public.disponibilites_gros_braquage for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dispo_gb_suppression on public.disponibilites_gros_braquage for delete to authenticated using (user_id = auth.uid() or public.a_role_minimum('commandante'));

create policy prison_lecture_soi on public.prison for select to authenticated using (user_id = auth.uid() or public.a_role_minimum('palabrero'));
create policy prison_gestion on public.prison for all to authenticated using (public.a_role_minimum('palabrero')) with check (public.a_role_minimum('palabrero'));

-- Tables bot : aucune policy d'écriture client. La service_role contourne RLS.
do $$ declare t text; begin
  foreach t in array array['bot_stocks','bot_stats','bot_user_mapping','bot_armurerie','bot_meta','bot_stock_history','bot_braquages','bot_cooldowns','bot_ventes','bot_bilans','bot_annonces','bot_presences','bot_drogue_bourse','bot_zone_bonus']
  loop execute format('create policy %I on public.%I for select to authenticated using (public.est_approuve() and not public.est_gerant_taxes())', t || '_lecture', t); end loop;
end $$;
create policy bot_taxes_lecture on public.bot_taxes for select to authenticated using (public.est_approuve());
create policy bot_grade_mapping_lecture on public.bot_grade_mapping for select to authenticated using (public.a_role_minimum('commandante'));

-- ──────────────────────────────────────────────────────────────────────────
-- Stockage
-- ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('photos','photos',true), ('galerie','galerie',true)
on conflict (id) do update set public = excluded.public;

create policy storage_lecture_publique on storage.objects for select using (bucket_id in ('photos','galerie'));
create policy storage_photo_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.est_approuve());
create policy storage_photo_maj on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner = auth.uid())
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_galerie_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'galerie' and (storage.foldername(name))[1] = auth.uid()::text and public.est_approuve());
create policy storage_suppression on storage.objects for delete to authenticated
  using (bucket_id in ('photos','galerie') and (owner = auth.uid() or public.a_role_minimum('commandante')));

-- ──────────────────────────────────────────────────────────────────────────
-- Fonctions réservées à l'administration
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.comptes_details()
returns table (id uuid, email text, approuve boolean, acces text, created_at timestamptz, discord_pseudo text, derniere_connexion timestamptz, nom text, rang text, role text, grade_suggere text)
language sql stable security definer set search_path = public, auth, pg_temp
as $$
  select c.id, c.email, c.approuve, c.acces, c.created_at,
    coalesce(i.identity_data -> 'custom_claims' ->> 'global_name', i.identity_data ->> 'full_name', i.identity_data ->> 'name') as discord_pseudo,
    u.last_sign_in_at, p.nom, p.rang, c.role, g.grade as grade_suggere
  from public.comptes c
  left join auth.users u on u.id = c.id
  left join public.profils p on p.id = c.id
  left join lateral (select identity_data, provider_id from auth.identities x where x.user_id = c.id and x.provider = 'discord' order by x.last_sign_in_at desc nulls last limit 1) i on true
  left join public.bot_grade_mapping g on g.discord_id = i.provider_id
  where public.est_admin()
  order by c.created_at desc;
$$;

create or replace function public.supprimer_compte(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth, pg_temp
as $$ begin
  if not public.est_admin() then raise exception 'Accès refusé'; end if;
  if p_id = auth.uid() then raise exception 'Auto-suppression administrateur refusée'; end if;
  delete from auth.users where id = p_id;
  return found;
end; $$;

revoke all on function public.est_admin() from public, anon;
revoke all on function public.est_approuve() from public, anon;
revoke all on function public.a_role_minimum(text) from public, anon;
revoke all on function public.mon_discord_id() from public, anon;
revoke all on function public.est_gerant_taxes() from public, anon;
revoke all on function public.peut_importer_taxes() from public, anon;
revoke all on function public.comptes_details() from public, anon;
revoke all on function public.supprimer_compte(uuid) from public, anon;
grant execute on function public.est_admin(), public.est_approuve(), public.a_role_minimum(text), public.mon_discord_id(), public.est_gerant_taxes(), public.peut_importer_taxes(), public.comptes_details(), public.supprimer_compte(uuid) to authenticated;

-- Valeurs non sensibles de départ.
insert into public.bot_taxes_types (type, label, ordre) values
  ('standard','Taxe standard',10), ('import','Importation',20), ('exceptionnelle','Taxe exceptionnelle',30)
on conflict (type) do update set label = excluded.label, ordre = excluded.ordre;

insert into public.site_contenu (cle, valeur, est_public) values
  ('accueil', '{"slogan":"La familia sobre todo.","histoire":"Contenu RP à personnaliser."}'::jsonb, true)
on conflict (cle) do nothing;

insert into public.grades_config (role, label, couleur, ordre, quota_pf_hebdo, pourcentage_paie) values
  ('jefe',        'Jefe',        '#9f2635', 60, 0,  35),
  ('segundo',     'Segundo',     '#b6512f', 50, 0,  30),
  ('palabrero',   'Palabrero',   '#ad8a4e', 40, 5,  25),
  ('commandante', 'Commandante', '#8a7654', 30, 8,  20),
  ('sicario',     'Sicario',     '#6d6151', 20, 12, 15),
  ('soldado',     'Soldado',     '#5a5142', 10, 15, 10)
on conflict (role) do update set label = excluded.label, couleur = excluded.couleur, ordre = excluded.ordre;

insert into public.pf_config (id, nom, gain_min, gain_max, cooldown_minutes, limite_semaine) values
  (1, 'Petite Frappe', 500, 1500, 20, 15)
on conflict (id) do nothing;

-- IMPORTANT : après création du premier utilisateur, utilisez
-- supabase/first-admin.sql depuis le SQL Editor pour lui attribuer le rôle.
