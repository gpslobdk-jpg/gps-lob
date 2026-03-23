"use client";

import { Home, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

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
    href: "/dashboard/indstillinger",
    label: "Indstillinger",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith("/dashboard/indstillinger"),
  },
];

function getNavLinkClasses(isActive: boolean) {
  if (isActive) {
    return "inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all";
  }

  return "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-emerald-900 transition-all hover:bg-emerald-50";
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogUd = async () => {
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="border-b border-white/70 bg-white/80 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold tracking-wide text-emerald-950 shadow-sm transition-all hover:border-emerald-300 hover:bg-white"
          >
            GPS Løb
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
          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-emerald-100 bg-white/75 p-1 shadow-sm">
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
    </header>
  );
}
