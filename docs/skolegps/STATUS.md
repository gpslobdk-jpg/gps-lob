# SkoleGPS: stabilitet og enkel forside

| Fase | Indhold | Status | Commit/bevis | Resterende risiko |
|---|---|---|---|---|
| 1/7 | Baseline og årsagsundersøgelse | Verificeret | `b42d02f` baseline; typecheck bestået; produktions-smoke 2026-09-10 | Lokale browser-E2E kræver den rigtige Supabase-testkonfiguration; fysisk mobiltest er ikke udført her. |
| 2/7 | Automatisk holdliste og stabile tilmeldinger | Verificeret | `ecf4975`, `a67eef5`; TypeScript, ESLint og 16 fokuserede policy-/roster-tests bestået | Tabt første svar uden auth-cookie afvises hellere end usikker overtagelse; fysisk skole-netværk er ikke simuleret. |
| 3/7 | Sikker fjernelse af hold | Verificeret | Additiv migration `202609100001_participant_soft_removal.sql`; 40 kontrakt-/spiltests og 17 fælles removal-/fokustests bestået | Hosted migrations- og produktionskontrol afventer fase 7; lokal Docker-Postgres var ikke tilgængelig til en reel samtidighedskørsel. |
| 4/7 | Egen position og GPS-hjælp | Verificeret | `7eb40c1`; fokuserede Chromium-/WebKit-scenarier for afvist tilladelse, resume og marker bestået | Fysisk iPhone/Android-livscyklus er fortsat ikke testet. |
| 5/7 | Fokusmode-afbryder | Verificeret | `9d94a42`; tilgængelig switch og fokuseret Chromium-test bestået | Eksisterende fail-open-kontrakt er bevaret; fysisk lærer-enhed er ikke testet. |
| 6/7 | Forside, nyhedsside og footer | Verificeret | `2a8062b`, `ee944fe`; 7 forsidetests, 10 PWA-kontrakttests og review ved 360/768/1440 px | Kilder er kontrolleret 2026-09-10; endelig publiceringskontrol følger i fase 7. |
| 7/7 | Samlet QA og produktion | I gang | Typegen, TypeScript og production build bestået; 48 fokuserede kontrakt-/spiltests og 2 mockede live-UI-tests bestået; migrations-dry-run viser kun `202609100001` | Kræver schema-push, preview, præcis SHA- og Vercel-projektverifikation. |

## Baseline

- Arbejdsbranch: `codex/skolegps-simple-home-live-stability` fra `main` / `origin/main` på `b42d02f2cafc5dad0dcd71b11a8383be2051d5cd`.
- Remote: `https://github.com/gpslobdk-jpg/gps-lob.git`. Ingen projektlokal `AGENTS.md` eller releasekonfiguration erstatter de eksisterende release-/sikkerhedsdokumenter.
- Read-only produktionskontrol den 10. september 2026: `skolegps.dk` viderestiller til `https://www.skolegps.dk/`; `/` og `/join` returnerede 200; `/dashboard` viderestillede til login med en sikker `next`-destination.
- `npx.cmd next typegen` og `npx.cmd tsc --noEmit` bestod. Det fokuserede browserløb kunne ikke etablere en reel Supabase-klient, fordi denne checkout ikke har de nødvendige offentlige Supabase-variabler; det er registreret som en miljøgrænse, ikke som et produktresultat.
- Ingen elevnavne, ruter, tokens eller andre persondata er indsamlet i denne dokumentation.

## Release- og rollbackretning

Normal release er featurebranch -> GitHub/Vercel Preview -> syntetisk smoke -> fast-forward til `main` -> `git push origin main` -> verificér den korrekte SkoleGPS-Vercel-deployment og præcise SHA -> read-only production-smoke. Brug ikke en lokal `.vercel`-linkning som produktionsbevis og brug ikke manuel `vercel --prod`.

Migration `202609100001_participant_soft_removal.sql` er additiv: den markerer en deltager som fjernet, rydder seneste position og afviser sene writes via serverkontrol og RLS. Rækkefølgen er schema først, derefter den kompatible app. Når et hold faktisk er fjernet, må en app-rollback ikke gå tilbage til en revision før denne håndhævelse; brug i stedet en post-migration-kompatibel revision eller ret fremad. Schemaet bliver stående ved almindelig app-rollback.

## Fase 3–6: afgrænsning og verifikation

- Fjernelse foregår kun gennem lærerens eksisterende livevisning: én diskret handlingsmenu, bekræftelse og en serverautoriseret, idempotent soft removal. Resultater, aktivt holdtal, Fokusmode og de aktive spilspor udelader fjernede deltagere.
- Sene svar, lokationsopdateringer, postskift og spilhandlinger får den samme terminale besked i en gammel elevfane. Et svar og en removal serialiseres på den aktive deltager, så sene retries ikke giver nye point.
- GPS-rettelsen stopper automatisk genforsøg efter afvist tilladelse og viser kort hjælp kun når positionen mangler. Kortets marker-/resume-spor bevarer GPS-kravene.
- Fokusmode er samme sted som før, men med en semantisk switch, synlig Til/Fra-status, tastaturbetjening og fortsat fail-open ved fejl.
- Forsiden bevarer elevens `/join`-vej og lærerflowet, har ingen pris-/købsindgange og linker til den forsigtige mobilside. Sidens faktuelle formuleringer er afgrænset af Folketingets L 130-status og Undervisningsministeriets kilder, kontrolleret den 10. september 2026.
