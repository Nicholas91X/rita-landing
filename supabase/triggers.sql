-- Bootstrap seed per profiles + trigger di auth.users.
-- Per deployment esistenti la source-of-truth sono le migrazioni dated
-- (supabase/YYYYMMDD_NN_*.sql). Questo file ricostruisce lo schema da zero.

-- Enum account_type
do $$
begin
    if not exists (select 1 from pg_type where typname = 'account_type') then
        create type account_type as enum ('lead', 'standard');
    end if;
end $$;

-- Tabella profiles con tutte le colonne attuali
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  terms_accepted_at timestamptz,
  welcome_email_sent_at timestamptz,
  account_type account_type not null default 'standard',
  lead_expires_at timestamptz,
  upgraded_from_lead_at timestamptz,
  lead_source text,
  marketing_consent_at timestamptz,
  lead_reminder_t10_sent_at timestamptz,
  lead_reminder_t20_sent_at timestamptz,
  completion_modal_shown_at timestamptz,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

-- Indici (idempotenti)
create index if not exists idx_profiles_lead_expires_at
    on public.profiles(lead_expires_at)
    where account_type = 'lead';

create index if not exists idx_profiles_upgraded_from_lead_at
    on public.profiles(upgraded_from_lead_at)
    where upgraded_from_lead_at is not null;

create index if not exists idx_profiles_account_type
    on public.profiles(account_type);

-- RLS
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles for
select using (true);

create policy "Users can update own profile." on profiles for
update using (auth.uid () = id);

-- Funzione handle_new_user. COALESCE legge sia chiavi standard Supabase
-- (full_name/avatar_url) sia quelle Google OAuth (name/picture).
-- account_type, lead_source e marketing_consent_at vengono forwarded da
-- requestLeadMagicLink tramite raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, email, full_name, avatar_url,
    terms_accepted_at, account_type, lead_source, marketing_consent_at
  )
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
    end,
    coalesce(
      (new.raw_user_meta_data->>'account_type')::account_type,
      'standard'
    ),
    new.raw_user_meta_data->>'lead_source',
    case
      when new.raw_user_meta_data->>'marketing_consent_at' is not null
        then (new.raw_user_meta_data->>'marketing_consent_at')::timestamptz
      else null
    end
  );
  return new;
end;
$$ language plpgsql security definer;

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
