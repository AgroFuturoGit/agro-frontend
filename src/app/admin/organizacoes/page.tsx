import type { Metadata } from "next";

import { OrganizationsPage } from "@/components/admin/organizations/organizations-page";

export const metadata: Metadata = {
  title: "Organizações · Agro",
};

export default function AdminOrganizationsPage() {
  return <OrganizationsPage />;
}
