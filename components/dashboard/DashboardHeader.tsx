"use client";

import {
  Archive,
  BookOpen,
  CircleHelp,
  Home,
  LogOut,
  Menu,
  Settings,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAudio } from "@/contexts/AudioContext";
import { TEACHER_TOOL_FACEBOOK_GROUP_LINK } from "@/lib/teacherTools/community";
import { createClient } from "@/utils/supabase/client";

type NavLink = {
  href: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
  label: string;
};

const portalNavLinks: NavLink[] = [
  {
    href: "/dashboard",
    label: "Forside",
    icon: Home,
    isActive: (pathname) => pathname === "/dashboard",
  },
  {
    href: "/dashboard/laerervaerktoejer",
    label: "Værktøjer",
    icon: BookOpen,
    isActive: (pathname) => pathname.startsWith("/dashboard/laerervaerktoejer"),
  },
  {
    href: "/dashboard/arkiv",
    label: "Mine løb",
    icon: Archive,
    isActive: (pathname) => pathname.startsWith("/dashboard/arkiv"),
  },
  {
    href: "/hjaelp",
    label: "Hjælp",
    icon: CircleHelp,
    isActive: (pathname) => pathname === "/hjaelp",
  },
];

const legacyNavLinks: NavLink[] = [
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

function isTeacherPortalRoute(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname === "/dashboard/laerervaerktoejer" ||
    pathname.startsWith("/dashboard/laerervaerktoejer/oevekort")
  );
}

function getLegacyNavLinkClasses(isActive: boolean) {
  if (isActive) {
    return "inline-flex items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all";
  }

  return "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--skolegps-deep-navy)] transition-all hover:bg-sky-50";
}

function AudioControl() {
  const { isPlaying, toggleAudio } = useAudio();

  return (
    <button
      type="button"
      onClick={toggleAudio}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? "Sluk baggrundslyd" : "Tænd baggrundslyd"}
      title={isPlaying ? "Sluk baggrundslyd" : "Tænd baggrundslyd"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white/90 text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 hover:text-emerald-900"
    >
      {isPlaying ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      <span className="sr-only">{isPlaying ? "Sluk baggrundslyd" : "Tænd baggrundslyd"}</span>
    </button>
  );
}

function PortalNav({ onNavigate, pathname }: { onNavigate?: () => void; pathname: string }) {
  return (
    <nav aria-label="Lærernavigation" className="grid gap-1">
      {portalNavLinks.map((link) => {
        const Icon = link.icon;
        const active = link.isActive(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active}
            onClick={onNavigate}
            className="skolegps-teacher-portal-nav-link inline-flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
      <a
        href={TEACHER_TOOL_FACEBOOK_GROUP_LINK.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="skolegps-teacher-portal-nav-link inline-flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition"
      >
        <UsersRound className="h-5 w-5" aria-hidden="true" />
        Fællesskab
      </a>
    </nav>
  );
}

function BrandLink() {
  return (
    <Link href="/dashboard" className="inline-flex w-fit items-center rounded-2xl px-2 py-2 transition hover:bg-sky-50">
      <Image src="/skolegps-logo.svg" alt="SkoleGPS" width={198} height={56} priority className="h-auto w-36" />
    </Link>
  );
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const portalRoute = isTeacherPortalRoute(pathname);

  useEffect(() => {
    setIsMobileNavigationOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavigationOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsMobileNavigationOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileNavigationOpen]);

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

  if (portalRoute) {
    return (
      <>
        <aside className="skolegps-teacher-portal-sidebar fixed inset-y-0 left-0 z-40 hidden w-[17.25rem] flex-col px-4 py-5 lg:flex">
          <BrandLink />
          <div className="mt-8">
            <PortalNav pathname={pathname} />
          </div>
          <div className="mt-auto grid gap-2 pt-8">
            <Link
              href="/dashboard/indstillinger"
              className="skolegps-teacher-portal-nav-link inline-flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
              Indstillinger
            </Link>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white/80 px-3 py-2">
              <AudioControl />
              <button
                type="button"
                onClick={() => void handleLogUd()}
                disabled={isSigningOut}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {isSigningOut ? "Logger ud..." : "Log ud"}
              </button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/92 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <BrandLink />
            <div className="flex items-center gap-2">
              <AudioControl />
              <button
                type="button"
                aria-label={isMobileNavigationOpen ? "Luk menu" : "Åbn menu"}
                aria-expanded={isMobileNavigationOpen}
                aria-controls="teacher-portal-mobile-navigation"
                onClick={() => setIsMobileNavigationOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-800 shadow-sm"
              >
                {isMobileNavigationOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {isMobileNavigationOpen ? (
            <div id="teacher-portal-mobile-navigation" className="mt-3 rounded-2xl border border-sky-100 bg-white p-2 shadow-[0_18px_42px_rgba(7,26,58,0.14)]">
              <PortalNav pathname={pathname} onNavigate={() => setIsMobileNavigationOpen(false)} />
              <div className="mt-2 flex gap-2 border-t border-sky-100 pt-2">
                <Link
                  href="/dashboard/indstillinger"
                  onClick={() => setIsMobileNavigationOpen(false)}
                  className="skolegps-teacher-portal-nav-link inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Indstillinger
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogUd()}
                  disabled={isSigningOut}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {isSigningOut ? "Logger ud..." : "Log ud"}
                </button>
              </div>
            </div>
          ) : null}
        </header>
        {signOutError ? <p role="alert" className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-lg lg:left-[18.25rem] lg:right-auto">Kunne ikke logge sikkert ud. Prøv igen.</p> : null}
      </>
    );
  }

  return (
    <header className="border-b border-sky-100 bg-white/86 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center justify-between gap-3">
          <BrandLink />
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
            {legacyNavLinks.map((link) => {
              const Icon = link.icon;
              const active = link.isActive(pathname);
              return (
                <Link key={link.href} href={link.href} className={getLegacyNavLinkClasses(active)}>
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <AudioControl />
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
      {signOutError ? <p role="alert" className="mx-auto max-w-7xl px-4 pb-3 text-sm font-semibold text-red-700 md:px-8">Kunne ikke logge sikkert ud. Prøv igen.</p> : null}
    </header>
  );
}
