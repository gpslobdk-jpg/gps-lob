begin;

-- Udvid gps_runs_race_type_check constrainten med 'musikquiz'.
-- Ingen nye tabeller eller kolonner — kun constraint-opdatering.

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
      'stratego',
      'musikquiz'
    )
  );

commit;
