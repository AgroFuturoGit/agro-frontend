"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChartLine,
  LayoutGrid,
  ShieldCheck,
  Sprout,
  Tractor,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { readUserFromStorage, type Role } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  labelByRole?: Partial<Record<Role, string>>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutGrid },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    icon: Users,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/admin/perfis",
    label: "Perfis",
    icon: ShieldCheck,
    roles: ["ADMIN"],
  },
  { href: "/admin/culturas", label: "Culturas", icon: Sprout },
  {
    href: "/admin/organizacoes",
    label: "Organizações",
    icon: Building2,
    labelByRole: { TECHNICIAN: "Minhas Assistências", FARMER: "Meus Planos" },
    // Ponto de entrada único da navegação em cascata (Organização →
    // Comunidade → Produtor → Planos): visível às 4 roles. Cada role pousa
    // no nível certo dentro de `organizations-page.tsx` — MANAGER e
    // FARMER são redirecionados automaticamente, nunca escolhem pela UI.
  },
  { href: "/admin/safras", label: "Safras", icon: Tractor },
  {
    href: "/admin/relatorios",
    label: "Relatórios",
    icon: ChartLine,
    // A tela é montada a partir de `GET /farmers/me`, que o backend só
    // libera para FARMER (`hasRole('FARMER')` em `FarmerController`). As
    // demais roles não têm caminho de dados para ela e recebiam 403.
    roles: ["FARMER"],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
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
      {visibleItems.map(({ href, label, labelByRole, icon: Icon }) => {
        const text = (role && labelByRole?.[role]) ?? label;
        const active =
          href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={text}
              className="gap-5 px-3 text-base"
              render={
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpenMobile(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>{text}</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
