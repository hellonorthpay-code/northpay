import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { LandingNav } from "@/components/landing/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { MobileLoginButton } from "@/components/landing/mobile-login-button";
import { RouteProgressBar } from "@/components/page-transition";
import { RecoveryGuard } from "@/components/recovery-guard";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const TITLE = "NorthPay — Canadian Payroll. Finally Beautiful.";
const DESCRIPTION =
  "The payroll system designed for modern Canadian businesses. Effortless. Compliant. Calm.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Was "https://northpay.example" — a placeholder. Next resolves every
  // relative canonical and Open Graph URL against this, so the live site has
  // been advertising a domain nobody owns.
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
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
