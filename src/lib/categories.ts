// Content categories for premium items and creator posts -- the marketplace
// sidebar filters on these. Safe to import from client components.
export const CATEGORIES = [
  { id: "riding", label: "Riding" },
  { id: "doggy", label: "Doggy" },
  { id: "oral", label: "Oral" },
  { id: "missionary", label: "Missionary" },
  { id: "grinding", label: "Grinding" },
  { id: "solo", label: "Solo & Toys" },
  { id: "nude", label: "Nude Poses" },
  { id: "tease", label: "Lingerie & Tease" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const isCategory = (v: unknown): v is CategoryId => CATEGORIES.some((c) => c.id === v);

export const categoryLabel = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
