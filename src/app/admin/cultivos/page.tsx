import type { Metadata } from "next";

import { ProductionPlansPage } from "@/components/admin/production/production-plans-page";

export const metadata: Metadata = {
  title: "Planos de Produção · Agro",
};

export default function AdminProductionPlansPage() {
  return <ProductionPlansPage />;
}
