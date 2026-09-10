import clsx from "clsx";

const map: Record<string, string> = {
  ALLOW: "badge-allow",
  HARD_BLOCK: "badge-block",
  QUEUED: "badge-queue",
  CLEARED: "badge-clear",
  FAILED: "badge-fail",
  PENDING: "badge-queue",
  PROCESSING: "badge-queue",
  RETRYING: "badge-queue",
  COMPLETED: "badge-clear",
  CANCELLED: "badge-fail",
  ACTIVE: "badge-allow",
  INACTIVE: "badge-fail",
  HEALTHY: "badge-allow",
  DEGRADED: "badge-queue",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cls = map[status] || "badge-fail";
  return (
    <span className={clsx("badge", cls, className)} title={status}>
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          status === "ALLOW" || status === "COMPLETED" || status === "ACTIVE" || status === "HEALTHY"
            ? "bg-emerald-400"
            : status === "HARD_BLOCK" || status === "FAILED" || status === "CANCELLED" || status === "INACTIVE"
              ? "bg-rose-400"
              : status === "CLEARED"
                ? "bg-sky-400"
                : "bg-amber-400 animate-pulse-soft"
        )}
        aria-hidden
      />
      {status.replace(/_/g, " ")}
    </span>
  );
}
