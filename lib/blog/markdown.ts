/**
 * A small Markdown renderer for blog posts.
 *
 * Deliberately not a dependency. The posts here are prose, headings, lists,
 * links and rate tables — a few hundred lines covers all of it, and a parser
 * we own can refuse everything else rather than allow-listing our way
 * backwards out of a general-purpose one.
 *
 * Safety: the source is escaped BEFORE any markup is produced, so a post can
 * never inject HTML — not a <script>, not an onerror, not an attribute. Only
 * the tags this file writes itself reach the page. The author is the site
 * owner, but "the only person who can write here is trusted" is a property
 * of today's auth rules, not of this function.
 *
 * Supported: # ## ###, paragraphs, - and 1. lists, > quotes, --- rules,
 * ```fenced code```, `inline code`, **bold**, *italic*, [links](url), and
 * pipe tables.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Only http(s) and site-relative links survive. Everything else — javascript:,
 * data:, vbscript: — becomes an inert anchor rather than a live one.
 */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^\/(?!\/)/.test(href)) return href;
  if (/^#[\w-]+$/.test(href)) return href;
  if (/^mailto:[^\s<>]+@[^\s<>]+$/i.test(href)) return href;
  return null;
}

/** Inline formatting, applied to text that is ALREADY html-escaped. */
function inline(escaped: string): string {
  let out = escaped;

  // Code first: its contents must not then be read as bold/italic/links.
  const codes: string[] = [];
  out = out.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });

  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, text: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return text;
    // Outbound links get rel="noopener"; they are written by us, but the
    // destination is not ours.
    const external = /^https?:\/\//i.test(safe);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${safe}"${attrs}>${text}</a>`;
  });

  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => `<code>${codes[Number(i)]}</code>`);
  return out;
}

/** The escaped form of a "> " quote marker. See renderMarkdown. */
const QUOTE = /^\s*&gt;\s?/;

const isTableDivider = (l: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes("-");
const splitRow = (l: string) =>
  l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source.replace(/\r\n/g, "\n")).split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code — taken verbatim, no inline formatting inside.
    if (/^```/.test(line.trim())) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${body.join("\n")}</code></pre>`);
      continue;
    }

    if (/^---+\s*$/.test(line.trim())) {
      html.push("<hr />");
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length + 1; // # is an h2: the post title is the h1.
      html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // Table: a header row followed by a |---|---| divider.
    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      html.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
      );
      continue;
    }

    // NB: the source was escaped first, so a quote marker reaching here is
    // "&gt;", not ">". Matching the raw character silently never fires.
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(lines[i].replace(QUOTE, ""));
        i += 1;
      }
      html.push(`<blockquote><p>${inline(body.join(" ").trim())}</p></blockquote>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, ""));
        i += 1;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.map((it) => `<li>${inline(it.trim())}</li>`).join("")}</${tag}>`);
      continue;
    }

    // Paragraph: consecutive plain lines join with a space, as Markdown does.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|```|---+\s*$|\s*&gt;|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return html.join("\n");
}

/** First ~N characters of prose, for an excerpt the author didn't write. */
export function autoExcerpt(body: string, max = 180): string {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`|_-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(" ", max) || max)}…`;
}
