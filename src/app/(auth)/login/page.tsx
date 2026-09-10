import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sprout } from "lucide-react";

import { LoginForm } from "@/components/login-form";


const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1600&q=80";

export const metadata: Metadata = {
  title: "Entrar · ProduPlan",
  description: "Acesse o painel do ProduPlan",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-2">
      <div className="flex flex-col gap-8 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sprout className="size-4" />
            </span>
            ProduPlan
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground md:text-left">
          © {new Date().getFullYear()} ProduPlan. Todos os direitos reservados.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-emerald-950 lg:block">
        <Image
          src={HERO_IMAGE_URL}
          alt="Vista aérea de uma plantação"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 0px"
          className="object-cover"
        />

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-emerald-950/55 via-emerald-900/15 to-emerald-950/75"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,oklch(0.18_0.05_150_/_0.35)_100%)]"
        />

        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-white/90">
            <span className="grid size-7 place-items-center rounded-md bg-white/15 text-white backdrop-blur">
              <Sprout className="size-3.5" />
            </span>
            ProduPlan · Plataforma
          </div>

          <div className="max-w-md space-y-6 drop-shadow-sm">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
              Gestão inteligente para o campo, do plantio à colheita.
            </h2>
            <p className="text-sm leading-relaxed text-white/85 text-pretty">
              Acompanhe talhões, insumos e produtividade em um só lugar.
              Decisões mais rápidas, baseadas em dados reais da sua operação.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
