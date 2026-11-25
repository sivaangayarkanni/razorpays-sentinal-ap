import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PitchOnePager } from "@/components/PitchOnePager";

export const metadata: Metadata = {
  title: "Sentinel-AP — One-Page Pitch",
  description: "Smart security guardrail between AI buyer agents and Razorpay",
};

export default function PitchPage() {
  return (
    <>
      <Nav />
      <main className="page-enter mx-auto max-w-6xl px-4 py-8 md:py-12">
        <PitchOnePager />
      </main>
    </>
  );
}
