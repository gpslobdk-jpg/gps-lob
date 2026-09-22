# SkoleGPS · fase 9–10 dækningsregister

Senest opdateret: 22. september 2026. Dette register er et arbejds- og bevisregister; `kortlagt` er ikke det samme som browser- eller live-verificeret.

## Statusskala

| Status | Betydning |
| --- | --- |
| Kortlagt | Route/komponent, ejergrænse og risici er læst i denne kodebase. |
| Rettet | Den afgrænsede UI-/a11y-ændring er i arbejdsgrenen, men ikke i sig selv releasebevis. |
| Typeverificeret | `npx.cmd next typegen` og `npx.cmd tsc --noEmit` er kørt efter ændringen. |
| Browserverificeret | Målrettet Playwright-flow er grønt med syntetisk læreradgang. |
| Dokumenteret undtagelse | Med vilje uden for fase 9 eller afhængig af et andet system/enhed. |

## Fase 9 · lærerflader

| Gruppe | Ruter (antal) | Status ved kortlægning | Fase-9-afgrænsning og testbevis |
| --- | ---: | --- | --- |
| Portal | `/dashboard`, `/dashboard/arkiv`, `/dashboard/indstillinger`, `/dashboard/laerervaerktoejer` (4) | Rettet | Den eksisterende portal-sidebar beholdes kun på de sikre portalrødder. Den fælles kompakte header har nu `data-teacher-chrome="workspace"` på øvrige lærerflader; den ændrer ikke links, logout eller layoutbredde. Kandidat: `tests/dashboard-first-run.spec.ts`, 1440/1024/768/390/320. |
| Interne værktøjer | `/dashboard/laerervaerktoejer/oevekort`, `/print`, `/tavle`, `/skak`, `/skemapilot`, `/aarsplan-generator` (6) | Kortlagt | Øvekort beholder sit frigivne flow. Skak/SkemaPilot/årsplan er ikke globalt overmalet. Kandidater: `tests/oevekort-domain.spec.ts`, `tests/oevekort-public-share.spec.ts`, `tests/chess-experience.spec.ts`, `tests/family-sso.spec.ts`. |
| Mobilspil | `/dashboard/mobilspil`, `/dashboard/mobilspil/find-bedrageren` (2) | Kortlagt | Kun fælles chrome må ændres; spillets egne kontrollag og sessioner bevares. Kandidat: relevant Find Bedrageren-/mobilspil-regression. |
| Løbsbyggere | `/dashboard/opret`, `/valg`, `/lynbygger`, `/{manuel,dansk,engelsk,matematik,foto,scanner,selfie,escape,rollespil,podcast,zone-krig,stratego,musikquiz,find-bedrageren}`, `/stjerneloeb`, `/stjerneloeb/bibliotek`, `/stjerneloeb/bibliotek/[category]` (20) | Kortlagt; fælles AI-reviewdialog rettet | Ingen race-type, `?id=`, autosave, drag/drop, kort, kamera eller entitlements ændres. Kandidater: `tests/race-type-capabilities.spec.ts`, `tests/lynbygger-contract.spec.ts`, `tests/lynbygger-handoff.spec.ts`, `tests/phase43-stjerneloeb-ai-print.spec.ts`, `tests/phase48-fotoloeb-chaos.spec.ts`. |
| Live/lærerview | `/dashboard/live/[sessionId]`, `/zone-krig`, `/find-bedrageren` (3) | Kortlagt; regelpanel/fotolysbord rettet | Operativt mørkt/datatæt layout bevares; Leaflet, realtime, timere, hold, pause/slut og resultatrækkefølge røres ikke. Assistenten skjules på live/resultat/print for ikke at dække kontrolflader. Kandidater: `tests/live-audit.spec.ts`, `tests/live-route-overview-ui.spec.ts`, `tests/live-view-stress.spec.ts`, `tests/teacher-live-roster-recovery.spec.ts`. |
| Resultater og print | `/dashboard/resultater/[runId]`, `/dashboard/print/[id]` (2) | Kortlagt | Resultater bruger fælles fotodialogsemantik; almindelig printlayout er en papir-undtagelse og får ikke portalbaggrund/sidebar. Kandidater: `tests/print-layout.spec.ts`, relevante resultat-/foto-flowtests. |
| Administration | `/dashboard/admin`, `/logs`, `/stjerneloeb-upload` (3) | Dokumenteret undtagelse | Rollebegrænset driftsflade, ikke almindeligt lærerflow. Ingen adgangs-/PIN-/logændringer i fase 9. Kandidat: `tests/admin-dashboard.spec.ts`. |

**Optælling:** 40 ejede dashboard-ruter er kortlagt. Den endelige rapport skal skelne tallet for `kortlagt`, `rettet`, `browserverificeret` og `i produktion`; den må ikke gøre denne optælling til et påstået live-bevis.

## Delte sømme og dialogregister

| Komponent/søm | Status | Bevidst kontrakt |
| --- | --- | --- |
| `app/dashboard/layout.tsx` + `components/dashboard/DashboardHeader.tsx` | Rettet | Portal-sidebar udvides ikke blindt til builders/live/print. Kompakt chrome er opt-in og har samme navigation, Family SSO-revoke og safe logout. Logout udsender den afbrydelige `skolegps:before-dashboard-leave` før nogen state/API-handling. |
| `app/globals.css` | Rettet | Nye `skolegps-teacher-workspace-*` og `skolegps-teacher-dialog*` er opt-in. Ingen ny global class-substring-overstyring; elev, print, Leaflet og public flows får ikke farveovermaling. |
| `components/ui/useModalFocusTrap.ts` | Rettet | Fælles Escape, Tab/Shift+Tab, kropsscroll-lås og fokusretur; ingen ændring af modalernes handlers eller data. |
| `components/dashboard/TeacherToolsModal.tsx` | Rettet | Bevarer manuel åbning. Facebook-panel bruger det fælles, verificerede link og påstår aldrig medlemskab. |
| `lib/teacherTools/communityPreference.ts` + `DashboardHomeClient.tsx` | Rettet | Kun browserlokal, versionssat nøgle pr. auth-user-id. `Ikke nu`, kryds og Escape udsætter auto-visning i 30 dage; erklæret medlemskab stopper auto-visning, men ikke manuel åbning. Ingen migration, Facebook-login, pixel, feed eller serverwrite. Auto-visning kræver root-dashboard, afsluttet kort guide, ingen aktiv lærer-/elevsession og ingen aktiv guide. |
| `AiReviewDraftModal`, `RunExecutionShareModal`, arkivets tidsdialog, Stjerneløb-bibliotekets uploaddialog, `LiveRulesSheet`, `LivePhotoLightbox`, `TeacherLiveResults` | Rettet | Rolle/aria-modal, fokusfælde og Escape/backdrop følger samme begrænsede livscyklus. Opret/gem/del/tilbagekald/realtime-handlinger er uændrede. |
| `components/AIChatButton.tsx` | Rettet | Skjules på live, resultater og print, så den ikke ligger over operative eller papirrelevante kontroller. Øvrig builderassistance bevares. |
| `app/dashboard/loading.tsx`, `app/dashboard/arkiv/loading.tsx`, `app/dashboard/opret/loading.tsx`, globale fejlflader | Kortlagt | Side-specifikke loading-/fejlflader er en separat P1-batch. Global `app/global-error.tsx` er en public/elev-delt undtagelse og må ikke restyles som lærerflade uden route-scoping. |

## Kontroller og begrænsninger

- Gennemført efter den afgrænsede patch: `npx.cmd next typegen` og `npx.cmd tsc --noEmit`.
- Målrettet browserkandidat: `npx.cmd playwright test tests/dashboard-first-run.spec.ts --project=chromium --workers=1`. Den dækker syntetisk login, dashboard, aktivt løb, popup, 30-dages valg, medlemsvalg, manuel genåbning og fokusretur. Før release skal den rapporteres som grøn/rød med faktisk output.
- Dialogregression bør suppleres med `tests/run-execution-share.spec.ts`, builder-/live-tests ovenfor samt tastaturtest for hver rettet dialog.
- Visuel matrix før release: ca. 1440, 1024, 768, 390, 320 og 200 % zoom; lang dansk tekst, fejl, tab/shift-tab og ingen vandret scroll. Screenshot-artifacts skal ligge i en ny, afgrænset fase-9-mappe; eksisterende utrackede review/PWA-filer ændres ikke.
- Ingen live-login, fysisk GPS/kamera, browserpermission, OAuth, kortattribution eller ekstern Family SSO-destination er bevist af dette dokument. Eksterne familieprodukter er ejerskabsundtagelser, ikke dækket ved at deres links vises her.

## Fase 10-grænse

Fase 10 må kun redesigne den aftalte standard-elevoplevelse efter særskilt visuel og flowmæssig kontrol. Den må ikke ændre `/join`, `/play/[sessionId]`-protokol, QR/PIN, deltagernavne, aktiv session, GPS/foto-registrering, realtime, score/progression, hold eller lærernes eksisterende liveflow. Specialspil og eksterne elevflader registreres som dokumenterede undtagelser, medmindre de har deres egen godkendte fase-10-opgave.
