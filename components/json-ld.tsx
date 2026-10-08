/**
 * Structured data for search engines.
 *
 * Two reasons this is a component rather than a <script> written inline in a
 * page:
 *
 * 1. An inline <script> in a page's own JSX makes Next flush the response
 *    head early, which means a later notFound() can no longer set the status
 *    — the 404 screen goes out as HTTP 200. Behind a component boundary it
 *    doesn't, and /blog/<missing> answers 404 properly.
 *
 * 2. Serialising safely is easy to get wrong twice over. Passing the JSON as
 *    a text child instead would let React escape `&` and `<` into entities,
 *    and a <script> body is raw text — the entities are NOT decoded, so the
 *    JSON silently arrives corrupt. And a value containing "</script>" would
 *    close the tag early, which is an injection even when the only author is
 *    the site owner. Escaping `<` as < solves both: JSON treats the
 *    escape as identical, and no tag can be closed from inside a string.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
