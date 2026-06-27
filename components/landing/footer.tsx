import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative border-t border-border/60 py-14">
      <div className="container">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-foreground text-background">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 13V3l10 10V3"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              NorthPay
            </p>
            <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
              Canadian payroll software for businesses outside Quebec. Made with
              care for the way modern teams actually work.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-3 text-[13px]">
            <Col title="Company">
              <Link href="/about" className="text-muted-foreground hover:text-foreground">
                About
              </Link>
            </Col>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-5 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 NorthPay Inc. All rights reserved.</p>
          <p>
            Calculations follow CRA 2026 guidance. Always verify with your
            accountant for filing.
          </p>
        </div>
      </div>
    </footer>
  );
}

function Col({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}
