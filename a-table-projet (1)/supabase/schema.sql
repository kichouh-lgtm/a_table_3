-- À table : schéma Supabase (à exécuter dans l'éditeur SQL). Sécurité par RLS.
create table profiles(id uuid primary key references auth.users on delete cascade, role text not null default 'user' check(role in('user','admin')));
create function is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='admin')$$;
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id) values(new.id);return new;end$$;
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();
alter table profiles enable row level security;
create policy "lire son profil" on profiles for select using(id=auth.uid());
-- Aucune politique d'écriture : le rôle ne peut être changé que par SQL/service role (pas d'auto-attribution).

create table recipes(id bigint generated always as identity primary key,title text not null,description text,servings int not null check(servings>0),prep_min int,cook_min int,
 diet text[] not null default '{}',modes text[] not null default '{classique}',meal_type text,image_url text,image_license text,image_reuse_ok boolean not null default false,
 author text,source_url text unique,license_notes text,ingredients jsonb not null default '[]',steps jsonb not null default '[]',raw jsonb,
 status text not null default 'draft' check(status in('draft','published','withdrawn')),created_by uuid references auth.users,updated_at timestamptz not null default now(),
 constraint publish_ok check(status<>'published' or (jsonb_array_length(ingredients)>0 and jsonb_array_length(steps)>0 and (image_url is null or image_reuse_ok))));
alter table recipes enable row level security;
create policy "admin gère les recettes" on recipes for all using(is_admin()) with check(is_admin());
-- Vue publique : uniquement les recettes publiées, sans licence, brouillons ni métadonnées internes.
create view public_recipes as select id,title,description,servings,prep_min,cook_min,diet,modes,meal_type,image_url,author,source_url,ingredients,steps from recipes where status='published';
grant select on public_recipes to anon,authenticated;

create table stock(user_id uuid not null default auth.uid() references auth.users on delete cascade,ing_key text not null,qty numeric check(qty is null or qty>=0),unit text not null,priority boolean not null default false,updated_at timestamptz not null default now(),primary key(user_id,ing_key,unit));
create table plans(user_id uuid not null default auth.uid() references auth.users on delete cascade,week_start date not null,data jsonb not null,updated_at timestamptz not null default now(),primary key(user_id,week_start));
create table favorites(user_id uuid not null default auth.uid() references auth.users on delete cascade,recipe_id bigint not null references recipes on delete cascade,primary key(user_id,recipe_id));
-- Une consommation par session de cuisine : la clé primaire empêche la double déduction.
create table consumption_log(user_id uuid not null default auth.uid() references auth.users on delete cascade,session_id text not null,lines jsonb not null,created_at timestamptz not null default now(),primary key(user_id,session_id));
create table orders(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users,snapshot jsonb not null,
 status text not null default 'requested' check(status in('requested','quoted','confirmed','shopping','ready','done','refused','cancelled')),quote_total numeric,admin_note text,created_at timestamptz not null default now());
create table service_settings(key text primary key,value jsonb not null); -- zones, tarifs, créneaux, FAQ, contact
do $$declare t text;begin foreach t in array array['stock','plans','favorites','consumption_log'] loop
 execute format('alter table %I enable row level security',t);
 execute format('create policy "propriétaire" on %I for all using(user_id=auth.uid()) with check(user_id=auth.uid())',t);end loop;end$$;
alter table orders enable row level security;
create policy "voir ses commandes" on orders for select using(user_id=auth.uid() or is_admin());
create policy "créer sa demande" on orders for insert with check(user_id=auth.uid() and status='requested' and quote_total is null);
create policy "admin traite" on orders for update using(is_admin()) with check(is_admin());
alter table service_settings enable row level security;
create policy "lecture" on service_settings for select using(true);
create policy "admin écrit" on service_settings for all using(is_admin()) with check(is_admin());
