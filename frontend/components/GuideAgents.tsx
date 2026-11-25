"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { MessageCircle, X } from "lucide-react";

type GuideId = "scout" | "watcher" | "runner" | "audit";

type Guide = {
  id: GuideId;
  name: string;
  role: string;
  emoji: string;
  accent: string;
  ring: string;
  bg: string;
  tip: string;
  section: string;
  ctaHref?: string;
  ctaLabel?: string;
};

const GUIDES: Guide[] = [
  {
    id: "scout",
    name: "Policy Scout",
    role: "Gate 1 guide",
    emoji: "🧭",
    accent: "text-rose-600",
    ring: "ring-rose-400/40",
    bg: "from-rose-100 to-rose-50",
    tip: "I hard-block overspend & bad SKUs before money moves. Check Dual-gate → Gate 1.",
    section: "gates",
  },
  {
    id: "watcher",
    name: "Rail Watcher",
    role: "Gate 2 guide",
    emoji: "📡",
    accent: "text-amber-700",
    ring: "ring-amber-400/40",
    bg: "from-amber-100 to-amber-50",
    tip: "Bank rails looking shaky? I soft-fail to a queue — never lose the intent.",
    section: "gates",
  },
  {
    id: "runner",
    name: "Razorpay Runner",
    role: "Dispatch guide",
    emoji: "⚡",
    accent: "text-lavender-700",
    ring: "ring-sentinel-400/40",
    bg: "from-sentinel-100 to-sentinel-50",
    tip: "When both gates pass, I mint Razorpay Orders in paise.",
    section: "cta",
    ctaHref: "/integrate",
    ctaLabel: "Integration guide",
  },
  {
    id: "audit",
    name: "Audit Buddy",
    role: "Pitch & trail",
    emoji: "📋",
    accent: "text-lavender-700",
    ring: "ring-lavender-400/40",
    bg: "from-lavender-100 to-lavender-50",
    tip: "Every decision leaves a trail. Scroll the pitch deck for the story in 90 seconds.",
    section: "pitch",
    ctaHref: "/integrate",
    ctaLabel: "Jump to Pitch",
  },
];

const SECTION_TIPS: Record<string, GuideId> = {
  hero: "scout",
  pitch: "audit",
  architecture: "watcher",
  gates: "scout",
  cta: "runner",
};

function AvatarCircle({
  guide,
  size = "md",
  active,
  onClick,
}: {
  guide: Guide;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  onClick?: () => void;
}) {
  const dim =
    size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-9 w-9 text-base" : "h-11 w-11 text-xl";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={onClick ? `Hear from ${guide.name}, ${guide.role}` : undefined}
      className={clsx(
        "relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-2 transition",
        guide.bg,
        guide.ring,
        dim,
        onClick && "cursor-pointer hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sentinel-400",
        active && "scale-110 shadow-glow"
      )}
    >
      <span aria-hidden>{guide.emoji}</span>
      {active && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-sentinel-400 animate-pulse-soft"
          aria-hidden
        />
      )}
    </Comp>
  );
}

export function GuideAgents() {
  const [activeId, setActiveId] = useState<GuideId>("scout");
  const [dismissed, setDismissed] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [section, setSection] = useState("hero");

  const active = useMemo(
    () => GUIDES.find((g) => g.id === activeId) ?? GUIDES[0],
    [activeId]
  );

  const onScroll = useCallback(() => {
    const ids = ["hero", "pitch", "architecture", "gates", "cta"];
    let current = "hero";
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.45) current = id;
    }
    setSection(current);
    const tipGuide = SECTION_TIPS[current];
    if (tipGuide && !dismissed) setActiveId(tipGuide);
  }, [dismissed]);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Hero coach row */}
      <div
        className="mx-auto mt-10 max-w-3xl"
        role="region"
        aria-label="Sentinel guide assistants"
      >
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
          Your guides on this tour
        </p>
        <div className="flex flex-wrap items-start justify-center gap-4 md:gap-6">
          {GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setActiveId(g.id);
                setDismissed(false);
                setDockOpen(true);
                scrollToSection(g.section === "pitch" ? "pitch" : g.section);
              }}
              className={clsx(
                "group flex w-[7.5rem] flex-col items-center gap-2 rounded-2xl border p-3 text-center transition",
                activeId === g.id && !dismissed
                  ? "border-sentinel-500/40 bg-sentinel-50 shadow-card"
                  : "border-line bg-surface hover:border-line hover:bg-surface"
              )}
              aria-pressed={activeId === g.id && !dismissed}
              aria-label={`${g.name} — ${g.role}. ${g.tip}`}
            >
              <AvatarCircle guide={g} size="lg" active={activeId === g.id && !dismissed} />
              <span className={clsx("text-xs font-semibold", g.accent)}>{g.name}</span>
              <span className="text-[10px] leading-tight text-fg-subtle">{g.role}</span>
            </button>
          ))}
        </div>

        {!dismissed && (
          <div className="mx-auto mt-5 max-w-md animate-bubble-in" key={active.id}>
            <div className="speech-bubble" role="status" aria-live="polite">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-base" aria-hidden>
                  {active.emoji}
                </span>
                <span className={clsx("text-xs font-bold", active.accent)}>{active.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  · {active.role}
                </span>
              </div>
              <p className="text-fg">{active.tip}</p>
              {active.ctaHref && (
                <Link
                  href={active.ctaHref}
                  className="mt-2 inline-flex text-xs font-semibold text-sentinel-700 hover:text-sentinel-700"
                >
                  {active.ctaLabel} →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating guide dock */}
      <div className="guide-dock max-md:bottom-20" aria-label="Floating guide dock">
        {dockOpen && !dismissed && (
          <div
            className="mb-1 w-[min(18rem,calc(100vw-2.5rem))] animate-bubble-in"
            key={`dock-${active.id}-${section}`}
          >
            <div className="speech-bubble !pb-3">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AvatarCircle guide={active} size="sm" active />
                  <div>
                    <p className={clsx("text-xs font-bold", active.accent)}>{active.name}</p>
                    <p className="text-[10px] text-fg-subtle">Watching · {section}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-fg-subtle hover:bg-surface hover:text-fg"
                  aria-label="Dismiss tip"
                  onClick={() => setDismissed(true)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs leading-relaxed text-fg-muted">{active.tip}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-1.5">
          {dockOpen &&
            GUIDES.map((g) => (
              <AvatarCircle
                key={g.id}
                guide={g}
                size="sm"
                active={g.id === activeId && !dismissed}
                onClick={() => {
                  setActiveId(g.id);
                  setDismissed(false);
                }}
              />
            ))}
          <button
            type="button"
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-full border shadow-glow transition",
              dockOpen
                ? "border-sentinel-500/40 bg-sentinel-50 text-sentinel-700"
                : "border-line bg-white text-fg-muted hover:border-sentinel-500/40"
            )}
            aria-label={dockOpen ? "Hide guide dock" : "Show guide assistants"}
            aria-expanded={dockOpen}
            onClick={() => {
              setDockOpen((v) => !v);
              if (!dockOpen) setDismissed(false);
            }}
          >
            {dockOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

/** Inline section coach mark — optional marker near gates/cta */
export function SectionCoach({
  guideId,
  className,
}: {
  guideId: GuideId;
  className?: string;
}) {
  const guide = GUIDES.find((g) => g.id === guideId);
  if (!guide) return null;
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1",
        className
      )}
      aria-label={`${guide.name} tip`}
    >
      <span className="text-sm" aria-hidden>
        {guide.emoji}
      </span>
      <span className={clsx("text-[11px] font-medium", guide.accent)}>{guide.name}</span>
    </div>
  );
}

export { GUIDES };
export type { GuideId };
