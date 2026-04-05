# Brætspilsregler baseret på Zone-Krigen og Live Stratego

Dette dokument er skrevet ud fra den faktiske kode i projektet pr. 5. april 2026.

Målet er ikke at kopiere mobilspillene 1:1, men at oversætte deres kerne til brætspilsregler, der føles så tæt på systemet som muligt.

## Kort gennemgang af hvordan spillene faktisk virker

### Zone-Krigen

- Spillet er et holdspil med op til 4 standardhold: Rød, Blå, Grøn og Gul.
- Hver zone svarer til en opgave på kortet.
- En zone overtages kun ved korrekt svar.
- Når en zone skifter ejer, får holdet zonens pointværdi med det samme.
- Hvis et hold svarer korrekt i en zone, de allerede ejer, får de ikke nye point, men de kan forny zonens skjold.
- I den nuværende kode varer zonens skjold 3 minutter efter en erobring.
- Kampen starter med en 15 minutters nedtælling.
- Vinderen findes på antal kontrollerede zoner, ikke på point.
- Hvis to eller flere hold står lige på flest zoner, er det uafgjort.

Bemærkning:
Ældre tekster i UI nævner nogle steder 60 sekunders shield, men selve spillogikken bruger 3 minutter. Reglerne her følger koden.

### Live Stratego

- Spillet er altid Rød mod Blå.
- Læreren placerer en rød base og en blå base før start.
- Baserne er både fredszoner og respawn-zoner.
- Hver spiller får en hemmelig rolle.
- Holdene blandes tilfældigt, og rollerne deles ud fra en fast prioriteret pulje, så hvert hold altid får mindst en fane og en spion.
- Allierede kan ses med navn og rolle. Fjender ses ikke som præcise brikker, men som radarsignaler.
- Radaren arbejder i fire afstandsbånd: `0-20 m` angreb muligt, `20-40 m` nær, `40-80 m` mellem, `80+ m` fjern.
- En duel kan kun ske, hvis begge spillere er levende, uden for fredszoner, og angriberen ikke er i duel-cooldown.
- Duel-cooldown er 5 sekunder.
- Når en spiller vender tilbage til basen, kan de respawne.
- Efter respawn får spilleren 10 sekunders spawn-skjold.
- Hvis fanen bliver fanget, slutter spillet straks, og holdet med angriberen vinder.

Særlige duelregler fra koden:

- Bomben slår alt, undtagen Minør.
- Minør slår Bombe.
- Spion slår kun Feltmarskal, hvis Spionen angriber.
- Højere styrke vinder ellers.
- Ved lige styrke ryger begge tilbage til base.

Vigtig kode-note:
Rolledataene indeholder klassiske Stratego-felter som "kan flytte" og "kan flytte flere felter", men de bliver ikke håndhævet i den nuværende live-logik. Hvis du vil være helt kode-tro, må alle roller derfor gerne flytte i brætspilsversionen.

## Brætspilsversion 1: Zone-Krigen

### Materialer

- 1 spilleplade med 8 zoner forbundet af ruter
- 8 zonekort med spørgsmål og pointværdi
- 2-4 hold
- 3 agentbrikker pr. hold
- 1 ejer-markør pr. zone
- 8 skjold-markører
- 1 pointspor
- 1 rundetæller

### Opsætning

1. Læg 8 zoner på brættet.
2. Læg ét zonekort på hver zone. Hvert kort skal have et spørgsmål og en pointværdi.
3. Vælg 2-4 hold.
4. Hvert hold placerer sine 3 agentbrikker i sin startkant eller startbase.
5. Sæt rundetælleren til 10 runder.

Hvorfor 10 runder:
Det er min bord-oversættelse af spillets 15 minutters digitale varighed.

### Rundeoversigt

Hver runde spilles i denne rækkefølge:

1. Alle hold flytter deres agentbrikker 1 rute hver.
2. Et hold må forsøge at erobre hver zone, hvor de har mindst 1 agent.
3. Hvis svaret er korrekt, afgøres zoneeffekten.
4. Til sidst tælles skjold-runder ned.

### Erobring

- Hvis zonen er neutral, og et hold svarer korrekt, overtager de zonen og får zonens point.
- Hvis zonen ejes af et andet hold, og skjoldet ikke er aktivt, overtager det angribende hold zonen og får zonens point.
- Hvis zonen ejes af et andet hold, og skjoldet er aktivt, kan zonen ikke overtages, selv med korrekt svar.
- Hvis et hold svarer korrekt i en zone, de allerede ejer, får de ingen point, men de fornyer zonens skjold.

### Skjold

- Når en zone overtages eller forsvares korrekt af ejeren, får zonen skjold i 3 runder.
- Et aktivt skjold beskytter kun mod andre hold.
- Ejeren må stadig forny skjoldet ved at svare korrekt på sin egen zone.

### Point

- Holdet får kun point, når ejerskabet faktisk skifter til dem fra neutral eller fjendtlig kontrol.
- Point afgør ikke sejren alene.

### Sejr

- Efter sidste runde vinder holdet med flest kontrollerede zoner.
- Hvis flere hold står lige på flest zoner, er resultatet uafgjort.
- Point kan bruges som sekundær statistik, men ikke som officiel sejrskriterium.

### Hvorfor denne version passer til koden

- Fri bevægelse mellem zoner er bevaret.
- Der er ingen direkte kamp mellem hold i zonefelterne.
- Spørgsmålene er stadig det, der afgør kontrol.
- Zonekontrol er vigtigere end rå pointsum.

## Brætspilsversion 2: Live Stratego

Denne version bliver mest tro mod koden, hvis én person er spilleder eller "kontrolrum".

### Materialer

- 1 spilleplade på 9x9 felter
- 1 spilleder-skærm
- 2 basemarkører: Rød og Blå
- 1 rolle-deck til hvert hold
- 1 brik pr. rolle i spil
- 1 cooldown-markør
- 1 spawn-skjold-markør

### Standard holdstørrelse

Til en kort bordversion anbefaler jeg 8 roller pr. hold:

- Fane
- Spion
- Bombe
- Minør
- Spejder
- Sergent
- Løjtnant
- Kaptajn

Hvis I vil køre en større version, tager I bare de næste roller i samme rækkefølge som i koden:

`flag, spy, bomb, miner, scout, sergeant, lieutenant, captain, major, colonel, general, marshal, bomb, miner, scout, sergeant, lieutenant, captain, major, scout, bomb, miner, captain, lieutenant, scout, major, bomb, sergeant, colonel, general`

### Opsætning

1. Placér Rød base og Blå base i hver sin ende af brættet.
2. Marker en fredszone rundt om hver base med radius 3 felter.
3. Hvert hold blander sine roller tilfældigt og fordeler dem mellem sine brikker.
4. Holdet må kende egne roller. Modstanderen må ikke.
5. Spillederen kender hele stillingen, ligesom lærerens kontrolrum i den digitale version.

### Felt-oversættelse

For at efterligne GPS-logikken tæller 1 felt som 10 meter:

- Angreb muligt inden for 2 felter
- Nær radar: 3-4 felter
- Mellem radar: 5-8 felter
- Fjern radar: 9+ felter
- Fredszone: 3 felter fra egen base

### Tur

Hver runde:

1. Rød flytter alle sine levende brikker 1 felt.
2. Blå flytter alle sine levende brikker 1 felt.
3. Spillederen annoncerer et radarsignal til begge hold: "angrebsklar", "nær", "mellem", "fjern" eller "ingen sikre signaler".
4. Hvis to fjendtlige brikker ender inden for 2 felter, kan den aktive spiller udløse duel.

### Bevægelse

Kode-tro version:

- Alle levende roller må flytte 1 felt pr. tur.

Valgfri klassisk Stratego-variant:

- Fane og Bombe står stille.
- Spejder må flytte 2 felter.

Hvis du vil ramme den nuværende app mest præcist, så brug kode-tro versionen.

### Fredszoner

- En brik i egen fredszone må ikke angribes.
- En brik i egen fredszone må ikke selv starte en duel.
- Når en brik vender hjem til sin base, kan den respawne.

### Respawn

- En tabende brik vendes eller markeres som "til base".
- Brikken skal flyttes tilbage til egen base.
- Når den når basen, bliver den levende igen.
- Efter respawn får den spawn-skjold i 1 hel tur.

Hvorfor 1 tur:
Det er bord-oversættelsen af spillets 10 sekunders spawn-skjold.

### Duel

Når en duel udløses, afsløres begge roller, og resultatet afgøres sådan:

- Fane taber ved kontakt og giver straks sejr til modstanderen.
- Bombe slår alle undtagen Minør.
- Minør slår Bombe.
- Spion slår Feltmarskal, men kun når Spionen angriber.
- Ellers vinder højeste styrke.
- Ved lige styrke taber begge og sendes til base.

### Cooldown

- En brik, der lige har været i duel, må ikke starte en ny duel i samme runde.

Hvorfor:
Det er bord-oversættelsen af spillets 5 sekunders duel-cooldown.

### Sejr

- Hvis du fanger modstanderens Fane, vinder dit hold øjeblikkeligt.

### Hvorfor denne version passer til koden

- Baserne fungerer som safe zones og respawn-zoner.
- Fjender er ikke åbne brikker, men radarsignaler.
- Roller afgør kun kamp, ikke nødvendigvis bevægelse.
- Flagfangst stopper spillet med det samme.

## Min anbefaling

Hvis du vil have den mest spilbare bordversion:

- Brug Zone-Krigen som et åbent taktisk familie-/klasse-spil.
- Brug Live Stratego som et holdspil med spilleder, skjulte roller og radar-oplysninger.

Hvis du vil have den mest kode-tro version:

- Lad Zone-Krigen afgøres på zonekontrol, ikke point.
- Brug 3 runder skjold i Zone-Krigen.
- Lad alle Stratego-roller kunne flytte.
- Brug safe zones, respawn og skjulte fjendesignaler som de bærende mekanikker.
