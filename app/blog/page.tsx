import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { listPublishedPosts } from "@/lib/blog/server";
import { readingMinutes } from "@/lib/blog/types";
import { SITE_NAME } from "@/lib/site";

// Server-rendered, and revalidated rather than cached forever: publishing in
// the admin panel must show up without a deploy, but every visitor shouldn't
// cost a database round trip either.
export const revalidate = 300;

const TITLE = "Canadian payroll, explained";
const DESCRIPTION =
  "Plain answers on CPP, EI, vacation pay, statutory holidays and CRA remittances — written against the same tables NorthPay runs payroll with.";

export const metadata: Metadata = {
  title: `${TITLE} — ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: `${TITLE} — ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/blog",
  },
};

function dateline(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogIndex() {
  const posts = await listPublishedPosts();

  return (
    <main className="relative min-h-screen overflow-x-clip pt-32 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-rose-200/35 via-sky-200/25 to-emerald-200/35 blur-3xl dark:from-rose-500/10 dark:via-sky-500/10 dark:to-emerald-500/10" />
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Notes
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-tightest sm:text-[46px]">
          {TITLE}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
          {DESCRIPTION}
        </p>

        {posts.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-border/70 bg-card/60 px-6 py-12 text-center">
            <p className="text-[14px] font-medium tracking-tight">Nothing published yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] text-muted-foreground">
              The first piece is on its way.
            </p>
          </div>
        ) : (
          <ul className="mt-12 divide-y divide-border/60 border-t border-border/60">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex items-start justify-between gap-6 py-7 transition-opacity hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {dateline(post.publishedAt)} · {readingMinutes(post.body)} min read
                    </p>
                    <h2 className="mt-2 text-[20px] font-semibold leading-snug tracking-tight sm:text-[23px]">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                      {post.excerpt}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-6 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
