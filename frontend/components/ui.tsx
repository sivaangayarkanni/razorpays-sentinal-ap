import clsx from "clsx";
import { Inbox, AlertTriangle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-slate-400 md:text-[15px]">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "text-white",
  hint,
  loading,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  hint?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="panel !p-4">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton mt-3 h-7 w-20" />
      </div>
    );
  }
  return (
    <div className="panel !p-4 transition hover:border-white/15">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={clsx("mt-1.5 text-2xl font-bold tabular-nums tracking-tight", tone)}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {message}
    </div>
  );
}

export function InfoBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-4 rounded-xl border border-sentinel-500/25 bg-sentinel-500/10 px-4 py-3 text-sm text-sentinel-200"
    >
      {message}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="panel !p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton h-5 w-20" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton ml-auto h-3 w-28" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="skeleton h-12 flex-1" />
            <div className="skeleton h-12 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-4 w-72" />
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel !p-4">
            <div className="skeleton h-3 w-14" />
            <div className="skeleton mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <SkeletonRows rows={3} />
    </div>
  );
}
