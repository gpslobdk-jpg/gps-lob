# Pilen fortæller – teknisk fundament

## Afgrænsning i denne fase

Fundamentet indfører en ny postvariant i det eksisterende manuelle lærerflow og standard-elevflow. Varianten hedder `character`, mens den underliggende spørgsmålstype fortsat er `multiple_choice`, så eksisterende løb forbliver bagudkompatible.

Der er bevidst ingen adgang til mikrofonen, ingen realtidsforbindelse og ingen AI-udbyder i denne fase. Prototypen simulerer kun start, nedtælling, stop og autoritativ afslutning af posten.

Zone-Krig og Stratego er ikke omfattet.

## Datamodel og eksisterende arkitektur

Konfigurationen gemmes sammen med løbets øvrige poster i `gps_runs.questions`:

- `postType: "character"`
- `characterConfig.character: "pilen"`
- `characterConfig.language: "en"`
- emne, klassetrin, semantisk stedbeskrivelse og maksimal varighed

Det kræver ingen databasemigration. Gamle poster uden `postType` fortolkes fortsat som quizposter. Eleven bruger fortsat den eksisterende join-, GPS-, sessions- og progressionsarkitektur. En karakterpost giver nul point og bliver afsluttet gennem den eksisterende idempotente `submit-answer`-rute.

Afslutningspayloaden består kun af tekniske progressionsmetadata. Serveren bygger payloaden på ny fra en streng allowlist, så lyd, transskription, spørgsmål, svar, samtalehistorik og position ikke kan blive gemt i `answers`.

## Privatlivskontrakt

- Samtaleindhold må ikke sendes til Supabase, lokal lagring, analytics, logs, Sentry eller andre telemetrisystemer.
- Rå GPS-koordinater må ikke indgå i en fremtidig samtalekontekst. Kun lærerens semantiske stedbeskrivelse må bruges.
- Der må ikke oprettes lydfiler eller anvendes `MediaRecorder` i realtidsflowet.
- Samtalens indhold må kun eksistere flygtigt i browserens mediestrøm og hos den valgte realtidsudbyder i den aktive session.
- Observability skal være allowlist-baseret og må kun indeholde fejlklasse, fase, varighed og ikke-identificerende tekniske statuskoder.
- Session Replay skal fortsat være deaktiveret i elevflowet.

## Realtime-fasen

Den efterfølgende realtime-implementering følger dette fundament med OpenAI
Realtime over WebRTC, servervalidering, default-off feature flags og fail-closed
EU/ZDR-/under-18-gates. Den aktuelle arkitektur, miljøkontrakt, dataminimering,
tests og releasecheckliste står i `docs/pilen-fortaeller-realtime.md`.
