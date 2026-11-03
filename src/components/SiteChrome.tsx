"use client";

import { Compass, Home, MapPinned, Plane, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWander } from "./WanderProvider";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/explore", label: "Explore My City", short: "Explore", icon: Compass },
  { href: "/somewhere", label: "Take Me Somewhere", short: "Travel", icon: Plane },
  { href: "/adventures", label: "My Adventures", short: "Adventures", icon: MapPinned },
  { href: "/home-base", label: "Home Base", short: "Home Base", icon: Home },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 group" aria-label="WANDER home">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <circle cx="16" cy="16" r="15" className={light ? "fill-white/10" : "fill-plum"} />
        <path d="M7 21 L13 11 L17 17 L20 13 L25 21 Z" className="fill-lilac" />
        <circle cx="21.5" cy="9.5" r="2.5" className="fill-orchid" />
      </svg>
      <span className={cn("font-display text-xl font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>WANDER</span>
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const { user, profile } = useWander();
  return (
    <header className="sticky top-0 z-[1100] bg-white/70 backdrop-blur-xl backdrop-saturate-150 border-b border-line/60">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-3.5 py-2 rounded-full text-sm font-medium transition-colors",
                  active ? "bg-plum text-white shadow-card" : "text-ink-soft hover:bg-mist hover:text-plum",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/home-base" className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
          <span className="hidden sm:inline max-w-40 truncate">{profile.homeBase ? profile.homeBase.label : "Set Home Base"}</span>
          <span className="size-9 rounded-full bg-mist text-plum grid place-items-center border border-line">
            <UserRound className="size-4" />
          </span>
          <span className="sr-only">{user ? "Account" : "Sign in"}</span>
        </Link>
      </div>
    </header>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-[1100] bg-white/85 backdrop-blur-xl border-t border-line/70 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <div className="grid grid-cols-4">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-orchid" : "text-muted")}>
              <Icon className="size-5" />
              {n.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
