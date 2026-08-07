# SkoleGPS databehandleraftale – skabelonartefakt

## Kilde og integritet

- Kilde: Datatilsynets danske standardkontraktbestemmelser efter GDPR artikel 28, stk. 3.
- Hentet: 7. august 2026.
- Referencefil: `Datatilsynet_standard_databehandleraftale_dansk.docx` (opbevaret uændret i opgavens midlertidige arbejdsmappe).
- SHA-256: `31D529F7B8CAFB52F63537CB74DBEA446782929AE803445AABD4B9996BACCAE2`.
- Standardskabelonens faste kontraktbestemmelser må ikke omskrives. Kun skabelonens valgmuligheder, felter og bilag udfyldes.

## Layoutkontrakt

- A4, stående format.
- Ét dokumentafsnit med Datatilsynets eksisterende sidehoved, sidefod, logo, typografi, nummerering og indholdsfortegnelse bevaret.
- Ingen ændring af overskriftsniveauer eller den juridiske hovedstruktur.
- Lange bilagstekster må brydes over flere sider, men tabelrækker og overskrifter skal holdes læsbare.
- Dokumentet skal markeres som `FØRSTEUDKAST – IKKE UNDERSKREVET` og tydeligt henvise til kommunens DPO-gennemgang.

## Udfyldningskontrakt

### Parter

- Dataansvarlig: kommune/skoleejer; alle identitets-, kontakt- og underskriftsfelter står som tydelige felter til udfyldelse.
- Databehandler: Jeppe Laursen, privatperson og ejer/driftsansvarlig for SkoleGPS.dk.
- Databehandleren er ikke CVR-registreret på udkaststidspunktet.
- Privat adresse og telefon må kun stå i den personlige aftale, ikke på en offentlig informationsside.

### Valg i standardbestemmelserne

- Tjeneste: SkoleGPS.dk – webbaseret oprettelse og afvikling af undervisningsløb.
- Underdatabehandlere: generel skriftlig godkendelse med 30 dages varsel.
- Kompetent tilsynsmyndighed: Datatilsynet.
- Brud: underretning uden unødig forsinkelse og om muligt senest 24 timer efter kendskab.
- Ophør: sletning og skriftlig bekræftelse; returnering kun efter særskilt dokumenteret instruks og hvor teknisk muligt.

## Behandlingsbeskrivelse

- Registrerede: lærere, undervisningskonsulenter, skoleadministratorer og elever/deltagere.
- Lærerkonto: navn, e-mail, autentifikations-id, login- og kontostatus, samtykke til produktnyt hvis afgivet.
- Elevdeltagelse: valgfrit fornavn/holdnavn, sessions- og deltager-id, aktuelle positionskoordinater og nøjagtighed under aktivt løb, tidsstempler, svar, point/resultater og foto ved fotoopgave.
- Teknisk drift: IP-/netværksoplysninger hos hosting- og kortleverandører, browser/enhed, URL/fejl-/driftsmetadata og pseudonyme tekniske id'er.
- Ingen elevkonto eller elev-e-mail er nødvendig i normal deltagelse.
- Særlige kategorier, CPR-numre og fortrolige elevsager er ikke tilsigtet og må ikke indtastes.
- Genkendelige personer må ikke fotograferes. Fotoopgaver skal tilrettelægges mod ting, steder eller ikke-identificerende motiver.

## Sletning og opbevaring

- Fotoobjekter og tilknyttede billedlinks er teknisk indstillet til automatisk oprydning efter 30 dage; læreren kan rydde tidligere via resultatsiden.
- Læreren kan manuelt rydde besvarelser, billeder, deltagere, sessionsdata og tilknyttede elevdata for et løb.
- Den aktuelle kode dokumenterer ikke en universel automatisk 30-dages sletning af alle øvrige elevdata. Aftalen må derfor ikke love dette som allerede implementeret.
- Foreslået instruks: dataansvarlige rydder løbsdata senest 30 dage efter aktiviteten, medmindre et kortere dokumenteret undervisningsbehov gælder. Databehandleren udfører dokumenterede sletteanmodninger uden unødig forsinkelse og normalt inden 30 dage.
- Aktuel GPS-position overskrives løbende på deltagerposten; der er ikke konstateret en særskilt historiktabel for standardløbet. Positionen fjernes sammen med deltager-/sessionsdata ved oprydning.
- Lærerskabte løb opbevares, indtil læreren sletter dem eller aftalen/kontoen ophører.
- Log- og backuppolitikker hos underdatabehandlere skal verificeres før underskrift; udkastet må ikke angive uverificerede garantier.

## Sikkerhedsrealiteter og åbne punkter

- TLS ved transport, server-only serviceadgang, RLS/adgangspolitikker, deltagerbinding og redaktion af tokens/navne/lokation i observability er dokumenteret i koden.
- Rå delingstokens gemmes ikke; delingslinks bruger fragment og hash-baseret opslag.
- Foto-bucketen `participant-uploads` er i den aktuelle migration markeret offentlig. Det er en væsentlig risiko og skal enten ændres til privat adgang med korte signaturer eller udtrykkeligt accepteres af kommunen før foto med personoplysninger kan bruges.
- Kortfliser/geokodning leveres direkte til browseren af eksterne tjenester og kan modtage IP-adresse og forespørgselsmetadata. Rolle, vilkår og geografisk behandling skal afklares eller tjenesterne skal erstattes/afgrænses før kommunal godkendelse.
- Vercels aktuelle DPA oplyser, at databehandlerrollen gælder Pro/Enterprise. SkoleGPS' konkrete plan og kontraktdækning skal verificeres.
- Supabase-projektets valgte region, backupretention og kontraktuelle DPA/SCC-status skal verificeres i leverandørkontoen.
- Sentry og Bugsnag er kodeunderstøttede, betinget af miljøkonfiguration; aktuel aktivering, konto, region og retention skal verificeres.
- OpenAI bruges i lærerrettede AI-funktioner. Elevdata og personhenførbart materiale må ikke sendes til AI-funktionerne. Aktuel DPA/SCC og kontoindstilling skal verificeres, hvis funktionen omfattes af kommunens brug.

## Underdatabehandlerklassifikation til bilag B/D

- Supabase, Inc.: database, autentifikation, Storage, Realtime og serverfunktioner; behandler centrale tjenestedata.
- Vercel Inc.: webhosting, edge/serverafvikling og aggregeret webanalyse; kan behandle tekniske forespørgselsdata og applikationsdata under afvikling.
- Functional Software, Inc. (Sentry): fejlmonitorering, hvis aktiveret; kun redigerede tekniske data må sendes.
- SmartBear Software, Inc. (Bugsnag): fejlmonitorering, hvis aktiveret; kun redigerede tekniske data må sendes.
- OpenAI Ireland Ltd./OpenAI-kontrakten: AI-behandling af lærerindhold, hvis funktionen bruges; ingen elevdata eller særlige kategorier må sendes.
- Stripe: betalingsbehandling er ikke en nødvendig del af skoleårets gratis elev-/løbsbehandling og beskrives som særskilt kommercielt flow, ikke som standard elevdatabehandling.
- OSM/CARTO/Esri/Nominatim og andre direkte korttjenester: eksterne modtagere, der skal afklares særskilt i bilag D før endelig aftale.

## DPO-gate

Før underskrift skal kommunen mindst godkende eller afklare:

1. dataansvarlig enhed, kontakt og behandlingsgrundlag;
2. om en konsekvensanalyse (DPIA) er nødvendig, navnlig pga. børn og lokation;
3. foto-bucketens adgangsmodel og kommunens forbud mod genkendelige personer;
4. Supabase-region, backup/sletning og DPA/SCC;
5. Vercel-planens DPA-dækning;
6. aktivering, placering og retention for Sentry/Bugsnag/Vercel Analytics;
7. kortleverandørernes rolle og overførselsgrundlag;
8. AI-funktionernes afgrænsning eller deaktivering;
9. en bindende automatiseret frist for øvrige elevdata, hvis kommunen ikke accepterer lærerens manuelle oprydning;
10. revisionsmodel, ansvar, erstatning, værneting og ophør.
