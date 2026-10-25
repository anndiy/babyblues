-- BabyBlues screening questionnaire responses (PHQ-9 now; EPDS scoring is supported once licensed).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Answers are stored as the position of the chosen option (top = 0 ... bottom = 3) in printed order.
-- Totals are never stored; the backend recomputes them from the answers.

create table if not exists public.screening_responses (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  instrument text not null check (instrument in ('phq9', 'epds')),
  answers smallint[] not null,
  difficulty smallint check (difficulty between 0 and 3),
  created_at timestamptz not null default now(),
  constraint screening_answers_length check (
    (instrument = 'phq9' and array_length(answers, 1) = 9) or
    (instrument = 'epds' and array_length(answers, 1) = 10)
  ),
  constraint screening_answers_range check (answers <@ array[0, 1, 2, 3]::smallint[])
);

create index if not exists screening_responses_parent_created_idx
  on public.screening_responses (parent_id, created_at desc);

alter table public.screening_responses enable row level security;

drop policy if exists "Users can view their own screening responses" on public.screening_responses;
create policy "Users can view their own screening responses"
  on public.screening_responses for select to authenticated
  using (auth.uid() = parent_id);

drop policy if exists "Users can add their own screening responses" on public.screening_responses;
create policy "Users can add their own screening responses"
  on public.screening_responses for insert to authenticated
  with check (auth.uid() = parent_id);

-- Users can delete their own responses (privacy). There is deliberately no update policy.
drop policy if exists "Users can delete their own screening responses" on public.screening_responses;
create policy "Users can delete their own screening responses"
  on public.screening_responses for delete to authenticated
  using (auth.uid() = parent_id);

grant select, insert, delete on public.screening_responses to authenticated;
