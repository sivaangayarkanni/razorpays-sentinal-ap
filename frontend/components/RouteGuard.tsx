"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ChangePasswordForm, useAdminToken } from "@/components/AuthGate";
import { LoadingScreen } from "@/components/ui";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/status" || pathname.startsWith("/status/");
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  const router = useRouter();
  const auth = useAdminToken();
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (!auth.ready || publicPath) return;
    if (!auth.token) {
      clearSessionCookie();
      const next = pathname + (search?.toString() ? `?${search.toString()}` : "");
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setSessionCookie();
  }, [auth.ready, auth.token, pathname, publicPath, router, search]);

  if (publicPath) {
    return <>{children}</>;
  }

  if (!auth.ready || !auth.token) {
    return (
      <>
        <Nav />
        <LoadingScreen />
      </>
    );
  }

  if (auth.mustChange) {
    return (
      <>
        <Nav />
        <ChangePasswordForm
          token={auth.token}
          forced
          onChanged={(tok) => {
            auth.acceptSession(tok, false);
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}
