import Link from "next/link";
import { Sprout } from "lucide-react";

import { SessionRefresher } from "@/components/admin/session-refresher";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { UserMenu } from "@/components/admin/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="light bg-background text-foreground">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo
      </a>
      <SessionRefresher />
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar collapsible="icon">
            <SidebarHeader className="px-5 pt-7 pb-0 group-data-[collapsible=icon]:px-2">
              <Link
                href="/admin"
                aria-label="ProduPlan — Visão geral"
                className="flex h-9 items-center gap-2 rounded-nav px-3 text-lg font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:px-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-brand-foreground group-data-[collapsible=icon]:size-8">
                  <Sprout className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="group-data-[collapsible=icon]:hidden">
                  ProduPlan
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup className="px-5 pt-8 group-data-[collapsible=icon]:px-2">
                <nav aria-label="Navegação principal">
                  <SidebarNav />
                </nav>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="px-5 pb-7 group-data-[collapsible=icon]:px-2">
              <p className="px-3 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                © {new Date().getFullYear()} ProduPlan
              </p>
            </SidebarFooter>
          </Sidebar>

          {/* Coluna do conteúdo. O <header> fica fora do <main> (vira o
              landmark banner) e o skip link salta direto para o conteúdo da
              página, sem passar de novo pelo gatilho e pelo menu do usuário.
              Mesmo visual do SidebarInset, que sempre renderiza <main>. */}
          <div
            data-slot="sidebar-inset"
            className="relative flex w-full min-w-0 flex-1 flex-col bg-background"
          >
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-header px-4 text-header-foreground md:h-(--header-height) md:px-6 lg:px-(--page-padding-x)">
              <SidebarTrigger className="-ml-1.5 size-control [&_svg:not([class*='size-'])]:size-6" />
              <h1 className="min-w-0 truncate text-lg font-semibold md:text-2xl">
                Painel administrativo
              </h1>
              <div className="ml-auto shrink-0">
                <UserMenu />
              </div>
            </header>
            <main
              id="conteudo-principal"
              tabIndex={-1}
              className="flex flex-1 flex-col gap-section-sm overflow-y-auto p-4 outline-none md:px-6 md:pt-(--page-padding-y) md:pb-8 lg:px-(--page-padding-x)"
            >
              {children}
            </main>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
