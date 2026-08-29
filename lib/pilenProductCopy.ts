import { isCharacterPost } from "@/lib/characterPosts";

export const PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION = "2026-08-30-v1";

export const PILEN_TEACHER_AI_NOTICE =
  "Pilen bruger en ekstern AI-tjeneste til den korte stemmesamtale. SkoleGPS gemmer ikke lyd eller samtalen.";

export const PILEN_TEACHER_PERMISSION_CONFIRMATION =
  "Jeg bekræfter, at nødvendig tilladelse fra forælder/værge er på plads for mindreårige elever, der skal bruge funktionen.";

export const PILEN_PRIVACY_LINK_LABEL = "Om Pilen og persondata";
export const PILEN_PRIVACY_PATH = "/privacy#pilen-fortaeller";

export const PILEN_STUDENT_AI_NOTICE =
  "Pilen er en AI – ikke et menneske. Din stemme bruges kun til den korte samtale.";

export const PILEN_AULA_COPY_LINES = [
  "Klassen kan bruge Pilen, en kort AI-stemmesamtale i SkoleGPS.",
  "Eleven taler med en AI – ikke et menneske.",
  "Stemmen bruges kun til at skabe svaret i den aktuelle undervisningspost.",
  "Når funktionen er aktiveret, behandles lyden af OpenAI som ekstern databehandler.",
  "SkoleGPS gemmer ikke lyd, transskription, spørgsmål eller AI-svar.",
  "Samtalen er kort og afgrænset til lærerens undervisningsemne.",
  "Hvis I ikke ønsker, at jeres barn bruger funktionen, kontakt skolen gennem den normale kanal.",
] as const;

export function containsPilenCharacterPost(questions: unknown) {
  return Array.isArray(questions) && questions.some(isCharacterPost);
}
