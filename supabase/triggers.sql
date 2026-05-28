-- Assicura che la tabella profiles esista
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  terms_accepted_at timestamptz,
  welcome_email_sent_at timestamptz,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

-- Abilita RLS
alter table public.profiles enable row level security;

-- Policy: I profili sono visibili a tutti (o restringi come preferisci)
create policy "Public profiles are viewable by everyone." on profiles for
select using (true);

-- Policy: L'utente può aggiornare il proprio profilo
create policy "Users can update own profile." on profiles for
update using (auth.uid () = id);

-- Funzione che gestisce la creazione del profilo.
-- COALESCE legge sia le chiavi standard Supabase (full_name/avatar_url) sia
-- quelle Google OAuth (name/picture). terms_accepted_at viene letto se
-- signUpAction lo passa via options.data.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, terms_accepted_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    case
      when new.raw_user_meta_data->>'terms_accepted_at' is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      else null
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger che attiva la funzione dopo l'inserimento in auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Sincronizza profiles.email quando auth.users.email viene aggiornata
-- (es. tramite il flusso email_change di Supabase).
create or replace function public.handle_user_email_change()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_change();
