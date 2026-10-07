# SkoleGPS elevlydassets

- **Dato:** 2026-10-07
- **Kilde / oprindelse:** Originale, lokalt syntetiserede SkoleGPS-lydsignaler. Der indgår ingen optagelser, stems, loops, stemmer, referenceværker, modelgenereret lyd, downloads eller betalte/onlinetjenester.
- **Metode:** `scripts/generate-student-audio-assets.mjs` bygger deterministiske mono-PCM-bølgeformer (sinus, envelope og deterministisk støj) i Node.js, skriver dem kun midlertidigt som 44,1 kHz/16-bit WAV og komprimerer dem til MP3. Ved den dokumenterede generering fandt scriptet den lokale CapCut-inkluderede FFmpeg 21.7.0 og brugte Windows Media Foundation-encoderen `mp3_mf` med konstant 128 kbps. De midlertidige WAV-filer slettes ved afslutning; kun MP3-filerne under `public/audio/elev/` er leverancefiler.
- **Licens:** Originalt SkoleGPS-projektmateriale — alle rettigheder forbeholdes; dette arbejde tildeler ingen ekstern licens. Generator-koden følger repositoryets almindelige vilkår. Encoder-softwaren er kun et lokalt produktionsværktøj og tilfører ingen tredjepartslyd til outputtet.

## Leverede filer

Alle filer er **MP3 (MPEG-1 Layer III), mono, 44,1 kHz, CBR 128 kbps**. Varighederne er aflæst ved at validere MP3-rammerne i den genererede pakke.

| Public-sti | Rolle | Varighed | Størrelse |
| --- | --- | ---: | ---: |
| `/audio/elev/mission-loop.mp3` | Rolig missionsbund; fem gentagelser af et originalt firesekunders motiv | 20,062 s | 320.300 bytes (312,8 KiB) |
| `/audio/elev/i-maal-sting.mp3` | Kort, stigende mål-/ankomststing | 1,855 s | 29.651 bytes (29,0 KiB) |
| `/audio/elev/tap.mp3` | Afrundet berøring/valg | 0,183 s | 2.963 bytes (2,9 KiB) |
| `/audio/elev/post.mp3` | Blød post-/waypoint-bekræftelse | 0,522 s | 8.384 bytes (8,2 KiB) |
| `/audio/elev/correct.mp3` | Kort to-tonet korrekt-svar-bekræftelse | 0,784 s | 12.554 bytes (12,3 KiB) |

Den samlede initiale pakke er **373.852 bytes (365,1 KiB)**, under budgettet på cirka 600 KiB. `mission-loop.mp3` ligger inden for kravet på 16-24 sekunder.

## Brug i elevoplevelsen

`StudentSoundController` opretter ingen lydafspiller eller lyd-URL før elevens direkte valg. Ved et valgt lydniveau er hele den maksimale lokale pakke 373.852 bytes; den er ikke en del af PWA'ens install-/precache-liste. Den eksisterende Pilen-maskot bruges i lydindgangen, så der er ikke tilføjet en ny maskot eller et nyt visuelt univers.

I den produktionslignende buildkontrol den 8. oktober 2026 svarede den lokale `next start`-server med `audio/mpeg` og i alt **373.852 bytes** for de fem asset-URL'er. Chromium-kontrollen observerede ingen audio-request eller audio-cache før elevens valg og derefter kun `/audio/elev/`-requests. Browseren kan vælge byte-range/metadata-requests, så det målte fulde HTTP-budget er angivet som øvre grænse for den første opt-in-hentning — ikke som et løfte om identisk mobiltrafik.

Pakken dækker navigation, poståbning, autoritativt korrekt svar og autoritativ fuldførelse. Der er bevidst ingen lobby-/lærerstarts-loop eller lærerbesked-cue: der findes ikke i denne afgrænsede frontend et sikkert, autoritativt signal for dem uden at ændre den beskyttede motor. Stilhed er den valgte sikre adfærd i de tilfælde.

Den tekniske dekodning er kontrolleret lokalt, og browserkontroller tester opt-in og fejlfald tilbage til stilhed. Der er ikke udført fysisk telefon- eller højttalerlytning; mono/mixegnethed må derfor ikke læses som en fysisk telefonverifikation.

## Gentagelig generering og kontrol

Kør fra projektroden i PowerShell:

```powershell
npm.cmd run audio:generate
npm.cmd run audio:verify
npm.cmd run audio:test
```

`audio:verify` afviser manglende filer, ugyldige MP3-rammer, forkert samplingsfrekvens/bitrate, varigheder uden for intervallet eller en pakke over 600 KiB. `audio:test` genererer to isolerede midlertidige pakker og sammenligner SHA-256 for hver fil; den bestod ved dokumentationstidspunktet. Den matematiske kilde er deterministisk uden klokke eller tilfældighed. De eksakte MP3-bytes forudsætter samme lokale encoder-build; en anden gyldig lokal MP3-encoder kan lovligt give andre, men stadig validerede, komprimerede bytes.
