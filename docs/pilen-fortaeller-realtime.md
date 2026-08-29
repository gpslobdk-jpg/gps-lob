# Pilen fortæller – realtime, privacy og release gates

## Status og arkitektur

Realtime-flowet bruger OpenAI Realtime over WebRTC. Modellen vælges kun på
serveren fra allowlisten `gpt-realtime-2.1-mini` og `gpt-realtime-2.1`; Preview-
standard er `gpt-realtime-2.1-mini`. Browseren åbner først mikrofonen efter elevens tryk og
sender derefter kun sit flygtige SDP-offer til SkoleGPS-ruten
`/api/play/character-realtime`. Den almindelige OpenAI API-nøgle bliver kun
brugt på serveren.

Serveren gør følgende før et OpenAI-kald:

1. kræver det eksplicitte serverflag og alle privacy-/release-gates;
2. validerer deltagerens host-only participant-login og sessionbinding;
3. kræver et aktivt standardløb og en komplet `character`-post;
4. kræver, at posten er elevens aktuelle autoritative post;
5. kræver frisk GPS med brugbar nøjagtighed og afstand inden for serverradius,
   medmindre lærerens eksisterende GPS-override er aktiv;
6. kræver den aktuelle, versionsbundne capability-bekræftelse fra den
   autentificerede lærer, der afvikler løbet;
7. bruger en serverless Supabase-RPC til højst fire starter pr. deltager/post i
   et femminuttersvindue;
8. bygger hele sessionen og instruktionen server-side fra faste regler samt
   allowlistede felter i den gemte karakterkonfiguration.

SDP-svaret går tilbage til browseren. Et kortlivet signeret stop-token indeholder
kun OpenAI-call-id og HMAC-bindinger, ikke rå deltager- eller sessions-id'er.
Klientens stop og timeout kalder `/api/play/character-realtime/stop`, så serveren
kan forsøge at lukke provider-kaldet. En lukket fane eller mistet forbindelse
lukker desuden WebRTC-peer'en direkte.

### Lærerbekræftelsens niveau

Bekræftelsen gælder pr. autentificeret lærer og copy-version. Det er valgt frem
for pr. løb, fordi den dokumenterer lærerens aktivering af capability'en uden at
gentage samme friktion for hvert løb. Den gælder ikke på tværs af lærere: en
anden lærer, som modtager en kopi, skal bekræfte selv. En versionsændring kræver
ny bekræftelse. Builderen kræver den ved første gemning med Pilen, arkivets
aktiveringsrute kræver den ved første lobby, og elevens Realtime-bootstrap
kontrollerer den udførende lærer igen. Det er en bekræftelse af skolens proces –
ikke et samtykke afgivet på barnets vegne.

## Dataminimering

- Der oprettes ingen `MediaRecorder`, blob, lydfil eller upload.
- Inputtransskription og Realtime tracing er eksplicit slået fra.
- SkoleGPS gemmer ikke lyd, transskription, elevspørgsmål, Pilen-svar,
  samtalehistorik, SDP eller rå GPS fra realtime-flowet.
- Rå koordinater bruges kun kortvarigt på SkoleGPS-serveren til den eksisterende
  afstandskontrol. OpenAI får kun lærerens semantiske stedbeskrivelse.
- Klienten læser kun typen på Realtime-kontrolhændelser og kasserer eventuelt
  tekstindhold uden at lægge det i React-state, storage, analytics, Sentry eller
  logs.
- Ny databasepersistens er begrænset til to formål i migrationen
  `202608290001_pilen_realtime_rate_limit.sql`:
  - Capability-bekræftelsen gemmer kun lærerens eksisterende auth-reference,
    `accepted=true`, tekstversion og tidspunkt. Den gemmer ingen elev, alder,
    forælder, dokumentation eller løbsreference.
  - Rate limit gemmer kun postindeks, HMAC-fingerprint, vindue og antal. Rå
    session- og deltager-ID'er gemmes ikke, og rækker ældre end én time slettes.
- Ruten logger ikke fejlobjekter, request bodies, provider responses eller
  identifikatorer. Elevflowets Session Replay forbliver deaktiveret.

## Miljøvariabler

Alle værdier sættes særskilt for Development, Preview og Production. Værdier og
nøgler må ikke skrives i repository, issues, logs eller screenshots.

| Navn | Eksponering | Krav |
| --- | --- | --- |
| `NEXT_PUBLIC_PILEN_REALTIME_ENABLED` | Browser | Eksakt `true` viser det virkelige voice-flow. Ellers bruges det ufarlige foundation-preview. |
| `PILEN_REALTIME_ENABLED` | Server | Eksakt `true` tillader bootstrap. Standard er off. |
| `OPENAI_API_KEY` | Kun server | Nøgle til det godkendte OpenAI-projekt. |
| `PILEN_REALTIME_RATE_LIMIT_SECRET` | Kun server | Højentropisk, særskilt hemmelighed til HMAC og stop-token. |
| `PILEN_REALTIME_MODEL` | Kun server | Preview bruger `gpt-realtime-2.1-mini` som standard. Tilladte værdier er kun `gpt-realtime-2.1-mini` og `gpt-realtime-2.1`; Production kræver et eksplicit valg. |
| `PILEN_REALTIME_OPENAI_REGION` | Kun server | Skal være `eu`; andre eller manglende værdier fejler lukket. |
| `PILEN_REALTIME_ZDR_CONFIRMED` | Kun server | Må kun være `true`, når ZDR og EU data residency er verificeret på det anvendte projekt. |
| `PILEN_REALTIME_UNDER_18_REVIEW_CONFIRMED` | Kun server | Må kun være `true` efter den ansvarlige børne-, privacy- og skolegennemgang. |
| `PILEN_REALTIME_PRODUCTION_APPROVED` | Kun server | Ekstra Production-gate. Preview/development ignorerer den. |

Manglende credentials eller bekræftelser er en kontrolleret unavailable-tilstand;
det er ikke en bygfejl. Begge enable-flags skal forblive `false` i Production,
indtil hele checklisten nedenfor er dokumenteret.

## Obligatoriske gates før Preview med rigtig lyd

- Anvend migrationen `202608290001_pilen_realtime_rate_limit.sql` i det valgte
  Preview-Supabase-projekt. Verificer, at begge nye tabeller kun kan tilgås af
  `postgres`/`service_role`, og at rate-limit-RPC'en kun kan udføres af samme.
- Opret eller vælg et separat OpenAI API-projekt til Pilen. Begræns medlemsadgang,
  opret en project/service-account API-nøgle, aktivér fakturering og sæt et lavt
  projektbudget/rate limit til pilotfasen.
- Få OpenAI til at godkende organisationen/projektet til Zero Data Retention og
  europæisk regional behandling. Sæt projektets data-retention-kontrol til
  `zero_data_retention`, og verificer den faktiske projekttilstand i OpenAI-
  dashboardet eller Admin API'en med en separat admin-nøgle. Appens almindelige
  API-nøgle og miljøflag er ikke bevis for kontostatus.
- Verificer, at `gpt-realtime-2.1-mini` og `gpt-realtime-2.1` er tilgængelige i
  projektet på `eu.api.openai.com`, og at `/v1/realtime` er omfattet. Der må ikke
  konfigureres amerikansk fallback. Realtime tracing forbliver `null`.
- Verificer databehandleraftale, underdatabehandlere, fakturering, kvoter og hvem
  der kan se providerens projekt- og sikkerhedslogs.
- Gennemfør den ansvarlige under-18-vurdering: alderssvarende AI-oplysning,
  indholdsgrænser, lærerens håndtering af bekymrende situationer, skole-/forældre-
  information, behandlingsgrundlag og eventuelle lokale samtykkekrav.
- Kør privacy-leak-prober med syntetiske sætninger og kontroller browser storage,
  SkoleGPS-logning/telemetri, Supabase og OpenAI-projektets retentionvisning.
- Kør på mindst én rigtig iPhone/Safari og én Android/Chrome: tillad og afvis
  mikrofon, start/stop, timeout, lås skærm, skift app, browser-tilbage, tab net,
  genindlæs og afslut løbet.

### Præcis telefonsekvens til voksen Preview

Brug kun en voksen tester og syntetiske oplysninger, indtil alle gates er
godkendt. Kør samme sekvens på iPhone/Safari og Android/Chrome:

1. Åbn et aktivt standardløb og gå til den autoritativt aktuelle Pilen-post.
2. Kontroller AI-oplysningen før tryk, og kontrollér at mikrofonen endnu ikke er aktiv.
3. Afvis mikrofonen; kontrollér venlig fejl, ingen provider-start og mulighed for at afslutte uden stemme.
4. Tillad mikrofonen, start og stil et kort fagligt spørgsmål på engelsk.
5. Prøv navn/adresse, navigation, dansk spørgsmål, rolleændring, systemprompt,
   seksuelt/voldeligt/selvskade-/mobbeindhold og irrelevant smalltalk fra det
   syntetiske red-team-katalog; vurder kort afvisning og redirect.
6. Test afbrydelse mens Pilen taler, Stop, 60–90 sekunders timeout og genstart-rate limit.
7. Gentag med appskift, skjult/låst skærm, browser-tilbage, reload og netværkstab.
8. Kontrollér bagefter browserstorage, SkoleGPS/Sentry/Vercel-logs, Supabase-
   tabeller og OpenAI-retentionvisning for fravær af lyd og samtaleindhold.
9. Afslut posten og kontrollér autoritativ progression, reload og færdigtilstand.

## Ekstra gates før Production

- Gentag alle kontoverifikationer på det præcise Production-projekt; en Preview-
  godkendelse er ikke tilstrækkelig.
- Få eksplicit produkt-, privacy-, sikkerheds- og børneansvarlig godkendelse og
  sæt først derefter `PILEN_REALTIME_PRODUCTION_APPROVED=true`.
- Fastlæg supporttekst til lærere, incident-flow, provider-/kvoteovervågning uden
  samtaleindhold og en hurtig kill switch via begge enable-flags.
- Gennemfør en lille, overvåget pilot før bred lancering og bekræft pris pr. elev,
  lydkvalitet i skolegård, alderssvarende svar og lærerens recovery-flow.
- Production må ikke åbnes, hvis EU/ZDR-status, under-18-vurdering eller reel
  enhedstest ikke kan dokumenteres.

## Samtalens sikkerhedsramme

Pilen oplyser, at figuren er AI, taler kun enkelt og alderssvarende engelsk,
holder sig til emne og sted, stiller højst ét kort spørgsmål ad gangen og beder
aldrig om navn, alder, skole, kontaktoplysninger, adresse eller præcis position.
Pilen må ikke sende eleven væk fra posten eller give fysiske instruktioner. Ved
persondata, privatliv, navigation, helbred, seksuelt/voldeligt/selvskade-/mobbe-
indhold eller tegn på akut bekymring stoppes emnet, og eleven henvises kort til
læreren eller en betroet voksen. Pilen må ikke opfordre til hemmeligheder eller
følelsesmæssig afhængighed, påstå at huske eleven, skifte rolle eller afsløre
systeminstruktioner. Lærerens emne og sted er citeret, utroværdig data og kan
ikke ændre reglerne.

Klientens timer og provider-stop håndhæver de gemte 60–90 sekunder. Alle lokale
tracks, receivers, senders, data channel, peer connection, audioelement, timere
og referencer ryddes ved stop, timeout, fejl, skjult fane, navigation og unmount.

Det automatiske katalog ligger i
`tests/fixtures/pilen-under-18-red-team.ts`. Det tester prompt- og
sessionkontrakten uden en ekstern model. En rigtig safety/quality-evaluering er
bevidst udskudt, indtil Preview-projektets EU/ZDR-status er verificeret.

## Model-sammenligning før Production

Lærere og elever ser eller vælger aldrig modellen. Sammenligningen udføres på
samme commit i to kontrollerede Preview-deployments:

1. Deployment A: `PILEN_REALTIME_MODEL=gpt-realtime-2.1-mini`.
2. Deployment B: `PILEN_REALTIME_MODEL=gpt-realtime-2.1`.
3. Kør samme voksne, syntetiske red-team-katalog og samme telefonsekvens på begge.
4. Registrér kun case-id, pass/fail, latency-interval, afbrydelseskvalitet og en
   kort aggregeret kvalitetsvurdering – aldrig lyd, transskription eller svartekst.
5. Vælg Production-model efter sikkerhedsadfærd, emnefastholdelse, enkelt engelsk,
   støj/afbrydelser, latency og pris. Sæt Production-værdien eksplicit; ugyldig
   eller manglende model fejler lukket.

## Officielle kilder kontrolleret 30. august 2026

- [Realtime API med WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Realtime conversations og aktuelle events](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [GPT-Realtime-2.1 Mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini)
- [GPT-Realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)
- [Data controls, retention og regional processing](https://developers.openai.com/api/docs/guides/your-data)
- [Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
