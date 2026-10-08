import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPublishedPost } from "@/lib/blog/server";
import { renderMarkdown } from "@/lib/blog/markdown";
import { readingMinutes } from "@/lib/blog/types";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedPost(params.slug);
  // Decided here as well as in the component: generateMetadata runs before
  // rendering, which is the only point at which the response head can still
  // change.
  //
  // KNOWN LIMITATION: it still answers HTTP 200, not 404. In this app a
  // dynamically rendered segment returns 200 from notFound() whatever the
  // route config — measured against every combination of revalidate,
  // force-dynamic, a segment-level not-found boundary and extracting the
  // JSON-LD script. Statically prerendered pages and genuinely unmatched
  // routes (/anything-else) do answer 404 correctly.
  //
  // What stops it mattering: the not-found page carries `noindex`, so these
  // URLs cannot be indexed however they are served. They are also
  // undiscoverable — nothing links to them and the sitemap lists only real
  // posts — so the exposure is a post that gets unpublished or renamed
  // after Google has already seen it.
  //
  // The fix that would work is generateStaticParams + dynamicParams:false,
  // which costs instant publishing: a new post would 404 until the next
  // deploy. Not worth it for this.
  if (!post) notFound();

  const url = `/blog/${post.slug}`;
  return {
    title: `${post.title} — ${SITE_NAME}`,
    description: post.excerpt,
    // The canonical is what stops /blog/x?utm_source=… from competing with
    // /blog/x for the same ranking.
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const post = await getPublishedPost(params.slug);
  // A draft is a 404, not a redirect: an unpublished address should look
  // like it was never there.
  if (!post) notFound();

  const html = renderMarkdown(post.body);
  const published = post.publishedAt ?? post.createdAt;

  // Article structured data. This is what lets a result show a date and an
  // author instead of a bare blue link.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: published,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.authorName },
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/blog/${post.slug}`) },
  };

  return (
    <main className="relative min-h-screen overflow-x-clip pt-32 pb-24">
      {/* A component, not an inline <script> — see JsonLd. Inline, it makes
          Next flush the response head early and the notFound() above can no
          longer answer 404. */}
      <JsonLd data={jsonLd} />

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-200/30 via-rose-200/20 to-emerald-200/30 blur-3xl dark:from-sky-500/10 dark:via-rose-500/10 dark:to-emerald-500/10" />
      </div>

      <article className="mx-auto w-full max-w-2xl px-5 sm:px-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All notes
        </Link>

        <h1 className="mt-6 text-[32px] font-semibold leading-[1.1] tracking-tightest sm:text-[42px]">
          {post.title}
        </h1>
        <p className="mt-4 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <time dateTime={published}>
            {new Date(published).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {" · "}
          {readingMinutes(post.body)} min read
        </p>

        <div
          className="np-prose mt-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="mt-16 rounded-3xl border border-border/70 bg-card/60 px-6 py-7">
          <p className="text-[17px] font-semibold tracking-tight">
            Run this payroll in about a minute.
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            NorthPay does the CPP, EI and tax maths on the same {new Date().getFullYear()} CRA
            tables this post is written against, and emails the paystub.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-[14px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            Try it free
          </Link>
        </div>
      </article>
    </main>
  );
}
