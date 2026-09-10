import type { Metadata } from "next";

import { PlanDetail } from "@/components/admin/production/plan-detail";

export const metadata: Metadata = {
  title: "Plano de produção · ProduPlan",
};

export default async function AdminProductionPlanDetailPage({
  params,
}: {
  params: Promise<{
    orgId: string;
    communityId: string;
    producerId: string;
    planId: string;
  }>;
}) {
  const { orgId, communityId, producerId, planId } = await params;
  return (
    <PlanDetail
      orgId={orgId}
      communityId={communityId}
      producerId={producerId}
      planId={planId}
    />
  );
}
