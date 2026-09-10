export function StatusBadge({ status }: { status: string }) {
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
  };
  const cls = map[status] || "badge-fail";
  return <span className={`badge ${cls}`}>{status.replace("_", " ")}</span>;
}
