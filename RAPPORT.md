# SkoleGPS — audit af enkelhed og design

Dato: 12. september 2026  
Auditbase: lokal `main` ved `3bc7e47f0ceb`  
Type: Oprindelig read-only audit. Den efterfølgende, direkte brugerordre gav særskilt mandat til implementering og produktion.

> Dette dokument bevarer auditten som beslutningsgrundlag. Den faktiske implementering, dækning, testbeviser og release-status dokumenteres i [docs/SKOLEGPS_MAKEOVER_DELIVERY.md](docs/SKOLEGPS_MAKEOVER_DELIVERY.md).

## Kort konklusion

SkoleGPS har allerede en stærk og enkel lærerindgang: **Forside → Dashboard → Opret et løb → Lynbygger eller valgt format**. Det egentlige problem er ikke dashboardets hovedvej, men at oprettelsesvalget er blevet en stor, visuelt konkurrerende kortvæg, og at Arkivet stadig er den skjulte kompatibilitetsmotor for en række ældre byggere.

Den sikre næste retning er derfor:

1. Bevar alle routes og arkivets type-til-builder-kontrakt.
2. Gør den eksisterende lærerrejse tydeligere med progressiv afsløring, ikke færre data- eller buildertyper.
3. Normalisér lærerflader til hvid, navy og blå med meget diskrete blå gradienter.
4. Behandl elevspil, live-afvikling, print og jura som afgrænsede specialflader.

**Vigtig arkitekturkonklusion:** Skjulte byggere er ikke nødvendigvis døde byggere. Selfie, Escape, Rollespil og Live Stratego er stadig den aktuelle redigeringsvej for eksisterende arkivdata og må ikke slettes, flyttes eller omskrives uden en dokumenteret kompatibilitetsplan.

## Grundlag og afgrænsning

- Den oprindeligt efterspurgte `SKOLEGPS_AUDIT_ENKELHED_OG_DESIGN.md` var ikke tilgængelig i repoet eller de tilgængelige vedhæftningsmapper. Auditens afgrænsning var derfor read-only. Efter auditten modtog arbejdet `SKOLEGPS_MAKEOVER_IMPLEMENTERINGSORDRE (3).md` sammen med den direkte besked om at udføre hele ordren og sætte den i produktion; den ordre er den særskilte implementerings- og releasegodkendelse.
- 61 `app/**/page.tsx`-ruter er kortlagt i kildekoden.
- Forside, `Skole & skærm`, `/teknologi` og `/opdateringer` er kontrolleret i lokal browser. Autentificerede og dataførende lærerflader er gennemgået i kildekode og eksisterende testkontrakter; ingen rigtig lærer-, elev- eller arkivdata er åbnet.
- Ingen handlinger med dataeffekt blev udført. Især er intet løb startet, ændret, slettet eller delt.
- Rapporten gengiver ingen konkrete bruger-, elev- eller arkivdata fra den visuelle gennemgang.

## Den reelle lærerrejse i dag

```text
Forside
  -> Log ind
  -> Dashboard
       -> Opret et løb
            -> Lynbygger -> kladde -> Manuel bygger -> Arkiv
            -> Fag-/foto-/musikbyggere -> Arkiv
            -> Scan bogen / Podcast -> kladde -> Manuel bygger
            -> Fysisk Stjerneløb -> separat printspor
            -> Zone-Krigen -> Arkiv, hvis adgang tillader det
       -> Mine løb -> Arkiv -> redigér via løbstype
       -> Lærerværktøjer
       -> Mobilspil -> Find Bedrageren -> opsætning -> live-lobby
```

Dashboardet har allerede én tydelig hovedhandling og to rolige sekundære valg. Det er den kontrakt, der skal bevares. Kilder: `app/dashboard/page.tsx:210-254`, `tests/dashboard-first-run.spec.ts:148-196`.

## Side- og ruteoversigt

| Område | Ruter | Vurdering for næste ordre |
|---|---|---|
| Lærerindgang | `/`, `/login`, `/dashboard` | Kerneflow. Bevar og forenk­l kun det visuelle hierarki. |
| Lærerarbejdsrum | `/dashboard/arkiv`, `/dashboard/indstillinger`, `/dashboard/resultater/[runId]`, `/dashboard/live/[sessionId]`, `/dashboard/live/[sessionId]/zone-krig`, `/dashboard/live/[sessionId]/find-bedrageren` | Funktionelle arbejdsflader, ikke dekorative undersider. Kontrakter må ikke ændres i en designordre. |
| Oprettelse | `/dashboard/opret` -> redirect til `/dashboard/opret/valg`, plus builderruterne nedenfor | `valg` er den reelle indgang. `/dashboard/opret` skal bevares som kompatibilitetsredirect. |
| Arkiv, print og deling | `/dashboard/arkiv`, `/dashboard/print/[id]`, `/del/afvikling` | Arkiv er centralt for genbrug, redigering, live, resultater og historiske buildertyper. Stjerneløb og deling er særspor. |
| Lærerværktøjer | `/dashboard/laerervaerktoejer`, `/skak`, `/aarsplan-generator`, `/skemapilot` | Hubben er enkel i første niveau. Den interne SkemaPilot-side og den eksterne SkemaPilot-destination kræver senere ejerafklaring, ikke sletning. |
| Mobilspil | `/dashboard/mobilspil`, `/dashboard/mobilspil/find-bedrageren`, `/dashboard/opret/find-bedrageren` | Aktivt produktspor, men med to forklarende trin før opsætning. |
| Elev- og spilflow | `/join`, `/play/[sessionId]`, `/play/[sessionId]/bonus`, `/find-bedrageren/join`, `/find-bedrageren/[sessionId]`, `/~offline` | Skal holdes adskilt fra lærerens planlægnings-UI. GPS, offline, deltagere og live-tilstand gør dem højrisiko. |
| Information og jura | `/hjaelp`, `/mobil-i-skolen`, `/manden-bag-skolegps`, `/gdpr`, `/privacy`, `/it-afdelinger`, `/ophavsret`, `/ophavsret/jura`, `/ophavsret-podcast` | Indhold og afgrænsninger bevares. Harmonisering må ikke omskrive juridiske eller kildeunderbyggede udsagn uden faglig kontrol. |
| Drift og administration | `/dashboard/admin`, `/dashboard/admin/logs`, `/dashboard/admin/stjerneloeb-upload` | Ikke almindelig lærernavigation. Hold uden for den første designforenkling. |
| Sekundære/offentlige flader | `/priser`, `/opdateringer`, `/teknologi`, `/om`, `/vaerktojer/skak`, `/play/v2-test` | Kræver forskellige beslutninger; se designrester og kompatibilitet nedenfor. |

## Hvilke byggere læreren faktisk kan åbne

### Synlige fra `/dashboard/opret/valg`

| Status | Indgang | Faktisk funktion | Bevaringsbeslutning |
|---|---|---|---|
| Primær | **Lynbygger** | Laver et kladdeudkast og åbner derefter Manuel bygger. Det er en indgang, ikke en selvstændig gemt løbstype. | Bevar som tydelig førstegangsvej. |
| Direkte | **Generel Quiz / Manuel** | Selvstændig editor og fælles destination for flere funnels. | Bevar som den kanoniske generelle editor. |
| Direkte | **Engelsk, Matematik, Dansk, Musikquiz** | Fire synlige fag-/formatbyggere. | Bevar routes og deres indhold; gør dem sekundære efter primærvalget. |
| Direkte | **Foto mission** | Kreativ løbstype med eget flow. | Bevar som specialformat. |
| Funnel | **Scan bogen** | Laver kladde til Manuel bygger. Historiske scannerløb åbnes også i Manuel bygger. | Bevar URL og håndoff; vis det som “Lav fra tekst/bog” frem for en selvstændig editor. |
| Funnel | **Podcast-Detektiven** | Laver spørgsmål og sender et nyt kladdeudkast til Manuel bygger. | Bevar ny-oprettelsesflowet. Se arkivgapet nedenfor. |
| Separat produkt | **Fysisk Stjerneløb** | Gemmes i separat `stjerneloeb`-spor og går til print, ikke det almindelige løbsarkiv. | Bevar som tydeligt afgrænset printprodukt. |
| Betinget | **Zone-Krigen** | Er synlig, men går til `/priser` ved låst adgang, når paywall er aktiv. | Bevar adgangskontrakt; behandl som spil-specialformat. |

Kilder: `app/dashboard/opret/valg/page.tsx:65-166,364-382,413-571`, `app/dashboard/opret/lynbygger/page.tsx:139-163`, `app/dashboard/opret/scanner/page.tsx:791-797`, `app/dashboard/opret/podcast/page.tsx:66-91`.

### Åbnes indirekte fra dashboardet

| Vej | Funktion | Vurdering |
|---|---|---|
| `Dashboard -> Mobilspil -> Find Bedrageren -> Start opsætning` | Aktiv mobilspilsvej til `/dashboard/opret/find-bedrageren`. | Bevar. Overvej at samle forklaring og start i ét trin. |
| `Mine løb -> Arkiv -> Redigér` | Vej til alle historiske buildertyper via `getBuilderHrefForRaceType`. | Kritisk kompatibilitetsvej. Skal låses af test før enhver redesign. |

Ingen rigtig lærer-session er brugt i auditten. Den kodeverificerede Find Bedrageren-vej har to forklarende trin før opsætning, og dens arkivredigering er ikke implementeret. En kommende ordre bør køre den autentificerede vej mod fixture-data uden at starte eller ændre virkelige løb.

### Skjulte, men stadig nødvendige legacy-byggere

| Builder | Hvorfor den ikke er “rest” | Nuværende status |
|---|---|---|
| Selfie | Arkivets Redigér sender historiske selfie-løb hertil med `?id=`. | Edit-only-kompatibilitet. |
| Escape | Samme centrale arkivrouting; læser og opdaterer eksisterende løb. | Edit-only-kompatibilitet. |
| Rollespil | Samme centrale arkivrouting; læser og opdaterer eksisterende løb. | Edit-only-kompatibilitet. |
| Live Stratego | Samme arkivrouting og tilhørende elev-/live-spor. Stratego er med vilje skjult på den nye valgside. | Edit-only-kompatibilitet og live-spilkontrakt. |

Kilder: `utils/gpsRuns.ts:225-246`, `app/dashboard/arkiv/page.tsx:592-600`, `tests/dashboard-first-run.spec.ts:345-356`. Alle fire understøtter indlæsning/opdatering via deres eksisterende routes. De skal først kategoriseres som **edit-only** i en implementeringsordre — ikke slettes.

### Verificeret builder- og editmatrix

Her betyder **kan åbnes** en eksisterende lærer-UI-vej eller den centrale arkivroute. Det beviser ikke, at der findes historiske løb af typen, og intet løb er åbnet eller ændret i auditten.

| Indgang eller type | Kan læreren åbne den fra UI? | Eksisterende løb kan redigeres? | Bevaringsstatus |
|---|---|---|---|
| Lynbygger | Ja, direkte fra valgside | Ikke relevant; den skriver en kladde til Manuel | Primær funnel |
| Generel Quiz / Manuel | Ja, direkte | Ja, via `?id=` | Kanonisk editor |
| Dansk | Ja, direkte | Ja, via `?id=` | Aktiv builder |
| Engelsk | Ja, direkte | Ja, via `?id=` | Aktiv builder |
| Matematik | Ja, direkte | Ja, via `?id=` | Aktiv builder |
| Musikquiz | Ja, direkte | Ja, via `?id=` | Aktiv builder |
| Foto mission | Ja, direkte | Ja, via `?id=` | Aktiv builder |
| Scan bogen | Ja, direkte | Via Manuel; den centrale mapping normaliserer scanner til Manuel | Funnel + kompatibilitetsroute |
| Podcast-Detektiven | Ja, direkte | **Nej.** `/podcast?id=` ignorerer id og starter et nyt importflow | Bevar ny-oprettelse; markér arkivredigering ærligt som uafklaret |
| Fysisk Stjerneløb | Ja, direkte | Ingen egentlig editor fundet; nyt løb går til separat printspor | Separat produkt, ikke almindeligt Arkiv-løb |
| Zone-Krigen | Ja, direkte når adgang giver det; ellers til Priser | Ja, via `?id=` | Aktiv spilbuilder med adgangskontrakt |
| Find Bedrageren | Ja, indirekte: Dashboard → Mobilspil → intro → opsætning | **Nej.** Editroute viser selv “Redigering kommer senere” | Aktivt spil, men read-only i Arkiv indtil reel editor findes |
| Selfie | Ikke som nyt valg | Ja, via `?id=` | Edit-only legacy |
| Escape | Ikke som nyt valg | Ja, via `?id=` | Edit-only legacy |
| Rollespil | Ikke som nyt valg | Ja, via `?id=` | Edit-only legacy |
| Live Stratego | Ikke som nyt valg | Ja, via `?id=` | Edit-only legacy + livekontrakt |

De 11 synlige valg på buildervælgeren er Lynbygger, Manuel, Engelsk, Matematik, Dansk, Musikquiz, Foto, Scanner, Podcast, Fysisk Stjerneløb og Zone-Krigen. Find Bedrageren er en to-trins, men stadig aktiv, dashboardvej. Arkivets centrale type-routing dækker alle 14 persistente `RACE_TYPES`-værdier og bruges også af delingsflowets kopi-returvej; den må derfor ikke erstattes lokalt i Arkivet.

### Arkivets kontraktgaps

1. **Filter og redigering stemmer ikke overens.** Arkivets løbstypefilter mangler Selfie, Escape, Rollespil og Find Bedrageren, selv om den centrale routing kender dem. Det gør eksisterende løb sværere at finde. Kilder: `app/dashboard/arkiv/page.tsx:63-75`, `utils/gpsRuns.ts:20-35`.
2. **Find Bedrageren er ikke en færdig arkiv-editor.** Arkivets Redigér kan sende brugeren til en route, der eksplicit viser, at redigering kommer senere. UI'et skal være ærligt om dette, indtil redigering faktisk findes. Kilde: `app/dashboard/opret/find-bedrageren/page.tsx:675-701`.
3. **Podcast har en databevaringsrisiko, ikke blot et linkproblem.** Den centrale mapping sender historiske podcastløb til Podcast-siden, mens den side kun starter et nyt scraper-/kladdeflow og ikke læser `id`. En ubetinget omdirigering til Manuel er heller ikke dokumenteret tabsløs: Manuel normaliserer spørgsmål, og ukendte spørgsmålsfelter samt metadata kan ændres. Første sikre fase er derfor “ikke understøttet” i Arkiv, indtil en testet preservation-adapter eller en kompatibilitetskontrol findes. Kilder: `utils/gpsRuns.ts:239`, `app/dashboard/opret/podcast/page.tsx:1-91`, `app/dashboard/opret/manuel/page.tsx:534,553,706,1497,1514`.
4. **Scanner er korrekt normaliseret.** Historiske scannerløb går til Manuel bygger, hvilket matcher scannerens nuværende handoff. Kilde: `utils/gpsRuns.ts:235`.
5. **Del til afvikling har en separat capability-grænse.** Knappen kan i dag vises bredere end den underliggende modal/API understøtter; den er kun dokumenteret for Manuel, Dansk, Engelsk, Matematik og Foto. En kommende menu må bruge samme registry som delingskontrakten, ikke blot race type. Kilder: `app/dashboard/arkiv/page.tsx:514-523`, `lib/runExecutionShare.ts:6`.
6. **Find Bedrageren kan se lukket ud efter reload.** Arkivets læsning henter kun `waiting`/`running`, mens spillet opretter eller genbruger `active`. Start kan fortsat genbruge sessionen, men åbent-lobby-status er ikke en pålidelig visning efter reload. Kilde: `app/dashboard/arkiv/page.tsx:627,747`.
7. **Den generiske builderrouter har en ekstra bruger.** `app/api/run-execution-share/route.ts` bruger også `getBuilderHrefForRaceType` efter kopiering. En bedre Arkiv-UI-melding for Podcast/Find Bedrageren skal derfor være en separat, UI-specifik capability-afgørelse og ikke en ændring af den generiske router.

## Tekst, der kan forenkles uden at fjerne funktion

| Flade | Fund | Forslag til næste ordre |
|---|---|---|
| Forside | Blå kampagnebjælke, hero-label, overskrift, to brødtekster, to CTA'er, mascot-kort og “gratis undervisningsværktøj” konkurrerer om samme første skærm. | Bevar én lærer-CTA: **Opret et løb**. Lad den sekundære CTA være en enkel tekstlink. Flyt eller nedton kampagnebjælken på forsiden. |
| Dashboard | “Hvad vil du lave?”, forklaringslinje, “Opret et løb”, en ny forklaringslinje og “Start” beskriver samme hovedhandling flere gange. Derudover vises Kort guide, kampagne, PWA-tip, lyd og assistent. | Bevar én hovedkorttekst og én CTA, fx **Opret løb**. Afklar én samlet hjælpestrategi: guide, assistent og PWA-tip skal ikke alle konkurrere ved første brug. |
| Buildervælger | Hero, anbefalet Lynbygger, “Andre måder”, fire kategorier og lange, markedsførende korttekster gør første valg større end nødvendigt. | Første niveau: **Start med Lynbyggeren** og **Vælg en anden type**. Vis specialformater først efter det aktive valg. |
| Builder-kort | Formuleringer som “smarte motor”, “moderne digital fangeleg”, “intens og sjov” og flere lange forklaringer sælger mere end de hjælper valgøjeblikket. | Ét konkret formål pr. kort: “Lav quiz med egne spørgsmål”, “Lav fra tekst”, “Lav fotoopgaver”, osv. Detaljer ligger inde i valgt format. |
| Arkiv | “Find dine tidligere eventyr her” er mindre præcist end funktionen; hvert kort har mange samtidige handlinger. | Brug **Dine gemte løb**. Bevar Start og reelt understøttet Redigér synligt; flyt Planlæg, Del, Resultater og Slet til et konsekvent “Flere handlinger”-mønster efter kontraktaudit. |
| Lærerværktøjer | Genbruger “Hvad vil du lave?” fra dashboardet. | Brug en funktionel overskrift: **Vælg et område** eller **Lærerværktøjer**. De tre grupper er ellers en god første filtrering. |
| Mobilspil / Find Bedrageren | Mobilspillets intro og Find Bedrageren-introen forklarer begge spil, roller og faser. | Lad hubben være ét valgskort. Lad næste side fokusere på én kort forklaring og **Start opsætning**. |
| `Skole & skærm` | Siden er formålstjenlig, men indledning og juridisk/politisk afgrænsning er bevidst detaljeret. | Kun strukturel forenkling: kort resumé, fold-ud kilder og tydelig CTA. Tekstlige påstande skal beholdes eller redigeres af ansvarlig fagperson. |

## Buildernes indre flader: auditstatus

En ny valgside er ikke nok. Følgende er den konkrete afgrænsning for en efterfølgende builder-opgave; den er bevidst opdelt efter data- og afviklingsrisiko.

| Builderområde | Faktisk funktion | Aktuel designrest | Sikker forenkling senere |
|---|---|---|---|
| Lynbygger | Genererer, kræver lærerens godkendelse og skriver derefter en Manual-kladde | Meget mørk/assistentpræget præsentation | Forkort introduktion og behold godkendelse, kladde og Manuel-handoff uændret. Kilde: `app/dashboard/opret/lynbygger/page.tsx:139-168`. |
| Manuel, Dansk, Engelsk, Matematik og Musikquiz | Persistente editorer med `?id=`, lokalkladder, kort og fokusindstillinger | Forskellig farve/hero/copy pr. fag samt store, tætte editorflader | Gør labels, sidehoved og sekundære indstillinger lokale og ens; flyt ikke kort, autosave, fokus eller payload-felter. |
| Foto mission | Redigerbar media-/opgavebuilder | Egen visuel identitet og uploadrelaterede tilstande | Harmoniser kun læseretning og knapper; bevar medier, validering, sortering og editload. |
| Scanner og Podcast | Upload-/tekst- eller URL-funnel til Manual | Mørke glas-/lilla flows og lang forklaringscopy | Kort copy kan samles, men kamera, fil-/kildehåndtering, samtykke, fejl, timeout og kladde-handoff må stå urørt. Kilder: `app/dashboard/opret/scanner/page.tsx:791-809`, `app/dashboard/opret/podcast/page.tsx:41-96`. |
| Fysisk Stjerneløb | Separat generering og print | Mørk violet læreropsætning | Lokal lys lærerflade er mulig, men print-layout, separat lagring og PDF-download er en isoleret kontrakt. Kilder: `app/dashboard/opret/stjerneloeb/page.tsx:34-49`, `app/dashboard/print/[id]/StjernelobPdfView.tsx:2427-2475`. |
| Zone-Krigen og Find Bedrageren | Spilopsætning, lobby og liveafvikling | Meget stærk spilvisuel identitet og ekstra forklaringslag | Zone behandles som redigerbar spilbuilder; Find får først ærlig Arkiv-capability. Timer, roller, sessioner, adgang og lobby hører til særskilte regressionstests. |
| Selfie, Escape, Rollespil og Stratego | Historisk redigering via Arkiv | Ældre, formatfarvede editorer | Ingen ny-oprettelsesmarkedsføring; kun lokal, regresstestet formforenkling efter en edit-only-kontrakt er låst. |

## Designrester og uens systemer

### Det, der allerede virker som fælles retning

- Hvid, dyb navy, stærk blå og meget lys blå findes allerede som gode byggesten (`app/globals.css:3-18`). De ligger dog side om side med grønne, sand- og gule generelle tokens, så en kommende retning skal gøre farvernes semantik eksplicit frem for at overskrive globalt.
- Dashboardets informationshierarki — én hovedhandling, Arkiv og Lærerværktøjer som sekundære valg — er den bedste lærerrettede struktur. Farver, hjælpelag og bannere skal derimod forenkles.
- Den nye dashboard-kontrakt med én hovedhandling, Arkiv og Lærerværktøjer som sekundære valg skal være designets udgangspunkt.

### Det, der konkurrerer med den retning

1. **Buildervælgeren er en mørk, flerfarvet glas-kortvæg.** Den blander cyan, grøn, indigo, amber, rose, pink, fuchsia, lilla, lime og orange, plus store skygger, blur og hover-bevægelser. Den er den tydeligste visuelle arv fra et tidligere “mange produkter på én gang”-udtryk. Kilde: `app/dashboard/opret/valg/page.tsx:20-27,65-166,431-572`.
2. **Arkivets race-type-temaer bruger samme regnbueprincip.** Type kan vises med ikon eller en diskret pill; hele kortet behøver ikke være farvekodet. Kilde: `utils/raceTypeTheme.ts:40-300`.
3. **Hero-banneret med landskab og mascot gentages på flere interne lærersider.** Det gør siderne mindre adskillelige og fylder før opgaven. Bevar det på forsiden og eventuelt store valg-hubs; brug ellers et lavt, funktionelt sidehoved.
4. **Der er tre samtidige hjælpelag på dashboardet:** aktiv Quick Guide, flydende assistent og den faste lydfunktion. Dertil er en ældre, deaktiveret tour stadig monteret. Det er produktstøj, ikke blot stil. Kilder: `app/dashboard/layout.tsx:29-46`, `components/OnboardingTour.tsx:7-11,160-166`.
5. **OnboardingModal er urefereret.** Den indeholder gammel neon-/salgs-copy og en opdigtet testimonial, men når ikke den aktive UI. Kandidat til en senere, eksplicit oprydningsordre — ikke denne designopgave. Kilde: `components/OnboardingModal.tsx:9-30,56-199`.
6. **`/teknologi` og `/opdateringer` er gamle kommunikationsflader.** Teknologisiden har teknologisælger-copy (“High-End”, “10x”, “markedets mest skalerbare”), mens opdateringssiden har rebrand-/“på vej”-tekst og en mørk særstil. Begge kræver redaktionel/ejerbeslutning, før de aflinkes eller omskrives. Kilder: `app/teknologi/page.tsx:4-135`, `app/opdateringer/page.tsx:10-78`.
7. **`/play/v2-test` er en testharness-route.** Den er ikke en produktside, men bruges af Playwright. Den bør ikke blive en del af et visuelt redesign; afgræns eller flyt den kun sammen med testændringer. Kilde: `app/play/v2-test/page.tsx:5-10`.
8. **`?debugNative=1` eksponerer en teknisk debugflade på forsiden.** Det er ikke en almindelig designflade og skal have en bevidst beslutning senere. Kilde: `components/HomePageClient.tsx:347-385`.
9. **Fælles kortkomponenter bærer stadig et farvekatalog.** `QuickActionCard` har seks farvetoner og en rainbow-stribe, og tomtilstanden bruger grøn som standardhandling. Det giver uens lærerflader, selv dér hvor hvert enkelt kort er roligt. Kilder: `components/brand/QuickActionCard.tsx:18-77`, `components/brand/AdventureEmptyState.tsx:42`.
10. **Informationsfladerne er visuelt splittede.** Hjælp, Skole & skærm og Om er overvejende lyse; IT-, jura-, privatlivs- og prissider er bevidst mørkere/glasagtige. Harmonisering må ikke ændre dokumentation, checkout, rettigheder eller juridisk indhold uden særskilt ansvarlig gennemgang.

### Ting, der ikke må kaldes “gammelt design” og fjernes nu

- **Postløp** er en aktiv, separat host-/sprogvariant, ikke en ubrugt kopi. Kilde: `lib/siteVariant.ts:9-37`.
- **`/om`**, **`/vaerktojer/skak`** og **`/dashboard/opret`** er kompatibilitetsredirects og skal bevares. Kilder: `app/om/page.tsx:1-4`, `app/vaerktojer/skak/page.tsx:1-5`, `app/dashboard/opret/page.tsx:1-4`.
- **Native elevstart, login, elev-/spilflader, live-afvikling, offline, Stjerneløb-bibliotek og printerflow** må gerne have egne mørke eller operationelle udtryk. De skal ikke styre lærerens planlægningsdesign, men heller ikke globalt hvid-/blåmales i første omgang.
- **`/priser`** er Zone-Krigens paywall-destination. Indhold, checkout og målgrupper kræver forretningsbeslutning, ikke en designoprydning.

## Hvid/blå designretning

### Princip

Lærerens arbejdsrum skal føles som et roligt arbejdsbord: hvid overflade, dyb navy-tekst, blå som eneste handlingsfarve og grøn kun til en faktisk aktiv/succes-tilstand. Farve må ikke være den primære måde at forklare en buildertype på.

### Konkret system

- **Baggrund:** `--skolegps-muted-bg` med højst to diskrete blå radialgradienter med lav opacitet.
- **Flader:** hvide kort, tynd `sky-100`-kant og én blød, lav skygge. Ingen glas-effekt som standard.
- **Handlinger:** blå primærknap; sekundær handling som blå tekst eller hvid knap med blå kant. Grøn reserveres til “løb åbent”, “gemt” eller “startet”. Rød reserveres til destruktive handlinger.
- **Kategorier:** neutralt ikon + tekst eller lille tonet pill. Ikke et helt orange/pink/lilla kort pr. race type.
- **Gradient:** kun som diskret atmosfære i topområdet eller én særlig primærhandling — aldrig som konkurrence mellem alle kort.
- **Mascot og landskab:** højst ét brandmoment pr. rejse. Forsiden kan bære det; interne opgaveflader bør bruge korte sidehoveder.
- **Motion:** korte, rolige feedback-overgange. Reduceret-motion-kontrakten bevares.
- **Indførsel:** tilføj først scoped, additive lærertokens og anvend dem rutevis. Omskriv ikke `:root`, printregler, PWA-/native-tema eller fælles body-baggrund i én designændring; de påvirker elev-, live- og printflader.

### Målbillede for de tre vigtigste lærerflader

| Flade | Første synlige beslutning | Efterfølgende valg |
|---|---|---|
| Dashboard | **Opret løb** | Arkiv, Lærerværktøjer, evt. aktivt løb. Hjælp holdes sekundær. |
| Opret løb | **Start med Lynbyggeren** eller **Lav selv** | Specialformater under “Se flere formater”. Ingen builder slettes. |
| Arkiv | Søg eller vælg løb | Start og Redigér synligt; øvrige handlinger samlet og kontekstuelle. |

## Sikker rækkefølge for den efterfølgende implementering

1. **Frys kompatibilitetskontrakter før designarbejde.** Skriv/udvid tests for alle 14 `RACE_TYPES`-værdier, `?id=`, redirects, Start, Planlæg, Resultater, Del, live-sessionstatus, print og elevflow. Dette er en nul-dataændringsfase uden virkelige datahandlinger.
2. **Lav en eksplicit capability-registry.** Mærk hver type som `new`, `funnel`, `edit-only`, `separate product` eller `unsupported edit` og angiv særskilt `filter`, `start`, `schedule`, `share`, `results` og `edit`. Find Bedrageren og Podcast skal være read-only/ikke understøttet i første sikre fase.
3. **Etabler fælles lærertokens og primitive komponenter.** Byg/tilpas kun fælles overflader, sidehoved, knapper, kort og action-menu med den hvid/blå retning. Ingen route- eller datalogik flyttes.
4. **Implementér dashboard og buildervælger først.** Bevar alle eksisterende hrefs, `data-tour`-mål og den primære rejse. Gør Lynbygger og Manuel til første niveau; flyt specialformater til progressiv afsløring.
5. **Normalisér Arkiv efter kontraktaudit.** Afled komplette filtre fra registry, medtag `active` Find Bedrageren-sessioner og brug en separat `getArchiveEditCapability(run)` frem for at ændre den generiske builderrouter. Derefter kan sekundære handlinger samles visuelt, uden at fjerne reelt understøttede Start-, Resultater-, Planlæg-, Del- eller Slet-handlinger.
6. **Harmoniser Lærerværktøjer og informationssider.** Bevar eksterne links, lov-/datatekster og den bevidste hjælpesides enkelhed. Afklar intern kontra ekstern SkemaPilot som produktbeslutning.
7. **Tag specialflader én ad gangen.** Mobilspil/Find Bedrageren, Zone-Krigen, Stratego, Stjerneløb, live og elevflow får hver deres afgrænsede opgave og regressionstest. De må ikke blive del af et globalt redesign.
8. **Beslut først derefter om udfasning.** Data-/brugsanalyse, arkivmigrering eller read-only fallback skal foreligge før en edit-only-builder, debugroute, gammel tour eller komponent fjernes. Ingen builder slettes i denne rækkefølge.
9. **Afslut med regression og visuel QA.** Test desktop og mobil for den primære lærerrejse, alle arkivløbstyper, reduceret motion, tastatur, elev join/play, live, print og loginredirects. Deploy først efter en særskilt implementeringsordre.

## Arkitektens beslutninger før næste ordre

1. Skal Podcast først forblive read-only i Arkiv, eller skal der finansieres en testet, tabsfri Podcast→Manuel-adapter? Den må ikke omdirigeres ubetinget til Manuel.
2. Skal Find Bedrageren have arkivredigering, eller skal Redigér være utilgængelig med en præcis forklaring?
3. Skal gamle buildertyper forblive edit-only på ubestemt tid, eller skal de have en senere migreringsplan?
4. Hvilken én hjælpeløsning er primær på dashboardet: Kort guide, assistent eller kontekstuel hjælp?
5. Hvem ejer indholdet på `/priser`, `/teknologi`, `/opdateringer` og den interne kontra eksterne SkemaPilot-vej?
6. Skal den separate Find Bedrageren-sessionstatus (`active` efter reload) løses som en funktionel fejl før eller sammen med Arkivets designforenkling?

## Konklusion til implementeringsordren

Start ikke med at slette eller slå byggere sammen. Start med at beskytte arkiv- og routekontrakterne, gør buildervalget progressivt og indfør det fælles hvid/blå lærersystem på dashboard, valg og Arkiv. Det giver en mærkbart enklere oplevelse uden at sætte gamle løb, elevflow eller aktive spil i risiko.
