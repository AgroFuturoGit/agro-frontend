"use client";

import { useEffect, useState } from "react";
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
import { clearSession, readUserFromStorage, type AuthUser } from "@/lib/auth";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readUserFromStorage());
  }, []);

  function handleLogout() {
    clearSession();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="lg"
            className="h-10 gap-2 rounded-full px-1.5"
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-primary-foreground">
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
