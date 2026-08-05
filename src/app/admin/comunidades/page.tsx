import type { Metadata } from "next";

import { CommunitiesPage } from "@/components/admin/communities/communities-page";

export const metadata: Metadata = {
  title: "Comunidades · Agro",
};

export default function AdminCommunitiesPage() {
  return <CommunitiesPage />;
}
