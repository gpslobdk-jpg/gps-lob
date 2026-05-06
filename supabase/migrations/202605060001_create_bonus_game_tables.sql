begin;

-- ============================================================================
-- Bonus-spil: Isolerede tabeller til auto-genereret bonusquiz
--
-- Disse tabeller er FULDSTÆNDIGT ADSKILT fra det normale løbeflow:
--   - Ingen FK til public.participants
--   - Ingen FK til public.answers
--   - bonus_sessions.score påvirker IKKE deltagernes normale resultater
--   - bonus_answers skriver ALDRIG til answers-tabellen
--
-- Al adgang sker via createAdminClient() i API-routes (service_role).
-- Service_role bypasser RLS i Supabase — RLS her er ren defense-in-depth.
--
-- Migrationsordre:
--   1. bonus_questions  — genererede spørgsmål, tilknyttet gps_run
--   2. bonus_sessions   — én session pr. elev pr. live_session
--   3. bonus_answers    — ét svar pr. spørgsmål pr. session
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. bonus_questions
--
-- Gemmer auto-genererede bonusspørgsmål for et givet gps_run.
-- Genereres én gang pr. løb og deles af alle live_sessions for det løb.
-- correct_index eksponeres ALDRIG til klienten — kun via service_role i API.
-- ----------------------------------------------------------------------------

create table if not exists public.bonus_questions (
  id               uuid        primary key default gen_random_uuid(),
  gps_run_id       uuid        not null
                               references public.gps_runs(id)
                               on delete cascade,
  question_index   integer     not null,           -- 1-baseret rækkefølge, 1..15
  source_post_index integer,                       -- kildepostens index i gps_run (0-baseret), til debug
  variant          text        not null default 'recall_direct',
  question_text    text        not null,
  answers          jsonb       not null,            -- ["A","B","C","D"] — præcis 4 elementer
  correct_index    integer     not null,            -- 0-3 (sendes ALDRIG til klienten)
  points           integer     not null default 10,
  media_url        text,                            -- valgfrit: billede fra kildeposten
  created_at       timestamptz not null default now(),

  constraint bonus_questions_run_order_unique
    unique (gps_run_id, question_index),

  constraint bonus_questions_correct_index_check
    check (correct_index between 0 and 3),

  constraint bonus_questions_points_check
    check (points > 0),

  constraint bonus_questions_question_index_check
    check (question_index between 1 and 15),

  constraint bonus_questions_variant_check
    check (variant in ('recall_direct', 'recall_post')),

  constraint bonus_questions_answers_array_check
    check (jsonb_typeof(answers) = 'array'),

  -- Kritisk: præcis 4 svarmuligheder — ikke 2, 3 eller 5
  constraint bonus_questions_answers_length_check
    check (jsonb_array_length(answers) = 4),

  constraint bonus_questions_question_text_not_empty
    check (trim(question_text) <> '')
);

comment on table public.bonus_questions is
  'Auto-genererede bonusspørgsmål baseret på gps_run-poster. '
  'Genereres én gang pr. gps_run og deles af alle live_sessions for det løb. '
  'correct_index sendes ALDRIG til klienten — kun læst i API med service_role.';

comment on column public.bonus_questions.gps_run_id is
  'FK til gps_runs. Bonusspørgsmål er knyttet til løbet, ikke til en specifik live_session.';

comment on column public.bonus_questions.question_index is
  '1-baseret rækkefølge-indeks. Max 15.';

comment on column public.bonus_questions.source_post_index is
  '0-baseret index for kildeposten i gps_runs.questions. Bruges til debug/audit.';

comment on column public.bonus_questions.variant is
  'recall_direct = genbrug af originalt GPS-spørgsmål. '
  'recall_post = reformuleret som "Hvad var svaret ved post X?".';

comment on column public.bonus_questions.answers is
  'JSON-array med præcis 4 svarmuligheder (shufflet fra kildepostens svar). '
  'Rækkefølgen er fastfrosset ved generering — alle elever ser samme ordre.';

comment on column public.bonus_questions.correct_index is
  'Korrekt svar-index (0-3). MÅ ALDRIG eksponeres i API-responses til klienten.';

comment on column public.bonus_questions.media_url is
  'Valgfrit billede fra kildeposten. Må kun sættes hvis URL er offentligt tilgængeligt.';

-- Indexes til bonus_questions
create index if not exists bonus_questions_gps_run_id_idx
  on public.bonus_questions (gps_run_id);

create index if not exists bonus_questions_gps_run_order_idx
  on public.bonus_questions (gps_run_id, question_index);


-- ----------------------------------------------------------------------------
-- 2. bonus_sessions
--
-- Én bonus-session pr. elev pr. live_session.
-- INGEN FK til public.participants — eleven identificeres kun med
-- (live_session_id, student_name), præcis som i det normale join-flow.
-- score her påvirker IKKE den normale løbsscore.
-- ----------------------------------------------------------------------------

create table if not exists public.bonus_sessions (
  id               uuid        primary key default gen_random_uuid(),
  live_session_id  uuid        not null
                               references public.live_sessions(id)
                               on delete cascade,
  gps_run_id       uuid        not null
                               references public.gps_runs(id)
                               on delete cascade,
  student_name     text        not null,
  -- participant_id: nullable, ingen FK, til fremtidig brug hvis vi vil koble til participants
  -- uden at bryde isolation. Brugt til: disambiguation ved identiske navne (ikke MVP).
  -- Sættes til null i MVP — API ignorerer feltet indtil videre.
  participant_id   uuid,
  current_index    integer     not null default 0,   -- sidst besvaret question_index (0 = intet besvaret)
  score            integer     not null default 0,   -- bonus-score; rører ALDRIG normal score
  total_questions  integer     not null default 0,   -- sættes ved session-start fra bonus_questions count
  status           text        not null default 'active',
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,                      -- null = stadig i gang

  constraint bonus_sessions_live_session_student_unique
    unique (live_session_id, student_name),

  -- Livscyklus: (active ↔ null finished_at) eller (finished ↔ not-null finished_at)
  -- Bidirektionel: forhindrer status='finished' med finished_at=null og omvendt
  constraint bonus_sessions_lifecycle_check
    check (
      (status = 'active'   and finished_at is null    ) or
      (status = 'finished' and finished_at is not null)
    ),

  constraint bonus_sessions_score_check
    check (score >= 0),

  -- current_index: 0 = intet besvaret, 1..15 = sidst besvaret question_index
  constraint bonus_sessions_current_index_check
    check (current_index between 0 and 15),

  constraint bonus_sessions_total_questions_check
    check (total_questions between 0 and 15),

  -- Navne-kollision: samme risiko som i det normale flow (answers bruger session_id+student_name).
  -- participant_id-kolonnen er reserveret til fremtidig disambiguation uden ny migration.
  constraint bonus_sessions_student_name_not_empty
    check (trim(student_name) <> '')
);

comment on table public.bonus_sessions is
  'Én bonus-session pr. elev pr. live_session. '
  'INGEN FK til participants eller answers — bonus er fuldstændigt isoleret. '
  'score er bonus-score og har INGEN indvirkning på normal løbs-score eller placering.';

comment on column public.bonus_sessions.live_session_id is
  'FK til live_sessions. Cascades ved sletning af session.';

comment on column public.bonus_sessions.gps_run_id is
  'FK til gps_runs. Genvej til løbets data uden join via live_sessions.';

comment on column public.bonus_sessions.student_name is
  'Elevens navn præcis som angivet i det normale join-flow. '
  'Unikt pr. (live_session_id, student_name) — én bonus-session pr. elev pr. session. '
  'Navne-kollision: samme risiko som i public.answers (session_id, student_name, question_index). '
  'Fremtidig disambiguation sker via participant_id-kolonnen uden ny migration.';

comment on column public.bonus_sessions.participant_id is
  'Nullable UUID til fremtidig brug — ingen FK, ingen constraint i MVP. '
  'Reserveret til at koble bonus-session til en specifik participant ved navne-kollision. '
  'Sættes til null af API i MVP. Brug kræver eksplicit fremtidig migration/kode.';

comment on column public.bonus_sessions.current_index is
  'Det sidst besvarede question_index (0 = intet besvaret endnu). '
  'Bruges til at genoptage bonus-session efter refresh.';

comment on column public.bonus_sessions.score is
  'Samlet bonus-score for denne session. '
  'Rører ALDRIG gps_runs, participants eller answers.';

comment on column public.bonus_sessions.status is
  'active = spiller stadig. finished = afsluttet (finished_at er sat).';

-- Indexes til bonus_sessions
create index if not exists bonus_sessions_live_session_id_idx
  on public.bonus_sessions (live_session_id);

create index if not exists bonus_sessions_live_session_score_idx
  on public.bonus_sessions (live_session_id, score desc);

create index if not exists bonus_sessions_gps_run_id_idx
  on public.bonus_sessions (gps_run_id);


-- ----------------------------------------------------------------------------
-- 3. bonus_answers
--
-- Ét svar pr. bonusspørgsmål pr. bonus-session.
-- Atomic unique constraint forhindrer dobbelt-besvarelse.
-- INGEN FK til public.answers-tabellen.
-- ----------------------------------------------------------------------------

create table if not exists public.bonus_answers (
  id                uuid        primary key default gen_random_uuid(),
  bonus_session_id  uuid        not null
                                references public.bonus_sessions(id)
                                on delete cascade,
  question_id       uuid        not null
                                references public.bonus_questions(id)
                                on delete cascade,
  question_index    integer     not null,           -- kopieret fra bonus_questions.question_index
  selected_index    integer,                        -- null = spring over / timeout
  is_correct        boolean     not null default false,
  points_awarded    integer     not null default 0,
  answered_at       timestamptz not null default now(),

  -- Atomisk lås: præcis ét svar pr. spørgsmål pr. session
  constraint bonus_answers_session_question_unique
    unique (bonus_session_id, question_index),

  constraint bonus_answers_selected_index_check
    check (selected_index is null or selected_index between 0 and 3),

  constraint bonus_answers_points_awarded_check
    check (points_awarded >= 0)
);

comment on table public.bonus_answers is
  'Elevsvar i bonus-quizzen. '
  'INGEN FK til public.answers — bonus er fuldstændigt isoleret fra normale løbsresultater. '
  'Unique constraint på (bonus_session_id, question_index) forhindrer double-submit.';

comment on column public.bonus_answers.bonus_session_id is
  'FK til bonus_sessions. Cascades ved sletning.';

comment on column public.bonus_answers.question_id is
  'FK til bonus_questions. Cascades ved sletning.';

comment on column public.bonus_answers.question_index is
  'Kopieret fra bonus_questions.question_index for hurtig opslag uden join.';

comment on column public.bonus_answers.selected_index is
  'Elevens valg (0-3). null = eleven sprang over (ingen tidsbegrænsning i MVP, '
  'men nul-spring er beholdt til fremtidig timeout-support).';

comment on column public.bonus_answers.is_correct is
  'Beregnet server-side ved sammenligning med bonus_questions.correct_index.';

comment on column public.bonus_answers.points_awarded is
  'Point tildelt for dette svar. 0 ved forkert svar eller spring-over.';

-- Indexes til bonus_answers
create index if not exists bonus_answers_bonus_session_id_idx
  on public.bonus_answers (bonus_session_id);

create index if not exists bonus_answers_session_question_idx
  on public.bonus_answers (bonus_session_id, question_index);


-- ----------------------------------------------------------------------------
-- 4. Feature-flag på gps_runs
--
-- Tilføjer bonus_enabled til gps_runs.
-- default false — ingen løb har bonus aktivt medmindre det eksplicit sættes.
-- Alle eksisterende løb er uberørte.
-- ----------------------------------------------------------------------------

alter table public.gps_runs
  add column if not exists bonus_enabled boolean not null default false;

comment on column public.gps_runs.bonus_enabled is
  'Feature-flag for bonusspil. false (default) = ingen bonus-CTA vises for elever. '
  'Sættes manuelt af administrator via SQL eller fremtidig dashboard-UI.';


-- ----------------------------------------------------------------------------
-- 5. Row Level Security
--
-- ALLE bonus-tabeller er service_role-only.
-- Service_role bypasser RLS i Supabase — disse regler forhindrer
-- DIREKTE browser-adgang fra anon/authenticated Supabase-klienter.
--
-- Mønster: identisk med public.stratego_games, public.stratego_players osv.
-- (supabase/migrations/202604010001_stratego_schema.sql)
-- ----------------------------------------------------------------------------

alter table public.bonus_questions enable row level security;
alter table public.bonus_sessions   enable row level security;
alter table public.bonus_answers    enable row level security;

-- Fratag alle rettigheder fra anon og authenticated
-- (service_role har altid fuld adgang og bypasser RLS)
revoke all on public.bonus_questions from anon, authenticated;
revoke all on public.bonus_sessions   from anon, authenticated;
revoke all on public.bonus_answers    from anon, authenticated;

-- Ingen SELECT-, INSERT-, UPDATE- eller DELETE-policies for anon/authenticated.
-- Al adgang sker via createAdminClient() (service_role) i API-routes.
-- Dette er den sikreste tilgang og forhindrer bl.a.:
--   - Direkte læsning af correct_index fra browser
--   - Direkte manipulation af bonus-scores
--   - Cross-session svar-indsendelse via browser


commit;
