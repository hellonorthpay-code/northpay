import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { LandingNav } from "@/components/landing/nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export const metadata: Metadata = {
  title: "NorthPay — Canadian Payroll. Finally Beautiful.",
  description:
    "The payroll system designed for modern Canadian businesses. Effortless. Compliant. Calm.",
  metadataBase: new URL("https://northpay.example"),
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
        <LandingNav />
        {children}
        <MobileNav />
      </body>
    </html>
  );
}
