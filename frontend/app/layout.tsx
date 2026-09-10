import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel-AP — AI Agent Payment Guardrails",
  description:
    "Smart Security Guardrail middleware between Autonomous AI Agents and Razorpay Payment Gateway",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
