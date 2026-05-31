# NorthPay

> Canadian payroll. Finally beautiful.

A premium payroll SaaS built for modern Canadian businesses outside Quebec.
Apple-inspired interface, calm motion, real CRA-grade math.

## Quick start

```bash
cd northpay
npm install
npm run dev
```

Open http://localhost:3000.

- Landing page → http://localhost:3000
- App → http://localhost:3000/dashboard
- "Start tracking" on the landing animates into the dashboard.

## What's included

### Landing page
Hero with floating gradient + animated payroll cards, six-feature grid,
automation flow, province coverage list, paystub preview, employees rail,
and footer. Subtle GPU-friendly motion via Framer Motion.

### Dashboard (4 tabs only)
1. **Employees** — Apple-styled cards, add-employee modal with grouped sections.
2. **Payroll** — Live preview, one-click run with animated calculating trace,
   per-employee breakdown.
3. **Paystubs** — Wallet-style cards, iOS sheet modal for detail, print + download.
4. **Settings** — Company, payroll defaults, theme, notifications.

### Payroll engine
Located in `lib/payroll/`. Modular and scalable.

| File | Purpose |
| --- | --- |
| `constants.ts` | 2026 CRA constants (CPP, EI, federal/provincial brackets, BPA) |
| `federal-tax.ts` | Federal income tax with bracketed calculation + BPA credit |
| `provincial-tax.ts` | Per-province tax + Ontario surtax |
| `cpp.ts` | CPP1 + CPP2 (tiered above YMPE) |
| `ei.ts` | EI premium + employer match (1.4×) |
| `engine.ts` | Orchestrator: gross → net per period |
| `types.ts` | All shared interfaces |

### Stores
Zustand + `localStorage` persistence (`lib/store/`):
- `employees` — seeded with four sample employees
- `payroll` — payroll-run history
- `settings` — company, theme, notifications

## Tech

- **Next.js 14** App Router · TypeScript
- **Tailwind CSS** with custom design tokens + dark mode
- **Framer Motion** for spring + ease-out transitions
- **Radix UI** primitives behind Shadcn-style components
- **Zustand** with `persist` middleware

## Notes on tax accuracy

The 2026 CRA T4127 (Payroll Deductions Formulas) is typically published in
Q4 2025. Where 2026 numbers are not finalized, this scaffold uses confirmed
2025 brackets with conservative indexation. Update `lib/payroll/constants.ts`
when the official 2026 tables are released.

This is a working scaffold. **Always verify with an accountant before filing
real-world remittances.**

## Architecture map

```
app/
├── layout.tsx           Root layout + theme script
├── globals.css          Design tokens, glass utilities, dark mode
├── page.tsx             Landing page
└── dashboard/
    ├── layout.tsx       Sidebar + top bar + transition shell
    ├── page.tsx         → redirects to /employees
    ├── employees/page.tsx
    ├── payroll/page.tsx
    ├── paystubs/page.tsx
    └── settings/page.tsx

components/
├── landing/             Hero, features, automation, provinces, paystub, employees, footer
├── dashboard/           4-tab views + sidebar + topbar
└── ui/                  Button, Input, Select, Dialog, Switch, Card, Badge, ...

lib/
├── payroll/             Engine + tax modules + constants + types
├── store/               Zustand stores (employees, payroll, settings)
└── utils.ts             cn(), formatCAD, formatDate, uid
```

## Adding a new province

1. Add the province code to `SUPPORTED_PROVINCES` in `lib/payroll/types.ts`.
2. Add a `ProvincialTaxConfig` entry to `PROVINCIAL_TAX` in `lib/payroll/constants.ts`.
3. Add an entry to `OVERTIME_WEEKLY_HOURS`.
4. Add a name in `PROVINCE_NAMES`.

That's it — the engine, UI, and forms pick it up automatically.

## License

UNLICENSED — internal prototype.
