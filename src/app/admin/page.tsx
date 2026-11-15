import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { ProductionDashboard } from "@/components/admin/dashboard/production-dashboard";

export const metadata: Metadata = {
  title: "Painel · ProduPlan",
};

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description="Meta e realizado da produção no seu recorte. O realizado considera somente apontamentos validados."
      />

      <ProductionDashboard />
    </div>
  );
}
