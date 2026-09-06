"use client";

import { Archive, BookOpen, Home, LogOut, Settings, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import Mascot from "@/components/brand/Mascot";
import { useAudio } from "@/contexts/AudioContext";
import { createClient } from "@/utils/supabase/client";

type NavLink = {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
};

const navLinks: NavLink[] = [
  {
    href: "/dashboard",
    label: "Hjem",
    icon: Home,
    isActive: (pathname) => pathname === "/dashboard",
  },
  {
    href: "/dashboard/arkiv",
    label: "Arkiv",
    icon: Archive,
    isActive: (pathname) => pathname.startsWith("/dashboard/arkiv"),
  },
  {
    href: "/dashboard/laerervaerktoejer",
    label: "Værktøjer",
    icon: BookOpen,
    isActive: (pathname) => pathname.startsWith("/dashboard/laerervaerktoejer"),
  },
  {
    href: "/dashboard/indstillinger",
    label: "Indstillinger",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith("/dashboard/indstillinger"),
  },
];

function getNavLinkClasses(isActive: boolean) {
  if (isActive) {
    return "inline-flex items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all";
  }

  return "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--skolegps-deep-navy)] transition-all hover:bg-sky-50";
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isPlaying, toggleAudio } = useAudio();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  const handleLogUd = async () => {
    setIsSigningOut(true);
    setSignOutError(false);

    try {
      const revokeResponse = await fetch("/api/family-sso/revoke", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!revokeResponse.ok) throw new Error("FAMILY_SSO_REVOKE_FAILED");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setSignOutError(true);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="border-b border-sky-100 bg-white/86 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-2 text-sm font-black text-[var(--skolegps-deep-navy)] shadow-sm transition-all hover:border-sky-200"
          >
            <Mascot variant="head-only" size="xs" />
            SkoleGPS
          </Link>

          <button
            type="button"
            onClick={() => void handleLogUd()}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white/90 px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 md:hidden"
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? "Logger ud..." : "Log ud"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-sky-100 bg-white/75 p-1 shadow-sm">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = link.isActive(pathname);

              return (
                <Link key={link.href} href={link.href} className={getNavLinkClasses(isActive)}>
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAudio}
              aria-pressed={isPlaying}
              aria-label={isPlaying ? "Sluk baggrundslyd" : "Taend baggrundslyd"}
              title={isPlaying ? "Sluk baggrundslyd" : "Taend baggrundslyd"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white/90 text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 hover:text-emerald-900"
            >
              {isPlaying ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="sr-only">
                {isPlaying ? "Sluk baggrundslyd" : "Taend baggrundslyd"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogUd()}
              disabled={isSigningOut}
              className="hidden items-center gap-2 rounded-full border border-red-200 bg-white/90 px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 md:inline-flex"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? "Logger ud..." : "Log ud"}
            </button>
          </div>
        </div>
      </div>
      {signOutError ? (
        <p role="alert" className="mx-auto max-w-7xl px-4 pb-3 text-sm font-semibold text-red-700 md:px-8">
          Kunne ikke logge sikkert ud. Prøv igen.
        </p>
      ) : null}
    </header>
  );
}
