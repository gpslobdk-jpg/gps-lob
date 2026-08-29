import { PILEN_AULA_COPY_LINES } from "@/lib/pilenProductCopy";

type PilenLegalEnvironment = Record<string, string | undefined>;

export type PilenPrivacyInformation = {
  title: string;
  paragraphs: readonly string[];
  bullets: readonly string[];
  providerAndRetention: string;
  aulaTitle: string;
  aulaLines: readonly string[];
  zdrStatementActive: boolean;
};

function isVerifiedProductionZdr(environment: PilenLegalEnvironment) {
  return (
    environment.VERCEL_ENV?.trim().toLowerCase() === "production" &&
    environment.PILEN_REALTIME_OPENAI_REGION?.trim().toLowerCase() === "eu" &&
    environment.PILEN_REALTIME_ZDR_CONFIRMED === "true" &&
    environment.PILEN_REALTIME_UNDER_18_REVIEW_CONFIRMED === "true" &&
    environment.PILEN_REALTIME_PRODUCTION_APPROVED === "true"
  );
}

export function getPilenPrivacyInformation(
  environment: PilenLegalEnvironment,
): PilenPrivacyInformation {
  const zdrStatementActive = isVerifiedProductionZdr(environment);

  return {
    title: "Pilen fortæller og AI-stemme",
    paragraphs: [
      "Pilen er en AI-figur, som eleven kan tale kort med om lærerens undervisningsemne. Mikrofonen åbnes først, når eleven selv trykker på knappen. Samtalen bruges ikke til elevbedømmelse.",
      "Skolen eller kommunen skal have afklaret det nødvendige grundlag og den nødvendige tilladelse, før mindreårige elever bruger den rigtige AI-stemme. SkoleGPS indsamler ikke elevens alder, forældreoplysninger eller dokumentation fra den enkelte familie.",
    ],
    bullets: [
      "Lyden sendes live til den valgte AI-databehandler for at skabe svaret.",
      "SkoleGPS gemmer ikke lydoptagelsen eller en transskription.",
      "SkoleGPS gemmer ikke elevens spørgsmål, AI'ens svar eller en samtalehistorik.",
      "Pilen får kun emne, klassetrin, en generel stedbeskrivelse og maksimal samtaletid.",
      "Rå GPS-koordinater sendes ikke til AI-modellen.",
    ],
    providerAndRetention: zdrStatementActive
      ? "OpenAI behandler lyden som ekstern databehandler via den europæiske API-konfiguration. Den godkendte Production-konfiguration er server-side markeret som Zero Data Retention, så API-indholdet ikke opbevares efter behandlingen."
      : "OpenAI er den planlagte eksterne databehandler. Den rigtige stemmefunktion er lukket, indtil den konkrete Production-konfiguration for europæisk behandling, databehandlerforhold og retention – herunder Zero Data Retention – er verificeret og godkendt.",
    aulaTitle: "Kort tekst til Aula eller skolens normale kanal",
    aulaLines: PILEN_AULA_COPY_LINES,
    zdrStatementActive,
  };
}
