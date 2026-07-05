import type { Metadata } from "next";
import { Leaf, Sprout, TrendingUp, Users } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          <Card key={label}>
            <CardHeader>
              <CardDescription className="flex items-center justify-between">
                <span>{label}</span>
                <Icon className="size-4" aria-hidden />
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight">
                {value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed bg-transparent ring-0 shadow-none">
        <CardHeader className="items-center text-center">
          <CardDescription>
            Selecione um módulo na lateral para começar.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
