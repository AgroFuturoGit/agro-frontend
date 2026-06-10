import type { Metadata } from "next";

import { RolesPage } from "@/components/admin/roles/roles-page";

export const metadata: Metadata = {
  title: "Perfis · Agro",
};

export default function AdminRolesPage() {
  return <RolesPage />;
}
