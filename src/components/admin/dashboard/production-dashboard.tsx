"use client";

import { useEffect, useState } from "react";

import { FarmerDashboard } from "@/components/admin/dashboard/farmer-dashboard";
import { ManagementDashboard } from "@/components/admin/dashboard/management-dashboard";
import { TechnicianDashboard } from "@/components/admin/dashboard/technician-dashboard";
import { readUserFromStorage, type Role } from "@/lib/auth";

/**
 * Visão geral: o agricultor vê o dashboard da Feature 6.1; o técnico, o da
 * 6.2; ADMIN e MANAGER, o macro-gerencial da 6.3 (global e da organização). Sem
 * role conhecida nada renderiza (falha fechado).
 */
export function ProductionDashboard() {
  const [role, setRole] = useState<Role | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(readUserFromStorage()?.role ?? null);
  }, []);

  if (!role) return null;
  if (role === "FARMER") return <FarmerDashboard />;
  if (role === "TECHNICIAN") return <TechnicianDashboard />;
  if (role === "MANAGER" || role === "ADMIN") return <ManagementDashboard role={role} />;
  return null;
}
