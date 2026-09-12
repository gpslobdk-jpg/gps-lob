# SkoleGPS — leveringsnote for enkelhed og design

> **Status:** Funktionel release verificeret i produktion. Denne post-release-optegnelse ændrer kun dokumentation.
> **Dato:** 12. september 2026.
> **Formål:** Nøgtern dokumentation af det aktuelle ændringsomfang, bevarede kontrakter og kendte verifikationsgrænser. Den er ikke i sig selv bevis for, at en produktion er gennemført.

## Mandat og afgrænsning

Den oprindelige bestilling af <code>SKOLEGPS_AUDIT_ENKELHED_OG_DESIGN.md</code> var udtrykkeligt en read-only audit uden kodeændringer eller deployment. Den efterfølgende direkte brugerbesked bad om at “udfør det hele og sæt det i produktion” og henviste til den nye implementeringsordre. Det erstattede auditgrænsen med mandat til den afgrænsede implementering, kvalitetssikring og normale releaseproces.

Denne levering ændrer ikke datamodel, historiske løbstyper, adgangsregler, betalings-/entitlementlogik eller produktionens data som et designgreb. Den bevarer eksisterende routes og fokuserer på lærerflader, ærlig arkivadfærd og afgrænset copy/styling.

## Statusnøglen

| Status | Betydning |
|---|---|
| **Omlagt** | Den konkrete UI-/copy-/overfladeflade er ændret i denne levering. |
| **Verificeret konsistent** | Route, redirect eller kontrakt er kontrolleret i kilde og/eller en navngiven fokuseret test uden bevidst visuel omlægning. |
| **Beskyttet undtagelse** | Fladen er bevidst holdt uden for den generelle hvid/blå restyling, fordi den er elev-, live-, spil-, print- eller sikkerhedskritisk. |
| **Konkret uafklaret** | En nødvendig fuld test mangler; det må ikke omtales som grønt eller som et produktionsbevis. |

En “verificeret konsistent” route er ikke det samme som en komplet visuel browsergennemgang på alle breakpoints. Den skelnen er særlig vigtig for godkendte lærerflows, der lokalt mangler den offentlige Supabase-konfiguration.

## Fælles designretning

Lærerfladerne bruger et afgrænset, hvidt/blåt overfladesystem: lys blå sidebaggrund, hvide arbejdsflader med blå kant, tydelig blå primærhandling og diskrete overgange. Det er indført via navngivne lærer-/builder-scopes frem for at ændre elev-, live-, print- eller Postløp-flader globalt. Mørke eller spilprægede runtimeflader er derfor ikke blevet gjort hvide alene for ensartethedens skyld.

## Dækningskort

### Offentlige sider og information

| Ruter/område | Status | Faktisk dækket nu | Grænse eller bevaret kontrakt |
|---|---|---|---|
| <code>/</code> | **Omlagt** | Kompakt mobilnyhed, ét hero-budskab, én tydelig opret-handling og tre GPS-trin. | Elevens adgang og nødvendige navigation er bevaret. |
| <code>/hjaelp</code>, <code>/mobil-i-skolen</code>, <code>/teknologi</code>, <code>/opdateringer</code>, <code>/manden-bag-skolegps</code> | **Omlagt** | Roligere sidehoveder og kortere, konkrete indgange. | Mobilartiklens forbehold/kilder, CV, begge kontaktadresser og dokumentlink er ikke erstattet af salgstekst. |
| <code>/om</code> | **Verificeret konsistent** | Den permanente redirect til <code>/manden-bag-skolegps</code> er bevaret i kilde. | Ingen ny separat Om-side eller ændret URL-kontrakt. |
| <code>/privacy</code>, <code>/gdpr</code>, <code>/it-afdelinger</code>, ophavsretssider og <code>/priser</code> | **Beskyttet undtagelse** | Ikke brugt som marketingflader eller slettet. | Juridisk indhold, pris/adgang og eksterne driftsforhold kræver egne ejerbeslutninger; den aktuelle Zone-Krigen-adgangsflagstatus er ikke en visuel påstand her. |
| Postløp host-/sprogvariant | **Verificeret konsistent** | Forsidekontrakten er dækket af den fokuserede forsidetest. | Danske kampagne-/Jeppe-elementer er ikke med vilje ført ind i Postløp-layoutet. |

### Lærerens startpunkter

| Ruter/område | Status | Faktisk dækket nu | Grænse eller bevaret kontrakt |
|---|---|---|---|
| <code>/dashboard</code> | **Omlagt** | Ét klart “Opret et løb”, roligere indgange til arkiv og værktøjer, aktivt løb kun når det findes, og behovsbaseret Hjælp. | Ingen ny guide-, chatbot- eller PWA-prompt åbner automatisk på denne startflade. |
| <code>/dashboard/opret</code> | **Verificeret konsistent** | Redirect til <code>/dashboard/opret/valg</code> er bevaret. | Eksisterende deep link fortsætter med samme mål. |
| <code>/dashboard/opret/valg</code> | **Omlagt** | Lynbygger og Lav selv er første niveau; de øvrige etablerede indgange ligger i ét tastaturvenligt “Flere formater”. | De oprindelige destinationsruter er bevaret, inkl. betinget Zone-Krigen-destination. |
| <code>/dashboard/arkiv</code> | **Omlagt** | Hvid/blå arkivflade, komplet typefilter fra den centrale typekapabilitet og ærlige redigeringshandlinger. | Ingen løb slettes, normaliseres eller konverteres. |
| <code>/dashboard/laerervaerktoejer</code> og <code>/dashboard/indstillinger</code> | **Omlagt** | Lærerhub og indstillinger bruger den samme rolige overflade og kortere hierarki. | Interne/eksterne destinations- og SSO-parametre er bevaret. |
| <code>/dashboard/laerervaerktoejer/skak</code>, <code>/dashboard/laerervaerktoejer/aarsplan-generator</code>, <code>/dashboard/laerervaerktoejer/skemapilot</code> | **Beskyttet undtagelse** | Hubben peger fortsat på de samme værktøjer. | De enkelte værktøjers egne flows, konti og ejerskab er ikke redesignet her. |
| <code>/vaerktojer/skak</code> | **Verificeret konsistent** | Den korte redirect til lærerhubben er bevaret i kilde. | Ingen ændret auth- eller værktøjskontrakt. |

### Byggere og gemte løbstyper

Lynbygger er en oprettelsesvej og ikke en selvstændig gemt <code>race_type</code>. Den centrale <code>RACE_TYPE_CAPABILITIES</code>-registrering dækker de 14 gemte typer og skelner bevidst mellem ny oprettelse, historisk deep link og sikker arkivredigering.

| Bygger/type | Oprettelsesindgang | Arkivredigering | Status og bevaret kontrakt |
|---|---|---|---|
| Lynbygger | Direkte, primær | Handoff til Manuel efter eksisterende kladdekontrakt | **Omlagt.** Route og kladde-handoff er bevaret. |
| Manuel / Generel Quiz | Direkte, primær | Understøttet med eksisterende <code>?id=</code>-vej | **Omlagt.** Formel copy er kortet; gemme- og redigeringsvej er ikke flyttet. |
| Dansk, Engelsk, Matematik og Musikquiz | Direkte under Flere formater | Understøttet med eksisterende <code>?id=</code>-veje | **Omlagt.** Indgange, formularstate og typekontrakter er bevaret. |
| Foto mission | Direkte under Flere formater | Understøttet med eksisterende <code>?id=</code>-vej | **Omlagt.** Fotoformatets eksisterende flow er ikke konverteret. |
| Scan bogen / Scanner | Direkte handoff under Flere formater | Understøttet via eksisterende Manuel-redigering | **Omlagt.** Kamera/upload/OCR, samtykke, kladde og overdragelse til Manuel er bevaret; fuld persisted-data genåbning er fortsat en autentificeret E2E-grænse. |
| Podcast-Detektiven | Direkte import-/handoff-vej under Flere formater | **Ikke understøttet** for eksisterende løb | **Omlagt og beskyttet.** Se den eksplicitte beslutning nedenfor. |
| Fysisk Stjerneløb og bibliotek | Direkte print-specialformat under Flere formater | Separat bibliotek-/printspor, ikke en generisk <code>race_type</code>-editor | **Omlagt.** Bibliotek, kategori-navigation og printspor er bevaret. |
| Zone-Krigen | Direkte, fortsat under eksisterende adgangskontrol | Understøttet med eksisterende <code>?id=</code>-vej | **Omlagt.** Kort, GPS, zoner, spørgsmål, kladde, arkivimport, Fokusmode og gemning er holdt urørte. |
| Find Bedrageren | Indirekte via <code>/dashboard/mobilspil</code> | **Ikke understøttet** for eksisterende spil | **Omlagt ved mobilspilsopsætningen; beskyttet i arkivet.** Se den eksplicitte beslutning nedenfor. |
| Selfie, Escape, Rollespil og Live Stratego | Ikke vist som ny-oprettelsesvalg | Understøttet med deres eksisterende <code>?id=</code>-veje | **Omlagt som edit-only-flader.** Historiske URL’er, indlæsning, gemning og spil-/livekontrakter er beholdt. De er ikke genintroduceret som nye valg i vælgeren. |

### Specialflader, elevflader og andre afkroge

| Ruter/område | Status | Faktisk dækket nu | Grænse eller bevaret kontrakt |
|---|---|---|---|
| <code>/dashboard/mobilspil</code> og <code>/dashboard/mobilspil/find-bedrageren</code> | **Omlagt** | Kortere lærerintroer og roligere opsætning. | Regler, roller, lobby, spillogik og den efterfølgende elevafvikling er ikke omskrevet. |
| <code>/dashboard/opret/find-bedrageren</code> | **Beskyttet undtagelse** | Historisk direct/deep-link-vej er fortsat registreret. | Arkivet lover ikke længere en editor, der ikke er dokumenteret. |
| <code>/dashboard/opret/stjerneloeb</code> og bibliotekruter | **Omlagt** | Lærerintroduktioner og biblioteksoverflader er forenklet. | Printlayout, sidestørrelse og læsbarhed er ikke globalt restylet. |
| <code>/dashboard/opret/zone-krig</code> og <code>/dashboard/opret/stratego</code> | **Omlagt** | Sikker læreropsætning, navigation og labels er harmoniseret. | Spilspecifikke regler, timer, scoring, kort og adgang er ikke ændret som designarbejde. |
| <code>/dashboard/live/[sessionId]</code>, Zone-/Find-live, <code>/dashboard/resultater/[runId]</code>, <code>/dashboard/print/[id]</code> | **Beskyttet undtagelse** | Ingen generel layout-/state-/GPS-omlægning. | Aktive løb, resultater og print er operationskritiske; de kræver deres egne regressionstests ved ændring. |
| <code>/join</code>, <code>/play/[sessionId]</code>, bonus, <code>/play/v2-test</code>, Find Bedrageren join/spil og <code>/~offline</code> | **Beskyttet undtagelse** | Elevrejse, GPS/status, progression, offline og holdidentitet er ikke ændret af lærerdesignets scopes. | Ingen fysisk enheds- eller skolenetværksverifikation er hævdet. |
| <code>/login</code>, fejl-/loadingflader og <code>/dashboard/admin/*</code> | **Konkret uafklaret** | Ingen ny authvej eller adminadgang er tilføjet. | Den lokale testkontekst havde ikke en relevant offentlig Supabase-konfiguration eller autoriseret adminrolle til en komplet browserkontrol. |
| <code>?debugNative=1</code>, deaktiveret tour og urefererede onboardingrester | **Beskyttet undtagelse** | Ikke genaktiveret eller blindt slettet. | De er ikke markedsføringsflader og bør kun ændres med en selvstændig kontrakt. |

## Arkivets sikre redigeringsbeslutninger

### Podcast-Detektiven

Eksisterende podcastløb sendes **ikke** til Manuel eller en ny import som om de kunne redigeres tabsløst. Kapabilitetsregistreringen markerer podcast-arkivredigering som ikke understøttet, og arkivet viser i stedet en læsbar forklaring. Direkte historiske <code>?id=</code>-links bevares, men podcastfladen viser også den ærlige status frem for at starte et tomt/nye løb.

Det betyder konkret:

- ingen ændring af <code>race_type</code>;
- ingen kopi eller nyt løb som erstatning for redigering;
- eksisterende løb og deres afvikling/startmulighed bevares;
- en rigtig podcasteditor eller dokumenteret tabsløs kompatibilitet er et særskilt senere arbejde.

### Find Bedrageren

Eksisterende Find Bedrageren-spil får heller ikke en falsk Redigér-handling i arkivet. Registreringen markerer redigering som ikke understøttet og bevarer de historiske destinationsveje, opsætning, lobby/afvikling og startmulighed. Der er ikke bygget en ny arkiveditor som sideeffekt af makeoveren.

For begge typer gælder den samme sikkerhedsregel: at en historisk deep link findes, er ikke i sig selv bevis for, at arkivet sikkert må love redigering.

### Øvrige arkivtyper og legacy

Arkivets filter kommer nu fra den samme centrale typeoversigt som builderrouting. Den omfatter alle registrerede gemte typer, inklusive Selfie, Escape, Rollespil og Find Bedrageren. Ukendte typer får en sikker unsupported-status i stedet for vilkårlig routing. Historiske edit-only-ruter for Selfie, Escape, Rollespil og Stratego er bevaret med <code>?id=</code>; deres eksisterende arkivredigering markeres fortsat som understøttet.

Arkivet anerkender desuden <code>active</code> som en aktiv live-sessionstatus sammen med de tidligere relevante statusser, så en faktisk aktiv session ikke præsenteres som inaktiv af den nye overflade.

## Test- og verifikationsspor

Følgende resultater er registreret under den aktuelle implementering og skal fastholdes eller gentages ved den afsluttende releasekontrol. De er ikke erstattet af en uprøvet grøn markering i dette dokument.

| Kontrol | Registreret resultat | Dækning / begrænsning |
|---|---|---|
| <code>npx.cmd next typegen</code> og <code>npx.cmd tsc --noEmit</code> | Bestået | Typegenerering og TypeScript for den samlede ændringsmængde. |
| Målrettet ESLint for ændrede lærer-/arkiv-/builderfiler | Bestået | Den globale lintkommando har fortsat eksisterende fejl uden for denne levering; den blev ikke skjult ved at ændre regler eller slette tests. |
| <code>tests/race-type-capabilities.spec.ts</code> | 4/4 bestået | Registrering, filterdækning, legacy-ruter og sikre unsupported-tilfælde. |
| <code>tests/run-execution-share.spec.ts</code> | 12/12 bestået | Eksisterende afviklings-/delingskontrakt. |
| Snæver <code>dashboard-first-run</code>-kontrakt | 1/1 bestået | Kildemæssig dashboard-/vælgerkontrakt, ikke et fuldt autentificeret lærerforløb. |
| <code>tests/homepage-background-video.spec.ts</code> | 8/8 bestået | Forside- og Postløp-variantgrænser. |
| Fokuseret Zone-Krigen Playwright-test | Bestået | Isoleret Zone-Krigen-lærerflade; ikke en fysisk GPS-/spiltest. |
| Lokal produktionsbuild, visuel forsidekontrol | Bestået ved 360, 768 og 1440 px | Faktiske screenshots blev kontrolleret med reduceret bevægelse; den forenklede nyhed, hero, trin, founder-indgang og footer havde ingen observeret vandret overflow. |
| <code>git diff --check</code> | Bestået ved de fokuserede ændringer | Skal køres igen på den endelige, staged releasegren. |

Det komplette lokale browserforløb med syntetisk lærerlogin kunne ikke etableres, fordi denne checkout mangler de nødvendige offentlige Supabase-variabler. Fejlen må ikke fortolkes som en produktregression, og der blev ikke indsat falske værdier eller foretaget dataændrende testkald for at omgå den. Derfor er især følgende stadig **konkret uafklaret**, indtil de køres i en passende testkontekst:

- autentificeret dashboard → Lynbygger → Manuel → gem → arkiv → genåbn;
- persisted-data redigering for alle understøttede arkivtyper;
- upload/OCR, kort/GPS, print og live-afvikling i en reel testkonto;
- Find Bedrageren-loadingobservationen fra auditten;
- adminflader med korrekt rolle;
- visuel browserkontrol af autentificerede lærerflader og specialbyggere ved 360, 768 og 1440 px i relevante motorer.

Der er **ingen** påstand om fysisk iPhone-, Android- eller skolenetværkstest. Viewport- eller browserautomatisering kan ikke dokumentere GPS-, baggrunds- eller livscyklusadfærd på rigtige enheder.

## Releaseoptegnelse

| Felt | Værdi |
|---|---|
| Releasebranch | <code>main</code> |
| Præcis funktionel release-commit (SHA) | <code>bdafaeae5db5d5f0778d342ab0c4d1a215ac1aeb</code> |
| Git push til <code>origin/main</code> | Gennemført 12. september 2026 |
| Verificeret SkoleGPS-produktionsprojekt | <code>Production – gps-lob.dkkk</code>; offentlig kanonisk adresse <code>https://www.skolegps.dk</code> |
| Vercel/GitHub deployment-id og status | GitHub deployment <code>6409311486</code>, <code>success</code>; præcis SHA matchede releasen |
| Tidspunkt for produktionsklar status | Verificeret 12. september 2026 efter Vercel-success |
| Read-only produktionssmoke: forside, nyhedslink, Om/CV, hjælp, <code>/join</code>, loginredirect | Bestået: apex 308 til www; forside, <code>/join</code>, <code>/hjaelp</code>, <code>/mobil-i-skolen</code> og founder/CV-rute 200; uautentificeret <code>/dashboard</code> 307 til sikker login-next. Browserkontrol bekræftede den nye forside, hjælp og CV-indgang. |
| Autoriseret lærer-/arkiv-/buildernavigation i egnet testkontekst | Ikke udført: denne checkout manglede offentlige Supabase-testvariabler. Det er registreret som uafklaret, ikke som bestået. |
| Git-status efter funktionel release | Ren <code>main</code> synkroniseret med <code>origin/main</code> før denne dokumentationsoptegnelse. |
| Tilbageførselsreference til foregående stabile apprevision | <code>3bc7e47f0ceb3c918819e5b213ab2e716d695674</code> |

Denne optegnelse bekræfter den funktionelle production-release. Den efterfølgende dokumentationscommit indeholder ingen app- eller datakontraktændringer.
