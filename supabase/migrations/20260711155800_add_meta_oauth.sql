-- Create table for connected Meta (Facebook) users
create table if not exists public.meta_connected_users (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    fb_user_id text not null,
    fb_name text not null,
    access_token text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, fb_user_id)
);

-- Add RLS policies for meta_connected_users
alter table public.meta_connected_users enable row level security;

create policy "Users can view own meta connections" 
on public.meta_connected_users for select 
to authenticated 
using (auth.uid() = user_id);

create policy "Users can insert own meta connections" 
on public.meta_connected_users for insert 
to authenticated 
with check (auth.uid() = user_id);

create policy "Users can update own meta connections" 
on public.meta_connected_users for update 
to authenticated 
using (auth.uid() = user_id);

create policy "Users can delete own meta connections" 
on public.meta_connected_users for delete 
to authenticated 
using (auth.uid() = user_id);

-- Create trigger for updated_at
create trigger handle_updated_at before update on public.meta_connected_users
  for each row execute procedure moddatetime (updated_at);

-- Add meta_ad_account_id to tracking_pixels
alter table public.tracking_pixels 
add column if not exists meta_ad_account_id text;
