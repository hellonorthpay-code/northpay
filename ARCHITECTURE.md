# NorthPay — Stability + Accuracy Layer

This document describes the correctness-first architecture introduced
on top of the original UI-driven prototype. It covers what changed,
how the layers interact, and how to migrate to a real backend without
touching UI code.

---

## 1. Folder structure

```
northpay/
├── app/                          # Next.js routes (UNCHANGED layout/design)
│   ├── page.tsx                  # Landing
│   └── dashboard/
│       ├── layout.tsx            # + useHydrateStores() on mount
│       ├── employees/page.tsx
│       ├── payroll/page.tsx
│       ├── paystubs/page.tsx
│       └── settings/page.tsx
│
├── components/                   # UNCHANGED (visual layer)
│   ├── landing/
│   ├── dashboard/
│   └── ui/
│
├── lib/
│   ├── payroll/                  # Pure math, no I/O
│   │   ├── types.ts              # + PayrollRunStatus, hash, lifecycle fields
│   │   ├── constants.ts          # 2026 CRA tables
│   │   ├── federal-tax.ts
│   │   ├── provincial-tax.ts
│   │   ├── cpp.ts                # accepts ytdCpp
│   │   ├── ei.ts                 # accepts ytdEi
│   │   └── engine.ts             # REFACTORED: takes YTD per employee
│   │
│   ├── services/                 # NEW: business orchestration
│   │   ├── ytd.ts                # PayrollYTDService
│   │   ├── validation.ts         # PayrollValidationService
│   │   ├── lifecycle.ts          # PayrollLifecycleService (state machine)
│   │   ├── audit.ts              # AuditLogService
│   │   └── hash.ts               # Deterministic content hash
│   │
│   ├── repositories/             # NEW: storage abstraction
│   │   ├── types.ts              # IEmployeeRepository et al.
│   │   ├── local-storage.ts      # ACTIVE implementation
│   │   ├── supabase.ts           # Stub for future
│   │   └── index.ts              # getRepositories() factory
│   │
│   ├── store/                    # REFACTORED: thin views, no localStorage
│   │   ├── employees.ts          # Delegates to repo + audit
│   │   ├── payroll.ts            # Delegates to repo
│   │   ├── settings.ts           # Delegates to repo (company)
│   │   └── hydrate.ts            # Single client-side hydration hook
│   │
│   ├── pdf/                      # UNCHANGED behavior
│   │   ├── paystub.ts
│   │   ├── t4.ts
│   │   └── ytd.ts                # + status filtering
│   │
│   └── utils.ts
│
└── ARCHITECTURE.md               # this file
```

---

## 2. Services — code-level design

### `PayrollYTDService` ([lib/services/ytd.ts](lib/services/ytd.ts))

Single source of truth for year-to-date state. Derived from the
immutable run history; never cached, never mutated.

```ts
class PayrollYTDService {
  constructor(runs: PayrollRun[])
  getEmployeeYTD(employeeId, year, asOf): YTDState
  getYTDMap(employees, year, asOf): Map<string, YTDState>
}
```

Inclusion rules:
- Only `finalized` and `voided` runs contribute.
- `preview`/`draft` runs are ignored.
- Voided original + reversal net to zero — no special case needed.

### `PayrollValidationService` ([lib/services/validation.ts](lib/services/validation.ts))

Pre-finalization gate. Returns structured `ValidationResult`.

```ts
interface ValidationIssue {
  code: string                              // "CPP_CAP_REACHED" etc.
  severity: "error" | "warning"
  employeeId?: string
  message: string
  detail?: Record<string, unknown>
}
```

Implemented checks:

| Code | Severity | Trigger |
|---|---|---|
| `PERIOD_INVALID_DATES` | error | Non-parseable date strings |
| `PERIOD_END_BEFORE_START` | error | end < start |
| `PAY_DATE_BEFORE_PERIOD_END` | error | pay < end |
| `DUPLICATE_PAYROLL` | error | Same employee + same period already finalized |
| `EMPLOYEE_NAME_MISSING` | error | Empty first/last name |
| `EMPLOYEE_PROVINCE_UNSUPPORTED` | error | Quebec or unknown |
| `EMPLOYEE_SALARY_INVALID` | error | Salary type + missing/≤0 annual |
| `EMPLOYEE_HOURLY_INVALID` | error | Hourly type + missing/≤0 rate |
| `EMPLOYEE_VACATION_UNUSUAL` | warning | <0 or >20 % |
| `CPP_CAP_REACHED` | warning | YTD ≥ annual max |
| `CPP2_CAP_REACHED` | warning | YTD CPP2 ≥ tier max |
| `EI_CAP_REACHED` | warning | YTD EI ≥ annual max |
| `CPP2_TIER_EXHAUSTED` | warning | YTD pensionable > YAMPE |

Errors block finalization. Warnings are surfaced to the operator but
do not block.

### `PayrollLifecycleService` ([lib/services/lifecycle.ts](lib/services/lifecycle.ts))

Owns the state machine. Only entry point for actually persisting runs.

```ts
class PayrollLifecycleService {
  constructor(repos, runsSnapshot)
  preview(input): PayrollRun                    // no side effects
  validate(input): Promise<ValidationResult>
  finalize(input): Promise<
    | { ok: true; run; warnings }
    | { ok: false; result }
  >
  void(runId, reason): Promise<PayrollRun>      // creates reversal
}
```

### `AuditLogService` ([lib/services/audit.ts](lib/services/audit.ts))

Append-only log via `IAuditRepository`. Auto-redacts `sin`, `bankAccount`,
`bankTransit`, `bankInstitution` from any context passed in. Events:

- `payroll.preview.created`
- `payroll.finalized`
- `payroll.voided`
- `employee.created` / `updated` / `removed`
- `settings.updated`

### `hashContent()` ([lib/services/hash.ts](lib/services/hash.ts))

Deterministic FNV-1a 64-bit (two halves) content hash over canonical
JSON (sorted keys). Used to fingerprint payroll input → output
provenance. Not cryptographic.

---

## 3. TypeScript interfaces (key contracts)

```ts
// lib/payroll/types.ts
type PayrollRunStatus = "draft" | "preview" | "finalized" | "voided";

interface PayrollRun {
  id: string;
  taxYear: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollRunStatus;
  inputHash: string;          // FNV(canonical(employees + inputs + ytd + period))
  createdAt: string;
  finalizedAt?: string;
  voidedBy?: string;          // reversal run id
  reverses?: string;          // if this IS a reversal
  voidReason?: string;
  lines: PayrollLineResult[];
  totals: { gross, net, federalTax, provincialTax, cpp, cpp2, ei, employerCost };
}

// lib/services/ytd.ts
interface YTDState {
  employeeId; year; asOf;
  gross; pensionableEarnings; insurableEarnings;
  cppEmployee; cpp2Employee; cppEmployer; cpp2Employer;
  eiEmployee; eiEmployer;
  federalTax; provincialTax; net;
}

// lib/repositories/types.ts
interface IEmployeeRepository {
  getAll(): Promise<Employee[]>;
  getById(id): Promise<Employee | null>;
  create(input): Promise<Employee>;
  update(id, patch): Promise<Employee>;
  remove(id): Promise<void>;
}

interface IPayrollRepository {
  getAll(): Promise<PayrollRun[]>;
  getById(id): Promise<PayrollRun | null>;
  save(run): Promise<PayrollRun>;          // throws on dup-hash finalized
  void(runId, reversal, reason): Promise<void>;
}

interface ISettingsRepository {
  get(): Promise<CompanySettings>;
  update(patch): Promise<CompanySettings>;
}

interface IAuditRepository {
  list(limit?): Promise<AuditEntry[]>;
  append(entry): Promise<void>;
}
```

---

## 4. Data flow

### Read flow (e.g., Payroll tab opens)

```
                                ┌────────────────────────┐
  React component               │ useEmployees(...)      │
  (PayrollView)                 │ usePayrollRuns(...)    │
                                └────────────┬───────────┘
                                             │ in-memory snapshot
                                             ▼
                                ┌────────────────────────┐
                                │ Zustand store (RAM)    │
                                └────────────┬───────────┘
                                             │ hydrate() (once, on mount)
                                             ▼
                                ┌────────────────────────┐
                                │ getRepositories()      │
                                │  → IEmployeeRepository │
                                │  → IPayrollRepository  │
                                └────────────┬───────────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          ▼                                     ▼
                ┌─────────────────────┐               ┌─────────────────────┐
                │ LocalStorageRepo    │   …or…        │ SupabaseRepo (stub) │
                │ (active)            │               │                     │
                └─────────────────────┘               └─────────────────────┘
```

### Write flow ("Run payroll" click)

```
  PayrollView.handleRun()
        │
        ▼
  PayrollLifecycleService.finalize({ employees, period })
        │
        ├─▶ PayrollYTDService(runsSnapshot).getYTDMap(...)
        │       └─ folds finalized + voided runs, no caching
        │
        ├─▶ PayrollValidationService.validate({ ytdMap, runs, ... })
        │       └─ returns { ok, errors[], warnings[] }
        │
        │   ┌── if !ok: return early, surface errors in UI ──┐
        │   ▼                                                 │
        ├─▶ runPayroll({ employees, ytdByEmployee, ... })    │
        │       └─ pure engine: snapshots employees,         │
        │          calls CPP/EI with YTD caps,               │
        │          produces immutable PayrollRun + inputHash │
        │                                                    │
        ├─▶ IPayrollRepository.save(finalRun)               │
        │       └─ rejects duplicate hash (idempotency)     │
        │                                                    │
        ├─▶ AuditLogService.log("payroll.finalized", ctx)  │
        │       └─ append-only audit entry                  │
        │                                                    │
        └─▶ usePayrollRuns.upsertRun(finalRun)              │
                └─ in-memory refresh; UI re-renders         │
```

### Void flow

```
  PayrollLifecycleService.void(runId, reason)
        │
        ├─▶ repos.payroll.getById(runId)         (must exist + finalized)
        ├─▶ build reversal: same lines/totals * −1, status=finalized,
        │                   reverses=originalId, new inputHash
        ├─▶ repos.payroll.void(runId, reversal, reason)
        │       └─ marks original as voided, prepends reversal
        └─▶ audit.log("payroll.voided", { runId, reversalId, reason })

  Result for YTD:
    YTDService folds both → original positive + reversal negative = 0
```

---

## 5. Migration plan (Zustand-persist → Repository-backed)

### What changed at rest

| Before | After |
|---|---|
| `northpay.employees` (Zustand persist) | `northpay.repo.employees` |
| `northpay.payroll` | `northpay.repo.payroll` |
| `northpay.settings` | `northpay.repo.settings` |
| — | `northpay.repo.audit` (new) |
| — | `northpay.ui.theme`, `northpay.ui.notifications` (cosmetic, kept separate) |

### Steps to migrate to Supabase

1. `npm install @supabase/supabase-js`
2. Create tables:
   ```sql
   create table employees ( id uuid pk, org_id uuid, created_at, ... );
   create table payroll_runs (
     id uuid pk, org_id uuid, tax_year int, status text check (status in ('draft','preview','finalized','voided')),
     input_hash text, created_at, finalized_at, voided_by uuid, reverses uuid, void_reason text,
     period_start date, period_end date, pay_date date,
     lines jsonb, totals jsonb
   );
   create unique index payroll_finalized_hash on payroll_runs(org_id, input_hash) where status = 'finalized';
   create table company_settings ( org_id uuid pk, ... );
   create table audit_log ( id uuid pk, org_id uuid, ts, event, actor, context jsonb );
   alter table audit_log enable row level security;
   create policy "no_update" on audit_log for update using (false);
   create policy "no_delete" on audit_log for delete using (false);
   ```
3. Fill in [`lib/repositories/supabase.ts`](lib/repositories/supabase.ts) — each method maps directly to a Supabase query (interfaces are already correct).
4. In [`lib/repositories/index.ts`](lib/repositories/index.ts), flip:
   ```ts
   _instance = createSupabaseRepositories();
   ```
5. (Optional) Migrate existing local data: read each `northpay.repo.*` key, POST to Supabase.

**No UI or service code changes required for the swap.** Stores, services, components all read through `getRepositories()`.

---

## 6. UI remains unchanged — proof

| Tab / Component | Visual change? | Functional change? |
|---|---|---|
| Landing page | None | None |
| Sidebar / Topbar | None | None |
| Employees tab | None | `addEmployee` is now async internally; UI fires-and-forgets, same call site |
| Add Employee modal | None | Same |
| Payroll tab | None | Same button, same animation, same calc trace; internally calls `lifecycle.finalize()` instead of inline `runPayroll()`; surfaces validation errors/warnings using the *existing* visual language (rounded card, soft tint) |
| Paystubs tab | None | Same |
| Paystub sheet + PDF | None | Same |
| Settings tab | None | `setCompany` is now async; UI fires-and-forgets |
| Dark mode toggle | None | None — theme stays in `northpay.ui.theme` (cosmetic) |

The only added DOM is conditional error/warning cards under the "Run payroll" button — same `motion.div` pattern as the existing success card.

---

## 7. Risk analysis

### Risks resolved

| Risk (before) | Resolution |
|---|---|
| CPP/EI over-deduction past annual max | YTD-aware engine: `calculatePayrollLine(..., ytd)` passes `ytdCpp`/`ytdEi` into cap-aware modules |
| Re-clicking "Run payroll" creates duplicates | `IPayrollRepository.save` rejects matching `inputHash` for `status='finalized'` |
| Finalized run can be silently mutated | `save()` rejects overwrites when existing.status is `finalized`; only `void()` can change finalized state |
| No audit trail | `AuditLogService` writes every create/finalize/void/update to `IAuditRepository`, with SIN/bank redaction |
| UI couples to localStorage | UI → store → `getRepositories()` → impl. Single switch line to change backend. |
| Old `"completed"` status was ambiguous | Strict enum `draft → preview → finalized → voided` with documented transitions |
| Employee edits could retroactively change past paystubs | Engine snapshots `JSON.parse(JSON.stringify(employee))` per line; PDFs read from the snapshot, not from the live employee store |
| YTD could be polluted by preview runs | YTD/PDF helpers filter `status ∈ {finalized, voided}` |

### Risks remaining

| Risk | Severity | Mitigation needed |
|---|---|---|
| Federal K2 credit is approximated (CPP+EI × 15 %) | medium | Implement full T4127 K1/K2/K3/K4 once 2026 PDOC is published; add golden-value tests against CRA PDOC |
| BPA phase-out for high incomes (>$173k) not modeled | medium | Add to `federal-tax.ts` (BPA shrinks linearly from $16,562 → $14,538 between $173k–$246k) |
| Provincial BPA phase-outs (Ontario, BC) | low | Add per-province phase-out logic; data shape already supports it |
| TD1 personal credits per employee (spouse, disability, age) | medium | Add `td1FederalAdditional`, `td1ProvincialAdditional` fields on Employee; subtract before tax calc |
| Stat holiday pay | medium | Per-province table of dates + 9-week average earnings formula; not implemented |
| Quebec (QPP/QPIP/RAMQ) | by design | Stay out of scope until separately resourced |
| Browser localStorage size (~5MB) | low for prototype | Will not surface until Supabase swap, which removes the constraint |
| No automated tests | high | Add Jest + golden-file PDOC comparisons before any production rollout |
| Single-user, no auth | high | Auth + RLS land with Supabase swap |

---

## 8. Non-goals (intentionally NOT in this layer)

- ROE
- T4 XML envelope for CRA e-filing
- Supabase wire-up (stub only)
- Direct-deposit file export
- WSIB / WCB
- Quebec
- Multi-company UI
- New design / animation work

These are correctness-orthogonal and are deferred to the next phase.

---

## 9. Verification

- `npx tsc --noEmit` → 0 errors
- All 5 routes return 200 (`/`, `/dashboard/employees`, `/dashboard/payroll`, `/dashboard/paystubs`, `/dashboard/settings`)
- Run payroll twice for the same period → second attempt blocked with `DUPLICATE_PAYROLL`
- High earner with YTD CPP at $4,142.15 → next run shows `CPP_CAP_REACHED` warning and contributes $0.00 to CPP
- Audit log written for finalize, void, and every employee mutation
