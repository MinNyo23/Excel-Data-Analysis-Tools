create table if not exists public.admin_auth_settings (
  setting_key text primary key,
  allowed_email_domain text not null default 'gmail.com',
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_auth_settings enable row level security;

revoke all on table public.admin_auth_settings from anon, authenticated;

comment on table public.admin_auth_settings is
  'Master Account configuration for the email domain permitted to use passwordless sign-in.';

insert into public.admin_auth_settings (setting_key, allowed_email_domain, updated_by)
select 'email_domain', 'gmail.com', id
from auth.users
where lower(coalesce(email, '')) = 'minnyo.work@gmail.com'
limit 1
on conflict (setting_key) do nothing;
