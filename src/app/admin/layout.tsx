import Link from "next/link";
import { Sprout } from "lucide-react";

import { SidebarNav } from "@/components/admin/sidebar-nav";
import { UserMenu } from "@/components/admin/user-menu";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="light flex min-h-svh flex-1 bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <Link href="/admin">Agro</Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Agro
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sprout className="size-4" />
            </span>
            <span className="font-semibold tracking-tight">Agro</span>
          </div>
          <h1 className="hidden text-lg font-semibold tracking-tight md:block">
            Painel administrativo
          </h1>
          <UserMenu />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
