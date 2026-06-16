"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const titles: Record<string, { title: string; sub: string }> = {
  "/dashboard/employees": {
    title: "Employees",
    sub: "Your team — send paystubs, T4s, or just keep things tidy.",
  },
  "/dashboard/payroll": {
    title: "Payroll",
    sub: "Review, run, and reconcile a pay period in one click.",
  },
  "/dashboard/cra": {
    title: "CRA",
    sub: "Monthly remittances, T4s, and year-end filings.",
  },
  "/dashboard/settings": {
    title: "Settings",
    sub: "Company, CRA, and appearance preferences.",
  },
  "/dashboard/profile": {
    title: "My profile",
    sub: "Your name, contact, and account preferences.",
  },
  "/dashboard/reset-password": {
    title: "Reset password",
    sub: "Choose a new password for your account.",
  },
};

export function Topbar() {
  const pathname = usePathname();
  const meta = titles[pathname] ?? titles["/dashboard/employees"];

  return (
    <header className="flex items-center gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-semibold leading-none tracking-tightest md:text-[28px]">
          {meta.title}
        </h1>
        <p className="mt-1.5 hidden truncate text-[13.5px] text-muted-foreground md:block">
          {meta.sub}
        </p>
      </div>
    </header>
  );
}
