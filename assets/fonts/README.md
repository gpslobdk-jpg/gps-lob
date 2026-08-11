# Self-hosted fonts

SkoleGPS self-hoster de production-weights, som allerede blev brugt via
`next/font/google`. Det fjerner Google Fonts som build-time dependency uden at
ændre den typografiske identitet.

## Poppins

- Weights: 400, 500, 600, 700 og 800
- Style: normal
- Subset: latin
- Official distribution: Google Fonts `fonts.gstatic.com`, Poppins v24
- Authoritative metadata: https://github.com/google/fonts/tree/main/ofl/poppins
- License: SIL Open Font License 1.1, bevaret i `poppins/OFL.txt`

## Rubik

- Weights: 700, 800 og 900
- Style: normal
- Subset: latin
- Official distribution: Google Fonts `fonts.gstatic.com`, Rubik v31
- Authoritative metadata: https://github.com/google/fonts/tree/main/ofl/rubik
- License: SIL Open Font License 1.1, bevaret i `rubik/OFL.txt`

Fontfilerne blev hentet fra de officielle statiske WOFF2-URL'er, som Google
Fonts CSS API udleverede for hver enkelt weight. Runtime og build bruger kun de
lokale filer i dette bibliotek.
