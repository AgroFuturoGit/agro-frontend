import type { Metadata } from "next";

import { CommunityProducersPage } from "@/components/admin/communities/community-producers-page";

export const metadata: Metadata = {
  title: "Agricultores · ProduPlan",
};

export default async function AdminCommunityProducersPage({
  params,
}: {
  params: Promise<{ orgId: string; communityId: string }>;
}) {
  const { communityId } = await params;
  return <CommunityProducersPage communityId={communityId} />;
}
