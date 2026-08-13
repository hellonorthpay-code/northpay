"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isRecovery, RESET_PATH } from "@/lib/auth/recovery";

/**
 * While a password-reset (recovery) session is open, keep the visitor on the
 * reset screen. The recovery session is a real session, so without this a
 * single nav tap would drop them into the app without ever setting a
 * password. Mounted once in the root layout.
 */
export function RecoveryGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const active = isRecovery();
    setLocked(active);
    if (active && pathname !== RESET_PATH) {
      router.replace(RESET_PATH);
    }
  }, [pathname, router]);

  // Belt and braces: if a route somehow renders before the redirect lands,
  // don't let its content flash behind the reset screen.
  if (locked && pathname !== RESET_PATH) {
    return <div className="fixed inset-0 z-[100] bg-background" />;
  }
  return null;
}
