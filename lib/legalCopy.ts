import type { SiteVariantKey } from "@/lib/siteVariant";

export type LegalBullet = {
  label?: string;
  text: string;
};

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: LegalBullet[];
  email?: string;
  emailLabel?: string;
};

export type LegalCardTone = "emerald" | "sky" | "amber" | "violet" | "purple";

export type LegalCard = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  bullets?: LegalBullet[];
  tone: LegalCardTone;
};

type LegalMetadata = {
  title: string;
  description: string;
};

type GdprPageCopy = {
  metadata: LegalMetadata;
  backToHomeLabel: string;
  heroTitle: string;
  heroEyebrow: string;
  intro: string;
  sections: LegalSection[];
  schoolCallout: LegalSection;
  updatedAt: string;
};

type PrivacyPageCopy = {
  metadata: LegalMetadata;
  backToHomeLabel: string;
  heroTitle: string;
  heroEyebrow: string;
  intro: string;
  sections: LegalSection[];
  securityCallout: LegalSection;
  support: LegalSection;
};

type OphavsretPageCopy = {
  metadata: LegalMetadata;
  backToHomeLabel: string;
  heroTitle: string;
  heroEyebrow: string;
  intro: string;
  principles: LegalCard[];
  summary: string;
  ctaLabel: string;
};

type JuraPageCopy = {
  metadata: LegalMetadata;
  backToOverviewLabel: string;
  backToHomeLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  cards: LegalCard[];
};

type PodcastRightsPageCopy = {
  metadata: LegalMetadata;
  backToPodcastLabel: string;
  title: string;
  heroEyebrow: string;
  intro: string;
  rulesTitle: string;
  rules: LegalCard[];
  summary: string;
};

type LegalCopy = {
  gdpr: GdprPageCopy;
  privacy: PrivacyPageCopy;
  ophavsret: OphavsretPageCopy;
  ophavsretJura: JuraPageCopy;
  ophavsretPodcast: PodcastRightsPageCopy;
};

const legalCopies: Record<SiteVariantKey, LegalCopy> = {
  gpslob: {
    gdpr: {
      metadata: {
        title: "Privatlivspolitik & GDPR | GPSLØB",
        description:
          "GPSLØB er fuldt GDPR-kompatibelt og bygget til folkeskolen. Læs vores privatlivspolitik og se hvordan vi håndterer data.",
      },
      backToHomeLabel: "Tilbage til forsiden",
      heroTitle: "Bygget til folkeskolen. 100 % styr på GDPR.",
      heroEyebrow: "Privacy by Design fra dag ét",
      intro:
        'Vi ved, at datasikkerhed er afgørende ude på skolerne. Derfor er systemet bygget med "Privacy by Design" – vi indsamler kun det absolut nødvendige, og vi sletter det igen, så snart løbet er slut.',
      sections: [
        {
          title: "1. Dataansvarlig",
          paragraphs: ["GPSLØB"],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
        {
          title: "2. Ingen elev-logins",
          paragraphs: [
            "Eleverne skal ikke oprette en konto, afgive mailadresser eller downloade en app. De deltager direkte via browseren – uden UNI-login eller anden registrering.",
          ],
        },
        {
          title: "3. Hvilke data indsamles",
          paragraphs: [
            'Eleverne indtaster udelukkende løbets pinkode og et valgfrit holdnavn (f.eks. "Hold 3"). Vi sporer ingen personfølsomme oplysninger. Data bruges udelukkende til at afvikle det aktive løb og vises kun på lærerens skærm.',
          ],
          bullets: [
            { label: "Holdnavn", text: "valgfrit, indtastet af eleven" },
            { label: "GPS-lokation", text: "kun aktivt under løbet" },
            { label: "Svar på opgaver", text: "tekst eller valg" },
            { label: "Billeder", text: "kun hvis opgaven kræver det" },
            { label: "Teknisk info", text: "browser og enhedstype til fejlfinding" },
          ],
        },
        {
          title: "4. Brug af kamera",
          paragraphs: [
            "Platformen kan anmode om adgang til kameraet, men kun hvis en opgave kræver, at eleven tager et billede som en del af løbet. Der sker ingen optagelse i baggrunden, og kameraet aktiveres aldrig uden elevens egen handling.",
          ],
        },
        {
          title: "5. Brug af GPS-lokation",
          paragraphs: [
            "Platformen bruger GPS til at registrere elevens position under løbet. Lokationen bruges udelukkende til at afgøre, om eleven er nær en opgavepost. GPS-data bruges ikke til sporing uden for løbet.",
          ],
        },
        {
          title: "6. Tryg datahåndtering",
          paragraphs: [
            'GPS-lokation registreres kun lokalt i elevens egen browser, mens løbet er aktivt. Svar og eventuelle billeder gemmes kortvarigt, men læreren kan med ét klik slette alt på Resultatsiden. Vi kalder det vores "Digitale Skraldemand".',
            "Billeder af elever slettes automatisk efter 30 dage – uanset om læreren husker det.",
          ],
        },
        {
          title: "7. Opbevaring og sletning",
          bullets: [
            { text: "Løbsdata slettes automatisk, når løbet afsluttes" },
            { text: "Billeder slettes automatisk efter 30 dage" },
            { text: "Læreren kan til enhver tid slette alt manuelt via Resultatsiden" },
          ],
        },
        {
          title: "8. Ingen reklamer, ingen videresalg",
          paragraphs: [
            "Vi sælger aldrig data til tredjepart, og der er ingen reklamer i platformen. GPSLØB er et lukket undervisningsrum.",
          ],
        },
        {
          title: "9. Tredjeparter",
          paragraphs: ["GPSLØB anvender følgende underleverandører til drift af platformen:"],
          bullets: [
            { label: "Supabase", text: "database og backend" },
            { label: "Vercel", text: "webhosting" },
            { label: "Stripe", text: "betalingsbehandling for lærere og skoler" },
            { label: "Sentry", text: "teknisk fejlovervågning" },
          ],
        },
        {
          title: "10. Dine rettigheder",
          paragraphs: [
            "Du har ret til indsigt i, hvilke data vi har registreret, ret til at få dem slettet og ret til at gøre indsigelse mod behandlingen.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
        {
          title: "11. Målgruppe – designet til skoler",
          paragraphs: [
            "GPSLØB er designet til undervisningsbrug i folkeskolen og lignende institutioner. Systemet indsamler ikke unødige personoplysninger om elever.",
          ],
        },
        {
          title: "12. Nyheder og opdateringer",
          paragraphs: [
            "Du modtager kun nyheder og opdateringer om GPS Løb på e-mail, hvis du aktivt har givet samtykke. Du kan til enhver tid trække samtykket tilbage under dine indstillinger eller ved at kontakte os.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
      ],
      schoolCallout: {
        title: "For skoler og kommuner",
        paragraphs: [
          "Vi ved, at I har brug for papirerne i orden. Vi indgår gerne en standard databehandleraftale (DPA) med jeres skole eller kommune, inden I tager platformen i brug.",
        ],
        email: "skolegpsdk@gmail.com",
        emailLabel: "Kontakt",
      },
      updatedAt: "Senest opdateret: 27. maj 2026.",
    },
    privacy: {
      metadata: {
        title: "Privatliv & Datasikkerhed | GPSLØB",
        description:
          "GPSLØB er bygget med Privacy by Design. Elevernes GPS-data bruges kun aktivt under løbet og slettes automatisk bagefter. Ingen elev-logins, ingen sporing.",
      },
      backToHomeLabel: "Tilbage til forsiden",
      heroTitle: "Privatliv, Sikkerhed & Udvikler Info",
      heroEyebrow: "Vi passer på elevernes data (og rydder op efter os)",
      intro:
        'Når I løber GPS-løb hos os, skal fokus være på leg, læring og frisk luft – ikke på bekymringer om data. Vi har bygget platformen med "Privacy by Design", hvilket betyder, at vi kun indsamler det absolut nødvendige, og vi sletter det igen, så snart løbet er slut.',
      sections: [
        {
          title: "1. Hvilke data indsamler vi?",
          paragraphs: ["Når en elev eller et hold deltager i et løb, beder vi kun om:"],
          bullets: [
            { text: "Et holdnavn eller fornavn" },
            { text: "GPS-lokation, kun mens løbet er aktivt" },
            { text: "Svar på posterne og eventuelle billeder, hvis læreren har valgt en foto-post" },
          ],
        },
        {
          title: "2. Hvad bruges dataen til?",
          paragraphs: [
            "Dataen bruges udelukkende til at drive spillet fremad og til at vise læreren et leaderboard og en resultatliste, når løbet er færdigt.",
          ],
        },
        {
          title: "3. Vores Digitale Skraldemand",
          paragraphs: [
            "Vi ønsker ikke at gemme billeder af børn og unge længere end nødvendigt. Derfor kan læreren med ét klik slette alle billeder og svar på resultatsiden.",
          ],
        },
        {
          title: "4. Ingen reklamer, ingen videresalg",
          paragraphs: [
            "Vi sælger aldrig data til tredjepart, og der er ingen reklamer i platformen. Det skal være et trygt undervisningsrum.",
          ],
        },
        {
          title: "5. For skoler og kommuner",
          paragraphs: [
            "Vi indgår gerne en standard databehandleraftale med jeres skole eller kommune, før I tager platformen i brug.",
          ],
        },
      ],
      securityCallout: {
        title: "Sikkerhed i Topklasse",
        paragraphs: [
          "Vi tager datasikkerhed seriøst og bruger etablerede driftstjenester samt begrænset adgang til administrationsfunktioner.",
        ],
        bullets: [
          { label: "Stram adgangskontrol", text: "kun autoriserede lærere og administratorer kan oprette og styre indhold" },
          { label: "Beskyttet KI-integration", text: "data bruges ikke til at træne offentlige KI-modeller" },
          { label: "Skudsikre API'er", text: "trafik begrænses med timeouts og beskyttelse mod misbrug" },
          { label: "Krypteret data", text: "al trafik kører over moderne kryptering" },
        ],
      },
      support: {
        title: "Udvikler Info & Support",
        paragraphs: [
          "Har du tekniske spørgsmål, ønsker du at købe adgang til din skole, eller vil du kontakte udvikleren direkte?",
        ],
        email: "skolegpsdk@gmail.com",
        emailLabel: "Skriv til",
      },
    },
    ophavsret: {
      metadata: {
        title: "Ophavsret & AI-brug | GPSLØB",
        description:
          "Klare principper for ophavsret og ansvarlig brug af AI og tekster i GPSLØB. Din data bruges ikke til at træne offentlige AI-modeller.",
      },
      backToHomeLabel: "Tilbage til forsiden",
      heroTitle: "Ophavsret og brug af AI i GPS Løb",
      heroEyebrow: "Klare rammer for sikker databehandling og ansvarlig brug af tekster",
      intro:
        "Når du bruger vores Scan tekst-funktion og øvrige kreative KI-værktøjer, er det vigtigt, at vi passer på forfatternes rettigheder. Derfor har vi bygget GPS Løb med to klare principper.",
      principles: [
        {
          eyebrow: "Punkt 1",
          title: "Din data træner ikke AI'en",
          tone: "emerald",
          paragraphs: [
            "Når du uploader et billede af en tekst, bruger vi en lukket API-forbindelse. Teksten læses kun i det øjeblik, det tager at generere løbet.",
            "Teksten bliver ikke gemt og bliver ikke brugt til at træne offentlige KI-modeller. Din data forbliver privat.",
          ],
        },
        {
          eyebrow: "Punkt 2",
          title: "Lærerens ansvar og Copydan",
          tone: "sky",
          paragraphs: [
            "Ligesom ved skolens kopimaskine er det dit eget ansvar som underviser at sikre, at du har ret til at bruge det materiale, du scanner ind.",
            "Vi opfordrer til, at funktionen primært bruges til egne noter, korte tekstuddrag under citatretten eller materiale, som skolen har en Copydan-aftale til.",
          ],
        },
      ],
      summary:
        "GPS Løb er designet til at hjælpe dig med at forvandle viden til aktiv læring i skolegården – hurtigt, sjovt og sikkert.",
      ctaLabel: "Læs den fulde juridiske uddybning her",
    },
    ophavsretJura: {
      metadata: {
        title: "Juridisk Ansvarsfraskrivelse | GPSLØB",
        description:
          "Fuld juridisk uddybning og ansvarsfraskrivelse for GPS Løb. Ophavsretsloven, E-handelsloven og Safe Harbor.",
      },
      backToOverviewLabel: "← Ophavsret",
      backToHomeLabel: "Forsiden",
      eyebrow: "Disclaimer",
      title: "Juridisk Uddybning og Ansvarsfraskrivelse",
      intro: "Denne side indeholder den fulde juridiske ramme for brug af GPS Løbs KI-værktøjer.",
      cards: [
        {
          eyebrow: "§ 1",
          title: "Brugerens rettigheder og ansvar",
          tone: "emerald",
          paragraphs: [
            "Ved upload af billeder, tekster eller links til bearbejdning i GPS Løbs KI-tjenester indestår brugeren fuldt ud for, at materialet anvendes lovligt.",
            "Det indebærer, at brugeren enten har indhentet samtykke fra rettighedshaveren, agerer inden for citatretten eller bruger materiale dækket af skolens Copydan Tekst & Node-aftale.",
          ],
        },
        {
          eyebrow: "§ 2",
          title: "Platformens status som teknisk formidler",
          tone: "sky",
          paragraphs: [
            "GPS Løb fungerer som teknisk it-infrastruktur og databehandler for brugeren. Platformen bærer ikke redaktionelt ansvar for det specifikke indhold, brugerne uploader, scanner eller transmitterer.",
            "Platformen udfører ingen forudgående manuel eller automatiseret kontrol af rettighederne til det brugergenererede indhold.",
          ],
        },
        {
          eyebrow: "§ 3",
          title: "Procedure ved mulig krænkelse",
          tone: "amber",
          paragraphs: [
            "Hvis GPS Løb får troværdig information om, at konkret indhold krænker tredjeparts rettigheder, kan vi fjerne eller blokere adgangen til materialet uden varsel.",
          ],
        },
        {
          eyebrow: "§ 4",
          title: "Databehandling og tredjeparts KI-modeller",
          tone: "violet",
          paragraphs: [
            "GPS Løb benytter lukkede API-forbindelser til underdatabehandlere. Materiale behandles midlertidigt for at generere løbsspørgsmål og slettes efter endt session.",
            "Materialet indgår ikke i træningsdata for offentlige KI-grundmodeller.",
          ],
        },
      ],
    },
    ophavsretPodcast: {
      metadata: {
        title: "Podcast-Detektiven & Ophavsret | GPSLØB",
        description:
          "Podcast-Detektiven i GPSLØB er lovlig at bruge i undervisningen og bygger kun på offentligt tilgængeligt indhold.",
      },
      backToPodcastLabel: "Tilbage til Podcast-Detektiven",
      title: "Podcast-Detektiven og Ophavsret ⚖️",
      heroEyebrow: "Tryg brug i undervisningen",
      intro:
        "Når du bruger Podcast-Detektiven til at bygge GPS-løb, skal ophavsretten respekteres. Værktøjet er bygget til at bruge offentligt tilgængeligt indhold på en forsigtig måde.",
      rulesTitle: "Sådan fungerer det i praksis",
      rules: [
        {
          eyebrow: "Regel 1",
          title: "Ingen lagring af lyd",
          tone: "purple",
          paragraphs: [
            "Vi downloader, kopierer eller gemmer aldrig selve lyd- eller videofilerne på vores servere.",
          ],
        },
        {
          eyebrow: "Regel 2",
          title: "Støt skaberne – lyt via originalkilden",
          tone: "sky",
          paragraphs: [
            "Når elever skal lytte til udsendelsen under løbet, bliver de sendt videre til originalkilden. Skaberne bag podcasten får fortsat deres lyttertal og anerkendelse.",
          ],
        },
        {
          eyebrow: "Regel 3",
          title: "Læsning af offentlig data",
          tone: "emerald",
          paragraphs: [
            "For at bygge spørgsmålene læser systemet kun offentligt tilgængelige tekster som show notes, resuméer og åbne undertekster.",
          ],
        },
      ],
      summary:
        "Læreren eller skolen er selv ansvarlig for, at podcastmateriale bruges lovligt i undervisningen.",
    },
  },
  postlob: {
    gdpr: {
      metadata: {
        title: "Personvern og databehandling | Postløp",
        description:
          "Les hvordan Postløp behandler personopplysninger i skolen. Ingen elevkonto, GPS-posisjon bare under aktivt løp og ingen annonser.",
      },
      backToHomeLabel: "Tilbake til forsiden",
      heroTitle: "Bygget for skolen. Nøktern behandling av personopplysninger.",
      heroEyebrow: "Personvern som standard",
      intro:
        "Postløp er laget for bruk i skole og undervisning. Vi behandler bare personopplysninger som er nødvendige for å gjennomføre et aktivt løp, vise resultater til lærer eller arrangør og rette tekniske feil.",
      sections: [
        {
          title: "1. Behandlingsansvarlig",
          paragraphs: [
            "Når Postløp brukes i skolen, vil skoleeier normalt være behandlingsansvarlig for personopplysninger som behandles som del av undervisningen.",
            "Postløp leverer plattformen og kan inngå databehandleravtale ved behov.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
        {
          title: "2. Ingen elevkonto",
          paragraphs: [
            "Elever trenger ikke å opprette konto, logge inn eller oppgi e-postadresse. De deltar via nettleseren med løpskode og eventuelt frivillig navn eller lag.",
          ],
        },
        {
          title: "3. Hvilke opplysninger brukes",
          paragraphs: [
            "Vi behandler bare opplysninger som er nødvendige for å gjennomføre løpet og vise status og resultater til lærer eller arrangør.",
          ],
          bullets: [
            { label: "Løpskode", text: "brukes for å koble eleven til riktig løp" },
            { label: "Frivillig navn eller lag", text: "kan oppgis hvis læreren ønsker det" },
            { label: "GPS-posisjon", text: "brukes bare mens løpet er aktivt" },
            { label: "Svar", text: "tekst, valg og poeng knyttet til oppgavene" },
            { label: "Bilder", text: "brukes bare ved fotooppgaver. Bilder av elever regnes som personopplysninger" },
            { label: "Teknisk informasjon", text: "som nettleser og enhetstype ved feilsøking" },
          ],
        },
        {
          title: "4. GPS-posisjon",
          paragraphs: [
            "GPS-posisjon brukes bare for å avgjøre om deltakeren er ved riktig post, og bare mens løpet er aktivt. Opplysningene brukes ikke til sporing utenfor løpet.",
          ],
        },
        {
          title: "5. Bilder og fotooppgaver",
          paragraphs: [
            "Kamera brukes bare hvis en oppgave krever at eleven tar et bilde. Det skjer ingen skjult opptak i bakgrunnen, og kameraet aktiveres ikke uten elevens egen handling.",
          ],
        },
        {
          title: "6. Hva opplysningene brukes til",
          paragraphs: [
            "Svar, bilder og løpsstatus brukes for å gjennomføre løpet og for å vise resultater til lærer eller arrangør. Opplysningene brukes ikke til annonser eller markedsføring.",
          ],
        },
        {
          title: "7. Ingen annonser og ingen videresalg",
          paragraphs: [
            "Postløp selger ikke data og viser ikke annonser til elever. Løsningen er laget for skolebruk, ikke reklameformål.",
          ],
        },
        {
          title: "8. Underleverandører",
          paragraphs: ["Postløp bruker etablerte underleverandører for drift av plattformen:"],
          bullets: [
            { label: "Supabase", text: "database og backend" },
            { label: "Vercel", text: "webhosting" },
            { label: "Stripe", text: "betalingsbehandling for lærere og skoler" },
            { label: "Sentry", text: "feillogging og teknisk overvåking" },
          ],
        },
        {
          title: "9. Lagring og sletting",
          bullets: [
            { text: "Løpsdata lagres bare så lenge det er nødvendig for å gjennomføre eller følge opp løpet" },
            { text: "Bilder og svar kan slettes av lærer eller arrangør" },
            { text: "Opplysninger slettes når de ikke lenger er nødvendige for formålet" },
          ],
        },
        {
          title: "10. Rettigheter og kontakt",
          paragraphs: [
            "For behandling av personopplysninger i skolen kan elever og foresatte normalt rette spørsmål til skolen eller skoleeier. Du kan også kontakte oss om plattformen, sletting eller databehandleravtale.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
      ],
      schoolCallout: {
        title: "For skoler og skoleeiere",
        paragraphs: [
          "Vi kan inngå databehandleravtale ved behov. Ta kontakt dersom skolen eller kommunen ønsker dokumentasjon eller en gjennomgang av behandlingen.",
        ],
        email: "skolegpsdk@gmail.com",
        emailLabel: "Kontakt",
      },
      updatedAt: "Sist oppdatert: 15. mai 2026.",
    },
    privacy: {
      metadata: {
        title: "Personvernerklæring | Postløp",
        description:
          "Postløp er bygget for skoler med innebygd personvern, ingen elevinnlogging og trygg bruk av GPS og kamera.",
      },
      backToHomeLabel: "Tilbake til forsiden",
      heroTitle: "Personvernerklæring og trygg bruk",
      heroEyebrow: "Postløp er bygget for skoler",
      intro:
        "Postløp er laget for undervisning. Derfor er løsningen bygget med innebygd personvern, nøktern bruk av data og så få personopplysninger som mulig.",
      sections: [
        {
          title: "1. Bygget for skoler",
          paragraphs: [
            "Postløp er laget for bruk i skole og undervisning. Løsningen er ikke bygget rundt reklame, profiler eller unødvendig innsamling av elevdata.",
          ],
        },
        {
          title: "2. Ingen elevinnlogging",
          paragraphs: [
            "Elever deltar uten elevkonto. De bruker løpskode og kan eventuelt oppgi et frivillig navn eller lag hvis læreren ønsker det.",
          ],
        },
        {
          title: "3. Trygg bruk av GPS og kamera",
          paragraphs: [
            "GPS brukes bare for å gjennomføre løpet, og kamera brukes bare hvis oppgaven krever bilde. Begge deler brukes når eleven selv aktivt deltar i løpet.",
          ],
        },
        {
          title: "4. Ingen reklamer",
          paragraphs: [
            "Postløp viser ikke annonser og selger ikke data. Opplysningene brukes bare for drift, gjennomføring av løp og nødvendig feilsøking.",
          ],
        },
        {
          title: "5. Lagring, sletting og avtaler",
          paragraphs: [
            "Skoler kan be om databehandleravtale. Opplysninger skal ikke lagres lenger enn nødvendig, og lærer eller arrangør kan slette innhold når det ikke lenger trengs.",
          ],
        },
      ],
      securityCallout: {
        title: "Nøktern teknisk sikkerhet",
        paragraphs: [
          "Vi bruker vanlige sikkerhetstiltak for drift av løsningen og begrenser tilgangen til funksjoner som er relevante for lærer eller arrangør.",
        ],
        bullets: [
          { label: "Tilgangsstyring", text: "bare relevante brukere skal kunne administrere løp" },
          { label: "Kryptert trafikk", text: "trafikken mellom enhet og tjeneste går over sikre forbindelser" },
          { label: "Feillogging", text: "brukes for drift og feilretting, ikke til annonser" },
          { label: "KI", text: "innhold brukes ikke til å trene offentlige KI-modeller" },
        ],
      },
      support: {
        title: "Kontakt og databehandleravtale",
        paragraphs: [
          "Har skolen spørsmål om personvern, drift eller databehandleravtale, kan dere kontakte oss.",
        ],
        email: "skolegpsdk@gmail.com",
        emailLabel: "Kontakt",
      },
    },
    ophavsret: {
      metadata: {
        title: "Opphavsrett og bruk av KI | Postløp",
        description:
          "Klare rammer for opphavsrett, Kopinor og bruk av kunstig intelligens (KI) i Postløp. Innhold brukes ikke til å trene offentlige KI-modeller.",
      },
      backToHomeLabel: "Tilbake til forsiden",
      heroTitle: "Opphavsrett og bruk av KI i Postløp",
      heroEyebrow: "Klare rammer for opphavsrett, KI og undervisningsbruk",
      intro:
        "Når du bruker tekst, bilder eller annet materiale i Postløp, må materialet være lovlig å bruke i undervisningen. Postløp er et verktøy, men kan ikke avklare rettigheter på vegne av læreren eller skolen.",
      principles: [
        {
          eyebrow: "Punkt 1",
          title: "Data brukes ikke til å trene offentlige KI-modeller",
          tone: "emerald",
          paragraphs: [
            "Når materiale behandles for å lage oppgaver eller forslag i Postløp, skjer dette via lukkede tjenester og bare så lenge det er nødvendig for den konkrete forespørselen.",
            "Innhold brukes ikke som treningsdata for offentlige KI-modeller.",
          ],
        },
        {
          eyebrow: "Punkt 2",
          title: "Læreren og skolen må bruke materiale lovlig",
          tone: "sky",
          paragraphs: [
            "Læreren eller skolen er selv ansvarlig for at tekst, bilder og annet materiale kan brukes lovlig i undervisningen.",
            "Det kan for eksempel være egne notater, åpne læremidler, korte lovlige utdrag etter sitatretten eller materiale som er dekket av skolens Kopinor-avtale.",
          ],
        },
      ],
      summary:
        "Hvis du er i tvil om et materiale kan brukes, må dette avklares av læreren eller skolen før innholdet tas inn i Postløp.",
      ctaLabel: "Les den juridiske presiseringen her",
    },
    ophavsretJura: {
      metadata: {
        title: "Juridisk presisering | Postløp",
        description: "Juridisk presisering om opphavsrett, Kopinor, KI og ansvar i Postløp.",
      },
      backToOverviewLabel: "← Opphavsrett",
      backToHomeLabel: "Forsiden",
      eyebrow: "Juridisk presisering",
      title: "Juridisk presisering om opphavsrett, KI og ansvar",
      intro:
        "Her finner du de viktigste juridiske rammene for bruk av Postløps KI-verktøy og innhold i undervisning.",
      cards: [
        {
          eyebrow: "§ 1",
          title: "Lærerens og skolens ansvar",
          tone: "emerald",
          paragraphs: [
            "Læreren eller skolen må selv vurdere om materiale som brukes i Postløp kan brukes lovlig i undervisningen.",
            "Det kan for eksempel være egne notater, åpne læremidler, korte lovlige utdrag etter sitatretten eller bruk som er dekket av skolens Kopinor-avtale.",
          ],
        },
        {
          eyebrow: "§ 2",
          title: "Postløp er et teknisk verktøy",
          tone: "sky",
          paragraphs: [
            "Postløp leverer en teknisk plattform for å bygge og gjennomføre løp. Vi avklarer ikke opphavsrett på vegne av læreren eller skolen.",
            "Plattformen foretar ikke en juridisk vurdering av hvert enkelt materiale som brukeren legger inn.",
          ],
        },
        {
          eyebrow: "§ 3",
          title: "Håndtering ved mulig krenkelse",
          tone: "amber",
          paragraphs: [
            "Hvis vi får troverdig informasjon om at konkret innhold i Postløp krenker tredjeparts rettigheter, kan vi fjerne eller blokkere innholdet mens saken vurderes.",
          ],
        },
        {
          eyebrow: "§ 4",
          title: "Data i KI-tjenester",
          tone: "violet",
          paragraphs: [
            "Når Postløp bruker kunstig intelligens (KI) for å lage spørsmål eller forslag, skjer dette via lukkede API-er og med midlertidig behandling av innhold.",
            "Innholdet brukes ikke til å trene offentlige KI-modeller.",
          ],
        },
      ],
    },
    ophavsretPodcast: {
      metadata: {
        title: "Podcast-detektiven og opphavsrett | Postløp",
        description:
          "Slik bruker Podcast-detektiven offentlig tilgjengelig informasjon, Kopinor og KI på en nøktern måte i undervisningen.",
      },
      backToPodcastLabel: "Tilbake til Podcast-detektiven",
      title: "Podcast-detektiven og opphavsrett ⚖️",
      heroEyebrow: "Trygg bruk i undervisningen",
      intro:
        "Når du bruker Podcast-detektiven til å lage Postløp, skal opphavsretten ivaretas. Verktøyet er laget for å bruke offentlig tilgjengelig informasjon på en forsiktig måte.",
      rulesTitle: "Slik fungerer det i praksis",
      rules: [
        {
          eyebrow: "Regel 1",
          title: "Ingen lagring av lyd",
          tone: "purple",
          paragraphs: [
            "Postløp laster ikke ned, kopierer eller lagrer selve lydfilene på egne servere.",
          ],
        },
        {
          eyebrow: "Regel 2",
          title: "Lytting skjer via originalkilden",
          tone: "sky",
          paragraphs: [
            "Når elever skal lytte til en podkast under løpet, sendes de videre til originalkilden. Skaperne beholder lyttertall og kontroll over publiseringen.",
          ],
        },
        {
          eyebrow: "Regel 3",
          title: "Offentlig tilgjengelig informasjon og lovlige utdrag",
          tone: "emerald",
          paragraphs: [
            "For å lage spørsmål bruker systemet offentlig tilgjengelige tekster som episodetekster, beskrivelser, åpne undertekster og annet materiale som allerede er publisert åpent.",
            "Hvis læreren bruker egne utdrag eller annet materiale, må dette være lovlig å bruke, for eksempel gjennom sitatretten, egne notater, åpne kilder eller skolens Kopinor-avtale.",
          ],
        },
        {
          eyebrow: "Regel 4",
          title: "KI brukes som verktøy, ikke som treningskilde",
          tone: "amber",
          paragraphs: [
            "Innhold som behandles for å lage spørsmål, brukes ikke til å trene offentlige KI-modeller.",
          ],
        },
      ],
      summary:
        "Læreren eller skolen er selv ansvarlig for at podkastmateriale kan brukes lovlig i undervisningen. Postløp avklarer ikke rettigheter på vegne av brukeren.",
    },
  },
};

export function getLegalCopy(siteVariantKey: SiteVariantKey) {
  return legalCopies[siteVariantKey];
}
