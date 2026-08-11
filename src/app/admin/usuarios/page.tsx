import type { Metadata } from "next";

import { UsersPage } from "@/components/admin/users/users-page";

export const metadata: Metadata = {
  title: "Usuários · ProduPlan",
};

export default function AdminUsersPage() {
  return <UsersPage />;
}
