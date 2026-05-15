create table public.quick_send_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  content text not null default '',
  parse_mode text not null default 'HTML',
  image_path text,
  image_mime text,
  image_ext text,
  default_room_id uuid,
  default_account_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quick_send_templates enable row level security;

create policy qst_select_own on public.quick_send_templates for select using (auth.uid() = user_id);
create policy qst_insert_own on public.quick_send_templates for insert with check (auth.uid() = user_id);
create policy qst_update_own on public.quick_send_templates for update using (auth.uid() = user_id);
create policy qst_delete_own on public.quick_send_templates for delete using (auth.uid() = user_id);

create trigger quick_send_templates_touch
  before update on public.quick_send_templates
  for each row execute function public.touch_updated_at();

create index quick_send_templates_user_idx on public.quick_send_templates(user_id, sort_order);