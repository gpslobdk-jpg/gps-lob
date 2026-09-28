# Martin Kleier – layoutkontrol

- `before-live-overlap.png` er det modtagne screenshot. Det viser, at “Faktisk startfordeling” dækker “Live overvågning” på lærerkortet.
- `after-desktop.png` er den lokale browserkontrol ved 1440 × 900. Kortet står øverst til højre under “Fokus” og uden overlap med hverken “Live overvågning” eller fokusknappen.
- `after-mobile-iphone14.png` er den lokale iPhone 14-kontrol. Fordelingskortet er skjult under `xl`, mens “Live overvågning” stadig er synlig.

Begge efterbilleder kommer fra den mockede lærerside i `tests/teacher-live-roster-recovery.spec.ts`; de bruger ingen produktionsdata.
