import type { Metadata } from "next";

import { ProducersPage } from "@/components/admin/producers/producers-page";

export const metadata: Metadata = {
  title: "Produtores · Agro",
};

export default function AdminProducersPage() {
  return <ProducersPage />;
}
