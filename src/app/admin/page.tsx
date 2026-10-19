import type { Metadata } from "next";

import { ProductionDashboard } from "@/components/admin/dashboard/production-dashboard";

export const metadata: Metadata = {
  title: "Painel · ProduPlan",
};

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
        <p className="text-sm text-muted-foreground">
          Meta e realizado da produção no seu recorte. O realizado considera
          somente apontamentos validados.
        </p>
      </div>

      <ProductionDashboard />
    </div>
  );
}
