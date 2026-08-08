# Verifikationsrapport for SkoleGPS' kommunepakke

Dato: 8. august 2026
Omfang: Lokal kode, migrationsfiler, dokumenter og isolerede testresultater på branch `security/kommuneklar-elevdata`.
Begrænsning: Ingen hosted konfiguration, leverandørkonto, produktionsdatabase eller deployment er ændret eller anvendt som bevis.

## 1. Dokumentkontrol

Den offentlige standardaftale er version 1.1, udgivet og senest opdateret 8. august 2026. Den er en ikke underskrevet standardskabelon, ikke en myndighedsgodkendelse.

| Søgeord | DOCX | PDF | Klassifikation |
| --- | ---: | ---: | --- |
| `SKAL VERIFICERES` | 0 | 0 | Fjernet |
| `FØRSTEUDKAST` | 0 | 0 | Fjernet |
| `IKKE UNDERSKREVET` | 2 | 2 | Bevidst dokumentstatus på forsiden og i bilag D.1 |
| `UDFYLDES` | 13 | 13 | Kun kommune-/skoleejerfelter: part (4), underskrift (4), kontaktperson (4) samt vejledningen på forsiden (1) |
| `TODO`, `TBD`, `ukendt`, `forventet`, `antaget`, `cirka`, `normalt` | 0 | 0 | Ikke til stede |
| `bør` | 4 | 4 | Almindelige substantiver (`børn`) i tre tilfælde; én anbefaling om holdnavn/kort fornavn i bilag C.2 |
| `kan` | 39 | 39 | Juridiske rettigheder, muligheder og betingelser i standardbestemmelserne og bilagene; ikke uverificerede faktapåstande |

Word og PDF indeholder samme version, dato, dokumentansvarlige, bilag A–D og centrale produktspecifikke oplysninger. De to `docs/legal`-filer er byte-identiske med deres respektive kopier i `public/dokumenter`.

## 2. GPS og lokation

- `app/api/play/location/route.ts` modtager `sessionId`, `participantId`, `lat`, `lng` og `accuracy`, validerer aktiv session/deltager og opdaterer deltagerens aktuelle position og `last_updated`.
- `supabase/migrations/202603040001_participants_answers_rls.sql` definerer `participants.lat`, `participants.lng`, `participants.last_updated` samt positionsfelter på svar.
- `components/play/v2/usePlayGPS.ts` beregner afstand i browseren med Haversine og synkroniserer løbende aktuelle målinger til API'et.
- Standardflowet har ikke en særskilt positionshistoriktabel. Den aktuelle deltagerposition overskrives. Der findes specialspilslogik andre steder, som skal vurderes særskilt, hvis kommunen aktiverer disse løbstyper.
- `app/api/play/location/route.ts` kan nulstille deltagerens position ved forladelse, og afslutningsflows sætter position og nøjagtighed til `null`.
- `supabase/migrations/202608070001_kommuneklar_elevdata.sql` nulstiller position ved deltager-/sessionsafslutning og ved oprydning efter 15 minutters inaktivitet. Lærer- og elevvisning skjuler stale eller afsluttede positioner straks; med planlagt femminutters oprydning er den normale maksimale fysiske opbevaring cirka 20 minutter.
- Nye elevsvar får positionsfelter fjernet både i API og med databasetrigger, så GPS ikke indgår i arkiverede svar.

## 3. Elevdata og medier

- Elever deltager uden elevkonto og elev-e-mail. Normal deltagelse kan omfatte holdnavn/kort fornavn, sessions- og deltager-id, løbskode, svar, fritekst, quizvalg, point, status, tidsstempler, aktuel lokation og foto.
- `app/api/play/submit-photo/route.ts` validerer aktiv session, konkret deltager og fotoopgave på serveren. Faktisk JPEG-, PNG- eller WebP-indhold dekodes, begrænses i bytes/dimensioner, roteres efter metadata og genkodes som JPEG uden EXIF/GPS-metadata. Fotoet får en servergenereret tilfældig sti og gemmes med service-role alene på serveren; browseren modtager ikke Storage-stien.
- Den nye migration gør `participant-uploads` privat, backfiller eksisterende referencer til `participant_photo_objects` og erstatter gamle offentlige URL'er med en intern foto-route.
- `app/api/teacher/answers/[answerId]/photo/route.ts` kræver lærerlogin, løbsejerskab samt match mellem svar, session, deltager og fotoobjekt. Routen henter derefter objektet server-side og streamer bytes med `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache` og `Referrer-Policy: no-referrer`. Browseren modtager ikke en signed Storage-URL.
- Der er ikke fundet et almindeligt elevflow, som optager eller uploader lyd, podcastlyd eller video. Lærerens AI-/podcastværktøjer kan behandle lærerindtastet tekst, links, resuméer eller transskriptioner.
- Fotoopgaver er fortsat begrænset til ting, steder og ikke-personhenførbare motiver. Privat Storage reducerer eksponering, men ændrer ikke dataminimeringsinstruksen.

## 4. Sletning og retention

- `supabase/functions/student-data-retention/index.ts` koordinerer Storage-sletning før databasefinalisering og registrerer kun status, tællere og en generisk fejlkode uden elevoplysninger eller objektstier.
- Retentionmodellen er: GPS aldrig synlig efter 15 minutters inaktivitet og fysisk nulstilling ved næste femminutters job; fotos 30 dage; almindelige elevsvar, deltagere, navne, beskeder og afsluttede live-sessioner 90 dage fra afslutnings- eller inaktivitetsanker; tekniske oprydningslogs 30 dage.
- Resultatsiden kan fortsat slette tidligere. Storage-sletning er fail-closed: databaseposterne slettes ikke, hvis et fotoobjekt ikke kan slettes.
- Den gamle foto-retentionfunktion er pensioneret. Migrationen forbereder en konfigurationsfunktion til GPS-job hvert femte minut og daglig samlet retention, men aktiverer ikke cron automatisk.
- Supabase-plan, databasebackup-retention, Edge-deployment samt den faktiske `cron.job`- og jobhistorik skal bekræftes af ejeren efter en senere, godkendt deployment. Storage-objekter indgår ikke i Supabase-databasebackups.

## 5. Adgang og sikkerhed

- RLS-migrationerne begrænser læreradgang via direkte ejerskab til `gps_runs.user_id = auth.uid()` og binder deltagere til deres aktive kontekst.
- Lærerlogin understøtter e-mail/adgangskode samt frivilligt Google- og Microsoft-login via Supabase. Der er ikke fundet et password-reset-flow i brugerfladen.
- Delingslinks til afvikling bruger URL-fragment, SHA-256-digest, one-time visning af rå hemmelighed, tokenredaktion, `no-store`, `noindex` og `NetworkOnly`.
- Administratorfunktioner bruger server-side privilegeret adgang. Der er ikke dokumenteret organisation-/skoletilknytning som en selvstændig adgangsgrænse; den primære grænse er lærerens ejerskab.
- Der er rate limiting og validering i relevante API-flows, men kontrollen udgør ikke en samlet penetrationstest.

## 6. Observability

- Sentry initialiseres kun, når det relevante eksplicitte miljøflag er `true`. Production, preview, development og test skal sættes med særskilte miljønavne. `sendDefaultPii` er slået fra, bruger-, server-, request-, app-, cloud-, enheds-, GPU-, OS- og runtimekontekst fjernes, replay maskerer tekst/input og blokerer medier, og den centrale sanitizer redigerer navn, e-mail, IP, koder, tokens, sessions-/deltager-id, svar, fotostier, URL-legitimationsoplysninger og lokation.
- Bugsnag findes som betinget integration bag `NEXT_PUBLIC_BUGSNAG_API_KEY`. Den robuste globale sanitizer er ikke koblet til alle automatisk indfangede Bugsnag-fejl. Bugsnag er derfor ikke angivet som aktiv/godkendt underdatabehandler i standardaftale version 1.0 og må ikke aktiveres til kommunens personoplysninger uden en ny kontrakt- og sikkerhedskontrol.
- Vercel Analytics er aktiv i layoutet med et før-afsendelsesfilter. Delingssiden til afvikling og fotoudleveringsflowet fravælges.

## 7. Leverandører og eksterne tjenester

| Tjeneste | Formål og mulige data | Status i lokal kode | Lokation/grundlag |
| --- | --- | --- | --- |
| Supabase | Database, Auth, Storage, Realtime og serverfunktioner; centrale konto-, løbs- og elevdata | Aktiv kerneintegration | Lokal linked-regionindikator `eu-west-1` (Irland); plan, backups og hosted DPA/SCC kræver ejerens kontodokumentation |
| Vercel | Hosting, server/edge og webanalyse; tekniske requests og data under afvikling | Aktiv kerneintegration | USA/global efter leverandørvilkår; konkret plan skal have DPA-dækning |
| Sentry | Fejlmonitorering; redigerede tekniske data | Aktiv initialisering | Valgt datalagringsregion Tyskland; konto, retention og DPA skal dokumenteres af ejeren |
| Bugsnag/SmartBear | Betinget fejlmonitorering | Kode findes, aktivering ukendt; ikke godkendt i aftale v1.0 | Må forblive deaktiveret for kommunedata uden ny kontrol |
| OpenAI | Frivillige lærerrettede AI-funktioner og indholdsgenerering | Flere lærer-API-routes | OpenAI Ireland/DPA og underdatabehandlere; kontoindstillinger, eventuel ZDR og data residency kræver ejerbevis |
| Pollinations | Fallback til lærerrettet billedgenerering | Aktiv fallbackkode | Ekstern tjeneste; ingen elevdata må sendes |
| Stripe | Betaling, abonnement og kundeportal | Kode findes; ikke nødvendig i gratis skoleår | Kun relevant hvis betaling aktiveres; konto og aftale kræver ejerbevis |
| OpenStreetMap/Nominatim, CARTO og Esri | Kortfliser/geokodning; IP, browser- og forespørgselsdata | Direkte browserkald | Rolle, vilkår og overførselsvurdering skal indgå i kommunens konkrete vurdering |
| Google/Microsoft | Frivilligt lærerlogin | Synlige OAuth-valg | Den valgte loginudbyders egne vilkår; ingen elevkonto |
| YouTube/Apple iTunes | Frivillige lærerrettede søge-/indholdsflows | Routekode findes | Ingen elevdata må sendes |

Der er ikke fundet en selvstændig mailleverandør, captcha-tjeneste, Google Analytics/PostHog eller ekstern pushleverandør i den kontrollerede kode. Browsernotifikationer er lokale. Eventuelle hosted miljøvariabler er ikke blevet læst eller udskrevet.

## 8. AI-afgrænsning

- Læreren kan sende emne, instruktioner, undervisningsmateriale, billeder, links, titler, resuméer og transskriptioner i de frivillige AI-/indholdsflows.
- Der er ikke fundet automatisk afsendelse af elevsvar, elevfoto, elevlyd eller elevlokation til OpenAI.
- Flere flows viser et genereret udkast til lærerens gennemgang, men der findes ikke en universel teknisk detektor, som forhindrer læreren i at indsætte personoplysninger.
- Den bindende instruks forbyder derfor elevdata, genkendelige billeder, særlige kategorier og fortroligt materiale i AI-funktioner.

## 9. Oplysninger som fortsat kræver ekstern dokumentation

1. Vercel-plan og dokumenteret DPA-dækning for den konkrete konto.
2. Supabase-plan, backupretention, projektregion i dashboardet, DPA/SCC samt faktisk hosted cron-/edge-aktivering.
3. Sentry-konto, valgt region, retention, DPA og underdatabehandlerliste.
4. Bekræftelse på, at Bugsnag er deaktiveret i hosted miljø, eller en teknisk/kontraktuel rettelse før aktivering.
5. OpenAI-kontoens DPA, data residency/ZDR-status og godkendte funktionsafgrænsning.
6. Kommunens vurdering af korttjenester, direkte browserkald og internationale overførsler.
7. Kommunens juridiske partsfelter, behandlingsgrundlag, sletteinstruks, brudkontakt og eventuelle DPIA.
8. Juridisk vurdering af aftaleindgåelse med Jeppe Laursen som privatperson uden CVR samt ansvar, forsikring, værneting, support og ophør.

## 10. Isoleret teknisk bevis

Den 8. august 2026 blev den eksisterende lokale Docker/Supabase-runtime anvendt uden installation af systemsoftware og uden forbindelse til produktionsprojektet. Hele migrationsrækken blev anvendt fra nul, og opgraderingen fra parent-migrationspunktet blev kørt separat. Gentagen migration gav ingen resterende migrationer.

Syntetiske tests beviste lærer A/B-isolation, anonym afvisning, privat Storage, server-only adgang, deltagerbinding, atomisk upload-ratebegrænsning, skjult/stale GPS, fysisk GPS-oprydning, finish-nulstilling, 30-/90-dages retention, aktive sessioners bevarelse, orphan-detektion, seriel retentionstart og 50 samtidige deltagere med GPS og svar. Et lokalt pg_cron-smokejob kørte succesfuldt, og alle testjobs blev derefter afmeldt. Hosted Edge-, cron- og dashboardstatus er fortsat ikke verificeret eller aktiveret.

## 11. Samlet vurdering

Pakken indeholder nu lokal hardening til privat foto-Storage, proxied og ikke-cachebar fotovisning, valideret/genkodet foto-upload, præcis GPS-timeout og samlet retention. Den isolerede database-, Storage-, RLS-, cron- og belastningstest er gennemført. Pakken er først klar til kommunal elevbrug efter teknisk review, godkendt deployment, migration i korrekt rækkefølge og dokumenteret hosted Edge-/cron-/jobhistorik. Den er ikke endeligt kommunegodkendt eller underskriftsklar for en konkret kommune, før ejerpunkterne er dokumenteret og kommunens DPO/jurist har gennemgået aftalen.

## Forberedt DagensTavle-login, ikke produktionsaktivt

Feature-branchen forbereder en valgfri login-overdragelse for lærere. Browseren
modtager ingen Supabase-session, JWT, OTP eller e-mail i URL'en. DagensTavle får
ingen service-role-nøgle og ingen adgang til SkoleGPS' elevtabeller. Request- og
nonceværdier gemmes kun som hashes i 90 sekunder, exchange sker server-til-
server med HMAC, og DagensTavle etablerer derefter sin egen host-only session.
Ingen elevdata overføres. Funktionen, migrationen og dashboardkonfigurationen er
ikke aktiveret eller verificeret i produktion.
