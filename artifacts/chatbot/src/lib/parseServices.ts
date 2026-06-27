// Classifies each non-empty line of a services block into one of four kinds:
//
//   "tagline"  starts with "Tagline:" — rendered as italic subtitle in header
//   "heading"  ALL-CAPS-heavy or ends with colon — rendered as section label
//   "priced"   "Name — ₦Price" pattern — rendered as a service card
//   "info"     everything else — rendered as a plain prose paragraph
//
// Fully generic. No business-type-specific logic anywhere.

export type ServiceLine =
  | { kind: "tagline"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "priced"; name: string; price: string }
  | { kind: "info"; text: string };

export function parseServicesBlock(raw: string): ServiceLine[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): ServiceLine => {
      if (/^tagline:\s*/i.test(line)) {
        return { kind: "tagline", text: line.replace(/^tagline:\s*/i, "").trim() };
      }

      const dashMatch = line.match(/^(.+?)\s*[—–]\s*(.+)$/);
      if (dashMatch) {
        const [, name, price] = dashMatch;
        if (/[₦\d]/.test(price)) {
          return { kind: "priced", name: name.trim(), price: price.trim() };
        }
      }

      const letters = (line.match(/[a-zA-Z]/g) ?? []).length;
      const uppers = (line.match(/[A-Z]/g) ?? []).length;
      const isAllCapsHeavy = letters > 3 && uppers / letters > 0.6;
      const endsWithColon = line.endsWith(":");
      if ((isAllCapsHeavy || endsWithColon) && line.length < 80) {
        return { kind: "heading", text: endsWithColon ? line.slice(0, -1) : line };
      }

      return { kind: "info", text: line };
    });
}
