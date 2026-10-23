-- BabyBlues AI-sharing consent table.
-- This migration is self-contained: it creates the preference table because AI consent
-- has not been added to the current app/schema yet. Existing users are opted out by default.

create table if not exists public.wellbeing_analysis_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.wellbeing_analysis_preferences enable row level security;

drop policy if exists "Users can view their own AI analysis preference"
  on public.wellbeing_analysis_preferences;
create policy "Users can view their own AI analysis preference"
  on public.wellbeing_analysis_preferences
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own AI analysis preference"
  on public.wellbeing_analysis_preferences;
create policy "Users can insert their own AI analysis preference"
  on public.wellbeing_analysis_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own AI analysis preference"
  on public.wellbeing_analysis_preferences;
create policy "Users can update their own AI analysis preference"
  on public.wellbeing_analysis_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.wellbeing_analysis_preferences to authenticated;
