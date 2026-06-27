"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  FileText,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ease = [0.22, 1, 0.36, 1] as const;

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip pt-32 pb-24">
      {/* Soft ambient gradient — same vocabulary as the landing hero */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-rose-200/35 via-sky-200/25 to-emerald-200/35 blur-3xl dark:from-rose-500/10 dark:via-sky-500/10 dark:to-emerald-500/10" />
        <div className="absolute left-1/2 top-72 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-200/25 to-amber-100/30 blur-3xl dark:from-indigo-500/10 dark:to-amber-500/10" />
      </div>

      <div className="container relative">
        <Header />
        <Story />
        <Founders />
        <ContactForm />
        <LegalSection />
      </div>
    </main>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────
function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease }}
      className="mx-auto max-w-3xl text-center"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md">
        About NorthPay
      </span>
      <h1 className="mt-6 text-balance text-[clamp(2.4rem,5.6vw,4.4rem)] font-semibold leading-[1.04] tracking-tightest">
        A calmer way to run
        <br />
        <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground/50 bg-clip-text text-transparent">
          Canadian payroll.
        </span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-balance text-[17px] leading-relaxed text-muted-foreground">
        Built by two people who got tired of payroll software designed in 2008.
        We work hard to keep the numbers clear and the experience calm — but the
        final call always stays with you. Run your own checks before you rely on
        anything here.
      </p>
    </motion.div>
  );
}

// ─── Story / What we do ──────────────────────────────────────────────────
function Story() {
  const points = [
    {
      title: "Updated for 2026",
      copy: "We keep our calculations aligned with the latest federal and provincial figures for the 2026 tax year. Rules change often, so treat every update as a helpful starting point — not the final word.",
    },
    {
      title: "End to end",
      copy: "Run payroll, generate paystub PDFs, prepare your remittance summaries, and produce year-end slips — all in one calm place, with your numbers always exportable.",
    },
    {
      title: "Quiet by default",
      copy: "Soft motion, generous spacing, real typography. A payroll tool you don't dread opening on a Friday afternoon.",
    },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease }}
      className="mx-auto mt-24 grid max-w-5xl gap-5 md:grid-cols-3"
    >
      {points.map((p) => (
        <div
          key={p.title}
          className="glass-strong rounded-2xl p-6 shadow-soft"
        >
          <h3 className="text-[15px] font-semibold tracking-tight">{p.title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            {p.copy}
          </p>
        </div>
      ))}
    </motion.section>
  );
}

// ─── Founders ────────────────────────────────────────────────────────────
function Founders() {
  const team = [
    {
      name: "Rajbir Bal",
      role: "Co-founder · Product & Engineering",
      bio: "Builds the calculation engine and the dashboard. Cares about millisecond paystub rendering more than most people care about anything.",
      initials: "RB",
      tint: "from-rose-200 to-amber-200 dark:from-rose-500/40 dark:to-amber-500/40",
    },
    {
      name: "Nandan Panchal",
      role: "Co-founder · Design & Operations",
      bio: "Designs every screen and the way it feels in your hand. Spent years inside spreadsheet payroll tools — that's the energy we're refusing.",
      initials: "NP",
      tint: "from-sky-200 to-indigo-200 dark:from-sky-500/40 dark:to-indigo-500/40",
    },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease }}
      className="mx-auto mt-28 max-w-5xl"
    >
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md">
          The Team
        </span>
        <h2 className="mt-5 text-balance text-[clamp(1.8rem,3.8vw,2.6rem)] font-semibold leading-[1.1] tracking-tightest">
          The two people behind NorthPay.
        </h2>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {team.map((m) => (
          <div
            key={m.name}
            className="glass-strong flex items-start gap-5 rounded-2xl p-6 shadow-soft"
          >
            <div
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${m.tint} text-[15px] font-semibold text-foreground`}
            >
              {m.initials}
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold tracking-tight">
                {m.name}
              </h3>
              <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                {m.role}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                {m.bio}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ─── Contact form ────────────────────────────────────────────────────────
function ContactForm() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(form: FormData) {
    const next: Record<string, string> = {};
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Looks like that's not a valid email.";
    if (!phone) next.phone = "Phone number is required.";
    else if (phone.replace(/\D/g, "").length < 7)
      next.phone = "Please include a usable phone number.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setStatus("submitting");
    // No backend yet — pretend the message went through. When wiring up an
    // endpoint, POST `Object.fromEntries(form)` to it and surface the result.
    await new Promise((r) => setTimeout(r, 900));
    setStatus("sent");
    (e.currentTarget as HTMLFormElement).reset();
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease }}
      className="mx-auto mt-28 max-w-5xl"
    >
      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        {/* Left: pitch + direct contacts */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md">
            Get in touch
          </span>
          <h2 className="mt-5 text-balance text-[clamp(1.8rem,3.8vw,2.6rem)] font-semibold leading-[1.1] tracking-tightest">
            Questions, ideas, or just a hello.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            We read every message and reply personally — usually within a day.
            If you&rsquo;re evaluating NorthPay for your business, mention your
            province and team size so we can point you at the right things.
          </p>
          <div className="mt-8 space-y-3 text-[14px]">
            <ContactLine
              icon={Mail}
              label="Email"
              value="hello@northpay.ca"
              href="mailto:hello@northpay.ca"
            />
            <ContactLine
              icon={Phone}
              label="Phone"
              value="+1 (647) 555-0188"
              href="tel:+16475550188"
            />
            <ContactLine
              icon={MapPin}
              label="Office"
              value="Toronto, Ontario"
            />
          </div>
        </div>

        {/* Right: query form */}
        <form
          onSubmit={handleSubmit}
          className="glass-strong rounded-3xl p-6 shadow-soft md:p-8"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Your name">
              <Input name="name" />
            </Field>
            <Field label="Company">
              <Input name="company" />
            </Field>
            <Field label="Email" required error={errors.email}>
              <Input
                name="email"
                type="email"
                inputMode="email"
                aria-invalid={!!errors.email}
              />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                aria-invalid={!!errors.phone}
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="What can we help with?">
              <textarea
                name="message"
                rows={5}
                className="flex w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[14px] leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              Email and phone are required — we never share your details.
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={status === "submitting" || status === "sent"}
              className="group"
            >
              {status === "submitting" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {status === "sent" && <Check className="h-4 w-4" />}
              {status === "idle" && (
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              )}
              {status === "sent" ? "Message sent" : "Send message"}
            </Button>
          </div>
          {status === "sent" && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-emerald-200/40 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              Thanks — we&rsquo;ll get back to you shortly at the email you
              provided.
            </motion.p>
          )}
        </form>
      </div>
    </motion.section>
  );
}

function ContactLine({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <span className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 px-4 py-3 backdrop-blur-md transition-colors hover:bg-background/80">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-foreground/[0.06] text-foreground dark:bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-[14px] font-medium text-foreground">
          {value}
        </span>
      </span>
    </span>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-[12px] text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Legal / disclaimers / privacy ───────────────────────────────────────
// Plain-English, calmly worded — not a substitute for a lawyer's review
// before public launch, but covers the basics any payroll SaaS should
// surface: accuracy disclaimer, "verify before filing", limitation of
// liability, what data is collected, and how it's stored.
function LegalSection() {
  return (
    <motion.section
      id="legal"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease }}
      className="mx-auto mt-28 max-w-5xl scroll-mt-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md">
          Legal &amp; privacy
        </span>
        <h2 className="mt-5 text-balance text-[clamp(1.8rem,3.8vw,2.6rem)] font-semibold leading-[1.1] tracking-tightest">
          The fine print, written like we&rsquo;d want to read it.
        </h2>
        <p className="mx-auto mt-5 text-[15px] leading-relaxed text-muted-foreground">
          Payroll touches money, taxes, and people&rsquo;s livelihoods. Please
          read these notes before you trust any number that comes out of
          NorthPay.
        </p>
      </div>

      {/* High-priority disclaimer — visually pulled out so nobody scrolls
          past it. Amber-tinted to read as "warning, but not scary". */}
      <div className="mt-10 rounded-2xl border border-amber-300/50 bg-amber-50 p-6 shadow-soft dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-200/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold tracking-tight text-amber-950 dark:text-amber-100">
              Always do your own checks before you file or pay.
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
              NorthPay is built to help you work faster — not to replace your own
              judgment. Tax rules shift, edge cases exist, and no software is
              flawless. <strong>Please don&rsquo;t rely on this website on its
              own.</strong> Verify every figure against your own records, and
              confirm anything important with a qualified payroll professional or
              accountant before you file or pay. You remain fully responsible for
              the accuracy of everything that leaves your hands.
            </p>
          </div>
        </div>
      </div>

      {/* Detail cards — same vocabulary as the Story trio above */}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <LegalCard
          icon={ShieldCheck}
          title="Accuracy &amp; limitation of liability"
        >
          NorthPay is provided <em>as is</em>, without warranty of any kind. We
          can&rsquo;t guarantee that any calculation, deduction, or generated
          document is free of error. To the fullest extent the law allows,
          NorthPay and its founders are not liable for any loss, penalty,
          charge, or other damage arising from your use of the platform —
          including reliance on any number, paystub, slip, or report it
          produces. Always confirm the details yourself first.
        </LegalCard>

        <LegalCard icon={FileText} title="Not professional advice">
          Nothing on NorthPay is tax, accounting, or legal advice. Our
          calculators and templates are convenience tools, not a substitute
          for a qualified professional who knows your situation. We don&rsquo;t
          currently support payroll in Quebec — if you operate there, please
          use a service set up for it.
        </LegalCard>

        <LegalCard icon={Lock} title="What we collect &amp; why">
          To run payroll we collect company details, employee profiles
          (including the pay and tax details you enter), and the pay-period
          inputs you record. The form on this page collects your name, email,
          phone, company, and message so we can reply to you. We do not sell,
          rent, or trade your data, and we never use payroll inputs for
          marketing.
        </LegalCard>

        <LegalCard icon={Scale} title="How long we keep your data">
          We keep operational records for as long as applicable record-keeping
          rules require, and then remove them on request. You can export your
          data at any time, and you can ask us to delete your account and its
          data by emailing the address below.
        </LegalCard>
      </div>

      {/* Footnote */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-background/40 px-6 py-5 text-[13px] leading-relaxed text-muted-foreground backdrop-blur-md">
        <p>
          <strong className="font-semibold text-foreground">
            Privacy questions or a data request?
          </strong>{" "}
          Email{" "}
          <a
            href="mailto:privacy@northpay.ca"
            className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            privacy@northpay.ca
          </a>{" "}
          and we&rsquo;ll do our best to respond promptly. By using NorthPay you
          agree to these terms; if anything here changes materially, we&rsquo;ll
          post a notice on this page.
        </p>
        <p className="mt-3 text-[12px] text-muted-foreground/80">
          Last updated: June 2026 · NorthPay is a Canadian product built in
          Toronto, Ontario. © {new Date().getFullYear()} NorthPay. All rights
          reserved.
        </p>
      </div>
    </motion.section>
  );
}

function LegalCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-strong rounded-2xl p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-foreground/[0.06] text-foreground dark:bg-white/10">
          <Icon className="h-4 w-4" />
        </span>
        <h3
          className="text-[15px] font-semibold tracking-tight"
          dangerouslySetInnerHTML={{ __html: title }}
        />
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
