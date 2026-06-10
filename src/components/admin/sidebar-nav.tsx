"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Leaf,
  LayoutDashboard,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/produtores", label: "Produtores", icon: Users },
  { href: "/admin/safras", label: "Safras", icon: Sprout },
  { href: "/admin/cultivos", label: "Cultivos", icon: Leaf },
  { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
