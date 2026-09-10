"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, X, Shield } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/#pitch", label: "Pitch" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/policies", label: "Policies" },
  { href: "/bank-health", label: "Bank Health" },
  { href: "/queue", label: "Queue" },
  { href: "/playground", label: "Playground" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
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

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sentinel-500 to-sentinel-700 text-white shadow-glow ring-1 ring-white/10 transition group-hover:brightness-110">
            <Shield className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[15px]">
            Sentinel<span className="text-sentinel-400">-AP</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {links.map((l) => {
            const active =
              l.href === "/#pitch"
                ? false
                : l.href === "/"
                  ? path === "/"
                  : path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-white/[0.08] text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                )}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/playground" className="btn-primary hidden text-xs sm:inline-flex md:text-sm">
            Try Demo
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
        <div className="border-t border-white/[0.08] bg-ink/95 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {links.map((l) => {
              const active = path === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-white/[0.08] text-white" : "text-slate-300 hover:bg-white/[0.04]"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link href="/playground" className="btn-primary mt-2 w-full sm:hidden">
              Try Demo
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
