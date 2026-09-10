import type { Metadata } from "next";

import { ProducerPlansPage } from "@/components/admin/production/producer-plans-page";

export const metadata: Metadata = {
  title: "Planos de Produção · ProduPlan",
};

export default async function AdminProducerPlansPage({
  params,
}: {
  params: Promise<{ orgId: string; communityId: string; producerId: string }>;
}) {
  const { orgId, communityId, producerId } = await params;
  return (
    <ProducerPlansPage
      orgId={orgId}
      communityId={communityId}
      producerId={producerId}
    />
  );
}
