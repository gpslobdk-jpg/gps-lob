"use client";

import { Camera, ChevronDown, CircleHelp, Download, MapPin, RotateCcw, Volume2, Wifi } from "lucide-react";
import { useState } from "react";

type StudentPhoneHelpProps = {
  showInstallEntry: boolean;
  canRetryJoinLookup: boolean;
  isRetryingJoinLookup?: boolean;
  onInstallRequested: () => void;
  onRetryJoinLookup?: () => void;
};

/**
 * A deliberately passive help surface for the student join flow. It explains
 * which existing control to use, but never requests device permissions or
 * starts camera/location/network work by itself.
 */
export default function StudentPhoneHelp({
  showInstallEntry,
  canRetryJoinLookup,
  isRetryingJoinLookup = false,
  onInstallRequested,
  onRetryJoinLookup,
}: StudentPhoneHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openInstallHelp = () => {
    setIsOpen(true);
    onInstallRequested();
  };

  return (
    <section className="mt-5" data-testid="student-phone-help" aria-label="Telefonhjælp">
      {showInstallEntry ? (
        <button
          type="button"
          onClick={openInstallHelp}
          data-testid="student-phone-help-install"
          className="mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-bold text-sky-100 transition hover:bg-sky-400/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Installer spillet
        </button>
      ) : null}

      <details
        open={isOpen}
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
        className="group rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.16)]"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-200">
          <span className="inline-flex items-center gap-2">
            <CircleHelp className="h-4 w-4 text-sky-200" aria-hidden="true" />
            Hjælp på telefonen
          </span>
          <ChevronDown className="h-4 w-4 text-sky-200/75 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
          <section aria-labelledby="phone-help-join-title">
            <h2 id="phone-help-join-title" className="inline-flex items-center gap-2 font-bold text-sky-50">
              <Wifi className="h-4 w-4 text-sky-200" aria-hidden="true" />
              Kom ind i løbet
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Internet:</strong> Tjek wi-fi eller mobildata. Er koden allerede skrevet, kan du bruge den eksisterende <em>Prøv igen</em>-knap nedenfor.
              </li>
              <li>
                <strong className="text-white">Kamera eller PIN:</strong> Virker QR-kameraet ikke, så skriv den sekscifrede kode fra læreren i stedet. Det kræver ikke kameraadgang.
              </li>
              <li>
                <strong className="text-white">Indlejret browser:</strong> Åbn linket i Safari på iPhone eller Chrome på Android, hvis det er åbnet inde i fx Aula, Teams, Instagram eller en anden app.
              </li>
            </ul>
          </section>

          {canRetryJoinLookup && onRetryJoinLookup ? (
            <button
              type="button"
              onClick={onRetryJoinLookup}
              disabled={isRetryingJoinLookup}
              data-testid="student-phone-help-retry-join"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-400/12 px-4 py-2.5 font-bold text-sky-100 transition hover:bg-sky-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 disabled:cursor-wait disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {isRetryingJoinLookup ? "Prøver igen…" : "Prøv koden igen"}
            </button>
          ) : null}

          <section aria-labelledby="phone-help-route-title">
            <h2 id="phone-help-route-title" className="inline-flex items-center gap-2 font-bold text-sky-50">
              <MapPin className="h-4 w-4 text-sky-200" aria-hidden="true" />
              Når I er på ruten
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Placering er afvist:</strong> Tillad placering for browseren, mens du bruger spillet. Gå derefter tilbage til kortet og brug den eksisterende handling dér.
              </li>
              <li>
                <strong className="text-white">Placeringen tager lang tid eller er upræcis:</strong> Gå et sted med fri udsigt til himlen, vent et øjeblik og hold telefonen stille. Prøv ikke at gætte på en post.
              </li>
              <li>
                <strong className="text-white">Lyd:</strong> Tryk én gang i spillet først, og tjek lydløs-knap og lydstyrke. Nogle browsere starter først lyd efter et tryk.
              </li>
            </ul>
          </section>

          <section aria-labelledby="phone-help-install-title">
            <h2 id="phone-help-install-title" className="inline-flex items-center gap-2 font-bold text-sky-50">
              <Download className="h-4 w-4 text-sky-200" aria-hidden="true" />
              Installér spillet
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Android:</strong> Åbn linket i Chrome eller den browser, skolen bruger, vælg menuen ⋮ og derefter <em>Installér app</em> eller <em>Føj til startskærm</em>.
              </li>
              <li>
                <strong className="text-white">iPhone/iPad:</strong> Åbn linket i Safari, vælg Del, derefter <em>Føj til hjemmeskærm</em> og til sidst <em>Tilføj</em>.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-amber-300/20 bg-amber-300/8 px-3 py-2.5" aria-labelledby="phone-help-it-title">
            <h2 id="phone-help-it-title" className="font-bold text-amber-50">Min skærm ser anderledes ud</h2>
            <p className="mt-1 text-amber-50/85">
              Menunavne og placeringer kan være anderledes på din telefon. Hvis en skoletelefon blokerer kamera, placering eller installation, så kontakt din lærer eller skolens IT i stedet for at ændre ukendte indstillinger.
            </p>
          </section>

          <p className="inline-flex items-start gap-2 text-xs leading-5 text-slate-400">
            <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Denne hjælp åbner ikke kamera, placering eller andre tilladelser af sig selv.
          </p>
          <p className="inline-flex items-start gap-2 text-xs leading-5 text-slate-400">
            <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Spillet virker også, hvis I vælger at spille uden lyd.
          </p>
        </div>
      </details>
    </section>
  );
}
