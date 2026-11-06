import type { Metadata } from "next";
import CommunityThread from "@/components/CommunityThread";

// Dynamic thread route: /community/:id
// Static sibling routes (leaderboard) take precedence over this dynamic
// segment, so they are unaffected. The client component reads the thread ID
// from window.location.pathname (same pattern as /deals/[id]).
export function generateStaticParams() {
  // No thread IDs are known at build time; all are rendered on demand.
  // Returning [] keeps `output: "export"` (legacy CF Pages path) buildable.
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Community Thread",
    description: "Discuss this community deal on BargainHuntrs.",
    alternates: { canonical: `/community/${id}` },
    openGraph: {
      title: "Community Thread | BargainHuntrs",
      description: "Discuss this community deal on BargainHuntrs.",
      url: `/community/${id}`,
    },
  };
}

export default function CommunityThreadPage() {
  return <CommunityThread />;
}
