/**
 * Deterministic hashing utilities.
 *
 * Used to produce a stable "fingerprint" of payroll inputs so the same
 * inputs always produce the same hash — enabling duplicate-run detection
 * and audit traceability without depending on the Web Crypto API.
 *
 * This is intentionally NOT cryptographically secure. It is a content
 * fingerprint, not a tamper-proof signature.
 */

/** FNV-1a 32-bit hash. Returns lowercase hex of length 8. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Stringify with sorted keys at every level — JSON canonical form. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonical).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") +
    "}"
  );
}

/** Deterministic content hash of any JSON-serializable value. */
export function hashContent(value: unknown): string {
  // Double pass over two halves to reduce collision risk at 32 bits.
  const json = canonical(value);
  const half = Math.max(1, Math.floor(json.length / 2));
  return fnv1a(json.slice(0, half)) + fnv1a(json.slice(half));
}
