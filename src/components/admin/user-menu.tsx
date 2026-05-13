"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-none">
          {user?.fullName ?? "Carregando…"}
        </p>
        <p className="text-xs text-muted-foreground">
          {user?.email ?? ""}
        </p>
      </div>
      <div
        aria-hidden
        className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      >
        {user ? initials(user.fullName) : "··"}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="gap-2"
      >
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
}
