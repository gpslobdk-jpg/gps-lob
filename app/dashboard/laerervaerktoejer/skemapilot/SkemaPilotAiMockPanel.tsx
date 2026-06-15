"use client";

import { BrainCircuit, CircleDashed, MessageSquareText, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

type PriorityLevel = "Lav" | "Middel" | "Høj";

type AiMockPrompt = {
  answer: string;
  id: string;
  question: string;
};

type SkemaPilotAiMockPanelProps = {
  previewClass: string;
  priorities: Record<string, PriorityLevel>;
  rubikClassName: string;
};

const mockPrompts: AiMockPrompt[] = [
  {
    id: "calm-class",
    question: "Kan du gøre 3. klasses skema mere roligt?",
    answer:
      "Jeg ville først kigge på antallet af fag pr. dag for den valgte klasse. Hvis der er mange korte skift, kan kreative fag samles i længere blokke, og dansk eller matematik kan ligge som tydelige ankre tidligt på dagen. Det er et eksempelsvar, ikke en beregnet anbefaling.",
  },
  {
    id: "pe-block",
    question: "Kan idræt samles som dobbeltlektion?",
    answer:
      "Idræt fungerer ofte bedst som dobbeltlektion, fordi omklædning, transport og opstart ellers spiser for meget tid. I en senere version kan SkemaPilot lede efter to nabofelter med hal eller andet relevant lokale. Her vises kun princippet som eksempelsvar.",
  },
  {
    id: "top-three",
    question: "Hvilke tre ændringer forbedrer skemaet mest?",
    answer:
      "De største forbedringer vil typisk være: kernefag tidligere på dagen, færre faglige skift i indskolingen og færre lærerhuller. I prototypen er det en fast formuleret pædagogisk tommelfingerregel, ikke en beregnet anbefaling.",
  },
  {
    id: "teacher-gaps",
    question: "Hvorfor får lærere huller?",
    answer:
      "Lærerhuller opstår ofte, når en lærer underviser på få lektioner spredt ud over dagen, eller når lokaler og faste blokke begrænser placeringen. Lærerhuller kan først vurderes præcist, når fagfordeling og lærer pr. lektion er koblet på.",
  },
  {
    id: "core-early",
    question: "Kan dansk og matematik ligge tidligere?",
    answer:
      "Hvis dansk og matematik ligger sent på dagen, kan SkemaPilot senere foreslå byt med lettere eller mere praktiske fag. I denne prototype kan panelet kun vise et eksempel på, hvordan dialogen kunne lyde.",
  },
  {
    id: "leader-first",
    question: "Hvad bør skolelederen tjekke først?",
    answer:
      "Jeg ville først tjekke om de hårde bindinger virker rimelige: faste blokke, speciallokaler og samlet timetal. Derefter giver det mening at kigge på ro i klassernes dage og på de ønsker, skolen har markeret som høj prioritet.",
  },
];

export function SkemaPilotAiMockPanel({ previewClass, priorities, rubikClassName }: SkemaPilotAiMockPanelProps) {
  const [selectedPromptId, setSelectedPromptId] = useState(mockPrompts[0].id);
  const selectedPrompt = mockPrompts.find((prompt) => prompt.id === selectedPromptId) ?? mockPrompts[0];
  const priorityContext = useMemo(() => getPriorityContext(priorities), [priorities]);

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dialog-prototype</p>
          <h4 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>
            Dialog med eksempelsvar
          </h4>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Panelet viser, hvordan en senere dialog kan støtte arbejdet med skemaets rytme. Svarene er faste
            eksempler i denne prototype.
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <CircleDashed className="h-4 w-4" />
            Ikke forbundet til AI endnu
          </p>
          <p className="text-sm font-bold leading-6">
            Svarene er skrevet på forhånd. De ændrer ikke skemaet og sender ingen data videre.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-950">
            <MessageSquareText className="h-5 w-5 text-emerald-700" />
            <h5 className="text-sm font-black uppercase tracking-[0.14em]">Eksempelspørgsmål</h5>
          </div>
          <div className="mt-4 grid gap-2">
            {mockPrompts.map((prompt) => {
              const isSelected = selectedPrompt.id === prompt.id;

              return (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => setSelectedPromptId(prompt.id)}
                  className={`rounded-lg border px-3 py-3 text-left text-sm font-black leading-6 transition focus-visible:outline-none focus-visible:ring-4 ${
                    isSelected
                      ? "border-emerald-300 bg-emerald-600 text-white focus-visible:ring-emerald-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 focus-visible:ring-slate-100"
                  }`}
                >
                  {prompt.question}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Lokal kontekst</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
              Viser dialog for {previewClass}. {priorityContext} Konteksten gør eksempelsvaret lettere at
              læse.
            </p>
          </div>

          <div className="mt-4 grid gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-h-16 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Valgt spørgsmål</p>
                <p className="mt-2 text-sm font-black leading-6 text-slate-950">{selectedPrompt.question}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                <BrainCircuit className="h-5 w-5" />
              </span>
              <div className="min-h-32 flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
                <p className="text-xs font-black uppercase tracking-[0.14em]">Eksempelsvar</p>
                <p className="mt-2 text-sm font-bold leading-7">{selectedPrompt.answer}</p>
                <div className="mt-4 flex flex-col gap-3 border-t border-emerald-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">
                    Ikke AI-beregnet
                  </p>
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Kommende funktion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function getPriorityContext(priorities: Record<string, PriorityLevel>) {
  const highPriorities = Object.entries(priorities)
    .filter(([, level]) => level === "Høj")
    .map(([wish]) => wish)
    .slice(0, 2);

  if (!highPriorities.length) {
    return "Der er ikke markeret høj prioritet i de bløde ønsker endnu.";
  }

  return `Høje ønsker i opsætningen: ${highPriorities.join(" og ")}.`;
}
