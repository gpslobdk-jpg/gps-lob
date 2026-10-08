# SkoleGPS Lyd og ro — lærerassets

- **Dato:** 2026-10-08
- **Afgrænsning:** Denne pakke er kun til den lærervendte `Lyd og ro`-motor. Den deler hverken afspillere, URL'er eller indstillinger med elevlyd under `public/audio/elev/`.
- **Opt-in:** Filerne har ingen PWA-precache-regel og får først en browser-request, når læreren trykker den eksplicitte lydhandling. Gemte valg er ikke en autoplay-tilladelse.

## Leverede, afspilningsklare filer

Alle leverede filer er lokalt transkodet til **MP3, 44,1 kHz, 128 kbps** med den lokale CapCut-medleverede FFmpeg `21.7.0-9c087b133d`. Transkodningen fjerner metadata, men ændrer ikke den oprindelige licens eller det nødvendige kreditkrav.

| Public-sti | Rolle | Varighed | Størrelse | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `/audio/teacher/afteraarsskov.mp3` | Naturlyd | 44,80 s | 715.199 B | `fa642b9375deeb716a599da6a7d34e69475c50a16da82f2b981050a1e77cf0e3` |
| `/audio/teacher/regn-ved-vinduet.mp3` | Natur-/rumlyd | 81,71 s | 1.304.420 B | `f3c0b8b31ecd04439e5b60589b3b427373ab548905a49f1ec8a506b160ce27d1` |
| `/audio/teacher/stille-klaver.mp3` | Instrumental musik | 212,85 s | 3.663.728 B | `81aabb1122cbea8b552c8550af451dafb55232d0a1fbb3ff68b09dff6c145136` |
| `/audio/teacher/papir-1.mp3` | Kort papirlyd | 1,04 s | 16.724 B | `1c3f23bbf5acb6fd870092b11991990b9cec0188f3a3cc1c9417da1a40d1774b` |
| `/audio/teacher/papir-2.mp3` | Kort papirlyd | 1,36 s | 21.728 B | `d7804ffbf865e9a1379670cceacacab20a1e43b477b1d6893b2770b658e9a1e8` |
| `/audio/teacher/papir-3.mp3` | Kort papirlyd | 1,23 s | 19.643 B | `cdc2cad835ffa48b7531a9fa1b7ebfbcb2d8adcef79f18ab9c684da3a2eb1eba` |

## Kilder og brugsgrundlag

### Efterårsskov

- **Original:** `Forest Ambience` af TinyWorlds.
- **Kilde:** [OpenGameArt: Forest Ambience](https://opengameart.org/content/forest-ambience), hentet fra den angivne MP3-kilde.
- **Licens:** CC0.
- **Behandling:** MP3 blev lokalt transkodet til den leverede 44,1 kHz/128 kbps-fil.

### Regn ved vinduet

- **Original:** `Rain against the window` af cori (Cori Samuel).
- **Kilde:** [Wikimedia Commons-filsiden](https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg), original [OGG-fil](https://upload.wikimedia.org/wikipedia/commons/4/41/Rain_against_the_window.ogg).
- **Licens:** Public domain, som angivet på filens Commons-side.
- **Behandling:** Original OGG blev lokalt transkodet til den leverede 44,1 kHz/128 kbps-MP3.

### Stille klaver

- **Original:** `Meditation Impromptu 01` af Kevin MacLeod.
- **Kilde:** [Incompetech-filsiden](https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100163), original [MP3](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2001.mp3).
- **Licens:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Påkrævet kredit:** `Meditation Impromptu 01 — Kevin MacLeod (incompetech.com), CC BY 4.0`.
- **Levering:** Krediten og kildelinket er synligt og nåbart i selve Lyd og ro-kontrollen. MP3'en er transkodet lokalt til 44,1 kHz/128 kbps.

### Papir ved valg

- **Originaler:** `BookFlip1.wav`, `BookFlip5.wav` og `BookFlip9.wav` fra `Book Flip Sounds` af Voltiment555.
- **Kilde:** [OpenGameArt: Book Flip Sounds](https://opengameart.org/content/book-flip-sounds), [kildearkiv](https://opengameart.org/sites/default/files/BookFlip_SFX.zip).
- **Licens:** CC0.
- **Behandling:** De tre korte WAV-filer er lokalt transkodet til mono-MP3. De bruges kun som valgfri, korte feedbacklyde efter en meningsfuld lydhandling — aldrig ved hover, tastning eller autosave.

## Bevidste fravalg og åbne kvalitetspunkter

- **Bibliotekets ro er ikke afspilningsklar.** Der er ikke fundet en dokumenteret, stemmefri og passende licenseret bibliotek-/læserumsoptagelse. Kortet er derfor markeret som afventende i stedet for at bruge cafélyde, elevstemmer, genereret støj eller en vildledende erstatning.
- De ældre `public/skovlyd.mp3` og `public/forest.mp3` bruges ikke i læreruniverset. De har ikke et tilstrækkeligt dokumenteret brugsgrundlag i repositoryet.
- Der er udført teknisk dekodnings- og browser-requestkontrol. Der er **ikke** udført en menneskelig lyttegennemgang på lærerhøjttalere, telefoner eller fysiske klasselokaler. Ingen beskrivelse af balance, ro eller oplevet lydkvalitet må derfor forstås som en afsluttet lyttegodkendelse.

## Gentagelig teknisk kontrol

Kør fra projektroden:

```powershell
npm.cmd run teacher-audio:verify
npm.cmd run teacher-audio:test
```

Kontrollen validerer de leverede lokale MP3-filer, deres SHA-256-værdier, deres dokumentations-/licenskilder og at det uafklarede biblioteks-preset ikke kan registreres som afspilningsklart.
