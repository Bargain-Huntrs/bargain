import { permanentRedirect } from "next/navigation";

// Legacy alias of /deals/[id] — it never carried a real deal ID (the old
// client component parsed the last path segment, which here resolves to
// "detail"), so it always rendered the error state. Now that deal pages are
// true SSR routes, fold the alias into the deals index permanently.
export default function DealDetailPage() {
  permanentRedirect("/deals");
}
