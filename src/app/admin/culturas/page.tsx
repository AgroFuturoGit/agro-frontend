import type { Metadata } from "next";

import { CropsPage } from "@/components/admin/crops/crops-page";

export const metadata: Metadata = {
  title: "Culturas · Agro",
};

export default function AdminCropsPage() {
  return <CropsPage />;
}
