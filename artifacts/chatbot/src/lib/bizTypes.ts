// ── Shared business-type constants ────────────────────────────────────────────
//
// Single source of truth for business type keys, display labels, and emojis
// used across ChatPage and AdminPage.

export type BookingIntent = "low" | "medium" | "high";

export const BIZ_EMOJIS: Record<string, string> = {
  wig: "💇‍♀️",
  fashion: "👗",
  food: "🍽️",
  cake: "🎂",
  beauty: "✨",
  photography: "📸",
  other: "💼",
};

// Long-form labels used in the chatbot UI header.
export const BIZ_TYPE_LABELS: Record<string, string> = {
  wig: "Wig Revamping",
  fashion: "Fashion",
  food: "Food & Restaurant",
  cake: "Cakes & Events",
  beauty: "Beauty & Wellness",
  photography: "Photography",
  other: "Business",
};

// Dropdown options used in the admin business form.
export const BIZ_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "wig",         label: "Wig / Hair" },
  { value: "fashion",     label: "Fashion" },
  { value: "food",        label: "Food" },
  { value: "cake",        label: "Cakes & Events" },
  { value: "beauty",      label: "Beauty" },
  { value: "photography", label: "Photography" },
  { value: "other",       label: "Other" },
];
