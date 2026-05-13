
-- Extensions
create extension if not exists pgcrypto;

-- =================== ENUMS ===================
create type public.app_role as enum ('admin', 'user');
create type public.message_status as enum ('pending', 'sending', 'sent', 'failed', 'cancelled');
create type public.account_status as enum ('unknown', 'ok', 'error');

-- =================== PROFILES ===================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  credits integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

-- =================== USER ROLES ===================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- =================== TELEGRAM ACCOUNTS ===================
create table public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  bot_token text not null,
  bot_username text,
  bot_first_name text,
  status account_status not null default 'unknown',
  last_check_at timestamptz,
  last_error text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_accounts enable row level security;

create policy "ta_select_own" on public.telegram_accounts for select using (auth.uid() = user_id);
create policy "ta_insert_own" on public.telegram_accounts for insert with check (auth.uid() = user_id);
create policy "ta_update_own" on public.telegram_accounts for update using (auth.uid() = user_id);
create policy "ta_delete_own" on public.telegram_accounts for delete using (auth.uid() = user_id);

-- =================== TELEGRAM CHATS (cache) ===================
create table public.telegram_chats (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.telegram_accounts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  chat_id bigint not null,
  title text,
  type text,
  username text,
  cached_at timestamptz not null default now(),
  unique (account_id, chat_id)
);

alter table public.telegram_chats enable row level security;

create policy "tc_select_own" on public.telegram_chats for select using (auth.uid() = user_id);
create policy "tc_insert_own" on public.telegram_chats for insert with check (auth.uid() = user_id);
create policy "tc_update_own" on public.telegram_chats for update using (auth.uid() = user_id);
create policy "tc_delete_own" on public.telegram_chats for delete using (auth.uid() = user_id);

-- =================== PREMIUM EMOJIS ===================
create table public.premium_emojis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  custom_emoji_id text not null,
  preview_char text,
  created_at timestamptz not null default now()
);

alter table public.premium_emojis enable row level security;

create policy "pe_select_own" on public.premium_emojis for select using (auth.uid() = user_id);
create policy "pe_insert_own" on public.premium_emojis for insert with check (auth.uid() = user_id);
create policy "pe_update_own" on public.premium_emojis for update using (auth.uid() = user_id);
create policy "pe_delete_own" on public.premium_emojis for delete using (auth.uid() = user_id);

-- =================== ROOMS ===================
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  default_account_id uuid references public.telegram_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "rooms_select_own" on public.rooms for select using (auth.uid() = user_id);
create policy "rooms_insert_own" on public.rooms for insert with check (auth.uid() = user_id);
create policy "rooms_update_own" on public.rooms for update using (auth.uid() = user_id);
create policy "rooms_delete_own" on public.rooms for delete using (auth.uid() = user_id);

create table public.room_chats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  chat_id bigint not null,
  chat_title text,
  unique (room_id, chat_id)
);

alter table public.room_chats enable row level security;

create policy "rc_select_own" on public.room_chats for select using (auth.uid() = user_id);
create policy "rc_insert_own" on public.room_chats for insert with check (auth.uid() = user_id);
create policy "rc_update_own" on public.room_chats for update using (auth.uid() = user_id);
create policy "rc_delete_own" on public.room_chats for delete using (auth.uid() = user_id);

-- =================== SCHEDULED MESSAGES ===================
create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  room_id uuid references public.rooms(id) on delete cascade not null,
  account_id uuid references public.telegram_accounts(id) on delete set null,
  content text not null,
  parse_mode text not null default 'HTML',
  scheduled_at timestamptz not null,
  status message_status not null default 'pending',
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.scheduled_messages enable row level security;

create policy "sm_select_own" on public.scheduled_messages for select using (auth.uid() = user_id);
create policy "sm_insert_own" on public.scheduled_messages for insert with check (auth.uid() = user_id);
create policy "sm_update_own" on public.scheduled_messages for update using (auth.uid() = user_id);
create policy "sm_delete_own" on public.scheduled_messages for delete using (auth.uid() = user_id);

create index idx_sm_due on public.scheduled_messages (status, scheduled_at);

-- =================== MESSAGE LOGS ===================
create table public.message_logs (
  id uuid primary key default gen_random_uuid(),
  scheduled_message_id uuid references public.scheduled_messages(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  chat_id bigint not null,
  ok boolean not null,
  telegram_message_id bigint,
  error text,
  created_at timestamptz not null default now()
);

alter table public.message_logs enable row level security;

create policy "ml_select_own" on public.message_logs for select using (auth.uid() = user_id);

-- =================== CREDIT TRANSACTIONS ===================
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

create policy "ct_select_own" on public.credit_transactions for select using (auth.uid() = user_id);

-- =================== TRIGGERS ===================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger ta_touch before update on public.telegram_accounts
  for each row execute function public.touch_updated_at();
