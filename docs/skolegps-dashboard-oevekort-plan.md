# SkoleGPS lærerhub og Øvekort

## Status

**I gang, lokal featuregren.** Dette dokument skelner bevidst mellem kode,
test og frigivelse. Ingen ny database-migration er anvendt uden for denne
checkout, og ingen deployment er foretaget som del af den første byggefase.

## Baseline (22. september 2026)

| Felt | Værdi |
| --- | --- |
| Repository | `gpslobdk-jpg/gps-lob` |
| Udgangspunkt | `main` ved `4f66aea` |
| Arbejdsgren | `codex/teacher-dashboard-oevekort` |
| Urelaterede lokale filer | Usporede PWA-/review-artefakter var til stede før arbejdet og må ikke stages eller fjernes. |

## Afgrænsning

Lærerhubben udvider kun lærerflader. `/join`, `/play/[sessionId]`, QR-join,
liveafvikling, GPS-/postregistrering, builders, Family SSO og PWA-elevflowet
beholdes som selvstændige kontrakter. Hverken loginmodel, domæner eller
elevidentiteter ændres.

## Verificeret rute- og værktøjsoversigt

| Produkt | Destination | Status i hubben | Grundlag |
| --- | --- | --- | --- |
| GPS-løb | `/dashboard/opret/valg` | Åben | Eksisterende lærerflow |
| DagensTavle | Familie-SSO til `/tavle` | Åben | Eksisterende, allowlistet SSO-destination |
| PrintMitArbejdsark | Familie-SSO til `/lav` | Åben | Eksisterende, allowlistet SSO-destination |
| Skak | `/dashboard/laerervaerktoejer/skak` | Åben | Eksisterende lærerroute |
| KildeGPS | `https://www.kildegps.dk` | Åben | Eksisterende værktøjslink |
| UgePilot | — | Ikke vist som åbent | Ingen verificeret destination i denne checkout |
| Øvekort | `/dashboard/laerervaerktoejer/oevekort` | Kommer snart indtil migration og release er verificeret | Ny, afgrænset funktion |

Facebook-invitationen bruger det brugerleverede, konkrete gruppelink
`https://www.facebook.com/groups/1649785632764130/`. Det er et frivilligt
almindeligt link; der indføres ikke Facebook-login, pixel, feed eller
medlemskontrol.

## Data- og adgangsbeslutninger

1. **DagensTavle-data:** Der findes ingen verificeret, autoriseret datavej i
   denne checkout. Dashboardet viser derfor en ærlig genvej/empty state i
   stedet for en opdigtet dagsplan.
2. **Senest brugt:** Kun en kontoafgrænset, lokal åbnehistorik for værktøjer
   må vises. Det må ikke omtales som redigeringshistorik eller deles mellem
   lærere.
3. **Øvekort lærerroute:** Funktionen lægges under
   `/dashboard/laerervaerktoejer/oevekort`, så den benytter den eksisterende
   beskyttede lærerflade og safe-next-kontrakt.
4. **Øvekort elevdeling:** Den offentlige indgang er `/oevekort/del#<token>`.
   Tokenet ligger i fragmentet, fjernes fra adresselinjen ved åbning og
   sendes kun i en POST-body. Deling er read-only, kan tilbagekaldes og
   kræver ikke elevkonto.
5. **Databasegrænse:** Øvekort-tabeller bruges kun fra serverruter efter
   verificeret lærerlogin. Data API-adgang er lukket; databasefunktioner er
   service-role-only og håndhæver ejerskab igen.

## Rollback- og frigivelsesretning

UI kan deaktiveres ved at fjerne hub-entryen uden at røre GPS-flows.
Øvekort-migrationen er additiv; tabellerne slettes ikke ved en almindelig
app-rollback. Før nogen produktionsfrigivelse kræves migrationstest,
verificeret preview, præcis commit/deployment-evidens og en kontrolleret
ejer-/anonym delingssmoke. En grøn build er ikke i sig selv en frigivelse.
