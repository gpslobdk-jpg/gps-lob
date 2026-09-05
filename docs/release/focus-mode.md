# Fokusmode

Fokusmode er valgfri og slået fra som standard. Indstillingen findes ved gem i de digitale GPS-byggere og kompakt i Lynbyggerens gennemgang. Livevisningen har en separat Fokusmode-knap med samlet antal, seneste varighed, global til/fra og undtagelse for den enkelte deltager/hold.

Elever får en tydelig, lukbar information på spilskærmen. Oplysningen beskriver kun, at SkoleGPS har været skjult; den afslører aldrig andre apps, hjemmesider eller aktivitet. Funktionen giver ingen straf, blokering eller pointændring.

## Afgrænsning og sikkerhed

- Egne API-ruter, tre additive tabeller og isolerede komponenter. Ingen ændringer i GPSManager, GameState, join-, svar-, progression- eller realtime-motoren.
- Fejl i data, API, rendering eller netværk deaktiverer kun fokuslaget. Løb og svar gemmes fortsat, også hvis fokusindstillingen ikke kunne gemmes; læreren får da en konkret besked.
- Kun en sammenhængende skjult periode på mindst 3 sekunder og højst 30 minutter tælles ved tilbagevenden. Dubletter, gamle hændelser, modstridende policyrevisioner og egne filvælgerovergange afvises.
- Reload, intern navigation og tvetydige `pagehide`-overgange kasseres konservativt. Ingen baggrundstimer, beacon, vedvarende kø, lokal fokuslog eller afhængighed af realtime.
- Lærerændringer håndhæves på serveren med det samme. En synlig elevside henter status cirka hvert 10. sekund og ved retur; livepanelet cirka hvert 5. sekund. En gammel intervalrevision kan ikke tælles efter global deaktivering eller individuel undtagelse.
- Databasen gemmer kun indstillinger, undtagelse, antal og seneste hændelses-ID/tid/varighed. Browserroller har ingen direkte adgang til tabeller eller privilegerede funktioner. API-ruter kræver eksisterende lærer- eller deltagerautentifikation og ejerskab til den konkrete session.
- Fokusdata om session/deltager slettes automatisk senest cirka 24 timer og 15 minutter efter afslutning og har højst syv dages levetid fra sessionens oprettelse. Løbsindstillingen bevares, så læreren kan genbruge løbet. Sletning af run/session/participant kaskaderer kun til den tilsvarende fokusmetadata.

## Browserbegrænsninger

Fokusmode er vejledende og kan ikke dokumentere snyd. Registrering kræver, at browseren leverer synlighedshændelser og vender tilbage til samme side med forbindelse. En lukket/discarded side, lang fraværsperiode eller netværksfejl kan derfor give færre registreringer. Et synligt browservindue uden inputfokus tælles ikke alene på `blur`. Hvis både pause og genoptagelse sker, mens browseren er suspenderet, kan pausetiden indgå i fraværsvarigheden.

Dette er i tråd med browsernes dokumenterede livscyklus: [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) og [WebKit pageshow/pagehide](https://webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/). Fysiske iPhones/Android-enheder og hardware lock/unlock skal skelnes fra automatiseret WebKit/Chromium-emulering.

Standardløb, foto, escape, rollespil, Stratego og Zone-Krig bruger det fælles autentificerede spilflow. Find Bedragerens separate UUID-baserede deltagerlogin er ikke udvidet med fokusregistrering. Analoge Stjerneløb har ingen relevant spilskærm. Zone-Krigs eksisterende kampzoneregler er uændrede og er ikke en del af Fokusmode.

## Afgrænsede regressionsrettelser

En Safari-test af genoprettet deltageradgang fandt en tilstand med et serverbekræftet svar, men et lukket spørgsmål uden fortsæt-knap. Kortvisningen viser nu den eksisterende fortsæt-handling i netop denne tilstand. Den kræver bekræftet svar på den aktuelle post, ingen ventende svar, afsendelse, pause eller fejl. Den bruger den eksisterende handling og serverens progression; GPS og GameState er uændrede. En offlinebesvarelse får ingen sådan knap.

Dashboardguidens fokusretur venter kort på sit mål ved langsom navigation. Derudover er enkelte testfixtures rettet til den aktuelle API-tekst og til at acceptere den autoritative målgang, som kan erstatte en kortvarig gemt-besked.

Preview med et rigtigt nyt join fandt desuden en eksisterende uoverensstemmelse: deltageroverdragelsen gemte et ikke-gennemført avatarvalg, selv om avatarskærmen er deaktiveret. Dette blokerede både GPS-start og Fokusmode. Handoff og læsning af gamle deltagerdata normaliserer nu kun dette flag til gennemført. Identitet, startpost, avatar og gemte svar bevares; join-API, GameState og GPSManager er uændrede. Tre regressionstests fejlede før rettelsen på præcis dette flag.

Fokusmodes browsertests bruger det eksisterende spil. En særskilt stresstest kombinerer fejlet fokus-POST og utilgængelig realtime med GPS, ét gemt svar og målgang. Ved browser-resume kan den eksisterende gendannelse lukke en ubesvaret opgave; testen genåbner da samme post gennem dens synlige knap. Der ændres ikke progression eller svar gennem testen. Øvrige Fokusmode-tests fremkalder ikke gentagne kunstige realtimefejl.

## Release og rollback

Normal release er featurebranch → GitHub/Vercel Preview → verificeret smoke → main → GitHub/Vercel Production → samme kontrollerede smoke. Preview og Production bruger samme database; kun migration `202609050001_focus_mode.sql` anvendes. Den må ikke kombineres med andre ventende migrationer.

SQL-verifikation: Kør migrationens indhold uden dens BEGIN/COMMIT-wrapper og `scripts/security/focus-mode-transactional-test.sql` i én ydre transaktion med lock/statement-timeout og afsluttende ROLLBACK. Testen afviser eksisterende fokusdata, anvender udelukkende nye syntetiske fixtures og tester grænser, dubletter, revisioner, RLS, undtagelser og retention. Kontrollér derefter, at tabellerne stadig ikke findes.

Central deaktivering: `FOCUS_MODE_DISABLED=true` på serveren og normal GitHub/Vercel-redeploy. Akut kode-rollback: revert Fokusmode-releasecommit på main og push gennem normal integration. Lad de additive tabeller stå; de er uden afhængigheder fra den tidligere app, og retention fortsætter. Ved regression i GPS/elev/live/svar foretages rollback før andre produktionsændringer.

Den opt-in-test `tests/focus-mode-release-smoke.spec.ts` opretter en ny syntetisk lærer, gemmer et testløb gennem byggeren og kontrollerer start/join/GPS/fokus/toggle/undtagelse/svar/målgang/reload. Den anvender kun præcist ejerskabskontrollerede syntetiske data og registrerer oprydning i en ignoreret lokal ledger. Ingen rigtige elevnavne, fotos eller brugerdata bruges.

## Verifikation

Lokale kontroller på Production-build:

- Build og TypeScript bestået. Ændrede TypeScript-filer har ingen ESLint-fejl. Fuld repository-lint har 68 fejl mod 69 på udgangspunktet; eksisterende lintgæld er ikke en grøn fuld lintkørsel.
- 168 brede regressionschecks bestået, herunder standardsvar, progression, GPS, dashboard, guide og de tre nye avatar-handoff-kontroller (19 handoff-tests i alt).
- 45 Fokusmode-kontroller bestået i desktop Chromium, Android/Chromium og iPhone/WebKit: default, elevinformation, grace, dubletter, pause, navigation, resume, global/individuel deaktivering og fejl under gameplay.
- 14 lærer-/Lynbyggerkontroller og 8 server-/adgangskontroller bestået.
- 13 særskilte iOS/Safari-regressionschecks bestået, inklusive genoprettet deltagerlogin, GPS-resume, afsluttet løb efter reload, to poster og rigtigt pointerklik på fortsæt-knappen.
- SQL-integrationen bestået på PostgreSQL i en transaktion med efterfølgende rollback. Derefter er den præcise additive migration anvendt og tre RLS-tabeller samt aktiv retention verificeret.

Mobilkontroller bruger browsermotorer med emuleret GPS og lifecycle-hændelser. Fysisk appskift og hardware lock/unlock på en rigtig telefon er ikke verificeret.

Preview og Production skal hver bestå den opt-in-smoke, og Vercels projekt, target og eksakte Git-SHA skal matche releasen. De endelige deploymentmetadata og oprydningsresultater leveres sammen med releaserapporten.
