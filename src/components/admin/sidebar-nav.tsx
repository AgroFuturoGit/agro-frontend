"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Home,
  Leaf,
  LayoutDashboard,
  ShieldCheck,
  Sprout,
  Users,
  UserCog,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { readUserFromStorage, type Role } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    icon: UserCog,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/admin/perfis",
    label: "Perfis",
    icon: ShieldCheck,
    roles: ["ADMIN"],
  },
  { href: "/admin/culturas", label: "Culturas", icon: Wheat },
  {
    href: "/admin/produtores",
    label: "Produtores",
    icon: Users,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/admin/organizacoes",
    label: "Organizações",
    icon: Building2,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/comunidades",
    label: "Comunidades",
    icon: Home,
    roles: ["ADMIN", "MANAGER"],
  },
  { href: "/admin/safras", label: "Safras", icon: Sprout },
  { href: "/admin/cultivos", label: "Planos de Produção", icon: Leaf },
  { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(readUserFromStorage()?.role ?? null);
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role !== null && item.roles.includes(role)),
  );

  return (
    <SidebarMenu className="gap-1">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={label}
              className="h-9"
              render={
                <Link href={href}>
                  <Icon />
                  <span>{label}</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
