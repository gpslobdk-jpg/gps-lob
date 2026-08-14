# PrintMitArbejdsark preview-grænse

Denne integration er kun beregnet til et isoleret SkoleGPS/PrintMit-preview. Den må ikke forbindes til SkoleGPS' produktionsdatabase eller aktivere et produktionskort.

## Preview-schema

Et tomt preview bygges med følgende afgrænsede rækkefølge:

1. `supabase/preview/202603010000_printmit_preview_baseline.sql`
2. `supabase/migrations/202608080001_dagenstavle_family_sso.sql`
3. `supabase/migrations/202608140001_printmitarbejdsark_preview.sql`

Baselinefilen ligger bevidst uden for den normale migrationsmappe. Den opretter kun de minimale `profiles`- og `gps_runs`-grænser, som SkoleGPS-previewets login og SSO-start forventer. Den må aldrig anvendes på den eksisterende produktionsdatabase.

SkoleGPS' fulde historiske migrationsrække er ikke reproducerbar mod en tom database: `202603090002_gps_runs_race_type.sql` forventer en tidligere `gps_runs`-baseline, som ikke findes i repositoryet. Det er en separat historisk begrænsning og må ikke skjules som et grønt M4-resultat.

## Sikkerhedsgrænser

- PrintMit-destinationen kræver audience `printmitarbejdsark` og et separat HMAC-secret.
- Handoffs gemmer kun request- og nonce-hashes og kan kun konsumeres én gang.
- PrintMit-kortet er default-off via `PRINTMITARBEJDSARK_ENABLED`.
- Projekter er private pr. `auth.uid()`; anonymous og andre lærere har ingen adgang.
- Genereringsloggen gemmer kun minimal driftsmetadata, aldrig prompt, dokument eller billede.
- Reservationen håndhæver idempotency-key, højst én aktiv generering pr. lærer og oprydning af fastlåste reservationer efter to minutter.
- AI-billeder forbliver lokale i lærerens browser; previewet opretter ingen storage-bucket.

Den reproducerbare syntetiske kontrol køres med `scripts/security/test-printmit-preview.ps1 -ProjectRef <preview-ref>`. Scriptet henter credentials via den autentificerede Supabase CLI, udskriver dem aldrig og sletter testbrugerne i `finally`.
