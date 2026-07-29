"use client";

import { FormEvent, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type UserMetadata = {
  full_name?: string;
  name?: string;
  school?: string;
  organization?: string;
};

type ProfileBillingRow = {
  stripe_customer_id?: string | null;
  plan_type?: string | null;
  cancel_at_period_end?: boolean | null;
  stripe_current_period_end?: string | null;
  marketing_consent?: boolean | null;
};

function getSchoolFromMetadata(metadata: UserMetadata) {
  return (metadata.school ?? metadata.organization ?? "").trim();
}

function formatPlanLabel(planType: string | null | undefined) {
  switch ((planType ?? "").trim().toLocaleLowerCase("da-DK")) {
    case "pro":
      return "Pro-planen";
    case "school":
      return "Skolelicensen";
    case "weekend":
      return "Weekend-pakken";
    case "event":
      return "Event-pakken";
    case "beta":
      return "Beta-adgangen";
    case "free":
      return "Gratis-planen";
    default:
      return "din plan";
  }
}

function formatDanishDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function IndstillingerPage() {
  const [navn, setNavn] = useState("");
  const [email, setEmail] = useState("");
  const [skoleOrganisation, setSkoleOrganisation] = useState("");
  const [nyAdgangskode, setNyAdgangskode] = useState("");
  const [billingProfile, setBillingProfile] = useState<ProfileBillingRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [besked, setBesked] = useState("");
  const [fejlBesked, setFejlBesked] = useState("");
  const [adgangskodeBesked, setAdgangskodeBesked] = useState("");
  const [adgangskodeFejl, setAdgangskodeFejl] = useState("");
  const [billingError, setBillingError] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [consentBesked, setConsentBesked] = useState("");
  const [consentFejl, setConsentFejl] = useState("");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const hentBruger = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Kunne ikke hente bruger:", error);
        }

        if (!user) {
          if (isMounted) {
            setFejlBesked("Din session kunne ikke indlæses endnu. Prøv at opdatere siden.");
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("stripe_customer_id, plan_type, cancel_at_period_end, stripe_current_period_end, marketing_consent")
          .eq("id", user.id)
          .maybeSingle<ProfileBillingRow>();

        if (profileError) {
          console.error("Kunne ikke hente abonnementsprofil:", profileError);
        }

        const metadata = (user.user_metadata ?? {}) as UserMetadata;

        if (isMounted) {
          setEmail(user.email ?? "");
          setNavn(metadata.full_name ?? metadata.name ?? "");
          setSkoleOrganisation(getSchoolFromMetadata(metadata));
          setBillingProfile(profile ?? null);
          setMarketingConsent(profile?.marketing_consent === true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void hentBruger();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGemAendringer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBesked("");
    setFejlBesked("");
    setIsSaving(true);
    const trimmedSchool = skoleOrganisation.trim();

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: navn,
          school: trimmedSchool,
          organization: trimmedSchool,
        },
      });

      if (error) {
        setFejlBesked("Kunne ikke gemme ændringer. Prøv igen.");
        return;
      }

      setBesked("Ændringer gemt.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkiftAdgangskode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdgangskodeBesked("");
    setAdgangskodeFejl("");

    const trimmedPassword = nyAdgangskode.trim();

    if (!trimmedPassword) {
      setAdgangskodeFejl("Indtast en ny adgangskode.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });

      if (error) {
        if (error.message.toLowerCase().includes("password")) {
          setAdgangskodeFejl("Adgangskoden skal opfylde kravene for at kunne gemmes.");
        } else {
          setAdgangskodeFejl("Kunne ikke opdatere adgangskoden. Prøv igen.");
        }
        return;
      }

      setNyAdgangskode("");
      setAdgangskodeBesked("Adgangskode opdateret.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleGemKommunikation = async (nyVaerdi: boolean) => {
    setConsentBesked("");
    setConsentFejl("");
    setIsSavingConsent(true);

    try {
      const response = await fetch("/api/profile/marketing-consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consent: nyVaerdi }),
      });

      if (!response.ok) {
        setConsentFejl("Kunne ikke gemme indstillingen. Prøv igen.");
        return;
      }

      setMarketingConsent(nyVaerdi);
      setConsentBesked(nyVaerdi ? "Du er tilmeldt nyheder." : "Du er frammeldt nyheder.");
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setBillingError("");
    setIsOpeningPortal(true);

    try {
      const response = await fetch("/api/stripe/create-portal", {
        method: "POST",
      });

      let data: { url?: string; error?: string } = {};
      try {
        data = (await response.json()) as { url?: string; error?: string };
      } catch {
        data = {};
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Kunne ikke åbne abonnementsportalen.");
      }

      window.location.href = data.url;
    } catch (error) {
      setBillingError(
        error instanceof Error ? error.message : "Kunne ikke åbne abonnementsportalen lige nu."
      );
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const stripeCustomerId =
    typeof billingProfile?.stripe_customer_id === "string"
      ? billingProfile.stripe_customer_id.trim()
      : "";
  const formattedPeriodEnd = formatDanishDateTime(billingProfile?.stripe_current_period_end);
  const planLabel = formatPlanLabel(billingProfile?.plan_type);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-emerald-50/30 to-sky-100 p-6 md:p-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <section className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-emerald-950">Min Profil</h1>
            <p className="mt-2 text-sm text-emerald-800">
              Hold dine profiloplysninger opdaterede, så dashboardet er klar til næste løb.
            </p>
          </div>

          <form onSubmit={handleGemAendringer} className="space-y-5">
            <div>
              <label htmlFor="navn" className="mb-2 block font-medium text-emerald-900">
                Navn
              </label>
              <input
                id="navn"
                type="text"
                value={navn}
                onChange={(event) => setNavn(event.target.value)}
                className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="Indtast dit navn"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block font-medium text-emerald-900">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-emerald-100 bg-slate-50/50 px-4 py-3 text-emerald-800 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="skoleOrganisation" className="mb-2 block font-medium text-emerald-900">
                Skole/Organisation
              </label>
              <input
                id="skoleOrganisation"
                type="text"
                value={skoleOrganisation}
                onChange={(event) => setSkoleOrganisation(event.target.value)}
                className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="Indtast skole eller organisation"
                autoComplete="organization"
              />
            </div>

            {fejlBesked ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {fejlBesked}
              </div>
            ) : null}
            {besked ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {besked}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Gemmer..." : "Gem ændringer"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-emerald-950">Skift adgangskode</h2>
            <p className="mt-2 text-sm text-emerald-800">
              Vælg en ny adgangskode, hvis du vil styrke eller opdatere din konto.
            </p>
          </div>

          <form onSubmit={handleSkiftAdgangskode} className="space-y-5">
            <div>
              <label htmlFor="nyAdgangskode" className="mb-2 block font-medium text-emerald-900">
                Ny adgangskode
              </label>
              <input
                id="nyAdgangskode"
                type="password"
                value={nyAdgangskode}
                onChange={(event) => setNyAdgangskode(event.target.value)}
                className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="Indtast ny adgangskode"
                autoComplete="new-password"
              />
              <p className="mt-2 text-xs text-stone-400/70">Mindst 6 tegn.</p>
            </div>

            {adgangskodeFejl ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {adgangskodeFejl}
              </div>
            ) : null}
            {adgangskodeBesked ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {adgangskodeBesked}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isUpdatingPassword || isLoading}
              className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUpdatingPassword ? "Opdaterer..." : "Gem ny adgangskode"}
            </button>
          </form>
        </section>

        {stripeCustomerId ? (
          <section className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-emerald-950">Abonnement & Betaling</h2>
              <p className="mt-2 text-sm text-emerald-800">
                Administrér kort, fakturaer og opsigelse via Stripes sikre kundeportal.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-900">
              <p className="font-semibold">Du er på {planLabel}.</p>
              <p className="mt-2 text-emerald-800">
                {billingProfile?.cancel_at_period_end
                  ? `Abonnementet er opsagt og løber frem til ${formattedPeriodEnd ?? "den registrerede udløbsdato"}.`
                  : formattedPeriodEnd
                    ? `Næste betaling / udløb: ${formattedPeriodEnd}.`
                    : "Din nuværende abonnementsperiode er registreret, men uden en præcis slutdato endnu."}
              </p>
            </div>

            {billingError ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {billingError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleOpenBillingPortal()}
              disabled={isOpeningPortal || isLoading}
              className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isOpeningPortal ? "Åbner portal..." : "Administrer Abonnement"}
            </button>
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-emerald-950">Nyheder og opdateringer</h2>
            <p className="mt-2 text-sm text-emerald-800">
              Du kan altid ændre dette igen. Vi sender kun få relevante opdateringer.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketingConsent}
              disabled={isSavingConsent || isLoading}
              onChange={(event) => void handleGemKommunikation(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
            />
            <span className="text-sm leading-relaxed text-emerald-900">
              Jeg vil gerne modtage nyheder og opdateringer om SkoleGPS på mail.
            </span>
          </label>

          {consentFejl ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {consentFejl}
            </div>
          ) : null}
          {consentBesked ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {consentBesked}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
