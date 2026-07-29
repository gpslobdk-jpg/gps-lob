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

comment on column public.bonus_questions.media_url is
  'Valgfrit billede fra kildeposten. Må kun sættes hvis URL er offentligt tilgængeligt.';

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

comment on column public.bonus_sessions.status is
  'active = spiller stadig. finished = afsluttet (finished_at er sat).';

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
