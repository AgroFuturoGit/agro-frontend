import type { Metadata } from "next";
import { Leaf, Sprout, TrendingUp, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Painel · Agro",
};

const STATS = [
  { label: "Produtores ativos", value: "0", icon: Users },
  { label: "Safras em curso", value: "0", icon: Sprout },
  { label: "Cultivos cadastrados", value: "0", icon: Leaf },
  { label: "Produtividade média", value: "—", icon: TrendingUp },
];

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
        <p className="text-sm text-muted-foreground">
          Indicadores principais da operação. Os módulos serão liberados conforme
          o cadastro for sendo realizado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">{label}</span>
              <Icon className="size-4" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-card-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Selecione um módulo na lateral para começar.
      </div>
    </div>
  );
}
