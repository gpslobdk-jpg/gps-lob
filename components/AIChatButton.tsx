"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const QUICK_QUESTIONS = [
  "Hvordan kommer jeg i gang?",
  "Hvordan bruger jeg arkivet og AI-hjælpen?",
  "Hvordan deltager man med pinkode?",
] as const;

const WELCOME_MESSAGE =
  'Hej! Jeg kan guide dig trin for trin gennem GPSLØB. Spørg fx "Hvordan kommer jeg i gang?" eller "Hvordan bruger jeg arkivet?", så peger jeg dig direkte hen til de rigtige knapper og menuer.';

const PAGE_CONTEXT_MESSAGE_ID = "gpslob-page-context";

const extractMessageText = (message: UIMessage) =>
  message.parts.filter(isTextUIPart).map((part) => part.text).join("").trim();

const buildPageContext = (pathname: string) => {
  if (pathname.includes("/opret/escape")) {
    return 'Systemkontekst: Læreren er i gang med at bygge et Escape Room i GPSLØB. Svar altid på dansk. Vær proaktiv og tilbyd hjælp til at finde på en "Master Code", svære gåder, kodebrikker og små spor, som passer til et skoleløb.';
  }

  if (pathname.includes("/opret/rollespil")) {
    return "Systemkontekst: Læreren bygger et rollespil i GPSLØB. Svar altid på dansk. Vær proaktiv og tilbyd hjælp til at opfinde sjove karakterer som trolde, agenter eller historiske personer samt dialoger og opgaver til posterne.";
  }

  if (pathname.includes("/resultater")) {
    return "Systemkontekst: Læreren kigger på Leaderboardet for et løb i GPSLØB. Svar altid på dansk. Tilbyd gerne hjælp til at skrive en sjov tale, et vinderdiplom eller en kort præmiering, der kan læses op for holdene.";
  }

  return "Systemkontekst: Du er en hjælpsom assistent på GPS-platformen. Svar altid på dansk og hjælp lærere og vikarer konkret videre med næste klik, næste valg og praktiske forslag.";
};

const withPageContextMessage = (
  messages: UIMessage[],
  pageContext: string
): UIMessage[] => {
  const messagesWithoutContext = messages.filter(
    (message) => message.id !== PAGE_CONTEXT_MESSAGE_ID
  );

  return [
    {
      id: PAGE_CONTEXT_MESSAGE_ID,
      role: "system",
      metadata: { hidden: true, type: "page-context" },
      parts: [{ type: "text", text: pageContext }],
    },
    ...messagesWithoutContext,
  ];
};

export default function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const pathname = usePathname();
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const pageContext = useMemo(() => buildPageContext(pathname), [pathname]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({
          api,
          body,
          credentials,
          headers,
          messages,
        }) => ({
          api,
          credentials,
          headers,
          body: {
            ...(body ?? {}),
            messages: withPageContextMessage(messages, pageContext),
          },
        }),
      }),
    [pageContext]
  );

  const { messages, sendMessage, setMessages, status, error, clearError } = useChat({
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (pathname !== "/") return;

    const hasClosedGuide = window.sessionStorage.getItem("aiGuideClosed");
    if (hasClosedGuide) return;

    const frameId = window.requestAnimationFrame(() => {
      setIsOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pathname]);

  useEffect(() => {
    setMessages((currentMessages) =>
      withPageContextMessage(currentMessages, pageContext)
    );
  }, [pageContext, setMessages]);

  useEffect(() => {
    if (!isOpen) return;

    setMessages((currentMessages) =>
      withPageContextMessage(currentMessages, pageContext)
    );
  }, [isOpen, pageContext, setMessages]);

  const chatMessages = useMemo(
    () =>
      messages
        .map((message) => ({
          id: message.id,
          role: message.role,
          text: extractMessageText(message),
        }))
        .filter((message) => message.role !== "system" && message.text.length > 0),
    [messages]
  );

  useEffect(() => {
    if (!isOpen) return;

    endOfMessagesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [isOpen, chatMessages, isLoading]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading) return;
    if (error) clearError();

    void sendMessage({ text: trimmedInput });
    setInput("");
  };

  const sendQuickQuestion = (question: (typeof QUICK_QUESTIONS)[number]) => {
    if (isLoading) return;
    if (error) clearError();

    void sendMessage({ text: question });
  };

  const handleClose = () => {
    setIsOpen(false);
    window.sessionStorage.setItem("aiGuideClosed", "true");
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
      return;
    }

    setIsOpen(true);
  };

  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 flex items-end sm:right-6 sm:bottom-6">
      <div className="flex flex-col items-end gap-3">
        {isOpen ? (
          <section className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-emerald-100/90 bg-slate-50/95 p-4 shadow-2xl shadow-emerald-900/15 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Image
                  src="/gpslogo.png"
                  alt={"GPSLØB logo"}
                  width={28}
                  height={28}
                  className="h-6 w-auto"
                />
                <p className="text-sm font-semibold tracking-wide text-slate-900">
                  {"AI Guide \u{1F916}"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1 rounded-md bg-slate-100 p-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                aria-label="Luk AI Guide"
              >
                <span aria-hidden="true">X</span>
                <span>Luk</span>
              </button>
            </div>

            <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm leading-relaxed text-slate-700 shadow-sm shadow-emerald-900/5">
                  {WELCOME_MESSAGE}
                </div>
              </div>

              {chatMessages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        isUser
                          ? "border border-emerald-700/20 bg-emerald-600 text-white"
                          : "border border-emerald-100 bg-white text-slate-700 shadow-sm shadow-emerald-900/5"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                );
              })}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm shadow-emerald-900/5">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:240ms]" />
                    </span>
                    {"AI tænker..."}
                  </div>
                </div>
              ) : null}

              <div ref={endOfMessagesRef} />
            </div>

            {error ? (
              <p className="mt-2 text-xs text-rose-600">
                {"Forbindelsen fejlede. Prøv igen om et øjeblik."}
              </p>
            ) : null}

            <div className="mt-4 space-y-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendQuickQuestion(question)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-emerald-700/15 bg-emerald-600 px-3 py-2 text-left text-sm text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={"Skriv dit spørgsmål..."}
                disabled={isLoading}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLoading || input.trim().length === 0}
                className="rounded-xl border border-emerald-700/15 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Send
              </button>
            </form>

            <div className="mt-2 text-[11px] text-slate-500">
              {"AI-svar kan indeholde fejl. Kontrollér altid vigtige oplysninger."}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label={"Åbn AI Guide"}
          className="inline-flex items-center gap-2.5 rounded-full border border-emerald-100 bg-white/80 px-3 py-2 text-slate-800 shadow-lg shadow-emerald-900/15 backdrop-blur-md transition hover:bg-white"
        >
          <Image
            src="/gpslogo.png"
            alt={"GPSLØB logo"}
            width={32}
            height={32}
            className="h-6 w-auto"
          />
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold">AI Guide</span>
        </button>
      </div>
    </div>
  );
}
