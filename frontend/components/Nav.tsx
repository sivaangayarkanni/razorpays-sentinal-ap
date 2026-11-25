"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, X, Shield } from "lucide-react";
import { ADMIN_TOKEN_KEY } from "@/lib/api";
import { ServerStatusBadge } from "@/components/SystemStatus";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pay", label: "New payment" },
  { href: "/policies", label: "Policies" },
  { href: "/agents", label: "API keys" },
  { href: "/bank-health", label: "Bank Health" },
  { href: "/queue", label: "Queue" },
  { href: "/integrate", label: "Integrate" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    const sync = () => setSignedIn(Boolean(localStorage.getItem(ADMIN_TOKEN_KEY)));
    sync();
    window.addEventListener("sentinel:unauthorized", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sentinel:unauthorized", sync);
      window.removeEventListener("storage", sync);
    };
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const ctaHref = signedIn ? "/dashboard" : "/dashboard";
  const ctaLabel = signedIn ? "Console" : "Sign in";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur-xl nav-glow">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sentinel-400 to-link text-white shadow-glow ring-1 ring-white/30 transition group-hover:brightness-110">
            <Shield className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[15px]">
            Sentinel<span className="text-sentinel-400">-AP</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? path === "/"
                : path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-surface text-fg shadow-sm ring-1 ring-line"
                    : "text-fg-muted hover:bg-surface hover:text-fg"
                )}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ServerStatusBadge compact />
          <Link href={ctaHref} className="btn-primary hidden text-xs sm:inline-flex md:text-sm">
            {ctaLabel}
          </Link>
          <button
            type="button"
            className="btn-ghost !px-2.5 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {links.map((l) => {
              const active = path === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-surface text-fg" : "text-fg-muted hover:bg-surface"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link href={ctaHref} className="btn-primary mt-2 w-full sm:hidden">
              {ctaLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
