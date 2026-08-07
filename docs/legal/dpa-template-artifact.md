# SkoleGPS standarddatabehandleraftale – dokumentkontrakt

## Dokumentidentitet

- Titel: `Standarddatabehandleraftale – SkoleGPS`
- Version: `1.1`
- Udgivet: `8. august 2026`
- Senest opdateret: `8. august 2026`
- Dokumentansvarlig: `Jeppe Laursen, SkoleGPS.dk`
- Status: `Ikke underskrevet standardskabelon`
- Kildeskabelon: Datatilsynets danske standardkontraktbestemmelser.

## Layout og redigering

- Skabelonens faste juridiske hovedstruktur, sidehoved, logo, typografi, nummerering og indholdsfortegnelse bevares.
- Kun skabelonens valgmuligheder, partsfelter og bilag udfyldes.
- Kommune-/skoleejerfelter står som `[UDFYLDES AF KOMMUNEN/SKOLEEJEREN]`.
- Den offentlige version må ikke indeholde interne noter, kontrolmarkører, TODO/TBD, lokale filstier eller hemmeligheder.
- Word og PDF skal have samme materielle indhold, version og dato.

## Parter og valg

- Dataansvarlig: Den konkrete kommune/skoleejer, som udfylder navn, CVR, adresse, kontaktperson, behandlingsgrundlag og underskriver.
- Databehandler: Jeppe Laursen, privatperson og ejer/driftsansvarlig for SkoleGPS.dk, uden CVR.
- Tjeneste: Webbaseret oprettelse, deling og afvikling af undervisningsløb.
- Underdatabehandlere: Generel skriftlig godkendelse med mindst 30 dages varsel ved ændringer.
- Brud: Underretning uden unødig forsinkelse og om muligt senest 24 timer efter kendskab.
- Ophør: Sletning og skriftlig bekræftelse; returnering efter særskilt dokumenteret instruks, hvor teknisk muligt.

## Behandling og registrerede

- Lærere/konsulenter: navn, e-mail, autentifikations-id, loginudbyder, kontostatus, oprettede løb og frivilligt produktnyt.
- Elever/deltagere: valgfrit holdnavn eller kort fornavn, sessions- og deltager-id, aktuel GPS-position og nøjagtighed, tidsstempler, svar, point/status og foto ved fotoopgave.
- Drift: IP-/netværksoplysninger hos drifts- og kortleverandører, browser/enhed, redigerede URL-, fejl- og driftsmetadata.
- Elever deltager uden elevkonto og elev-e-mail.
- CPR-numre, særlige kategorier, fortrolige elevsager og andre unødvendige personoplysninger må ikke indtastes.
- Fotoopgaver må kun vise ting, steder og andet ikke-personhenførbart indhold. Genkendelige personer må ikke fotograferes.

## GPS

- Elevens position sendes til serveren under et aktivt løb og gemmes på deltagerposten som breddegrad, længdegrad, nøjagtighed og seneste opdatering.
- Den aktuelle position overskrives løbende; standardflowet har ikke en særskilt positionshistoriktabel.
- Afstand til posten beregnes i elevens browser.
- Positionen nulstilles ved afslutning/forladelse og skjules/slettes automatisk efter 15 minutters inaktivitet.
- Positionsfelter fjernes fra elevsvar, så GPS ikke indgår i arkiverede resultater.

## Opbevaring og sletning

- Læreren kan fra resultatsiden rydde fotos, svar, deltagere, sessionselever, beskeder og live-sessioner for løbet.
- Fotoobjekter og billedreferencer har en fast standardfrist på 30 dage.
- Almindelige elevsvar, deltagere, navne, beskeder og afsluttede live-sessioner har en fast standardfrist på 90 dage.
- Tekniske oprydningslogs uden elevoplysninger har en frist på 30 dage.
- Hosted cron og Edge-funktion er forberedt versionsstyret, men må ikke beskrives som aktive i produktion, før migration, cron.job og jobhistorik er verificeret. Indtil da er lærerens manuelle oprydning bindende.
- Lærerkonto og lærerskabte løb opbevares, mens konto/aftale er aktiv, og slettes efter verificeret anmodning eller ophør med forbehold for lovpligtig opbevaring og lukkede backups.
- Leverandørspecifik retention for logs og backups følger godkendte leverandørvilkår; der gives ikke et særskilt RTO/RPO-løfte.

## Sikkerhed

- HTTPS/TLS, Supabase RLS, ejerskabskontrol, deltagerbinding og serverbeskyttede privilegerede nøgler er dokumenteret i kodebasen.
- Rå delingstokens gemmes ikke; delingslinks bruger URL-fragment, SHA-256-digest, no-store/noindex og tokenredaktion.
- Sentry fjerner brugerobjektet og redigerer navn, e-mail, PIN-/løbskoder, tokens, sessions-/deltager-id, svar, billeder og lokation.
- Bugsnag er en betinget kodeintegration og er ikke godkendt som aktiv underdatabehandler i version 1.0. Den må ikke aktiveres til kommunens personoplysninger uden ændringsvarsel, kontraktgrundlag og global redaktion.
- Foto-bucketen er privat. Browseren modtager ikke objektstien; en autentificeret lærer får først et 60-sekunders signed URL efter kontrol af løbs-, svar- og fotoejerskab.
- Forbuddet mod genkendelige personer og fortroligt indhold i fotoopgaver gælder fortsat som dataminimering.

## Godkendte underdatabehandlere i version 1.1

- Supabase, Inc.: database, login, Storage, Realtime og serverfunktioner. Projektkonfigurationen angiver region `eu-west-1` (Irland); support, backups og underleverandører følger gældende DPA.
- Vercel Inc.: webhosting, edge/serverafvikling og webanalyse. Må kun anvendes til kommunens personoplysninger på en plan med kontraktuel DPA-dækning.
- Functional Software, Inc. (Sentry): aktiv fejlmonitorering med valgt datalagringsregion Tyskland og redigerede tekniske data.
- OpenAI Ireland Ltd.: frivillige lærerrettede AI-funktioner. Elevdata, genkendelige fotos, lokation, særlige kategorier og fortroligt materiale må ikke sendes.

## Andre eksterne tjenester og betingede funktioner

- OpenStreetMap/Nominatim, CARTO og Esri leverer kortfliser eller geokodning direkte til browseren og modtager teknisk nødvendige IP- og forespørgselsdata.
- Pollinations, YouTube og Apple iTunes-søgning kan bruges i frivillige lærerrettede indholdsflows; elevdata må ikke sendes.
- Stripe er kun relevant, hvis betaling aktiveres, og er ikke en nødvendig del af skoleårets gratis elev-/løbsbehandling.
- Bugsnag/SmartBear må ikke aktiveres til kommunens personoplysninger uden et varslet og dokumenteret kontrakt- og sikkerhedsgrundlag.

## Kommunens konkrete udfyldelse og vurdering

1. Juridisk navn, CVR, adresse, kontaktperson, behandlingsgrundlag og underskriver.
2. Behovet for en konsekvensanalyse (DPIA) ved børn og præcis lokation.
3. Om fotoopgaver med ikke-personhenførbare motiver må anvendes.
4. Om frivillige lærerrettede AI- og indholdsfunktioner må anvendes.
5. Ansvar for tidligere manuel sletning og kontrol af de aftalte automatiske frister.
6. Kommunens kontaktvej ved brud og anmodninger fra registrerede.
7. Eventuelle supplerende krav til support, oppetid, revision, ansvar, forsikring, værneting og ophør.
