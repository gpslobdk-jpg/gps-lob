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
  updatedAt: string;
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
        title: "Databehandling og privatliv | SkoleGPS",
        description:
          "Praktisk information om databehandling, elevoplysninger, billeder og skolebrug i SkoleGPS.dk.",
      },
      backToHomeLabel: "Tilbage til forsiden",
      heroTitle: "Databehandling i SkoleGPS.dk",
      heroEyebrow: "Praktiske hensyn for skoler og lærere",
      intro:
        "SkoleGPS.dk er et værktøj, hvor lærere kan oprette løb og opgaver til undervisning. Siden her er praktisk information - ikke juridisk rådgivning. Skolen skal selv vurdere brugen efter egne retningslinjer.",
      sections: [
        {
          title: "1. Dataansvar og kontakt",
          paragraphs: [
            "Skolen eller kommunen vurderer normalt selv, hvordan et digitalt skoleværktøj må bruges i undervisningen. SkoleGPS.dk kan hjælpe med dokumentation om platformens behandling og underleverandører.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
        {
          title: "2. Dataminimering i praksis",
          paragraphs: [
            "Elever behøver ikke oprette konto eller afgive mailadresse for at deltage i et løb. Brug gerne holdnavne eller korte navne, hvis fulde elevnavne ikke er nødvendige for aktiviteten.",
          ],
        },
        {
          title: "3. Hvilke data kan indgå",
          paragraphs: [
            "Et løb kan indeholde de oplysninger, læreren vælger at bruge i aktiviteten. Det kan blandt andet være løbskode, holdnavn, svar, placering under løbet og eventuelle billeder fra fotoopgaver.",
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
          title: "4. Kamera og billeder",
          paragraphs: [
            "Kameraet bruges kun, hvis en opgave kræver, at eleven aktivt tager et billede. Fotoopgaver må kun vise ting, steder eller andet ikke-personhenførbart indhold. Genkendelige personer og fortrolige oplysninger må ikke fotograferes.",
          ],
        },
        {
          title: "5. Brug af GPS-lokation",
          paragraphs: [
            "Platformen bruger GPS til at afgøre, om eleven er i nærheden af en opgavepost. GPS bruges i forbindelse med selve løbet og skal forstås som en del af undervisningsaktiviteten.",
          ],
        },
        {
          title: "6. Sletning og adgang",
          paragraphs: [
            "Læreren kan slette svar og eventuelle billeder fra resultatsiden, når materialet ikke længere skal bruges. Kontakt os, hvis skolen har brug for hjælp til sletning, indsigt eller dokumentation.",
          ],
        },
        {
          title: "7. Opbevaring",
          bullets: [
            { text: "Løbsdata opbevares, så læreren kan gennemgå resultater og bruge aktiviteten" },
            { text: "Billeder og svar bør slettes, når de ikke længere er relevante for undervisningen" },
            { text: "Skolen kan kontakte os ved spørgsmål om sletning eller adgang" },
          ],
        },
        {
          title: "8. Ingen reklamer, ingen videresalg",
          paragraphs: [
            "Vi sælger aldrig data til tredjepart, og der er ingen reklamer i platformen. SkoleGPS er et lukket undervisningsrum.",
          ],
        },
        {
          title: "9. Underleverandører",
          paragraphs: [
            "SkoleGPS.dk bruger leverandører til drift, hosting, fejlovervågning og frivillige lærerfunktioner. Skoler og kommuner bør vurdere databehandleraftale, underdatabehandlere og eventuelle overførsler som en del af deres egen proces.",
          ],
          bullets: [
            { label: "Supabase", text: "database, login, Storage og backend" },
            { label: "Vercel", text: "webhosting og begrænset webanalyse" },
            { label: "Sentry", text: "redigeret teknisk fejlovervågning" },
            { label: "OpenAI", text: "frivillige lærerrettede AI-funktioner; må ikke modtage elevdata" },
            { label: "Stripe", text: "kun betalingsbehandling, hvis et betalingsflow senere aktiveres" },
          ],
        },
        {
          title: "10. Rettigheder og spørgsmål",
          paragraphs: [
            "Spørgsmål om elevoplysninger bør normalt håndteres gennem skolen eller kommunen. Du kan også kontakte SkoleGPS.dk om platformen, sletning, adgang eller dokumentation.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
        {
          title: "11. Målgruppe - designet til skoler",
          paragraphs: [
            "SkoleGPS.dk er designet til undervisningsbrug i skoler og lignende institutioner. Platformen skal bruges sammen med skolens lokale retningslinjer.",
          ],
        },
        {
          title: "12. Nyheder og opdateringer",
          paragraphs: [
            "Du modtager kun nyheder og opdateringer om SkoleGPS på e-mail, hvis du aktivt har givet samtykke. Du kan til enhver tid trække samtykket tilbage under dine indstillinger eller ved at kontakte os.",
          ],
          email: "skolegpsdk@gmail.com",
          emailLabel: "Kontakt",
        },
      ],
      schoolCallout: {
        title: "Til skoler, kommuner og DPO'er",
        paragraphs: [
          "Vi kan hjælpe med praktisk information om platformen og indgå databehandleraftale, hvis skolen eller kommunen har brug for det.",
          "Brug altid skolens egne procedurer, og kontakt skoleledelse, kommune eller DPO ved tvivl om konkrete aktiviteter.",
        ],
        email: "skolegpsdk@gmail.com",
        emailLabel: "Kontakt",
      },
      updatedAt: "Senest opdateret: 8. august 2026.",
    },
    privacy: {
      metadata: {
        title: "Privatlivspolitik | SkoleGPS",
        description:
          "Privatlivspolitik for lærer- og kontaktdata samt forklaring af SkoleGPS' rolle som databehandler for elevdata.",
      },
      backToHomeLabel: "Tilbage til forsiden",
      heroTitle: "Privatlivspolitik",
      heroEyebrow: "Hvem behandler hvad – og hvorfor?",
      intro:
        "Denne politik gælder SkoleGPS' egen behandling af lærer-, kontakt- og driftsoplysninger. Når en skole bruger SkoleGPS til elever, er skolen eller kommunen dataansvarlig, mens SkoleGPS behandler elevdata efter skolens dokumenterede instruks.",
      sections: [
        {
          title: "1. Dataansvarlig og kontakt",
          paragraphs: [
            "SkoleGPS.dk drives af Jeppe Laursen som privatperson uden CVR-nummer. Adresse: Sandbergvej 29, 4760 Vordingborg. E-mail: skolegpsdk@gmail.com. Telefon: +45 40 87 45 38.",
            "Jeppe Laursen er dataansvarlig for oplysninger om lærerkonti, skole- og kundekontakt, support, sikkerhedsdrift og frivilligt produktnyt. Kommunen eller skoleejeren er dataansvarlig for elevdata i undervisningsløb.",
          ],
        },
        {
          title: "2. Lærer-, kunde- og kontaktoplysninger",
          paragraphs: [
            "Vi kan behandle navn, e-mailadresse, autentifikations-id, valgt loginudbyder, kontostatus, oprettede undervisningsløb, supportkorrespondance, skole-/kommunetilknytning og tekniske sikkerhedsoplysninger.",
            "Når den forberedte DagensTavle-integration senere aktiveres, kan læreren vælge en sikker login-overdragelse. Kun nødvendige læreridentitetsoplysninger behandles kortvarigt server-side. DagensTavle får ikke SkoleGPS-løb, klasser, elevsvar, elevfotos, GPS-data eller adgang til Gmail, Google Drive, kalender, Microsoft-filer eller postkasser.",
            "Hvis betaling senere aktiveres, kan kunde-, abonnements- og betalingsreferencer behandles. Kortoplysninger håndteres af betalingsleverandøren og skal ikke indtastes i SkoleGPS' almindelige felter.",
          ],
        },
        {
          title: "3. Formål og behandlingsgrundlag",
          bullets: [
            { label: "Konto og tjeneste", text: "at oprette login, levere funktionerne og besvare support. Grundlaget er aftalen eller skridt før aftale, jf. GDPR artikel 6, stk. 1, litra b." },
            { label: "Sikkerhed og drift", text: "at forebygge misbrug, fejlfinde og beskytte tjenesten. Grundlaget er legitim interesse, jf. artikel 6, stk. 1, litra f." },
            { label: "Lovkrav", text: "at opfylde eventuelle regnskabs-, myndigheds- eller retskrav, jf. artikel 6, stk. 1, litra c." },
            { label: "Produktnyt", text: "at sende frivillige nyheder, når du har samtykket. Samtykket kan altid trækkes tilbage, jf. artikel 6, stk. 1, litra a." },
          ],
        },
        {
          title: "4. Elevdata: SkoleGPS som databehandler",
          paragraphs: [
            "Elever behøver ikke en individuel konto eller e-mailadresse. Et løb kan behandle holdnavn eller kort fornavn, sessions- og deltager-id, aktuel GPS-position, svar, point, tidsstempler og et foto ved en fotoopgave.",
            "Elevdata bruges til at afvikle undervisningsløbet og vise resultater til den ansvarlige lærer. Henvendelser om indsigt, rettelse eller sletning af elevdata skal som udgangspunkt sendes til skolen eller kommunen, som kan instruere SkoleGPS.",
          ],
        },
        {
          title: "5. GPS, billeder og AI",
          paragraphs: [
            "Den aktuelle GPS-position sendes under et aktivt løb og overskrives løbende. Afstanden beregnes i elevens browser. Positionen skjules for alle efter 15 minutters inaktivitet og nulstilles fysisk ved næste femminutters oprydning, normalt senest efter cirka 20 minutter. Afslutning og forladelse nulstiller straks, hvor det er muligt. Standardflowet opbygger ikke en særskilt rutehistorik.",
            "Fotoopgaver må kun bruges til ting, steder og andre ikke-personhenførbare motiver. Genkendelige personer, fortrolige oplysninger og særlige kategorier må ikke fotograferes eller uploades.",
            "Lærerrettede AI-funktioner er frivillige og må ikke få elevdata, elevfotos, lokation, særlige kategorier eller fortroligt materiale. Der er ikke en teknisk garanti, som kan genkende alt personindhold; læreren skal derfor kontrollere materialet før afsendelse.",
          ],
        },
        {
          title: "6. Modtagere og underleverandører",
          paragraphs: [
            "SkoleGPS bruger leverandører til database, autentifikation og Storage (Supabase), hosting og webanalyse (Vercel) samt fejlmonitorering (Sentry). Lærerens frivillige funktioner kan desuden bruge OpenAI og eksterne kort- eller indholdstjenester. Betaling via Stripe er kun relevant, hvis et betalingsflow aktiveres.",
            "Bugsnag findes som betinget integration i kodebasen, men er ikke godkendt som aktiv leverandør for kommunens personoplysninger i standardaftale version 1.0. Vi sælger ikke personoplysninger og viser ikke reklamer i platformen.",
          ],
        },
        {
          title: "7. Overførsler uden for EØS",
          paragraphs: [
            "Nogle leverandører eller deres underleverandører kan behandle oplysninger uden for EØS. Overførsler skal være dækket af en tilstrækkelighedsafgørelse, EU-Kommissionens standardkontraktbestemmelser med nødvendige supplerende foranstaltninger eller et andet gyldigt grundlag efter GDPR kapitel V.",
          ],
        },
        {
          title: "8. Opbevaring og sletning",
          paragraphs: [
            "Lærerkonto og lærerskabte løb opbevares, mens kontoen eller aftalen er aktiv, og slettes efter en verificeret anmodning eller ved ophør, bortset fra oplysninger som skal opbevares efter loven eller i lukkede backups indtil deres normale udløb.",
            "Læreren kan rydde fotos, svar, deltagere og sessionsdata tidligere fra resultatsiden. Den forberedte retentionmodel sletter fotos efter 30 dage, almindelige elevsvar, deltagere og afsluttede sessioner efter 90 dage regnet fra afslutning eller dokumenteret inaktivitet samt tekniske oprydningslogs uden elevoplysninger efter 30 dage. Hosted cron er ikke oplyst som aktiv, før den er deployet og verificeret; indtil da skal læreren følge den manuelle sletteprocedure.",
            "Supporthenvendelser og sikkerhedsoplysninger opbevares kun så længe, de er nødvendige for formålet, en tvist eller et lovkrav. Et eventuelt nyhedssamtykke opbevares, indtil det trækkes tilbage, samt i den periode dokumentation er nødvendig.",
          ],
        },
        {
          title: "9. Cookies og analyse",
          paragraphs: [
            "Nødvendige teknologier bruges til login, session og sikkerhed. Vercel Analytics bruges til begrænset teknisk besøgsanalyse; delingssiden til afvikling og fotoudleveringsflowet er fravalgt. Tredjeparts login via Google eller Microsoft vælges af læreren og er også omfattet af den valgte udbyders egne vilkår.",
            "SkoleGPS og DagensTavle bruger separate host-only sessions. Den forberedte login-overdragelse bruger en 90 sekunders, hash-baseret engangsrequest, state/nonce og server-til-server-kontrol; adgangstokens, refresh tokens, e-mail og elevdata sendes ikke i browserens overdragelsesadresse. Første brug kan kræve accept af DagensTavles egne vilkår.",
          ],
        },
        {
          title: "10. Dine rettigheder",
          paragraphs: [
            "Når SkoleGPS er dataansvarlig, kan du efter reglerne anmode om indsigt, rettelse, sletning, begrænsning, dataportabilitet eller gøre indsigelse. Du kan trække et samtykke tilbage uden at påvirke tidligere lovlig behandling. Rettighederne afhænger af den konkrete behandling og kan være begrænset ved lov.",
            "Du kan klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby, www.datatilsynet.dk. Der anvendes ikke automatiske afgørelser med retsvirkning eller tilsvarende væsentlig virkning.",
          ],
        },
      ],
      securityCallout: {
        title: "Sikkerhed i praksis",
        paragraphs: [
          "SkoleGPS bruger HTTPS/TLS, autentifikation, ejerskabskontrol, row-level security og serverbeskyttede nøgler. Elevfotos ligger i privat Storage og leveres kun til løbets ejer gennem en beskyttet, ikke-cachebar SkoleGPS-route; Storage-sti og midlertidige Storage-adresser udleveres ikke til browseren. Uploads dekodes og genkodes som JPEG, så EXIF- og GPS-metadata fjernes. Fejlmonitoreringen redigerer blandt andet navne, e-mail, koder, tokens, svar, fotostier, URL'er og lokation.",
        ],
        bullets: [
          { label: "Brud", text: "berørte dataansvarlige orienteres uden unødig forsinkelse og om muligt inden 24 timer efter, at SkoleGPS bliver bekendt med bruddet" },
          { label: "Ingen absolut garanti", text: "ingen internetbaseret tjeneste kan love fuldstændig sikkerhed; adgang og funktioner begrænses efter behov" },
        ],
      },
      support: {
        title: "Kontakt, klage og dokumentation",
        paragraphs: [
          "Skriv til os om privatliv, sikkerhed, rettigheder eller dokumentation. Ved elevdata bør du samtidig kontakte skolen eller kommunen, som er dataansvarlig.",
        ],
        email: "skolegpsdk@gmail.com",
        emailLabel: "Skriv til",
      },
      updatedAt: "Senest opdateret: 8. august 2026.",
    },
    ophavsret: {
      metadata: {
        title: "Ophavsret og Tekst & Node | SkoleGPS",
        description:
          "Praktisk information om ophavsret, Tekst & Node og ansvarlig brug af materialer i SkoleGPS.dk.",
      },
      backToHomeLabel: "Tilbage til forsiden",
      heroTitle: "Ophavsret og Tekst & Node",
      heroEyebrow: "Praktiske rammer for tekster, noder og AI",
      intro:
        "Når lærere bruger tekst, billeder, noder eller andet materiale i SkoleGPS.dk, skal materialet være lovligt at bruge i undervisningen. SkoleGPS.dk er et værktøj; skolen og læreren har ansvar for indholdet.",
      principles: [
        {
          eyebrow: "Punkt 1",
          title: "Materialer skal kunne bruges i undervisningen",
          tone: "emerald",
          paragraphs: [
            "Brug egne noter, egne opgaver, åbne materialer eller materiale, som skolen i øvrigt har ret til at bruge.",
            "Hvis der uploades tekst, billeder eller noder fra andre, bør læreren følge skolens lokale retningslinjer og relevante aftaler.",
          ],
        },
        {
          eyebrow: "Punkt 2",
          title: "Tekst & Node og skolens aftaler",
          tone: "sky",
          paragraphs: [
            "Mange skoler har aftaler gennem Tekst & Node, som kan give rammer for kopiering af tekster og noder til undervisning.",
            "SkoleGPS.dk vurderer ikke automatisk, om et bestemt materiale er dækket. Ved tvivl bør læreren spørge skolen, kommunen eller den ansvarlige for skolens aftaler.",
          ],
        },
        {
          eyebrow: "Punkt 3",
          title: "AI og uploadet tekst",
          tone: "amber",
          paragraphs: [
            "Når en AI-funktion bruges til at hjælpe med opgaver, behandles materialet via lukkede API-forbindelser.",
            "Uploadet materiale bruges ikke til at træne offentlige AI-modeller, men skolen bør stadig kun bruge materiale, den har ret til at behandle.",
          ],
        },
      ],
      summary:
        "Siden er praktisk information og ikke juridisk rådgivning. Ved tvivl bør skolen bruge egne retningslinjer eller kontakte den ansvarlige for ophavsret og aftaler.",
      ctaLabel: "Læs den juridiske uddybning",
    },
    ophavsretJura: {
      metadata: {
        title: "Juridisk præcisering | SkoleGPS",
        description:
          "Praktisk præcisering om ansvar, ophavsret og AI-behandling i SkoleGPS.dk.",
      },
      backToOverviewLabel: "Tilbage til ophavsret",
      backToHomeLabel: "Forsiden",
      eyebrow: "Præcisering",
      title: "Juridisk præcisering om ansvar og ophavsret",
      intro:
        "Denne side er praktisk information om brug af materialer i SkoleGPS.dk. Den er ikke juridisk rådgivning, og skolen skal selv vurdere konkrete materialer og aktiviteter.",
      cards: [
        {
          eyebrow: "1",
          title: "Skolens og lærerens ansvar",
          tone: "emerald",
          paragraphs: [
            "Når en lærer uploader eller bruger tekst, billeder, noder, lyd eller andet materiale, skal skolen og læreren sikre, at materialet må bruges i undervisningen.",
            "Det kan for eksempel være egne materialer, åbne materialer eller materiale, der er dækket af skolens aftaler, herunder relevante aftaler med Tekst & Node.",
          ],
        },
        {
          eyebrow: "2",
          title: "SkoleGPS.dk er et teknisk værktøj",
          tone: "sky",
          paragraphs: [
            "SkoleGPS.dk leverer en teknisk platform til at oprette og afvikle undervisningsaktiviteter. Platformen foretager ikke en juridisk vurdering af rettighederne til hvert enkelt materiale.",
            "Læreren bør derfor kun bruge materiale, som skolen vurderer kan indgå i aktiviteten.",
          ],
        },
        {
          eyebrow: "3",
          title: "Procedure ved mulig krænkelse",
          tone: "amber",
          paragraphs: [
            "Hvis SkoleGPS.dk får troværdig information om, at konkret indhold krænker tredjeparts rettigheder, kan vi fjerne eller blokere adgangen til materialet.",
          ],
        },
        {
          eyebrow: "4",
          title: "Databehandling og AI",
          tone: "violet",
          paragraphs: [
            "AI-funktioner kan behandle uploadet materiale via lukkede API-forbindelser til underleverandører for at hjælpe med at generere undervisningsindhold.",
            "Materialet bruges ikke til at træne offentlige AI-modeller. Databehandleraftaler, underdatabehandlere og eventuelle overførsler bør vurderes som en del af skolens egen proces.",
          ],
        },
      ],
    },
    ophavsretPodcast: {
      metadata: {
        title: "Podcast-Detektiven & Ophavsret | SkoleGPS",
        description:
          "Praktisk information om ophavsret, podcastmateriale og undervisningsbrug i SkoleGPS.dk.",
      },
      backToPodcastLabel: "Tilbage til Podcast-Detektiven",
      title: "Podcast-Detektiven og ophavsret",
      heroEyebrow: "Praktiske hensyn i undervisningen",
      intro:
        "Når en podcast bruges i undervisningen, skal skolen og læreren vurdere, at materialet må indgå i aktiviteten. Siden her er praktisk information og ikke juridisk rådgivning.",
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
            "Når elever skal lytte til udsendelsen under løbet, bør de bruge originalkilden. Det hjælper med at respektere podcastens normale udgivelseskanal.",
          ],
        },
        {
          eyebrow: "Regel 3",
          title: "Læsning af offentlig data",
          tone: "emerald",
          paragraphs: [
            "AI-funktioner kan bruge offentligt tilgængelige tekster som show notes, resuméer og åbne undertekster til at foreslå spørgsmål.",
          ],
        },
      ],
      summary:
        "Læreren eller skolen er selv ansvarlig for at vurdere, om podcastmateriale må bruges i den konkrete undervisningsaktivitet.",
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
      updatedAt: "Sist oppdatert: 15. mai 2026.",
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
