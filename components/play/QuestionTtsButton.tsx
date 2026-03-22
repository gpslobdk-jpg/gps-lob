"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DANISH_LANG = "da-DK";

type QuestionTtsButtonProps = {
  question: string;
  answers: string[];
};

function buildSpeechText(question: string, answers: string[]) {
  const trimmedQuestion = question.trim();
  const trimmedAnswers = answers.map((answer) => answer.trim()).filter(Boolean);

  if (!trimmedQuestion) return "";

  if (trimmedAnswers.length === 0) {
    return `Spørgsmål. ${trimmedQuestion}`;
  }

  const answerSection = trimmedAnswers
    .map((answer, index) => `Mulighed ${index + 1}. ${answer}.`)
    .join(" ");

  return `Spørgsmål. ${trimmedQuestion}. Svarmuligheder. ${answerSection}`;
}

function pickDanishVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang.toLocaleLowerCase("da-DK") === DANISH_LANG.toLocaleLowerCase("da-DK")) ??
    voices.find((voice) => voice.lang.toLocaleLowerCase("da-DK").startsWith("da")) ??
    null
  );
}

export default function QuestionTtsButton({ question, answers }: QuestionTtsButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string | null>(null);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    return pickDanishVoice(window.speechSynthesis.getVoices());
  });
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeUtteranceTokenRef = useRef<number | null>(null);
  const utteranceTokenCounterRef = useRef(0);
  const isMountedRef = useRef(true);
  const speechText = buildSpeechText(question, answers);
  const isSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;
  const isActiveSpeech = isSpeaking && activeSpeechText === speechText;

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const synth = window.speechSynthesis;
    synthRef.current = synth;

    const syncPreferredVoice = () => {
      setPreferredVoice(pickDanishVoice(synth.getVoices()));
    };

    synth.addEventListener("voiceschanged", syncPreferredVoice);

    return () => {
      synth.removeEventListener("voiceschanged", syncPreferredVoice);
      isMountedRef.current = false;
      synth.cancel();
      utteranceRef.current = null;
      activeUtteranceTokenRef.current = null;
    };
  }, [isSupported]);

  useEffect(() => {
    const synth = synthRef.current;
    if (!synth || activeSpeechText === null || activeSpeechText === speechText) return;

    synth.cancel();
    utteranceRef.current = null;
    activeUtteranceTokenRef.current = null;
  }, [activeSpeechText, speechText]);

  const handleToggleSpeech = () => {
    if (!isSupported || !speechText || typeof window === "undefined") return;

    const synth = synthRef.current ?? window.speechSynthesis;
    synthRef.current = synth;

    if (isActiveSpeech) {
      synth.cancel();
      utteranceRef.current = null;
      activeUtteranceTokenRef.current = null;
      setActiveSpeechText(null);
      setIsSpeaking(false);
      return;
    }

    synth.cancel();
    const utteranceToken = utteranceTokenCounterRef.current + 1;
    utteranceTokenCounterRef.current = utteranceToken;
    activeUtteranceTokenRef.current = utteranceToken;
    setActiveSpeechText(speechText);
    setIsSpeaking(true);

    const utterance = new window.SpeechSynthesisUtterance(speechText);
    utterance.lang = DANISH_LANG;
    utterance.rate = 0.95;

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      if (activeUtteranceTokenRef.current !== utteranceToken) {
        return;
      }
      utteranceRef.current = utterance;
    };
    utterance.onend = () => {
      if (activeUtteranceTokenRef.current !== utteranceToken) return;

      utteranceRef.current = null;
      activeUtteranceTokenRef.current = null;

      if (isMountedRef.current) {
        setActiveSpeechText(null);
        setIsSpeaking(false);
      }
    };
    utterance.onerror = () => {
      if (activeUtteranceTokenRef.current !== utteranceToken) return;

      utteranceRef.current = null;
      activeUtteranceTokenRef.current = null;

      if (isMountedRef.current) {
        setActiveSpeechText(null);
        setIsSpeaking(false);
      }
    };

    synth.speak(utterance);
  };

  const buttonLabel = isActiveSpeech ? "Stop oplæsning" : "Læs spørgsmål og svar op";

  return (
    <button
      type="button"
      onClick={handleToggleSpeech}
      disabled={!isSupported || !speechText}
      aria-label={buttonLabel}
      aria-pressed={isActiveSpeech}
      title={isSupported ? buttonLabel : "Oplæsning er ikke understøttet i denne browser"}
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white shadow-[0_12px_28px_rgba(15,23,42,0.3)] transition-all hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {isActiveSpeech ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-5 w-5" />}
      <span className="sr-only">{buttonLabel}</span>
    </button>
  );
}
