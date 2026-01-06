-- Create admins table
create table if not exists admins (
    user_id uuid references auth.users (id) primary key
);

-- Policy to allow anyone to read (so we can check is_admin in client/server)
-- Or better, restrict to service_role and use a secure function provided by backend?
-- For simplicity, let's allow authenticated read for now, so client can hide/show elements.
alter table admins enable row level security;

create policy "Enable read access for all authenticated users" on admins for
select to authenticated using (true);

-- Insert your user info (Replace with actual UUID if known, or run manually)
-- insert into admins (user_id) values ('your-uuid-here');