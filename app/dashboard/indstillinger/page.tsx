"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type UserMetadata = {
  full_name?: string;
  name?: string;
  school?: string;
  organization?: string;
};

export default function IndstillingerPage() {
  const router = useRouter();
  const [navn, setNavn] = useState("");
  const [email, setEmail] = useState("");
  const [skoleOrganisation, setSkoleOrganisation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [besked, setBesked] = useState("");
  const [fejlBesked, setFejlBesked] = useState("");

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
  }, [router]);

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

  const handleLogUd = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-emerald-50/30 to-sky-100 p-6 md:p-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="mb-8 text-3xl font-bold text-emerald-950">Min Profil</h1>
          <button
            type="button"
            onClick={handleLogUd}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-red-600 transition-all hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log ud
          </button>
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
              className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 focus:ring-2 focus:ring-emerald-300 focus:outline-none"
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
              className="w-full rounded-xl border border-emerald-100 bg-white/60 px-4 py-3 text-emerald-950 focus:ring-2 focus:ring-emerald-300 focus:outline-none"
              placeholder="Indtast skole eller organisation"
            />
          </div>

          {fejlBesked ? <p className="text-sm text-red-600">{fejlBesked}</p> : null}
          {besked ? <p className="text-sm text-emerald-700">{besked}</p> : null}

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Gemmer..." : "Gem Ændringer"}
          </button>
        </form>
      </div>
    </main>
  );
}
