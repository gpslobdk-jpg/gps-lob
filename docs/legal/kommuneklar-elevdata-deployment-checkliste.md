# Deployment-checkliste: kommuneklar elevdata

Status: Forberedt, ikke udført. Denne checkliste giver ikke tilladelse til produktion, deployment eller databaseændring.

## Godkendelsesgate

- [ ] Sikkerheds-PR er gennemgået af mindst én anden teknisk reviewer.
- [x] Isoleret lokal Supabase/Postgres-test har kørt hele migrationsrækken, RLS-/ejeradgang, privat Storage, proxied fotoadgang, sletning, retention og opgraderingen fra parent-schemaet den 8. august 2026.
- [ ] Kommunepakke version 1.1 er gennemgået af ejer og kommunens DPO/jurist.
- [ ] Et vedligeholdelsesvindue uden aktive elevsessioner er aftalt. Appkoden kræver den nye fotometadatatabel; fotoaflevering skal derfor holdes lukket mellem apprelease og migration.
- [ ] Produktionsprojektets reference, region og målmiljø er dobbelttjekket uden at udskrive nøgler eller persondata.

## 1. Backup og førkontrol

- [ ] Tag og verificér en databasebackup/snapshot efter den konkrete Supabase-plans procedure.
- [ ] Eksportér kun schema-/rækkeantal og checksums til kontrol; hent ikke elevdata lokalt.
- [ ] Registrér antal objekter i `participant-uploads`, antal ikke-null `answers.image_url`, antal svar med `lat/lng` og antal aktive/afsluttede sessioner.
- [ ] Kontroller for dublette Storage-stier, manglende objekter og objekter uden svarreference. Orphans slettes ikke automatisk under migrationen; de skal rapporteres og håndteres efter særskilt godkendt liste.
- [ ] Bekræft, at eksisterende fotostier matcher de genererede mønstre. Migrationen stopper ved ukendte eksterne URL'er; de må ikke nulstilles eller flyttes automatisk uden verificeret objektmapping.
- [ ] Planlæg en vedligeholdelsesstyret legacy-rekey: kopiér hvert kendt objekt server-side til et nyt `private-v2`-objektnavn, verificér indhold/checksum og ejermapping, opdatér referencen atomisk, og slet først derefter det gamle objekt. Purge leverandør-/CDN-cache, hvor muligt. Bucketen må aldrig gøres offentlig som rollback.
- [ ] Bekræft, at den nye Edge-funktion `student-data-retention` er klar, men at ingen cron er aktiveret.

## 2. Rækkefølge

1. [ ] Deploy den præcist godkendte app- og Edge-funktionscommit uden at aktivere cron.
2. [ ] Smoke-test login, almindeligt løb og at nye fotoafleveringer fejler lukket i det korte interval før migrationen. Der må ikke være aktive elevsessioner.
3. [ ] Anvend `202608070001_kommuneklar_elevdata.sql` én gang på det bekræftede projekt.
4. [ ] Kontroller straks, at `participant-uploads.public = false`, at `participant_photo_objects` er backfillet, og at `answers.image_url` kun indeholder interne `/api/teacher/answers/<id>/photo`-referencer eller `null`.
5. [ ] Kontroller, at ingen anon/authenticated Storage-policy giver direkte adgang til `participant-uploads`.
6. [ ] Smoke-test ejeradgang og afvisning, før cron aktiveres.
7. [ ] Aktivér først derefter cron som databaseejer med den korrekte HTTPS-URL til `/functions/v1/student-data-retention` via `public.configure_student_data_retention_cron(...)`.

## 3. Hosted cron og jobhistorik

- [ ] `cron.job` har præcis ét `student-gps-retention-every-five-minutes` og ét `student-data-retention-daily`.
- [ ] Den pensionerede `participant-uploads-retention-daily` findes ikke.
- [ ] GPS-jobbet kører hvert femte minut, og det daglige job kører kl. 03:17 UTC.
- [ ] Udfør én kontrolleret manuel Edge-kørsel med syntetiske testdata og den hostede secret uden at vise secret i terminal/log.
- [ ] Kontroller `cron.job_run_details`, Edge-logstatus og `student_data_retention_runs`: kun status, tællere og generisk fejlkode må forekomme.
- [ ] Bekræft mindst én succesfuld GPS-kørsel og én succesfuld samlet retentionkørsel. Først herefter må dokumentationen markere cron som aktiv i produktion.
- [ ] Opsæt en ejerproces/alarm for status `failed`, manglende jobhistorik eller et job, som ikke har kørt inden for forventet vindue.

## 4. Smoke tests efter migration

- [ ] Lærer A kan se et foto fra eget løb.
- [ ] Lærer A får 404/ingen adgang til lærer B's svar-ID; responsen afslører ikke ejer, sti eller bucket.
- [ ] Anonym bruger får 401 og kan ikke følge en gammel offentlig URL.
- [ ] Fotobilledet leveres gennem den beskyttede SkoleGPS-route med `private, no-store`, `Pragma: no-cache` og `Referrer-Policy: no-referrer`; responsen indeholder ingen Storage-sti eller signed URL og kan ikke genbruges efter sletning.
- [ ] Sletning fra resultatsiden fjerner både Storage-objekt, fotometadata, svar, deltagere og session; ny hentning giver 404.
- [ ] En elev kan aflevere foto uden elevkonto i en konkret aktiv session/fotoopgave, men ikke i en afsluttet eller anden session.
- [ ] GPS-afstand beregnes fortsat lokalt; en frisk position vises under aktivt løb.
- [ ] Position skjules ved målgang, lærerafslutning og efter højst 15 minutters inaktivitet. Den fysiske værdi nulstilles straks ved afslutningsflows og ellers ved næste femminutters cronjob, normalt senest efter cirka 20 minutter.
- [ ] Afsluttede resultater indeholder ingen svarpositioner.
- [ ] Syntetiske data yngre end fristen bevares; 30-dages fotos og 90-dages elevsessioner målt fra afslutnings-/inaktivitetsankeret slettes; aktive sessioner uden anker bevares.
- [ ] Manuel sletning af lærer A's løb ændrer ikke lærer B's løb. Automatisk retention bruger kun alder/status og krydser ikke ejerrelationer ved læsning eller visning.
- [ ] Sentry, almindelige logs og analytics indeholder ingen GPS, IP, Storage-stier, URL-legitimationsoplysninger, svar-ID'er eller elevoplysninger. Bekræft særskilt environment-tags, retention, region, DPA og integrationsindstillinger i hosted Sentry-dashboardet.

## 5. Rollback

- [ ] Stop først begge nye cronjobs; bevar jobhistorikken som revisionsspor.
- [ ] Stop fotoaflevering og aktive elevsessioner.
- [ ] Rul appen tilbage til den senest godkendte commit kun efter vurdering af datamodellen. En gammel app må ikke genåbne bucketen eller begynde at gemme offentlige URL'er.
- [ ] Bevar bucketen privat under rollback. Offentliggørelse er ikke en acceptabel rollback.
- [ ] Ved kodefejl kan den nye foto-route og retentionfunktion rettes fremad, mens Storage forbliver privat.
- [ ] Ved databasefejl gendannes den verificerede backup efter Supabase-proceduren. Sammenhold Storage-inventaret særskilt, fordi Storage-objekter ikke indgår i databasebackup.
- [ ] Genaktiver først trafik og cron efter ny ejer-/RLS-/slettetest.

## Stopkriterier

Stop uden videre ændring ved ukendt legacy-sti, uventet offentlig policy, forkert projekt, manglende backup, backfill-afvigelse, cross-owner adgang, Storage-/database-uoverensstemmelse eller retention af aktive/for nye data.
