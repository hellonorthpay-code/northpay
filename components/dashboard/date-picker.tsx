"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/*
 * ─── DatePicker ──────────────────────────────────────────────────────────
 *
 * NorthPay's own calendar, shared by every date field in the app.
 *
 * Deliberately NOT <input type="date">. That control renders whatever the
 * BROWSER ships — Chrome's calendar on a Mac, a different one in Safari,
 * a wheel on iOS, a dialog on Android. There is no web API that opens the
 * macOS system picker, so "native" can only ever mean "inconsistent". This
 * looks identical on every OS and matches the rest of the product.
 *
 * Desktop gets the popover; phones get a typed YYYY-MM-DD field, where the
 * on-screen keyboard beats a cramped grid.
 * ─────────────────────────────────────────────────────────────────────────
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function DatePicker({
  value,
  onChange,
  rangeFrom,
  rangeTo,
}: {
  value: string;
  onChange: (next: string) => void;
  /**
   * Optional pay-period bounds (ISO yyyy-mm-dd). When both are given the
   * calendar tints the days between them, fills THIS field's own date, and
   * outlines the other end — so picking a period end shows what it's
   * measured from instead of asking you to hold it in your head.
   */
  rangeFrom?: string;
  rangeTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  // `viewMonth` is the first day of the month currently displayed —
  // separate from the selected `value` so the user can browse months
  // without committing a date.
  const initial = value ? new Date(value + "T00:00:00") : new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  // Mobile gets a plain typed field instead of the calendar popover — kept
  // as its own local string so the user can type freely (e.g. mid-digit)
  // without the parent value flipping to an invalid date.
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);

  function handleTypedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setTyped(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00").getTime())) {
      onChange(v);
    }
  }

  useEffect(() => setMounted(true), []);

  // The calendar is portaled to document.body so it floats ABOVE the modal
  // instead of expanding it. It carries [data-northpay-popover] so the
  // Radix Dialog ignores clicks on it (see dialog.tsx) — that's what makes
  // day selection actually register. Width is fixed (288px) so it never
  // overflows the viewport edge.
  const PANEL_W = 288;
  function reposition() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const PANEL_H = 340;
    const below = r.bottom + 8;
    const flipUp = below + PANEL_H > window.innerHeight && r.top - PANEL_H > 0;
    // keep within the viewport horizontally
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - PANEL_W - 8,
    );
    setPos({
      top: flipUp ? Math.max(8, r.top - PANEL_H - 8) : below,
      left,
      width: r.width,
    });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => reposition();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const displayLabel = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";

  function pick(d: Date) {
    const iso =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    onChange(iso);
    setOpen(false);
  }

  return (
    <>
      {/* Mobile: plain typed input — no calendar popover. */}
      <Input
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        value={typed}
        onChange={handleTypedChange}
        className="sm:hidden"
      />

      {/* Desktop: calendar button + popover. */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hidden h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-[14px] text-foreground shadow-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:flex"
      >
        <span className={value ? "" : "text-muted-foreground"}>{displayLabel}</span>
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popRef}
                data-northpay-popover
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: EASE }}
                // Stop pointer events from bubbling to the document /
                // Radix Dialog — without this, parent listeners would
                // swallow the click and the day buttons wouldn't fire.
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  width: PANEL_W,
                  zIndex: 80,
                  // Radix Dialog (modal) sets `pointer-events: none` on
                  // <body> while open. This popover is portaled to <body>,
                  // so it inherits that and every click is swallowed —
                  // the calendar renders but nothing is selectable. Re-enable
                  // pointer events here so day/nav clicks register.
                  pointerEvents: "auto",
                }}
                className="origin-top rounded-2xl border border-border bg-background p-3 shadow-pop"
              >
                <CalendarPanel
                  viewMonth={viewMonth}
                  onViewMonth={setViewMonth}
                  selected={value ? new Date(value + "T00:00:00") : null}
                  rangeFrom={rangeFrom ? new Date(rangeFrom + "T00:00:00") : null}
                  rangeTo={rangeTo ? new Date(rangeTo + "T00:00:00") : null}
                  onPick={pick}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function CalendarPanel({
  viewMonth,
  onViewMonth,
  selected,
  rangeFrom,
  rangeTo,
  onPick,
}: {
  viewMonth: Date;
  onViewMonth: (d: Date) => void;
  selected: Date | null;
  rangeFrom?: Date | null;
  rangeTo?: Date | null;
  onPick: (d: Date) => void;
}) {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  // Only a well-formed range paints. A backwards one (end before start,
  // mid-edit) would otherwise shade nothing and flicker.
  const hasRange = !!rangeFrom && !!rangeTo && rangeFrom.getTime() <= rangeTo.getTime();
  // Which switcher is showing: the day grid (default), the month grid, or
  // the scrollable year list. Clicking the month/year label in the header
  // toggles into the matching switcher; picking a value returns to "day".
  const [mode, setMode] = useState<"day" | "month" | "year">("day");

  // Build the 6-row grid: leading blanks from the previous month so the
  // first of the current month lands under its real weekday column.
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: ({ d: Date; current: boolean } | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d: new Date(year, month, d), current: true });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function pickMonth(m: number) {
    onViewMonth(new Date(year, m, 1));
    setMode("day");
  }
  function pickYear(y: number) {
    onViewMonth(new Date(y, month, 1));
    setMode("day");
  }
  function jumpToday() {
    setMode("day");
    onViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onPick(today);
  }

  // Years offered in the year switcher: a generous window around today,
  // scrollable so the header stays free of paging arrows.
  const YEARS: number[] = [];
  for (let y = today.getFullYear() - 80; y <= today.getFullYear() + 10; y++) {
    YEARS.push(y);
  }
  const selectedYearRef = React.useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mode === "year") {
      selectedYearRef.current?.scrollIntoView({ block: "center" });
    }
  }, [mode]);

  const headerBtn =
    "rounded-lg px-2.5 py-1 text-[13px] font-semibold tracking-tight text-foreground transition-colors hover:bg-muted/70 dark:hover:bg-white/10";

  return (
    <div className="w-full">
      {/* Header: ◀ / ▶ step one month; tapping the month or year opens its
          switcher. Arrows only show on the day grid. */}
      <div className="mb-2 flex items-center justify-between gap-1 px-1">
        {mode === "day" ? (
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onViewMonth(new Date(year, month - 1, 1))}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode(mode === "month" ? "day" : "month")}
            className={`${headerBtn} ${mode === "month" ? "bg-muted" : ""}`}
          >
            {MONTH_FULL[month]}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "year" ? "day" : "year")}
            className={`${headerBtn} tabular-nums ${mode === "year" ? "bg-muted" : ""}`}
          >
            {year}
          </button>
        </div>

        {mode === "day" ? (
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onViewMonth(new Date(year, month + 1, 1))}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}
      </div>

      {mode === "month" ? (
        /* Month switcher — 3 × 4 grid of month names. */
        <div className="grid grid-cols-3 gap-1 px-1 py-1">
          {MONTH_SHORT.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => pickMonth(i)}
              className={`rounded-lg py-2.5 text-[13px] font-medium transition-colors ${
                i === month
                  ? "bg-foreground text-background dark:bg-white dark:text-black"
                  : "text-foreground hover:bg-muted/70 dark:hover:bg-white/10"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      ) : mode === "year" ? (
        /* Year switcher — scrollable list, auto-centred on the current year. */
        <div className="max-h-[212px] overflow-y-auto px-1 py-1 scrollbar-none">
          <div className="grid grid-cols-4 gap-1">
            {YEARS.map((y) => (
              <button
                key={y}
                ref={y === year ? selectedYearRef : undefined}
                type="button"
                onClick={() => pickYear(y)}
                className={`rounded-lg py-2 text-[13px] font-medium tabular-nums transition-colors ${
                  y === year
                    ? "bg-foreground text-background dark:bg-white dark:text-black"
                    : "text-foreground hover:bg-muted/70 dark:hover:bg-white/10"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 px-1 pb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={i}
                className="grid h-7 place-items-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5 px-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="h-8" />;
              const isToday = cell.d.getTime() === today.getTime();
              const isSelected = selected !== null && sameDay(cell.d, selected);

              const t = cell.d.getTime();
              const inRange =
                hasRange && t >= rangeFrom!.getTime() && t <= rangeTo!.getTime();
              const isFrom = hasRange && sameDay(cell.d, rangeFrom!);
              const isTo = hasRange && sameDay(cell.d, rangeTo!);
              // The end of the period this field ISN'T editing — outlined,
              // so both bounds are legible without competing with each other.
              const isOtherEnd = (isFrom || isTo) && !isSelected;
              const col = i % 7;

              return (
                <div key={i} className="relative">
                  {/* The band bleeds into the 2px grid gap so a week reads as
                      one continuous stripe, and rounds off only where the
                      range actually stops — or where the row does. */}
                  {inRange && (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-y-0 -left-0.5 -right-0.5 bg-foreground/[0.07] dark:bg-white/[0.09]",
                        (isFrom || col === 0) && "left-0 rounded-l-lg",
                        (isTo || col === 6) && "right-0 rounded-r-lg"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onPick(cell.d)}
                    className={cn(
                      "relative grid h-8 w-full place-items-center rounded-lg text-[12.5px] font-medium transition-colors",
                      isSelected
                        ? "bg-foreground text-background dark:bg-white dark:text-black"
                        : isOtherEnd
                          ? "text-foreground ring-1 ring-foreground/45 dark:ring-white/45"
                          : isToday
                            ? "text-foreground ring-1 ring-foreground/30 dark:ring-white/30"
                            : "text-foreground hover:bg-muted/70 dark:hover:bg-white/10"
                    )}
                  >
                    {cell.d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer: single "Today" action — jumps the view to the current
          month AND selects today's date. Two separate buttons were
          confusing and did effectively the same thing. */}
      <div className="mt-2 flex items-center justify-center border-t border-border/60 px-1 pt-2">
        <button
          type="button"
          onClick={jumpToday}
          className="rounded-full px-3 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          Today
        </button>
      </div>
    </div>
  );
}
