"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const QUICK_QUESTIONS = [
  "Hvordan opretter jeg et løb?",
  "Hvor finder jeg mine koder?",
  "Kan jeg bruge mine egne spørgsmål?",
] as const;

const WELCOME_MESSAGE =
  "Hej! Jeg er din GPSLØB-guide. Hvordan kan jeg hjælpe dig med at skabe eller deltage i et løb i dag?";

const extractMessageText = (message: UIMessage) =>
  message.parts.filter(isTextUIPart).map((part) => part.text).join("").trim();

export default function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";

  const chatMessages = useMemo(
    () =>
      messages
        .map((message) => ({
          id: message.id,
          role: message.role,
          text: extractMessageText(message),
        }))
        .filter((message) => message.text.length > 0),
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

  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex items-end sm:right-6 sm:bottom-6">
      <div className="flex flex-col items-end gap-3">
        {isOpen ? (
          <section className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-700/70 bg-slate-900/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Image
                  src="/gpslogo.png"
                  alt="GPSLØB logo"
                  width={28}
                  height={28}
                  className="h-6 w-auto"
                />
                <p className="text-sm font-semibold tracking-wide text-slate-100">
                  AI Guide
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                Luk
              </button>
            </div>

            <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-xl border border-slate-700/70 bg-slate-800/75 px-3 py-2 text-sm leading-relaxed text-slate-100">
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
                          ? "border border-cyan-400/35 bg-cyan-500/20 text-cyan-50"
                          : "border border-slate-700/70 bg-slate-800/75 text-slate-100"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                );
              })}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:240ms]" />
                    </span>
                    AI tænker...
                  </div>
                </div>
              ) : null}

              <div ref={endOfMessagesRef} />
            </div>

            {error ? (
              <p className="mt-2 text-xs text-rose-300">
                Forbindelsen fejlede. Prøv igen om et øjeblik.
              </p>
            ) : null}

            <div className="mt-4 space-y-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendQuickQuestion(question)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-800/70 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Skriv dit spørgsmål..."
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLoading || input.trim().length === 0}
                className="rounded-xl border border-cyan-400/45 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Send
              </button>
            </form>

            <div className="mt-2 text-[11px] text-slate-500">
              AI-svar kan indeholde fejl. Kontrollér altid vigtige oplysninger.
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label="Åbn AI Guide"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-slate-200 shadow-lg shadow-black/35 transition hover:border-slate-600 hover:bg-slate-900"
        >
          <Image
            src="/gpslogo.png"
            alt="GPSLØB logo"
            width={32}
            height={32}
            className="h-7 w-auto"
          />
          <span className="text-sm font-semibold">AI Guide</span>
        </button>
      </div>
    </div>
  );
}
