# Årsagsmatrix: stabilitet, GPS og Fokusmode

Denne note indeholder kun anonymiserede tekniske observationer fra den rapporterede oplevelse.

| Observation | Reproduktion/undersøgelse | Fundet årsag eller hypotese | Mindste ændring | Regressionstest |
|---|---|---|---|---|
| Nyt hold vises først efter reload | Lærerhookens realtime-grene sammenholdt med join-ruten | `participants` er den reelle identitet, men lobbyen reagerer kun på det forsinkede `session_students`-spejl | Id-baseret participant-roster; participant-events opdaterer listen direkte; kontrolleret resync | INSERT uden mirror, UPDATE efter INSERT, genforbindelse og snapshot/event-rækkefølge |
| Flere eller forkerte hold i visningen | Gennemgang af navn-baseret roster og join-retry | Navn bruges som liste-/resume-nøgle; parallelt join kan oprette/rende forkert række | Stabil participant-id som roster-nøgle; auth-bundet, idempotent resume; navn er kun visning | Samme navn i to browsere, dobbelttap, timeout/retry, reload og to faner |
| Lærer fjerner hold | Eksisterende klient-DELETE sammenholdt med nyere RLS-/cutover-spor | Direkte klient-DELETE er ikke en sikker, autoritativ afslutning af deltagelsen | Serverautoriseret, ikke-destruktiv deaktivering med konsekvent afvisning af sene writes | Uautoriseret forsøg, aktiv/pending deltager, offline retry og øvrige hold fortsætter |
| Egen position mangler efter fejl eller resume | GPS lifecycle og kortvarianter gennemgået; eksisterende standardkorttest fundet | Legacy GPS kan fortsætte automatisk retry efter afvist tilladelse; Zone Krig/Stratego mangler kortets resume-recovery-spor | Stop auto-retry ved afvisning; kontrolleret manuel retry; lille marker/map-resume-recovery | Tilladelse afvist, timeout, gyldig position før kort, pageshow/remount og watcher-cleanup |
| Fokusmode-kontrol er uklar | Eksisterende komponent og serverkontrakt gennemgået | Semantik/persistens er på plads, men knappen ligner ikke en til/fra-switch | Genbrug tilgængelig switch; behold synlig Til/Fra-status, pending og resync | Tastatur, `aria-checked`, dobbeltklik, gemmefejl og anden lærerfane |

## Kendte grænser

- Det lokale miljø mangler den reelle offentlige Supabase-testkonfiguration. Syntetiske browser-/lokale databasekontroller kan dække kontrakter, men ikke bekræfte den hostede database eller fysiske telefoners GPS.
- `session_students` behandles som legacy-fallback, indtil dens hosted schema, adgangsregler og realtime-publication er verificeret.
- Fysiske iPhone- og Android-kontroller er ikke erstattet af Playwrights WebKit-/viewport-emulering.
