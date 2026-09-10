import Link from "next/link";
import { Sprout } from "lucide-react";

import { SidebarNav } from "@/components/admin/sidebar-nav";
import { UserMenu } from "@/components/admin/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="light bg-background text-foreground">
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <Link
                href="/admin"
                className="flex h-10 items-center gap-2 px-2 font-semibold tracking-tight"
              >
                <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Sprout className="size-4" />
                </span>
                <span className="group-data-[collapsible=icon]:hidden">
                  ProduPlan
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarNav />
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                © {new Date().getFullYear()} ProduPlan
              </p>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:px-8">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-6" />
              <h1 className="text-lg font-semibold tracking-tight">
                Painel administrativo
              </h1>
              <div className="ml-auto">
                <UserMenu />
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
