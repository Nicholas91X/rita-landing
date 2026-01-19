-- Assicura che la tabella profiles esista
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
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

-- Funzione che gestisce la creazione del profilo
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger che attiva la funzione dopo l'inserimento in auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();