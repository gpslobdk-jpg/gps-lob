# Isoleret databasetest: Del til afvikling

Denne plan må kun køres mod en ny lokal Supabase/Postgres-database eller et
udtrykkeligt separat testprojekt. Den må aldrig køres mod produktion.

## Sikker start

1. Kontrollér, at databasehosten er `localhost`, `127.0.0.1` eller `::1`. Ved et
   separat testprojekt skal projekt-reference, navn og tom datamængde bekræftes
   manuelt af to personer før start.
2. Kontrollér, at projektet ikke indeholder produktionsbrugere eller elevdata.
3. Anvend migrationerne på den tomme testdatabase.
4. Opret kun syntetiske testbrugere med domænet `local.test` og løbstitler med en
   unik `run-execution-share-test-<uuid>`-præfiks.
5. Brug mindst to uafhængige databaseforbindelser til race-tests. Rul testdata
   tilbage eller slet kun rækker med den unikke testpræfiks efter testen.

Stop straks, hvis host-, projekt- eller datakontrollen ikke kan bekræftes.

## Basisscenarie og kopigrænse

- Opret syntetiske brugere `owner`, `teacher-a`, `teacher-b` og `new-owner`.
- Opret et `manuel` source-run ejet af `owner`, med alle de materiale-felter som
  claim-RPC'en må kopiere.
- Opret samtidig en source-session med syntetisk PIN, en syntetisk deltager og
  syntetiske svar/resultater/uploads, hvor den lokale test-schema tillader det.
- Opret en deling med et lokalt genereret tokenhash og claim som `teacher-a`.
- Kontrollér, at kopien ejes af `teacher-a`, og at de eksplicit tilladte
  materiale-felter er kopieret.
- Kontrollér, at kopiens ID ikke findes i sessions-, deltager-, svar-, resultat-,
  upload-, statistik- eller specialspilstabeller. Source-rækkerne skal være
  uændrede.

## Tombstone og ny separat deling

1. Kontrollér, at claimet `(share_id, teacher-a)` findes med kopiens ID.
2. Slet kopien og kontrollér direkte i SQL, at claim-rækken stadig findes, og at
   `copied_run_id is null`.
3. Claim samme share igen. Resultatet skal være `already_claimed = true`,
   `copy_deleted = true` og `copied_run_id is null`.
4. Kontrollér, at der ikke er oprettet et nyt `gps_runs`-objekt til `teacher-a`.
5. Rotér til en ny separat share og claim dens nye token som `teacher-a`. Der skal
   nu oprettes præcis én ny kopi efter de normale regler.

## Ejerskab og metadata

- Preview og claim skal virke, mens source-rækkens `user_id` matcher share-rækkens
  `owner_id`.
- Overfør source-rækken privilegeret til `new-owner` uden at ændre share-rækken.
- Preview med det gamle token skal fejle med `share_invalid_or_inactive` og må
  ikke returnere titel, fag, klassetrin, bruger-ID eller andre metadata.
- Claim med det gamle token skal fejle med samme generiske kontrakt, og antallet
  af kopier og claims må ikke ændre sig.

## Schedule-matrix

Kør hvert input gennem en rigtig claim og læs description/topic på kopien:

| Input | Forventet kopi |
| --- | --- |
| `{"schedule":{"startAt":"2026-08-10T08:00:00.000Z","endAt":null},"note":"Bevar"}` | `{"note":"Bevar"}` |
| `{"gpslobSchedule":{"startAt":null,"endAt":"2026-08-10T10:00:00+02:00"},"note":"Bevar"}` | `{"note":"Bevar"}` |
| `{"schedule":"Læs kapitel 1"}` | byte-for-byte uændret |
| `{"startAt":"Start ved biblioteket"}` | byte-for-byte uændret |
| `{"schedule":{"startAt":null,"endAt":null}}` | byte-for-byte uændret |
| `{"schedule":{"startAt":"2026-99-99T08:00:00Z"}}` | byte-for-byte uændret |
| `Almindelig tekst  ` | byte-for-byte uændret, inklusive afsluttende mellemrum |
| `Intro\n\n[gpslob_schedule]{"startAt":"2026-08-10T08:00:00.000Z","endAt":null}` | `Intro` |
| `Intro [gpslob_schedule]{ikke-json}` | byte-for-byte uændret |

Kør matricen både i `description` og `topic`.

## Race-tests med to forbindelser

- **To claims:** Send samme `(token, teacher-a)` samtidigt. Begge kald skal ende
  på samme kopieringsresultat; der må være én claim og én kopi.
- **Revoke mod claim:** Start revoke og claim samtidigt. Tillad kun de to sikre
  sluttilstande: claim afsluttes atomisk før revoke, eller claim afvises uden
  kopi. Ingen delvis kopi eller ekstra claim må findes.
- **To rotationer:** Opret to nye shares samtidigt for samme source-run. Efter
  commit må præcis én række have `revoked_at is null`; kun dens token må kunne
  previewes og claimes.
- **Source-sletning mod claim:** Start source-sletning og claim samtidigt. Enten
  afsluttes den atomiske kopi før sletningen, eller claim afvises. Der må aldrig
  være en delvist udfyldt kopi.
- **Flere lærere:** Claim samme aktive share samtidigt som `teacher-a` og
  `teacher-b`. Der skal være én uafhængig kopi og én claim pr. lærer.

## Slutkontrol

- Verificér PK/unique-kontrakten `(share_id, teacher_id)` og nullable unik
  `copied_run_id` med `ON DELETE SET NULL`.
- Verificér, at `anon` og `authenticated` ikke kan læse/skrive tabeller eller
  kalde RPC'erne.
- Verificér, at `service_role` kun har direkte `SELECT` på share-tabellen og kun
  de eksplicit tildelte RPC-execute-rettigheder.
- Gem kun antal og pass/fail i testrapporten; gem aldrig tokens, bruger-ID'er,
  PIN-koder eller syntetiske elevpayloads i loggen.
