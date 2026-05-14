
-- ============ Catalog (public read) ============
create table public.engagement_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_brl numeric(10,2) not null,
  monthly_reactions_quota integer not null default 0,
  monthly_members_quota integer not null default 0,
  kirvano_checkout_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.engagement_plans enable row level security;

create policy ep_select_all on public.engagement_plans for select using (true);

create trigger trg_engagement_plans_updated
before update on public.engagement_plans
for each row execute function public.touch_updated_at();

-- ============ Subscriptions ============
create type public.engagement_sub_status as enum ('pending', 'active', 'canceled', 'expired');

create table public.user_engagement_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.engagement_plans(id) on delete restrict,
  status public.engagement_sub_status not null default 'pending',
  reactions_used integer not null default 0,
  members_used integer not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  kirvano_sale_id text,
  kirvano_customer_email text,
  last_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ues_user on public.user_engagement_subscriptions(user_id);
create index idx_ues_status on public.user_engagement_subscriptions(status);

alter table public.user_engagement_subscriptions enable row level security;

create policy ues_select_own on public.user_engagement_subscriptions
  for select using (auth.uid() = user_id);

create trigger trg_ues_updated
before update on public.user_engagement_subscriptions
for each row execute function public.touch_updated_at();

-- ============ Per-room settings ============
create table public.room_engagement_settings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique,
  user_id uuid not null,
  auto_react_enabled boolean not null default false,
  reactions_per_signal integer not null default 30,
  react_emojis text[] not null default array['👍','❤️','🔥']::text[],
  delay_seconds_min integer not null default 5,
  delay_seconds_max integer not null default 60,
  auto_members_enabled boolean not null default false,
  members_per_day integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_engagement_settings enable row level security;

create policy res_select_own on public.room_engagement_settings
  for select using (auth.uid() = user_id);
create policy res_insert_own on public.room_engagement_settings
  for insert with check (auth.uid() = user_id);
create policy res_update_own on public.room_engagement_settings
  for update using (auth.uid() = user_id);
create policy res_delete_own on public.room_engagement_settings
  for delete using (auth.uid() = user_id);

create trigger trg_res_updated
before update on public.room_engagement_settings
for each row execute function public.touch_updated_at();

-- ============ Orders (SMM panel dispatches) ============
create type public.engagement_order_type as enum ('reaction', 'members');
create type public.engagement_order_status as enum ('pending', 'in_progress', 'completed', 'partial', 'canceled', 'failed');

create table public.engagement_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid,
  subscription_id uuid references public.user_engagement_subscriptions(id) on delete set null,
  type public.engagement_order_type not null,
  target text not null,
  quantity integer not null,
  smm_order_id text,
  smm_service_id integer,
  status public.engagement_order_status not null default 'pending',
  cost_usd numeric(10,4),
  raw_response jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_eo_user on public.engagement_orders(user_id);
create index idx_eo_status on public.engagement_orders(status);
create index idx_eo_smm on public.engagement_orders(smm_order_id);

alter table public.engagement_orders enable row level security;

create policy eo_select_own on public.engagement_orders
  for select using (auth.uid() = user_id);

create trigger trg_eo_updated
before update on public.engagement_orders
for each row execute function public.touch_updated_at();

-- ============ Seed default plans ============
insert into public.engagement_plans (slug, name, description, price_brl, monthly_reactions_quota, monthly_members_quota, sort_order)
values
  ('starter', 'Starter', 'Ideal para começar e testar o engajamento bot', 49.00, 3000, 300, 1),
  ('pro', 'Pro', 'Para canais em crescimento que precisam de volume', 149.00, 15000, 1500, 2),
  ('vip', 'VIP', 'Máximo engajamento e prioridade no atendimento', 399.00, 50000, 5000, 3);
