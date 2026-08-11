import type { Metadata } from "next";

import { HarvestsPage } from "@/components/admin/harvests/harvests-page";

export const metadata: Metadata = {
  title: "Safras · ProduPlan",
};

export default function AdminHarvestsPage() {
  return <HarvestsPage />;
}
