import type { Metadata } from "next";

import { OrganizationCommunitiesPage } from "@/components/admin/organizations/organization-communities-page";

export const metadata: Metadata = {
  title: "Comunidades · Agro",
};

export default async function AdminOrganizationCommunitiesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrganizationCommunitiesPage orgId={orgId} />;
}
