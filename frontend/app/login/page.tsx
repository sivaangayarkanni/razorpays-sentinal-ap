"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { LoadingScreen } from "@/components/ui";
import { safeNextPath, setSessionCookie } from "@/lib/session";
import { Suspense } from "react";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAdminToken();
  const dest = safeNextPath(params.get("next")) || "/dashboard";

  useEffect(() => {
    if (!auth.ready) return;
    if (auth.token) {
      setSessionCookie();
      router.replace(dest);
    }
  }, [auth.ready, auth.token, dest, router]);

  if (!auth.ready || auth.token) {
    return (
      <>
        <Nav />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <Nav />
      <LoginForm
        defaultEmail="admin@sentinel-ap.local"
        onLogin={(token, mustChange) => {
          auth.acceptSession(token, mustChange);
          router.replace(dest);
        }}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <>
          <Nav />
          <LoadingScreen />
        </>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
