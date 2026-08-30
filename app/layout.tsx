import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { LandingNav } from "@/components/landing/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { MobileLoginButton } from "@/components/landing/mobile-login-button";
import { RouteProgressBar } from "@/components/page-transition";
import { RecoveryGuard } from "@/components/recovery-guard";
import { AnalyticsBeacon } from "@/components/analytics-beacon";

export const metadata: Metadata = {
  title: "NorthPay — Canadian Payroll. Finally Beautiful.",
  description:
    "The payroll system designed for modern Canadian businesses. Effortless. Compliant. Calm.",
  metadataBase: new URL("https://northpay.example"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        {/* A subtle top progress bar gives the "something's happening" cue
            on navigation. We deliberately do NOT wrap children in a keyed
            page-transition: pages are prerendered and switch instantly, and
            wrapping the sticky-scroll homepage in AnimatePresence broke its
            scroll measurement on soft navigation (blank until refresh). */}
        <RouteProgressBar />
        {/* Keeps a password-reset session locked to the reset screen — that
            session is real, so any nav would otherwise log the visitor in
            without a new password ever being set. */}
        <RecoveryGuard />
        {/* Cookieless, first-party page-view beacon. Public pages only. */}
        <AnalyticsBeacon />
        <LandingNav />
        <MobileLoginButton />
        {children}
        <MobileNav />
      </body>
    </html>
  );
}
