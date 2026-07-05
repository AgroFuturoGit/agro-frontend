import type { Metadata } from "next";

import { PlanDetail } from "@/components/admin/production/plan-detail";

export const metadata: Metadata = {
  title: "Plano de produção · Agro",
};

export default async function AdminProductionPlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  return <PlanDetail planId={planId} />;
}
