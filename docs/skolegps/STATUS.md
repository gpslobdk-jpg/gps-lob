# SkoleGPS: stabilitet og enkel forside

| Fase | Indhold | Status | Commit/bevis | Resterende risiko |
|---|---|---|---|---|
| 1/7 | Baseline og årsagsundersøgelse | Verificeret | `b42d02f` baseline; typecheck bestået; produktions-smoke 2026-09-10 | Lokale browser-E2E kræver den rigtige Supabase-testkonfiguration; fysisk mobiltest er ikke udført her. |
| 2/7 | Automatisk holdliste og stabile tilmeldinger | Verificeret | `ecf4975`, `a67eef5`; TypeScript, ESLint og 16 fokuserede policy-/roster-tests bestået | Tabt første svar uden auth-cookie afvises hellere end usikker overtagelse; fysisk skole-netværk er ikke simuleret. |
| 3/7 | Sikker fjernelse af hold | Verificeret | Additiv migration `202609100001_participant_soft_removal.sql` er anvendt hosted; 48 kontrakt-/spiltests og 24 gentagne removal-/fokustests bestået | Lokal Docker-Postgres var ikke tilgængelig til en reel samtidighedskørsel; fysisk skole-netværk er ikke simuleret. |
| 4/7 | Egen position og GPS-hjælp | Verificeret | `7eb40c1`; fokuserede Chromium-/WebKit-scenarier for afvist tilladelse, resume og marker bestået | Fysisk iPhone/Android-livscyklus er fortsat ikke testet. |
| 5/7 | Fokusmode-afbryder | Verificeret | `9d94a42`; tilgængelig switch og fokuseret Chromium-test bestået | Eksisterende fail-open-kontrakt er bevaret; fysisk lærer-enhed er ikke testet. |
| 6/7 | Forside, nyhedsside og footer | Verificeret | `2a8062b`, `ee944fe`; 7 forsidetests, 10 PWA-kontrakttests og review ved 360/768/1024/1440 px samt produktion | Fysisk mobil- og skole-netværksbrug er ikke testet. |
| 7/7 | Samlet QA og produktion | I produktion | `65a99ad`; typegen, TypeScript, production build, 48 kontrakt-/spiltests og 2 mockede live-UI-tests bestået; migration, Preview og `Production – gps-lob.dkkk` verificeret | Fysisk iPhone/Android-livscyklus og reel samtidighed under skole-netværk er ikke testet her. |

## Baseline

- Arbejdsbranch: `codex/skolegps-simple-home-live-stability` fra `main` / `origin/main` på `b42d02f2cafc5dad0dcd71b11a8383be2051d5cd`.
- Remote: `https://github.com/gpslobdk-jpg/gps-lob.git`. Ingen projektlokal `AGENTS.md` eller releasekonfiguration erstatter de eksisterende release-/sikkerhedsdokumenter.
- Read-only produktionskontrol den 10. september 2026: `skolegps.dk` viderestiller til `https://www.skolegps.dk/`; `/` og `/join` returnerede 200; `/dashboard` viderestillede til login med en sikker `next`-destination.
- `npx.cmd next typegen` og `npx.cmd tsc --noEmit` bestod. Det fokuserede browserløb kunne ikke etablere en reel Supabase-klient, fordi denne checkout ikke har de nødvendige offentlige Supabase-variabler; det er registreret som en miljøgrænse, ikke som et produktresultat.
- Ingen elevnavne, ruter, tokens eller andre persondata er indsamlet i denne dokumentation.

## Verificeret udrulning

- `202609100001_participant_soft_removal.sql` er anvendt på det linkede hosted schema. Den første push blev afvist atomisk, fordi en eksisterende Stratego-viewkolonne skulle bevares; den korrigerede additive migration blev derefter anvendt uden `DROP` eller cascade.
- App-revisionen `65a99addafe8d26778c17af1f785538f99a0156a` blev fast-forwardet til `main`. GitHub/Vercel-deploymenten `Production – gps-lob.dkkk` blev markeret `success` den 10. september 2026.
- Den read-only offentlige smoke bekræftede `www.skolegps.dk` (200), `/join` (200), `/mobil-i-skolen` (200), `/hjaelp` (200) og uautoriseret `/dashboard` (307 til sikker login-next). Apex-domænet viderestiller til `www`.

## Release- og rollbackretning

Normal release er featurebranch -> GitHub/Vercel Preview -> syntetisk smoke -> fast-forward til `main` -> `git push origin main` -> verificér den korrekte SkoleGPS-Vercel-deployment og præcise SHA -> read-only production-smoke. Brug ikke en lokal `.vercel`-linkning som produktionsbevis og brug ikke manuel `vercel --prod`.

Migration `202609100001_participant_soft_removal.sql` er additiv: den markerer en deltager som fjernet, rydder seneste position og afviser sene writes via serverkontrol og RLS. Rækkefølgen er schema først, derefter den kompatible app. Når et hold faktisk er fjernet, må en app-rollback ikke gå tilbage til en revision før denne håndhævelse; brug i stedet en post-migration-kompatibel revision eller ret fremad. Schemaet bliver stående ved almindelig app-rollback.

## Fase 3–6: afgrænsning og verifikation

- Fjernelse foregår kun gennem lærerens eksisterende livevisning: én diskret handlingsmenu, bekræftelse og en serverautoriseret, idempotent soft removal. Resultater, aktivt holdtal, Fokusmode og de aktive spilspor udelader fjernede deltagere.
- Sene svar, lokationsopdateringer, postskift og spilhandlinger får den samme terminale besked i en gammel elevfane. Et svar og en removal serialiseres på den aktive deltager, så sene retries ikke giver nye point.
- GPS-rettelsen stopper automatisk genforsøg efter afvist tilladelse og viser kort hjælp kun når positionen mangler. Kortets marker-/resume-spor bevarer GPS-kravene.
- Fokusmode er samme sted som før, men med en semantisk switch, synlig Til/Fra-status, tastaturbetjening og fortsat fail-open ved fejl.
- Forsiden bevarer elevens `/join`-vej og lærerflowet, har ingen pris-/købsindgange og linker til den forsigtige mobilside. Sidens faktuelle formuleringer er afgrænset af Folketingets L 130-status og Undervisningsministeriets kilder, kontrolleret den 10. september 2026.
