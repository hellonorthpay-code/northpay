"use client";

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
};

export function Topbar() {
  const pathname = usePathname();
  const meta = titles[pathname] ?? titles["/dashboard/employees"];

  return (
    <header className="flex items-center gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[28px] font-semibold leading-none tracking-tightest">
          {meta.title}
        </h1>
        <p className="mt-1.5 truncate text-[13.5px] text-muted-foreground">
          {meta.sub}
        </p>
      </div>
    </header>
  );
}
