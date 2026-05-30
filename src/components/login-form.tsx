"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiRequest } from "@/lib/api";
import { persistSession, type LoginResponse } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function LoginForm({ className, ...props }: React.ComponentProps<"form">) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      persistSession(data);
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível conectar ao servidor. Tente novamente.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <div className="flex flex-col gap-2 text-center md:text-left">
        <h1 className="text-2xl font-semibold tracking-tight">
          Acesse sua conta
        </h1>
        <p className="text-sm text-muted-foreground text-balance">
          Entre com seu e-mail e senha para continuar.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@empresa.com.br"
              required
              disabled={submitting}
              className="h-10 pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              minLength={8}
              disabled={submitting}
              className="h-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

      </div>

      <Button type="submit" size="lg" disabled={submitting} className="h-10 w-full">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
