import Link from "next/link";
import { CheckCircle2, Leaf, Sprout } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { NAV_ITEMS, STATS, FEATURES } from "@/data/content";
import { ScrollLink } from "@/components/ScrollLink";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Sprout className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">SmartAgro</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            {NAV_ITEMS.map((item) => (
              <ScrollLink
                key={item.label}
                href={item.href}
                className="transition-colors hover:text-foreground cursor-pointer"
              >
                {item.label}
              </ScrollLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={buttonVariants({
                className:
                  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700",
              })}
            >
              Acessar Plataforma
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section
          id="inicio"
          className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            <div className="size-125 rounded-full bg-emerald-500/5 blur-3xl" />
          </div>

          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Leaf className="size-3.5" />
              <span>Tecnologia para a Agricultura Familiar e Cooperativas</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Gestão inteligente para o campo,{" "}
              <br className="hidden sm:inline" />
              <span className="text-emerald-600 dark:text-emerald-500">
                do plantio à colheita.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Acompanhe talhões, estimativas de safra, apontamentos diários de
              colheita e a conformidade de produtores em uma única plataforma
              integrada, preparada para funcionar no campo.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/login"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "w-full bg-emerald-600 px-8 text-white hover:bg-emerald-700 sm:w-auto",
                })}
              >
                Entrar no Sistema
              </Link>

              <ScrollLink
                href="#plataforma"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full sm:w-auto cursor-pointer",
                })}
              >
                Conheça os Módulos
              </ScrollLink>
            </div>

            <div
              id="indicadores"
              className="mt-16 grid grid-cols-2 gap-6 border-t border-border/60 pt-12 md:grid-cols-4"
            >
              {STATS.map((stat, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {stat.value === "PWA" ? (
                      <span className="text-emerald-600 dark:text-emerald-500">
                        {stat.value}
                      </span>
                    ) : (
                      stat.value
                    )}
                  </span>
                  <span className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="plataforma"
          className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8"
        >
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-destructive/60" />
                <div className="size-3 rounded-full bg-amber-500/60" />
                <div className="size-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex h-6 w-64 items-center justify-center rounded-md bg-background/80 px-3 text-xs text-muted-foreground font-mono">
                app.smartagro.com.br
              </div>
              <div className="w-10" />
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-3 md:p-8">
              {FEATURES.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={idx}
                    className="flex flex-col justify-between border-border/60 p-6 shadow-none"
                  >
                    <div>
                      <div className="mb-4 inline-flex rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                        <Icon className="size-6" />
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" />
                      <span>{feature.highlight}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 bg-muted/20 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 font-medium">
            <Sprout className="size-4 text-emerald-600" />
            <span>SmartAgro — Plataforma Integrada de Gestão Agrícola</span>
          </div>
          <p>
            © {new Date().getFullYear()} SmartAgro. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
