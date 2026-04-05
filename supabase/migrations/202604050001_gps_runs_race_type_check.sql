begin;

update public.gps_runs
set race_type = case lower(btrim(coalesce(race_type, '')))
  when 'quiz' then 'manuel'
  when 'generel quiz' then 'manuel'
  when 'manuel' then 'manuel'
  when 'manual' then 'manuel'
  when 'dansk' then 'dansk'
  when 'danish' then 'dansk'
  when 'engelsk' then 'engelsk'
  when 'english' then 'engelsk'
  when 'matematik' then 'matematik'
  when 'math' then 'matematik'
  when 'foto' then 'foto'
  when 'photo' then 'foto'
  when 'scanner' then 'scanner'
  when 'scan' then 'scanner'
  when 'bog-scanner' then 'scanner'
  when 'bog scanner' then 'scanner'
  when 'bog-scanneren' then 'scanner'
  when 'bog scanneren' then 'scanner'
  when 'bogscanner' then 'scanner'
  when 'bookscanner' then 'scanner'
  when 'qr' then 'scanner'
  when 'qrscanner' then 'scanner'
  when 'selfie' then 'selfie'
  when 'escape' then 'escape'
  when 'escape_room' then 'escape'
  when 'escaperoom' then 'escape'
  when 'rollespil' then 'rollespil'
  when 'roleplay' then 'rollespil'
  when 'role_play' then 'rollespil'
  when 'tidsmaskinen' then 'rollespil'
  when 'podcast' then 'podcast'
  when 'stratego' then 'stratego'
  when 'live_stratego' then 'stratego'
  when 'live-stratego' then 'stratego'
  when 'live stratego' then 'stratego'
  when 'zone_krig' then 'zone_krig'
  when 'zone-krig' then 'zone_krig'
  when 'zone-krigen' then 'zone_krig'
  when 'zone krigen' then 'zone_krig'
  when 'zonekrig' then 'zone_krig'
  else 'manuel'
end;

alter table public.gps_runs
  drop constraint if exists gps_runs_race_type_check;

alter table public.gps_runs
  add constraint gps_runs_race_type_check
  check (
    race_type in (
      'manuel',
      'dansk',
      'engelsk',
      'matematik',
      'foto',
      'scanner',
      'selfie',
      'escape',
      'rollespil',
      'podcast',
      'zone_krig',
      'stratego'
    )
  );

commit;
