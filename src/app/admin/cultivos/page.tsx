import type { Metadata } from "next";

import { ProductionPlansPage } from "@/components/admin/production/production-plans-page";

export const metadata: Metadata = {
  title: "Cultivos · Agro",
};

export default function AdminProductionPlansPage() {
  return <ProductionPlansPage />;
}
