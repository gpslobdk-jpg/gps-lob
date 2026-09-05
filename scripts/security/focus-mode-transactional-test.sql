-- Execute ONLY inside one caller-owned BEGIN ... ROLLBACK transaction, directly
-- after the Focus Mode migration on a database where these sidecar tables did
-- not exist. No fixture ID is supplied or reused; all are generated here.
-- This file neither commits nor leaves synthetic data behind when rolled back.
do $$
declare
  v_teacher uuid := gen_random_uuid();
  v_run uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_other_session uuid := gen_random_uuid();
  v_closed_session uuid := gen_random_uuid();
  v_participant uuid := gen_random_uuid();
  v_other_participant uuid := gen_random_uuid();
  v_event uuid := gen_random_uuid();
  v_revision uuid;
  v_new_revision uuid;
  v_count integer;
  v_original_role text := current_user;
  v_denied boolean;
  v_role text;
begin
  -- Retention is deliberately scoped by proof that Focus Mode is newly empty.
  -- Refuse this test instead of touching pre-existing Focus Mode records.
  if exists (select 1 from public.focus_run_settings)
    or exists (select 1 from public.focus_session_settings)
    or exists (select 1 from public.focus_participant_state) then
    raise exception 'FOCUS_TEST_REQUIRES_NEW_EMPTY_SIDECAR_TABLES';
  end if;

  insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_teacher, 'authenticated', 'authenticated', 'focus-' || v_teacher || '@synthetic.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.gps_runs(id, user_id, title, subject, description, questions, race_type)
  values (v_run, v_teacher, 'Synthetic Focus rollback test', 'Test', 'Transactional synthetic test only', '[]'::jsonb, 'manuel');
  insert into public.live_sessions(id, run_id, teacher_id, pin, status, created_at)
  values
    (v_session, v_run, v_teacher, '999991', 'running', now() - interval '10 minutes'),
    (v_other_session, v_run, v_teacher, '999992', 'running', now() - interval '10 minutes');
  insert into public.live_sessions(id, run_id, teacher_id, pin, status, created_at, student_data_retention_anchor_at)
  values (v_closed_session, v_run, v_teacher, '999993', 'finished', now() - interval '3 days', now() - interval '2 days');
  insert into public.participants(id, session_id, student_name, created_at)
  values
    (v_participant, v_session, 'Synthetic focus participant', now() - interval '10 minutes'),
    (v_other_participant, v_other_session, 'Synthetic second participant', now() - interval '10 minutes');

  insert into public.focus_run_settings(run_id) values (v_run);
  if (select enabled from public.focus_run_settings where run_id = v_run) then raise exception 'default run must be off'; end if;
  insert into public.focus_session_settings(session_id) values (v_session) returning revision into v_revision;
  if (select enabled from public.focus_session_settings where session_id = v_session) then raise exception 'default session must be off'; end if;
  if public.record_focus_return(v_session,v_participant,v_event,now()-interval '50 seconds',now()-interval '40 seconds',v_revision,0) then raise exception 'off mode accepted'; end if;

  update public.focus_session_settings set enabled = true where session_id = v_session;
  if public.record_focus_return(v_session,v_other_participant,v_event,now()-interval '50 seconds',now()-interval '40 seconds',v_revision,0) then raise exception 'cross session accepted'; end if;
  if public.record_focus_return(v_session,v_participant,v_event,now()-interval '42 seconds',now()-interval '40 seconds',v_revision,0) then raise exception 'below grace accepted'; end if;
  if public.record_focus_return(v_session,v_participant,v_event,now()-interval '31 minutes',now(),v_revision,0) then raise exception 'long stale interval accepted'; end if;
  if public.record_focus_return(v_session,v_participant,v_event,now()-interval '100 seconds',now()-interval '80 seconds',v_revision,0) then raise exception 'old return accepted'; end if;
  if not public.record_focus_return(v_session,v_participant,v_event,now()-interval '50 seconds',now()-interval '40 seconds',v_revision,0) then raise exception 'valid return rejected'; end if;
  if public.record_focus_return(v_session,v_participant,v_event,now()-interval '50 seconds',now()-interval '40 seconds',v_revision,0) then raise exception 'duplicate accepted'; end if;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '55 seconds',now()-interval '45 seconds',v_revision,0) then raise exception 'out of order accepted'; end if;
  if (select event_count from public.focus_participant_state where participant_id = v_participant) <> 1 then raise exception 'invalid count'; end if;
  if (select latest_duration_ms from public.focus_participant_state where participant_id = v_participant) <> 10000 then raise exception 'invalid duration'; end if;

  if public.set_focus_participant_excluded(v_session,v_other_participant,true) then raise exception 'cross session override accepted'; end if;
  if not public.set_focus_participant_excluded(v_session,v_participant,true) then raise exception 'exclusion failed'; end if;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '30 seconds',now()-interval '20 seconds',v_revision,1) then raise exception 'excluded event accepted'; end if;
  if not public.set_focus_participant_excluded(v_session,v_participant,false) then raise exception 'restore failed'; end if;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '30 seconds',now()-interval '20 seconds',v_revision,0) then raise exception 'stale participant policy accepted'; end if;
  if not public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '30 seconds',now()-interval '20 seconds',v_revision,2) then raise exception 'restored policy rejected'; end if;

  update public.focus_session_settings set enabled = false, revision = gen_random_uuid() where session_id = v_session;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '10 seconds',now()-interval '5 seconds',v_revision,2) then raise exception 'disabled session accepted'; end if;
  update public.focus_session_settings set enabled = true, revision = gen_random_uuid() where session_id = v_session returning revision into v_new_revision;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '10 seconds',now()-interval '5 seconds',v_revision,2) then raise exception 'stale session policy accepted'; end if;
  update public.live_sessions set status = 'paused' where id = v_session;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '10 seconds',now()-interval '5 seconds',v_new_revision,2) then raise exception 'paused session accepted'; end if;
  update public.live_sessions set status = 'running' where id = v_session;
  update public.participants set finished_at = now() where id = v_participant;
  if public.record_focus_return(v_session,v_participant,gen_random_uuid(),now()-interval '10 seconds',now()-interval '5 seconds',v_new_revision,2) then raise exception 'finished participant accepted'; end if;

  -- Neither unauthenticated nor authenticated browser clients can read/write
  -- the sidecar or execute privileged routines, including the actual teacher.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_teacher,'role','authenticated')::text, true);
  foreach v_role in array array['anon','authenticated'] loop
    execute format('set local role %I', v_role);
    v_denied := false;
    begin perform 1 from public.focus_participant_state; exception when insufficient_privilege then v_denied := true; end;
    if not v_denied then raise exception 'browser focus read allowed'; end if;
    v_denied := false;
    begin update public.focus_session_settings set enabled = false where session_id = v_session; exception when insufficient_privilege then v_denied := true; end;
    if not v_denied then raise exception 'browser focus write allowed'; end if;
    v_denied := false;
    begin perform public.set_focus_participant_excluded(v_session,v_participant,true); exception when insufficient_privilege then v_denied := true; end;
    if not v_denied then raise exception 'browser focus RPC allowed'; end if;
    execute format('set local role %I', v_original_role);
  end loop;

  insert into public.focus_session_settings(session_id) values (v_closed_session);
  v_count := public.purge_expired_focus_data();
  if v_count <> 1 or exists (select 1 from public.focus_session_settings where session_id = v_closed_session) then raise exception 'ended session retention failed'; end if;
  update public.focus_session_settings set expires_at = now()-interval '1 second' where session_id = v_session;
  v_count := public.purge_expired_focus_data();
  if v_count <> 1 or exists (select 1 from public.focus_participant_state where participant_id = v_participant) then raise exception 'hard expiry cascade failed'; end if;
  if not exists (select 1 from public.participants where id = v_participant)
    or not exists (select 1 from public.live_sessions where id = v_session)
    or not exists (select 1 from public.gps_runs where id = v_run) then raise exception 'retention altered gameplay'; end if;
  if not exists (select 1 from cron.job where jobname = 'focus-mode-retention' and active) then raise exception 'retention schedule missing'; end if;
  raise notice 'PASS Focus Mode default, validation, idempotency, revision, override, pause/finish, client-role denial and retention';
end;
$$;
