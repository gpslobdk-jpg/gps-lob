# Den Gyldne Portal — grafiske assets

- **Dato:** 2026-10-08
- **Omfang:** Kun SkoleGPS' sæsonbestemte elevindgang (`/join`) for `gpslob`.
- **Oprindelse:** Originale illustrationer produceret til denne levering med det
  indbyggede billedværktøj, uden downloadede stockfotos, elevdata, personer,
  eksterne asset-providerkald eller betalte API-kald. Den færdige bladportal er
  desuden renset lokalt for en uønsket kant i alpha-laget; der er ikke tilføjet
  motiv eller materiale fra en tredjepart.

## Leverede filer

| Public-sti | Format og mål | Rolle |
| --- | --- | --- |
| `/brand/golden-portal/forest-night.webp` | WebP, 900×1600 | Vertikal nattehimmel, skov, sti og fjernt landemærke som hovedbaggrund. |
| `/brand/golden-portal/foreground-leaves.webp` | WebP med transparens, 900×1600 | Statiske, grafiske nærblade, der skaber dybde på elevindgangen uden løbende partikelmotor. |
| `/brand/golden-portal/portal-leaf-ring-v2.webp` | WebP med transparens, 640×640 | Kort, synlig bladportal omkring den eksisterende Pilen-maskot i introens sidste del. |

Den eksisterende `skolegps-pin.webp` er fortsat den blå Pilen. Halstørklæde,
blad og kantlys er små SVG-accessory-lag i React og erstatter hverken ansigt,
krop eller de permanente PWA-ikoner.

## Brug og driftsgrænser

`GoldenPortalBackdrop` og `GoldenPortalIntro` bruger lagene via Next Image.
`STUDENT_AUTUMN_PORTAL_ENABLED` i `lib/studentExperienceSeason.ts` er den ene
centrale kontakt: `false` giver den ordinære blå elevindgang igen. Variationen
begrænses til `gpslob`; andre site-varianter berøres ikke.

Assets er ikke en del af service-workerens precache (`publicExcludes` bevares).
Den produktionslignende buildkontrol den 8. oktober 2026 bekræftede, at den
serverede `/sw.js` matchede buildartefaktet byte-for-byte, og at den ikke
indeholdt `golden-portal`-assets. Grafikken må derfor gerne fejle eller indlæse
langsomt uden at blokere adgang til elevens rigtige knapper.

Der er ikke gennemført fysisk telefon- eller skærmkalibreringskontrol. Den
visuelle og responsive kontrol er udført i automatiseret Chromium og WebKit
iPhone-emulering.
