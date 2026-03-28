"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type QuickAction = {
  id: string;
  prompt: string;
  description: string;
};

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: "zone-krig",
    prompt: '🎯 "Hvordan fungerer Zone-Krigen?"',
    description: "Få forklaret zoner, point, erobring og 60-sekunders shields.",
  },
  {
    id: "scanner",
    prompt: '📚 "Lav et løb ud fra min bogtekst"',
    description: "Brug Bog-Scanneren til at omsætte tekst, bogsider eller OCR til quizposter.",
  },
  {
    id: "podcast",
    prompt: '🎙️ "Brug et podcast-link til et løb"',
    description: "Lad Podcast-Detektiven omdanne et link eller en episode til et færdigt quiz-løb.",
  },
  {
    id: "manual",
    prompt: '💡 "Giv mig en god idé til en Generel Quiz"',
    description: "Få en skarp idé til et klassisk GPS-løb med quizposter og tydeligt tema.",
  },
  {
    id: "start",
    prompt: "Hvordan kommer jeg i gang?",
    description: "Få en hurtig klik-guide til at vælge builder og starte det første løb.",
  },
] as const;

const getWelcomeMessage = (pathname: string) => {
  if (pathname.includes("/opret/zone-krig")) {
    return "Hej! Jeg er klar til at hjælpe dig med Zone-Krigen. Spørg mig om zoner, placering, taktik, pointpres eller hvordan 60-sekunders shields påvirker spillets tempo.";
  }

  if (pathname.includes("/opret/scanner")) {
    return "Hej! Jeg kan hjælpe dig med Bog-Scanneren. Du kan spørge om bogtekst, OCR, billeder af sider og hvordan materialet bedst bliver omsat til et skarpt quiz-løb.";
  }

  if (pathname.includes("/opret/podcast")) {
    return "Hej! Jeg kan hjælpe dig med Podcast-Detektiven. Spørg mig om podcast-links, episodevalg, transcript-kvalitet og hvordan lydindhold bliver til gode spørgsmål og research-baserede løb.";
  }

  if (pathname.includes("/opret/manuel")) {
    return "Hej! Jeg kan hjælpe dig hurtigt i gang med Generel Quiz. Spørg mig om idéer, temaer, multiple-choice poster eller hvordan du bygger et stærkt klassisk GPS-løb.";
  }

  return "Hej! Jeg er GPSLØB AI Arkitekten. Jeg kan guide dig gennem Generel Quiz, Bog-Scanneren, Podcast-Detektiven, Zone-Krigen og resten af platformens builders og features.";
};

const PAGE_CONTEXT_MESSAGE_ID = "gpslob-page-context";

const extractMessageText = (message: UIMessage) =>
  message.parts.filter(isTextUIPart).map((part) => part.text).join("").trim();

const getQuickActions = (pathname: string) => {
  let prioritizedIds: string[] = ["zone-krig", "scanner", "podcast", "manual", "start"];

  if (pathname.includes("/opret/zone-krig")) {
    prioritizedIds = ["zone-krig", "manual", "scanner", "podcast", "start"];
  } else if (pathname.includes("/opret/scanner")) {
    prioritizedIds = ["scanner", "manual", "podcast", "zone-krig", "start"];
  } else if (pathname.includes("/opret/podcast")) {
    prioritizedIds = ["podcast", "scanner", "manual", "zone-krig", "start"];
  } else if (pathname.includes("/opret/manuel")) {
    prioritizedIds = ["manual", "scanner", "podcast", "zone-krig", "start"];
  }

  return prioritizedIds
    .map((id) => QUICK_ACTIONS.find((action) => action.id === id))
    .filter((action): action is QuickAction => Boolean(action));
};

const buildPageContext = (pathname: string) => {
  if (pathname.includes("/opret/zone-krig")) {
    return "Systemkontekst: Brugeren står i Zone-Krigen-builderen i GPSLØB. Svar altid på dansk. Hjælp som taktisk spildesigner. Fokuser på zoner, strategisk placering, pointpres, angreb/forsvar, variation i sværhedsgrad og 60-sekunders shields efter erobring.";
  }

  if (pathname.includes("/opret/scanner")) {
    return "Systemkontekst: Brugeren står i Bog-Scanneren i GPSLØB. Svar altid på dansk. Hjælp med at vælge mellem rå tekst, bogsider og billeder, vurdere om materialet egner sig til quizspørgsmål og forklare hvordan Bog-Scanneren omsætter materialet til et quiz-løb.";
  }

  if (pathname.includes("/opret/podcast")) {
    return "Systemkontekst: Brugeren står i Podcast-Detektiven i GPSLØB. Svar altid på dansk. Hjælp med at vurdere podcast-links, episodevalg, transcript-kvalitet og hvordan lydindhold kan blive til et skarpt quiz-løb.";
  }

  if (pathname.includes("/opret/manuel")) {
    return "Systemkontekst: Brugeren står i Generel Quiz-builderen i GPSLØB. Svar altid på dansk. Hjælp med klassiske multiple-choice poster, præcis 4 svarmuligheder, gode titler til arkivet og med at afklare hvornår Generel Quiz er bedre end Bog-Scanneren, Podcast-Detektiven eller Zone-Krigen.";
  }

  if (pathname.includes("/opret/escape")) {
    return 'Systemkontekst: Læreren er i gang med at bygge et Escape Room i GPSLØB. Svar altid på dansk. Vær proaktiv og tilbyd hjælp til at finde på en "Master Code", svære gåder, kodebrikker og små spor, som passer til et skoleløb.';
  }

  if (pathname.includes("/opret/rollespil")) {
    return "Systemkontekst: Læreren bygger et rollespil i GPSLØB. Svar altid på dansk. Vær proaktiv og tilbyd hjælp til at opfinde sjove karakterer som trolde, agenter eller historiske personer samt dialoger og opgaver til posterne.";
  }

  if (pathname.includes("/resultater")) {
    return "Systemkontekst: Læreren kigger på Leaderboardet for et løb i GPSLØB. Svar altid på dansk. Tilbyd gerne hjælp til at skrive en sjov tale, et vinderdiplom eller en kort præmiering, der kan læses op for holdene.";
  }

  return "Systemkontekst: Du er GPSLØB AI Arkitekten. Svar altid på dansk og hjælp brugeren med at vælge den rigtige builder, forstå næste klik og skelne mellem Generel Quiz, Bog-Scanneren, Podcast-Detektiven og Zone-Krigen, når det er relevant.";
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
  const quickActions = useMemo(() => getQuickActions(pathname), [pathname]);
  const welcomeMessage = useMemo(() => getWelcomeMessage(pathname), [pathname]);

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

  const sendQuickQuestion = (question: string) => {
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
    <div className="global-ai-chat-button fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 flex items-end sm:right-6 sm:bottom-6">
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
                  {welcomeMessage}
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

            <div className="mt-4">
              <p className="mb-2 px-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                Hurtige genveje
              </p>
              <div className="grid gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => sendQuickQuestion(action.prompt)}
                  disabled={isLoading}
                  className="group w-full rounded-2xl border border-emerald-200/90 bg-white px-3.5 py-3 text-left shadow-sm shadow-emerald-900/5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-slate-900 transition group-hover:text-emerald-900">
                    {action.prompt}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500 transition group-hover:text-slate-600">
                    {action.description}
                  </span>
                </button>
              ))}
              </div>
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
