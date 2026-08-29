# Pilen fortæller – realtime, privacy og release gates

## Status og arkitektur

Realtime-flowet bruger OpenAI Realtime over WebRTC og modellen
`gpt-realtime-2.1-mini`. Browseren åbner først mikrofonen efter elevens tryk og
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
6. bruger en serverless Supabase-RPC til højst fire starter pr. deltager/post i
   et femminuttersvindue;
7. bygger hele sessionen og instruktionen server-side fra faste regler samt
   allowlistede felter i den gemte karakterkonfiguration.

SDP-svaret går tilbage til browseren. Et kortlivet signeret stop-token indeholder
kun OpenAI-call-id og HMAC-bindinger, ikke rå deltager- eller sessions-id'er.
Klientens stop og timeout kalder `/api/play/character-realtime/stop`, så serveren
kan forsøge at lukke provider-kaldet. En lukket fane eller mistet forbindelse
lukker desuden WebRTC-peer'en direkte.

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
- Den eneste nye databasepersistens er teknisk rate-limit-metadata: postindeks,
  en HMAC-fingerprint, vindue og antal. Rå session- og deltager-ID'er
  gemmes ikke i tabellen. RPC'en sletter rækker ældre end én time. Migrationen er
  `202608290001_pilen_realtime_rate_limit.sql`.
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
| `PILEN_REALTIME_OPENAI_REGION` | Kun server | Skal være `eu`; andre eller manglende værdier fejler lukket. |
| `PILEN_REALTIME_ZDR_CONFIRMED` | Kun server | Må kun være `true`, når ZDR og EU data residency er verificeret på det anvendte projekt. |
| `PILEN_REALTIME_UNDER_18_REVIEW_CONFIRMED` | Kun server | Må kun være `true` efter den ansvarlige børne-, privacy- og skolegennemgang. |
| `PILEN_REALTIME_PRODUCTION_APPROVED` | Kun server | Ekstra Production-gate. Preview/development ignorerer den. |

Manglende credentials eller bekræftelser er en kontrolleret unavailable-tilstand;
det er ikke en bygfejl. Begge enable-flags skal forblive `false` i Production,
indtil hele checklisten nedenfor er dokumenteret.

## Obligatoriske gates før Preview med rigtig lyd

- Anvend migrationen i det valgte ikke-Production-miljø og verificer RPC-adgang
  kun for service role.
- Brug et OpenAI-projekt, der er godkendt til EU regional endpoint.
- Verificer i OpenAI-kontoen, at projektet faktisk er godkendt til Zero Data
  Retention/Modified Abuse Monitoring og EU data residency. Koden kan ikke
  bevise eller ændre den eksterne kontoindstilling.
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
persondata, farligt indhold eller tegn på akut bekymring stoppes emnet, og eleven
henvises roligt til læreren.

Klientens timer og provider-stop håndhæver de gemte 60–90 sekunder. Alle lokale
tracks, receivers, senders, data channel, peer connection, audioelement, timere
og referencer ryddes ved stop, timeout, fejl, skjult fane, navigation og unmount.

## Officielle kilder kontrolleret 30. august 2026

- [Realtime API med WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Realtime conversations og aktuelle events](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [GPT-Realtime-2.1 Mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini)
- [Data controls, retention og regional processing](https://developers.openai.com/api/docs/guides/your-data)
- [Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
