import type { Metadata } from "next";

import { ReportsPage } from "@/components/admin/production/reports-page";

export const metadata: Metadata = {
  title: "Relatórios · Agro",
};

export default function AdminReportsPage() {
  return <ReportsPage />;
}
