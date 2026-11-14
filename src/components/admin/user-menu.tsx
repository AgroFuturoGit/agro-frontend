"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clearAppCaches,
  clearSession,
  getUserSnapshot,
  subscribeUserStorage,
} from "@/lib/auth";

function getServerUserSnapshot() {
  return null;
}

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const user = useSyncExternalStore(
    subscribeUserStorage,
    getUserSnapshot,
    getServerUserSnapshot,
  );

  function handleLogout() {
    clearSession();
    void clearAppCaches();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            // Abaixo de 640px só as iniciais ficam visíveis: o nome descreve
            // a função do botão e mantém o nome visível dentro dele.
            aria-label={user ? `Menu do usuário: ${user.fullName}` : "Menu do usuário"}
            className="h-10 gap-3 rounded-full pr-2 pl-1 text-header-foreground"
          >
            <Avatar>
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                {user ? initials(user.fullName) : "··"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {user?.fullName ?? "Carregando…"}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="text-sm font-medium text-foreground">
              {user?.fullName ?? "Carregando…"}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
