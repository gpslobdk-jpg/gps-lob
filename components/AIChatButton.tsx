"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type QuickAction = {
  id: string;
  label: string;
  prompt: string;
};

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: "stratego",
    label: "Vis mig, hvordan Live Stratego fungerer",
    prompt: "Vis mig, hvordan Live Stratego fungerer.",
  },
  {
    id: "zone-krig",
    label: "Vis mig, hvordan man vinder i Zone-Krigen",
    prompt: "Vis mig, hvordan man vinder i Zone-Krigen.",
  },
  {
    id: "vm26",
    label: "Hjælp med VM26-løb",
    prompt: "Hvad er VM26 – Jagten på pokalen, og hvordan kommer jeg i gang?",
  },
  {
    id: "scanner",
    label: "Lav et løb ud fra min bogtekst",
    prompt: "Lav et løb ud fra min bogtekst.",
  },
  {
    id: "podcast",
    label: "Byg et løb fra et podcast-link",
    prompt: "Byg et løb fra et podcast-link.",
  },
  {
    id: "manual",
    label: "Giv mig en skarp ide til en Generel Quiz",
    prompt: "Giv mig en skarp ide til en Generel Quiz.",
  },
  {
    id: "start",
    label: "Vis mig den bedste vej i gang",
    prompt: "Vis mig den bedste vej i gang.",
  },
] as const;

const getWelcomeMessage = (pathname: string) => {
  if (pathname.includes("/opret/stratego")) {
    return "Jeg kan hjælpe dig med Live Stratego: radar, hemmelige roller, fredszoner, kontrolrum og hvornår det er det stærkeste valg.";
  }

  if (pathname.includes("/opret/zone-krig")) {
    return "Jeg kan hjælpe dig med Zone-Krigen: zoner, placering, pointpres, taktiske greb og balancen i 3-minutters shields.";
  }

  if (pathname.includes("/opret/scanner")) {
    return "Jeg kan hjælpe dig med Bog-Scanneren: bogtekst, OCR, billeder af sider og hvordan materialet bliver til et skarpt quiz-løb.";
  }

  if (pathname.includes("/opret/podcast")) {
    return "Jeg kan hjælpe dig med Podcast-Detektiven: episodevalg, links, transcript-kvalitet og hvordan lyd bliver til stærke spørgsmål.";
  }

  if (pathname.includes("/opret/manuel")) {
    return "Jeg kan hjælpe dig med Generel Quiz: ideer, temaer, multiple-choice poster og et skarpt klassisk løb.";
  }

  return "Jeg kan guide dig gennem GPSLOB.DK og hjælpe dig med at vælge den rigtige builder, skærpe ideen og komme hurtigt videre.";
};

const PAGE_CONTEXT_MESSAGE_ID = "gpslob-page-context";

const extractMessageText = (message: UIMessage) =>
  message.parts.filter(isTextUIPart).map((part) => part.text).join("").trim();

const getQuickActions = (pathname: string) => {
  let prioritizedIds: string[] = [
    "stratego",
    "zone-krig",
    "vm26",
    "scanner",
    "podcast",
    "manual",
    "start",
  ];

  if (pathname.includes("/opret/stratego")) {
    prioritizedIds = ["stratego", "zone-krig", "vm26", "manual", "scanner", "podcast", "start"];
  } else if (pathname.includes("/opret/zone-krig")) {
    prioritizedIds = ["zone-krig", "stratego", "vm26", "manual", "scanner", "podcast", "start"];
  } else if (pathname.includes("/opret/scanner")) {
    prioritizedIds = ["scanner", "manual", "podcast", "vm26", "stratego", "zone-krig", "start"];
  } else if (pathname.includes("/opret/podcast")) {
    prioritizedIds = ["podcast", "scanner", "manual", "vm26", "stratego", "zone-krig", "start"];
  } else if (pathname.includes("/opret/manuel")) {
    prioritizedIds = ["manual", "vm26", "scanner", "podcast", "stratego", "zone-krig", "start"];
  }

  return prioritizedIds
    .map((id) => QUICK_ACTIONS.find((action) => action.id === id))
    .filter((action): action is QuickAction => Boolean(action));
};

const HIDDEN_PATHNAMES = ["/opret/zone-krig"];

export default function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const pathname = usePathname();

  if (HIDDEN_PATHNAMES.some((hidden) => pathname.includes(hidden))) {
    return null;
  }
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
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
            messages: messages.filter(
              (message) => message.id !== PAGE_CONTEXT_MESSAGE_ID
            ),
            pathname,
          },
        }),
      }),
    [pathname]
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
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
    <>
      <div
        className="global-ai-chat-button pointer-events-none fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-1200 flex items-end sm:right-6 sm:bottom-6"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="pointer-events-auto flex max-h-full min-h-0 flex-col items-end gap-3">
          {isOpen ? (
            <section
              className="relative isolate flex max-h-full min-h-0 w-[min(22.5rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-emerald-500/15 bg-linear-to-b from-white/96 to-emerald-50/88 px-4 pb-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl"
              style={{
                animation: "aiChatReveal 260ms cubic-bezier(0.16, 1, 0.3, 1)",
                paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.25rem))",
              }}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 right-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-emerald-200/45 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-6 translate-y-6 rounded-full bg-sky-100/45 blur-2xl" />
              </div>

              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Image
                      src="/gpslogo.png"
                      alt={"GPSLØB logo"}
                      width={28}
                      height={28}
                      className="mt-0.5 h-5 w-auto opacity-90"
                    />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-emerald-700/55">
                        GPSLOB.DK
                      </p>
                      <p className="mt-1 text-sm font-medium tracking-[0.04em] text-slate-800">
                        GPS-Assistent
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs text-slate-400 transition-colors hover:bg-emerald-950/5 hover:text-emerald-900"
                    aria-label="Luk Assistent"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>

                <div className="mt-3 h-px w-full bg-linear-to-r from-emerald-200/80 via-white to-transparent" />

                <div className="mt-4 min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1.5 pt-1">
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-[1.35rem] border border-emerald-500/12 bg-linear-to-b from-white to-emerald-50/65 px-3.5 py-3 text-[13px] leading-[1.65] tracking-[0.01em] text-[#0f3d2e]/88 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
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
                          className={`max-w-[90%] rounded-[1.35rem] px-3.5 py-3 text-[13px] leading-[1.65] tracking-[0.01em] ${
                            isUser
                              ? "border border-emerald-950/10 bg-[#0f3d2e] text-emerald-50 shadow-[0_12px_32px_rgba(6,78,59,0.18)]"
                              : "border border-emerald-500/12 bg-linear-to-b from-white to-emerald-50/65 text-[#0f3d2e]/88 shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    );
                  })}

                  {isLoading ? (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-[1.35rem] border border-emerald-500/12 bg-linear-to-b from-white to-emerald-50/65 px-3.5 py-2.5 text-[10px] uppercase tracking-[0.24em] text-emerald-800/65 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                        <span className="inline-flex gap-1">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500/70" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500/70 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500/70 [animation-delay:240ms]" />
                        </span>
                        {"Henter svar..."}
                      </div>
                    </div>
                  ) : null}

                  <div ref={endOfMessagesRef} />
                </div>

                {error ? (
                  <p className="mt-3 text-xs text-rose-600">
                    {"Forbindelsen fejlede. Prøv igen om et øjeblik."}
                  </p>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={"Skriv dit spørgsmål..."}
                    disabled={isLoading}
                    className="w-full rounded-[1.25rem] border border-emerald-500/12 bg-white/92 px-3.5 py-3 text-sm tracking-[0.01em] text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || input.trim().length === 0}
                    className="rounded-[1.25rem] border border-emerald-500/14 bg-white/92 px-3.5 py-3 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-900/70 transition hover:border-emerald-500/25 hover:bg-emerald-50/70 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Send
                  </button>
                </form>

                <div className="mt-2 space-y-1 text-[11px] tracking-[0.01em] text-slate-400">
                  <div>{"Automatiske svar kan indeholde fejl. Kontrollér altid vigtige oplysninger."}</div>
                  <div>
                    {"Oplever du tekniske problemer? Skriv til "}
                    <a
                      href="mailto:Gpslobdk@gmail.com"
                      className="break-all underline transition-colors hover:text-emerald-600"
                    >
                      Gpslobdk@gmail.com
                    </a>
                  </div>
                </div>

                <div className="mt-4 border-t border-emerald-500/10 pt-3.5">
                  <p className="mb-1.5 px-0.5 text-[10px] uppercase tracking-[0.24em] text-emerald-800/45">
                    Quick Actions
                  </p>
                  <div className="flex flex-col items-start gap-0.5">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => sendQuickQuestion(action.prompt)}
                        disabled={isLoading}
                        className="group inline-flex items-center gap-1 px-0 py-1 text-left text-[11px] tracking-[0.01em] text-slate-500 transition-colors duration-200 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-45 sm:text-xs"
                      >
                        <span>{action.label}</span>
                        <span
                          aria-hidden="true"
                          className="opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                        >
                          -&gt;
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-label={"Åbn Assistent"}
            className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-slate-950/84 px-3 py-2 text-emerald-50 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-md transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-emerald-400/35 hover:bg-slate-950/92 hover:shadow-[0_20px_50px_rgba(6,78,59,0.24)]"
          >
            <Image
              src="/gpslogo.png"
              alt={"GPSLØB logo"}
              width={32}
              height={32}
              className="h-5.5 w-auto opacity-90"
            />
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/85" />
            <span className="text-sm font-medium tracking-[0.04em] text-emerald-50">GPS-Assistent</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes aiChatReveal {
            from {
              opacity: 0;
              transform: translateY(14px) scale(0.985);
            }

            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        }
      `}</style>
    </>
  );
}
