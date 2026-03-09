"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type ClearRunDataButtonProps = {
  action: () => void | Promise<void>;
  disabled?: boolean;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-900 shadow-lg transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "RYDDER DATA..." : "Ryd alle billeder, besvarelser og data for dette loeb"}
    </button>
  );
}

export default function ClearRunDataButton({ action, disabled = false }: ClearRunDataButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Er du sikker paa, at du vil slette alle gemte billeder, besvarelser, deltagerspor og live-sessioner for dette loeb?"
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton disabled={disabled} />
    </form>
  );
}
