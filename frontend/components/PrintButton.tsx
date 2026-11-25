"use client";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-secondary text-xs print-hide" onClick={() => window.print()}>
      {label}
    </button>
  );
}
