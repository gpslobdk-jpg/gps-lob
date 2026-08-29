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

## Anbefalet realtidsarkitektur til næste fase

1. Eleven trykker aktivt på mikrofonknappen. Først derefter kaldes `getUserMedia`. Afvisning eller manglende understøttelse giver en rolig fejltilstand og blokerer ikke resten af løbet.
2. Browseren beder en ny serverrute om en engangs-session. Serveren validerer deltageridentitet, live-session, aktuel post, GPS-oplåsning og den allowlistede karakterkonfiguration.
3. Serveren udsteder meget kortlivede, postbundne legitimationsoplysninger til en WebRTC-session. En leverandørnøgle må aldrig sendes til browseren.
4. Browseren forbinder lyd direkte via WebRTC. Undgå optagelse, blob-opbygning og proxying af lyd gennem applikationsserveren. Kontrolhændelser kan sendes over data channel, men ikke samtaletekst.
5. Instruktionen bygges server-side af faste sikkerhedsregler plus de allowlistede felter: Pilen, engelsk, emne, klassetrin, semantisk sted og højst 60–90 sekunder. Lærer eller elev skal ikke kunne indsætte en skjult systemprompt.
6. Både serverens session-TTL og klientens timer håndhæver maksimumtiden. Stop, timeout, navigation, baggrundstilstand og unmount skal alle lukke peer connection, stoppe alle media tracks, nulstille flygtig state og ugyldiggøre sessionen.
7. Samtalen skal instrueres til at holde eleven på stedet, ikke bede eleven gå, krydse vej eller følge nye ruter og ikke indsamle navn eller andre personoplysninger. Usikre eller uklare situationer skal fejle lukket.
8. Før en udbyder vælges, skal databehandleraftale, dataplacering, børne-/skolevilkår, udbyderretention og mulighed for at slå træning, transskription og leverandørlogs fra være afklaret som et produkt- og sikkerhedsvalg.

## Verifikation i næste fase

Ud over enheds- og UI-tests bør realtidsfasen have kontrakttests for kortlivede credentials, afviste deltagere, forkert post, dobbeltafslutning, timeout og cleanup. En netværks- og storage-test skal dokumentere, at kendte syntetiske spørgsmål og svar ikke findes i requests, responses, browser storage, logs, Sentry-events eller persistente tabeller.
