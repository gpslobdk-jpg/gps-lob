"use client";

import { FormEvent, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type UserMetadata = {
  full_name?: string;
  name?: string;
  school?: string;
  organization?: string;
};

export default function IndstillingerPage() {
  const [navn, setNavn] = useState("");
  const [email, setEmail] = useState("");
  const [skoleOrganisation, setSkoleOrganisation] = useState("");
  const [nyAdgangskode, setNyAdgangskode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [besked, setBesked] = useState("");
  const [fejlBesked, setFejlBesked] = useState("");
  const [adgangskodeBesked, setAdgangskodeBesked] = useState("");
  const [adgangskodeFejl, setAdgangskodeFejl] = useState("");

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

        const metadata = (user.user_metadata ?? {}) as UserMetadata;

        if (isMounted) {
          setEmail(user.email ?? "");
          setNavn(metadata.full_name ?? metadata.name ?? "");
          setSkoleOrganisation(metadata.school ?? metadata.organization ?? "");
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

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: navn,
          school: skoleOrganisation,
          organization: skoleOrganisation,
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
      </div>
    </main>
  );
}
