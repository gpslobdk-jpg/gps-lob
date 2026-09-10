# SkoleGPS: stabilitet og enkel forside

| Fase | Indhold | Status | Commit/bevis | Resterende risiko |
|---|---|---|---|---|
| 1/7 | Baseline og årsagsundersøgelse | Verificeret | `b42d02f` baseline; typecheck bestået; produktions-smoke 2026-09-10 | Lokale browser-E2E kræver den rigtige Supabase-testkonfiguration; fysisk mobiltest er ikke udført her. |
| 2/7 | Automatisk holdliste og stabile tilmeldinger | I gang | Se årsagsmatrix | Ingen hosted-schemaændring er godkendt af baseline alene. |
| 3/7 | Sikker fjernelse af hold | Afventer | — | Skal være serverautoriseret og bagudkompatibel. |
| 4/7 | Egen position og GPS-hjælp | I gang | Se årsagsmatrix | Fysisk iPhone/Android-livscyklus skal fortsat skelnes fra emulering. |
| 5/7 | Fokusmode-afbryder | I gang | Se årsagsmatrix | Eksisterende fail-open-kontrakt må ikke ændres. |
| 6/7 | Forside, nyhedsside og footer | I gang | Produktionsbaseline 2026-09-10 | Aktuelle politiske kilder skal verificeres igen før publicering. |
| 7/7 | Samlet QA og produktion | Afventer | — | Kræver præcis SHA- og Vercel-projektverifikation. |

## Baseline

- Arbejdsbranch: `codex/skolegps-simple-home-live-stability` fra `main` / `origin/main` på `b42d02f2cafc5dad0dcd71b11a8383be2051d5cd`.
- Remote: `https://github.com/gpslobdk-jpg/gps-lob.git`. Ingen projektlokal `AGENTS.md` eller releasekonfiguration erstatter de eksisterende release-/sikkerhedsdokumenter.
- Read-only produktionskontrol den 10. september 2026: `skolegps.dk` viderestiller til `https://www.skolegps.dk/`; `/` og `/join` returnerede 200; `/dashboard` viderestillede til login med en sikker `next`-destination.
- `npx.cmd next typegen` og `npx.cmd tsc --noEmit` bestod. Det fokuserede browserløb kunne ikke etablere en reel Supabase-klient, fordi denne checkout ikke har de nødvendige offentlige Supabase-variabler; det er registreret som en miljøgrænse, ikke som et produktresultat.
- Ingen elevnavne, ruter, tokens eller andre persondata er indsamlet i denne dokumentation.

## Release- og rollbackretning

Normal release er featurebranch -> GitHub/Vercel Preview -> syntetisk smoke -> fast-forward til `main` -> `git push origin main` -> verificér den korrekte SkoleGPS-Vercel-deployment og præcise SHA -> read-only production-smoke. Brug ikke en lokal `.vercel`-linkning som produktionsbevis og brug ikke manuel `vercel --prod`.

Eventuelle schemaændringer skal være additive, testet lokalt/isoleret og have en kompatibilitets- og rollbackvej. App-rollback må ikke genåbne fjernede hold eller gøre eksisterende join-/svar-kald ugyldige.
