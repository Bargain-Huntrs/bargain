import type { ArbitrageDeal } from "@/lib/api";

// Most scraped deals arrive with no `category` set, so we infer a bucket
// from the title. Keeps the filter chips useful instead of 90% "none".
export const CATEGORY_KEYWORDS: [string, string[]][] = [
  ["Electronics", ["laptop", "headphone", "earbud", "speaker", "monitor", "tv", "tablet", "phone", "charger", "camera", "printer", "keyboard", "mouse", "ssd", "hard drive", "bluetooth", "smartwatch", "gaming", "console", "ps5", "xbox", "nintendo", "router", "drone", "projector"]],
  ["Home & Kitchen", ["kitchen", "cookware", "mattress", "pillow", "blanket", "vacuum", "air fryer", "blender", "coffee", "lamp", "furniture", "desk", "chair", "storage", "organizer", "towel", "bedding", "sheet"]],
  ["Beauty & Care", ["makeup", "skincare", "serum", "moisturizer", "shampoo", "conditioner", "toothpaste", "lotion", "fragrance", "perfume", "razor", "hair dryer", "curling"]],
  ["Clothing & Shoes", ["dress", "shirt", "jeans", "jacket", "sneaker", "boots", "shoes", "hoodie", "leggings", "bra ", "underwear", "socks", "coat"]],
  ["Toys & Games", ["lego", "toy", "doll", "puzzle", "board game", "action figure", "plush", "nerf", "barbie", "hot wheels"]],
  ["Sports & Outdoors", ["fitness", "yoga", "dumbbell", "treadmill", "bike", "camping", "tent", "fishing", "golf", "basketball", "hiking", "kayak"]],
  ["Tools & Auto", ["drill", "saw", "wrench", "tool", "dewalt", "milwaukee", "ryobi", "automotive", "tire", "car ", "mechanic"]],
  ["Baby & Kids", ["baby", "diaper", "stroller", "crib", "toddler", "kids", "children"]],
  ["Pet Supplies", ["dog", "cat ", "pet", "puppy", "kitten", "aquarium", "bird"]],
  ["Grocery & Health", ["vitamin", "supplement", "protein", "snack", "grocery", "food", "medicine", "first aid"]],
];

export function inferDealCategory(deal: ArbitrageDeal): string {
  if (deal.category && deal.category.trim()) return deal.category;
  const t = (deal.title || "").toLowerCase();
  for (const [bucket, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => t.includes(k))) return bucket;
  }
  return "Other";
}

// URL slug for a category bucket: lowercase, "&" dropped, everything else
// non-alphanumeric collapses to a single hyphen.
// "Home & Kitchen" -> "home-kitchen", "Pet Supplies" -> "pet-supplies".
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface DealCategory {
  name: string;
  slug: string;
}

// The 11 indexable category landing pages: the 10 keyword buckets plus
// "Other" for everything inferDealCategory can't place.
export const DEAL_CATEGORIES: DealCategory[] = [
  ...CATEGORY_KEYWORDS.map(([name]) => name),
  "Other",
].map((name) => ({ name, slug: categorySlug(name) }));

export function categoryBySlug(slug: string): DealCategory | undefined {
  return DEAL_CATEGORIES.find((c) => c.slug === slug);
}
