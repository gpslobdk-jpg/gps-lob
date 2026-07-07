import type { SiteVariantKey } from "@/lib/siteVariant";

export type QrScannerCopy = {
  buttonLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  startingCamera: string;
  ready: string;
  failed: string;
  scanFailed: string;
  closeAriaLabel: string;
  errors: {
    permissionDenied: string;
    noCamera: string;
    busy: string;
    generic: string;
    unsupported: string;
  };
};

type SiteCopy = {
  localeTag: string;
  metadata: {
    homeTitle: string;
    homeDescription: string;
    joinTitle: string;
    joinDescription: string;
    loginTitle: string;
    loginDescription: string;
    manifestName: string;
    manifestDescription: string;
  };
  home: {
    brandLabel: string;
    logoAlt: string;
    legalLinks: {
      gdpr: string;
      privacy: string;
    };
    showTestimonials: boolean;
    showDanishOnlyExtras: boolean;
    mobile: {
      title: string;
      studentEyebrow: string;
      studentDescription: string;
      joinCodeButton: string;
      teacherEyebrow: string;
      teacherDescription: string;
      loginButton: string;
    };
    desktop: {
      organizerEyebrow: string;
      organizerTitle: string;
      organizerDescription: string;
      loginButton: string;
    };
  };
  login: {
    preparingTitle: string;
    preparingDescription: string;
    redirectTitle: string;
    redirectDescription: string;
    logoAlt: string;
    welcomeTitle: string;
    subtitle: string;
    organizerEyebrow: string;
    organizerDescription: string;
    googleButton: string;
    microsoftButton: string;
    emailDivider: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    passwordHint: string;
    signupConsentEyebrow: string;
    marketingConsentText: string;
    marketingConsentStorageText: string;
    submitButton: string;
    submitPending: string;
    backToHome: string;
    errors: {
      missingCredentials: string;
      invalidCredentials: string;
      invalidEmail: string;
      passwordRequirements: string;
      genericEmailAuth: string;
    };
  };
  join: {
    defaultExpiredMessage: string;
    fillPinAndName: string;
    pinLength: (length: number) => string;
    rateLimit: string;
    invalidPin: string;
    finishedOrMissing: string;
    timeout: string;
    networkError: string;
    genericJoinError: string;
    teamBadge: (teamName: string) => string;
    connectionCheck: {
      offlineTitle: string;
      offlineDetail: string;
      okTitle: string;
      okDetailIos: string;
      okDetailDefault: string;
      serverErrorTitle: string;
      serverErrorDetail: (status: number) => string;
    };
    scheduled: {
      eyebrow: string;
      statusLabel: string;
      title: string;
      description: (dateLabel: string | null, timeLabel: string | null) => string;
      startWindowLabel: string;
      endWindowLabel: string;
      unknownDate: string;
      unknownTime: string;
      endFallback: string;
    };
    waiting: {
      eyebrow: string;
      statusLabel: string;
      title: string;
      description: string;
    };
    scheduleError: {
      eyebrow: string;
      title: string;
      description: string;
      retryButton: string;
    };
    expired: {
      eyebrow: string;
      title: string;
      retryButton: string;
    };
    missingSession: {
      eyebrow: string;
      title: string;
      description: string;
      homeButton: string;
    };
    form: {
      title: string;
      description: string;
      dismissWarningLabel: string;
      iosHintTitle: string;
      iosHintDescription: string;
      inAppWarningIosStrong: string;
      inAppWarningIosBody: string;
      inAppWarningAndroidStrong: string;
      inAppWarningAndroidBody: string;
      codePlaceholder: string;
      namePlaceholder: string;
      submitButton: string;
      submitPending: string;
      checkConnectionButton: string;
      checkConnectionPending: string;
      troubleshootingTitle: string;
      troubleshootingToggle: string;
      troubleshootingParagraphs: [string, string, string];
      homeButton: string;
      homescreenTitle: string;
      homescreenBody: string;
      homescreenIos: string;
      homescreenAndroid: string;
    };
  };
  qrScanner: QrScannerCopy;
  wifiTip: string;
};

const siteCopies: Record<SiteVariantKey, SiteCopy> = {
  gpslob: {
    localeTag: "da-DK",
    metadata: {
      homeTitle: "SkoleGPS – aktive GPS-løb til undervisning",
      homeDescription:
        "SkoleGPS hjælper lærere med at lave aktive GPS-løb, quizzer og læringsaktiviteter, hvor eleverne bevæger sig og deltager via mobilen.",
      joinTitle: "Deltag i løbet | GPS Løb",
      joinDescription: "Indtast pinkode eller scan QR-koden for at deltage i løbet.",
      loginTitle: "Login | SkoleGPS",
      loginDescription:
        "Log ind på SkoleGPS.dk for at oprette løb, følge klassen live og hente resultater.",
      manifestName: "GPS Løb",
      manifestDescription: "Interaktive GPS-missioner",
    },
    home: {
      brandLabel: "SkoleGPS",
      logoAlt: "SkoleGPS logo",
      legalLinks: {
        gdpr: "Privat fra start",
        privacy: "Sikker databehandling",
      },
      showTestimonials: true,
      showDanishOnlyExtras: true,
      mobile: {
        title: "Hvem er du?",
        studentEyebrow: "Jeg er elev",
        studentDescription: "Scan QR-koden eller indtast løbskoden for at deltage.",
        joinCodeButton: "Indtast løbskode",
        teacherEyebrow: "Jeg er lærer",
        teacherDescription: "Brug helst SkoleGPS fra en computer, når du opretter og styrer løb.",
        loginButton: "Log ind",
      },
      desktop: {
        organizerEyebrow: "Til lærere og skoler",
        organizerTitle: "Lav aktive GPS-løb på få minutter",
        organizerDescription: "Opret løb, del med eleverne og følg resultaterne.",
        loginButton: "Log ind",
      },
    },
    login: {
      preparingTitle: "Gør login klar",
      preparingDescription: "Vi læser din session, så du ikke bliver sendt rundt unødigt.",
      redirectTitle: "Logger dig ind",
      redirectDescription:
        "Vi læser din session og sender dig videre til dashboardet uden auth-flicker.",
      logoAlt: "SkoleGPS logo",
      welcomeTitle: "Velkommen til SkoleGPS.dk",
      subtitle: "",
      organizerEyebrow: "Log ind for arrangører",
      organizerDescription:
        "Brug en af disse login-metoder for at åbne dashboardet og styre dine løb.",
      googleButton: "Log ind med Google",
      microsoftButton: "Log ind med Microsoft",
      emailDivider: "eller log ind med e-mail",
      emailLabel: "Email",
      emailPlaceholder: "Email",
      passwordLabel: "Adgangskode",
      passwordPlaceholder: "Adgangskode",
      passwordHint: "Mindst 6 tegn.",
      signupConsentEyebrow: "Kun ved oprettelse af ny konto",
      marketingConsentText:
        "Ja tak, jeg vil gerne modtage nyheder og opdateringer om SkoleGPS på mail. Jeg kan altid afmelde mig igen.",
      marketingConsentStorageText:
        "v1: Ja tak, jeg vil gerne modtage nyheder og opdateringer om GPS Løb på mail. Jeg kan altid afmelde mig igen.",
      submitButton: "Log ind / Opret",
      submitPending: "Logger ind...",
      backToHome: "Tilbage til forsiden",
      errors: {
        missingCredentials: "Skriv både e-mail og adgangskode.",
        invalidCredentials: "Forkert adgangskode eller e-mail.",
        invalidEmail: "Skriv en gyldig e-mailadresse.",
        passwordRequirements: "Adgangskoden skal opfylde kravene for at kunne bruges.",
        genericEmailAuth: "Vi kunne ikke logge dig ind lige nu. Prøv igen.",
      },
    },
    join: {
      defaultExpiredMessage: "Dette løb er desværre slut. Kontakt din arrangør.",
      fillPinAndName: "Udfyld venligst både pinkode og navn.",
      pinLength: (length) => `Pinkoden skal bestå af ${length} tal.`,
      rateLimit:
        "Der er lige nu kø i skolegården. Vent 5-10 sekunder og prøv at trykke 'Deltag i løbet' igen.",
      invalidPin: "Ugyldig pinkode.",
      finishedOrMissing:
        "Løbet er afsluttet eller findes ikke længere. Få en ny pinkode fra din lærer.",
      timeout:
        "Forbindelsen tager for lang tid. Hvis du er på skolens Wi-Fi, så prøv mobildata. På iPhone: åbn helst linket i Safari.",
      networkError:
        "Forbindelsen driller. Prøv igen. Hvis du er på skolens Wi-Fi, så prøv mobildata. På iPhone: åbn helst linket i Safari.",
      genericJoinError:
        "Der skete en fejl ved deltagelse. Prøv igen. Hvis du er på skolens Wi-Fi, så prøv mobildata. På iPhone: åbn helst linket i Safari. Kontakt din lærer, hvis problemet fortsætter.",
      teamBadge: (teamName) => `Du er på ${teamName} hold!`,
      connectionCheck: {
        offlineTitle: "Forbindelsen driller",
        offlineDetail: "Prøv mobildata / Safari.",
        okTitle: "Appen svarer",
        okDetailIos:
          "Forbindelsen ser okay ud. Hvis det stadig driller, så prøv mobildata eller åbn linket i Safari.",
        okDetailDefault: "Forbindelsen ser okay ud. Hvis det stadig driller, så prøv mobildata.",
        serverErrorTitle: "Serveren returnerede en fejl",
        serverErrorDetail: (status) =>
          `Appen svarer, men serveren returnerede en fejl (HTTP ${status}). Prøv igen, eller prøv mobildata.`,
      },
      scheduled: {
        eyebrow: "Mission Briefing",
        statusLabel: "Planlagt Mission",
        title: "Missionen er låst og klar",
        description: (dateLabel, timeLabel) =>
          `Missionen starter automatisk d. ${dateLabel ?? "ukendt dato"} kl. ${timeLabel ?? "ukendt tid"}. Hold agentudstyret klar.`,
        startWindowLabel: "Startvindue",
        endWindowLabel: "Mission slutter",
        unknownDate: "Tid ikke sat",
        unknownTime: "--:--",
        endFallback: "Når arrangøren lukker",
      },
      waiting: {
        eyebrow: "Klar til start",
        statusLabel: "Løbet er ikke startet endnu",
        title: "Du er klar",
        description: "Vent på, at din lærer starter løbet.",
      },
      scheduleError: {
        eyebrow: "Tidsplan utilgængelig",
        title: "Kunne ikke læse tidsplanen",
        description: "Kunne ikke læse tidsplanen. Kontakt arrangøren.",
        retryButton: "Prøv en anden kode",
      },
      expired: {
        eyebrow: "Løbet er lukket",
        title: "Dette løb er desværre slut",
        retryButton: "Prøv en anden kode",
      },
      missingSession: {
        eyebrow: "Løb ikke fundet",
        title: "Hov! Vi kan ikke finde dette løb 🏁",
        description:
          "Det ser ud til, at linket er blevet for gammelt, eller at din lærer har afsluttet løbet. Tjek med din lærer, om du har fået det rigtige link eller den rigtige PIN-kode.",
        homeButton: "Gå til forsiden",
      },
      form: {
        title: "Deltag i løbet",
        description: "Indtast løbskoden eller scan QR-koden. Skriv derefter dit navn.",
        dismissWarningLabel: "Luk advarsel",
        iosHintTitle: "Bruger du iPhone?",
        iosHintDescription: "Åbn helst linket i Safari. Hvis skolens Wi-Fi driller, så prøv mobildata.",
        inAppWarningIosStrong: "Åbn linket i Safari",
        inAppWarningIosBody:
          "for bedst chance for at GPS og login virker. Hvis skolens Wi-Fi driller, så prøv mobildata.",
        inAppWarningAndroidStrong: "Åbn linket i den rigtige browser",
        inAppWarningAndroidBody:
          "i Chrome på Android for bedst chance for at GPS og login virker.",
        codePlaceholder: "Løbskode, f.eks. 492173",
        namePlaceholder: "Dit navn",
        submitButton: "Deltag i løbet",
        submitPending: "Gør klar...",
        checkConnectionButton: "Tjek forbindelse",
        checkConnectionPending: "Tjekker...",
        troubleshootingTitle: "Problemer med at deltage?",
        troubleshootingToggle: "Vis hjælp",
        troubleshootingParagraphs: [
          "Hvis koden er forkert eller for gammel, skal din lærer give dig en ny kode eller et nyt link.",
          "Hvis kameraet ikke starter, kan du stadig taste koden manuelt i feltet ovenfor.",
          "På iPhone virker GPS og login bedst i Safari. Undgå helst at åbne linket direkte i Facebook, Instagram eller andre indbyggede browsere.",
        ],
        homeButton: "Tilbage til forsiden",
        homescreenTitle: "Tip: Brug som app",
        homescreenBody:
          "Tilføj GPS-løbet til hjemmeskærmen. Så fylder spillet mere på skærmen og fungerer ofte bedre.",
        homescreenIos: "iPhone: Del → Føj til hjemmeskærm",
        homescreenAndroid: "Android: Menu ⋮ → Føj til startskærm",
      },
    },
    qrScanner: {
      buttonLabel: "Scan QR",
      eyebrow: "Scan dig ind",
      title: "Ret kameraet mod QR-koden",
      description:
        "Tillad kameraadgang, og hold QR-koden foran kameraet. Vi sender dig direkte videre til løbet, så snart koden er læst.",
      startingCamera: "Starter kamera...",
      ready: "QR-scanneren er klar.",
      failed: "Kameraet kunne ikke startes.",
      scanFailed: "QR-koden kunne ikke forstås. Prøv en anden kode.",
      closeAriaLabel: "Luk QR-scanner",
      errors: {
        permissionDenied:
          "Kamera-adgang naegtet. For at bruge scanneren skal du tillade kamera i din browsers indstillinger (ofte oppe i adressebaren). Ellers kan du lukke denne boks og taste pinkoden manuelt.",
        noCamera:
          "Vi kunne ikke finde et kamera paa denne enhed. Du kan lukke denne boks og taste pinkoden manuelt.",
        busy:
          "Kameraet er allerede i brug af en anden app eller browser-fane. Luk denne boks og proev igen, eller tast pinkoden manuelt.",
        generic:
          "Kameraet kunne ikke startes lige nu. Du kan proeve igen eller lukke denne boks og taste pinkoden manuelt.",
        unsupported:
          "Din browser understotter ikke kameraadgang til QR-scanning. Du kan lukke denne boks og taste pinkoden manuelt.",
      },
    },
    wifiTip: "💡 Tip: Sluk for Wi-Fi og brug mobildata! Så mister du ikke forbindelsen ude på ruten.",
  },
  postlob: {
    localeTag: "nb-NO",
    metadata: {
      homeTitle: "Postløp - Løp for hele klassen",
      homeDescription: "Lag, del og følg løpet live.",
      joinTitle: "Bli med i løpet | Postløp",
      joinDescription: "Skriv inn pinkode eller skann QR-koden for å bli med i løpet.",
      loginTitle: "Logg inn | Postløp",
      loginDescription: "Logg inn på Postløp for å lage og styre GPS-løp for klassen.",
      manifestName: "Postløp",
      manifestDescription: "Interaktive skoleløp med poster",
    },
    home: {
      brandLabel: "Postløp",
      logoAlt: "Postløp logo",
      legalLinks: {
        gdpr: "Personvern & databehandling",
        privacy: "Personvernerklæring",
      },
      showTestimonials: false,
      showDanishOnlyExtras: false,
      mobile: {
        title: "Hvem er du?",
        studentEyebrow: "Jeg er elev",
        studentDescription: "Skann QR-koden eller skriv inn løpskoden for å delta.",
        joinCodeButton: "Skriv inn løpskode",
        teacherEyebrow: "Jeg er lærer",
        teacherDescription: "Bruk helst Postløp på en datamaskin når du lager og styrer løp.",
        loginButton: "Logg inn",
      },
      desktop: {
        organizerEyebrow: "For lærere og arrangører",
        organizerTitle: "Lag aktive læringsløp på få minutter",
        organizerDescription:
          "Logg inn for å lage løp, hente resultater og følge deltakerne live. Elever og deltakere blir med via mobil, nettbrett eller nettleser.",
        loginButton: "Logg inn",
      },
    },
    login: {
      preparingTitle: "Gjør innlogging klar",
      preparingDescription: "Vi leser økten din, slik at du ikke sendes rundt unødvendig.",
      redirectTitle: "Logger deg inn",
      redirectDescription: "Vi leser økten din og sender deg videre til dashbordet.",
      logoAlt: "Postløp logo",
      welcomeTitle: "Velkommen til Postløp",
      subtitle: "Logg inn for å lage og styre GPS-løp for klassen.",
      organizerEyebrow: "Logg inn for arrangører",
      organizerDescription:
        "Bruk en av disse innloggingsmetodene for å åpne dashbordet og styre løpene dine.",
      googleButton: "Logg inn med Google",
      microsoftButton: "Logg inn med Microsoft",
      emailDivider: "eller logg inn med e-post",
      emailLabel: "E-post",
      emailPlaceholder: "E-post",
      passwordLabel: "Passord",
      passwordPlaceholder: "Passord",
      passwordHint: "Minst 6 tegn.",
      signupConsentEyebrow: "Kun ved opprettelse av ny konto",
      marketingConsentText:
        "Jeg samtykker til at Postløp kan sende meg praktisk informasjon om kontoen min og tjenesten.",
      marketingConsentStorageText:
        "v1: Jeg samtykker til at Postløp kan sende meg praktisk informasjon om kontoen min og tjenesten.",
      submitButton: "Logg inn / Opprett",
      submitPending: "Logger inn...",
      backToHome: "Tilbake til forsiden",
      errors: {
        missingCredentials: "Skriv både e-post og passord.",
        invalidCredentials: "Feil passord eller e-post.",
        invalidEmail: "Skriv inn en gyldig e-postadresse.",
        passwordRequirements: "Passordet må oppfylle kravene for å kunne brukes.",
        genericEmailAuth: "Vi kunne ikke logge deg inn akkurat nå. Prøv igjen.",
      },
    },
    join: {
      defaultExpiredMessage: "Dette løpet er dessverre slutt. Kontakt læreren.",
      fillPinAndName: "Fyll inn både pinkode og navn.",
      pinLength: (length) => `Pinkoden må være ${length} tall.`,
      rateLimit: "Det er litt kø akkurat nå. Vent 5-10 sekunder og prøv igjen.",
      invalidPin: "Ugyldig pinkode.",
      finishedOrMissing: "Løpet er avsluttet eller finnes ikke lenger. Få en ny pinkode fra læreren.",
      timeout:
        "Tilkoblingen bruker for lang tid. Hvis skolens Wi-Fi er ustabil, prøv mobildata. På iPhone bør du åpne lenken i Safari.",
      networkError:
        "Tilkoblingen er ustabil. Prøv igjen. Hvis skolens Wi-Fi er ustabil, prøv mobildata. På iPhone bør du åpne lenken i Safari.",
      genericJoinError:
        "Det oppstod en feil da du skulle bli med. Prøv igjen. Hvis skolens Wi-Fi er ustabil, prøv mobildata. På iPhone bør du åpne lenken i Safari. Kontakt læreren hvis problemet fortsetter.",
      teamBadge: (teamName) => `Du er på lag ${teamName}!`,
      connectionCheck: {
        offlineTitle: "Tilkoblingen er ustabil",
        offlineDetail: "Prøv mobildata / Safari.",
        okTitle: "Appen svarer",
        okDetailIos:
          "Tilkoblingen ser grei ut. Hvis det fortsatt lugger, prøv mobildata eller åpne lenken i Safari.",
        okDetailDefault: "Tilkoblingen ser grei ut. Hvis det fortsatt lugger, prøv mobildata.",
        serverErrorTitle: "Serveren svarte med en feil",
        serverErrorDetail: (status) =>
          `Appen svarer, men serveren svarte med en feil (HTTP ${status}). Prøv igjen, eller prøv mobildata.`,
      },
      scheduled: {
        eyebrow: "Oppdrag",
        statusLabel: "Planlagt oppdrag",
        title: "Oppdraget er klart",
        description: (dateLabel, timeLabel) =>
          `Oppdraget starter automatisk ${dateLabel ?? "på ukjent dato"} kl. ${timeLabel ?? "ukjent tid"}. Hold utstyret klart.`,
        startWindowLabel: "Starter",
        endWindowLabel: "Løpet slutter",
        unknownDate: "Tid ikke satt",
        unknownTime: "--:--",
        endFallback: "Når læreren avslutter",
      },
      waiting: {
        eyebrow: "Klar til start",
        statusLabel: "Løpet er ikke startet ennå",
        title: "Du er klar",
        description: "Vent til læreren starter løpet.",
      },
      scheduleError: {
        eyebrow: "Tidsplan utilgjengelig",
        title: "Kunne ikke lese tidsplanen",
        description: "Kunne ikke lese tidsplanen. Kontakt læreren.",
        retryButton: "Prøv en annen kode",
      },
      expired: {
        eyebrow: "Løpet er lukket",
        title: "Dette løpet er dessverre slutt",
        retryButton: "Prøv en annen kode",
      },
      missingSession: {
        eyebrow: "Løpet ble ikke funnet",
        title: "Oi! Vi finner ikke dette løpet 🏁",
        description:
          "Det ser ut til at lenken er for gammel, eller at læreren har avsluttet løpet. Sjekk med læreren om du har fått riktig lenke eller riktig PIN-kode.",
        homeButton: "Gå til forsiden",
      },
      form: {
        title: "Bli med i løpet",
        description: "Skriv inn løpskoden eller skann QR-koden. Skriv deretter navnet ditt.",
        dismissWarningLabel: "Lukk advarsel",
        iosHintTitle: "Bruker du iPhone?",
        iosHintDescription:
          "Åpne helst lenken i Safari. Hvis skolens Wi-Fi er ustabil, prøv mobildata.",
        inAppWarningIosStrong: "Åpne lenken i Safari",
        inAppWarningIosBody:
          "for størst sjanse for at GPS og innlogging virker. Hvis skolens Wi-Fi er ustabil, prøv mobildata.",
        inAppWarningAndroidStrong: "Åpne lenken i riktig nettleser",
        inAppWarningAndroidBody:
          "i Chrome på Android for størst sjanse for at GPS og innlogging virker.",
        codePlaceholder: "Løpskode, for eksempel 492173",
        namePlaceholder: "Navnet ditt",
        submitButton: "Bli med i løpet",
        submitPending: "Gjør klar...",
        checkConnectionButton: "Sjekk tilkobling",
        checkConnectionPending: "Sjekker...",
        troubleshootingTitle: "Hjelp, jeg står fast",
        troubleshootingToggle: "Vis hjelp",
        troubleshootingParagraphs: [
          "Hvis koden er feil eller for gammel, må læreren gi deg en ny kode eller en ny lenke.",
          "Hvis kameraet ikke starter, kan du fortsatt skrive inn koden manuelt i feltet over.",
          "På iPhone virker GPS og innlogging best i Safari. Unngå helst å åpne lenken direkte i Facebook, Instagram eller andre innebygde nettlesere.",
        ],
        homeButton: "Tilbake til forsiden",
        homescreenTitle: "Tips: Bruk som app",
        homescreenBody:
          "Legg Postløp til på hjemmeskjermen. Da fyller spillet mer av skjermen og fungerer ofte bedre.",
        homescreenIos: "iPhone: Del → Legg til på Hjem-skjerm",
        homescreenAndroid: "Android: Meny ⋮ → Legg til på startskjermen",
      },
    },
    qrScanner: {
      buttonLabel: "Skann QR",
      eyebrow: "Skann deg inn",
      title: "Hold kameraet mot QR-koden",
      description:
        "Gi tilgang til kameraet, og hold QR-koden foran kameraet. Vi sender deg rett videre til løpet så snart koden er lest.",
      startingCamera: "Starter kamera...",
      ready: "QR-skanneren er klar.",
      failed: "Kameraet kunne ikke startes.",
      scanFailed: "QR-koden kunne ikke leses. Prøv en annen kode.",
      closeAriaLabel: "Lukk QR-skanner",
      errors: {
        permissionDenied:
          "Kameratilgang ble avslått. For å bruke skanneren må du tillate kamera i nettleserinnstillingene. Ellers kan du lukke dette vinduet og skrive inn pinkoden manuelt.",
        noCamera:
          "Vi fant ikke noe kamera på denne enheten. Du kan lukke dette vinduet og skrive inn pinkoden manuelt.",
        busy:
          "Kameraet brukes allerede av en annen app eller nettleserfane. Lukk dette vinduet og prøv igjen, eller skriv inn pinkoden manuelt.",
        generic:
          "Kameraet kunne ikke startes akkurat nå. Du kan prøve igjen eller lukke dette vinduet og skrive inn pinkoden manuelt.",
        unsupported:
          "Nettleseren din støtter ikke kameratilgang for QR-skanning. Du kan lukke dette vinduet og skrive inn pinkoden manuelt.",
      },
    },
    wifiTip: "💡 Tips: Slå av Wi-Fi og bruk mobildata. Da mister du ikke forbindelsen ute på ruten.",
  },
};

export function getSiteCopy(siteVariantKey: SiteVariantKey) {
  return siteCopies[siteVariantKey];
}
