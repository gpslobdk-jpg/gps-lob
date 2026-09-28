# SkoleGPS Printpakker — lokal status

## Arbejdsgrundlag

- Isoleret worktree: `C:\Users\Bruger\kode\gps-lob-printpakker-v1`
- Branch: `codex/printpakker-v1`
- Verificeret baseline: `origin/main` på `b31d8ad57d75b43646e467c086b86e082a636b3e`
- Remote: `https://github.com/gpslobdk-jpg/gps-lob.git`

Den oprindelige checkout `C:\Users\Bruger\kode\gps-lob` blev kun inspiceret
læsebeskyttet og er ikke brugt som arbejdsgrundlag. Ingen ændring er foretaget i
Projektværkstedet/M2-worktrees, deres branches eller commits.

## Leveret i denne lokale commit

- Offentlig katalogside: `/printpakker`
- Offentlig pakkeside: `/printpakker/efteraarsmysteriet`
- Lærerretur efter login: `/dashboard/laerervaerktoejer/printpakker`
- Beskyttet download-route for hele pakken, elevark, facit og lærervejledning.
- Én komplet pakke, **Efterårsmysteriet: Den forsvundne lanterne**, til 5.–6.
  klasse med seks matematikposter og fælles slutløsning.
- Originale, lokale illustrationer til katalog, omslag og alle seks poster.
- Farve-, blækbesparende-, elevark-, facit-, lærervejlednings- og
  forhåndsvisnings-PDF'er.

Facit og løsningsspor ligger kun i de serverlæste PDF-filer under
`assets/printpakker/`; offentlige previews og sider er facitfrie. En anonym eller
fejlet session omdirigeres til den eksisterende loginvej med en sikker lokal
`next`-retur. Den eksisterende auth- og Family SSO-kode er ikke ændret.

`Analog Poster`/Stjerneløb forbliver en sekundær **Byg selv**-vej. PrintMitArbejdsark
er ikke ændret.

## Kontrol udført

- `npx.cmd next typegen` — bestået
- `npx.cmd tsc --noEmit` — bestået
- Afgrænset ESLint for Printpakker-filer — bestået
- `npx.cmd playwright test --config=playwright.printpakker.config.ts` —
  16 bestået
- `npm.cmd run build` — bestået
- PDF-sideantal, checksum-paritet og facitfri elev-/previewtekst — kontrolleret.
- Statisk PDF-rendering gennemgået visuelt for farve, blækbesparelse, seks
  stationer, seks holdfelter og facit.

En fuld repository-lint er fortsat rød på baseline med 63 fejl og 163 advarsler i
ikke-relaterede eksisterende filer. Poppler gav manglende-display-font-advarsler
under statisk rendering, men de renderede sider blev visuelt gennemgået.

## Bevidste afgrænsninger

- Ingen push, merge, deployment, migrering, produktionsændring eller
  ændring af delte data.
- Ingen rigtig lærersession/hostet Family SSO blev prøvet; kun den lokale,
  anonyme adgangsafvisning og route-kontrakt er verificeret.
- Ingen fysisk printer eller fysisk mobil/PWA-installation blev verificeret.

## Lokale artefakter

- Runtime-PDF'er: `assets/printpakker/efteraarsmysteriet/`
- Offentligt facitfrit preview: `public/printpakker/afteraarsmysteriet-forhaandsvisning.pdf`
- Fuld lokal PDF-eksport: `output/pdf/`
- Browser-screenshots: `artifacts/printpakker/`

Start lokalt med:

```powershell
cd C:\Users\Bruger\kode\gps-lob-printpakker-v1
npm.cmd run dev -- --port 3107
```

Åbn derefter `http://localhost:3107/printpakker`.
