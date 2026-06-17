import type { Metadata } from "next";

import { HarvestsPage } from "@/components/admin/harvests/harvests-page";

export const metadata: Metadata = {
  title: "Safras · Agro",
};

export default function AdminHarvestsPage() {
  return <HarvestsPage />;
}
