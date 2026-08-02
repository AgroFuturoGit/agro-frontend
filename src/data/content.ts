import { BarChart3, Tractor, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
};

export type StatItem = {
  value: string;
  label: string;
};

export type FeatureCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Início", href: "#inicio" },
  { label: "Sobre", href: "#sobre" },
  { label: "Impacto", href: "#indicadores" },
  { label: "Funcionalidades", href: "#plataforma" },
];

export const STATS: StatItem[] = [
  { value: "100%", label: "Agricultura Familiar" },
  { value: "4", label: "Perfis Integrados (RBAC)" },
  { value: "+10", label: "Culturas Gerenciadas" },
  { value: "PWA", label: "Pronto para Offline" },
];

export const FEATURES: FeatureCard[] = [
  {
    icon: Users,
    title: "Comunidades & Produtores",
    description:
      "Cadastro estruturado por hierarquia cooperativa, garantindo segurança de dados e conformidade de associados.",
    highlight: "Vinculação direta por comunidade",
  },
  {
    icon: Tractor,
    title: "Planejamento de Safra",
    description:
      "Definição de calendário produtivo, cultura agrícola, área de plantio e metas iniciais de expectativa de colheita.",
    highlight: "Histórico completo por talhão",
  },
  {
    icon: BarChart3,
    title: "Apontamentos & Analytics",
    description:
      "Registro de execução diária no campo e comparativo automático entre colheita planejada vs. realizada.",
    highlight: "Cálculos de rendimento em tempo real",
  },
];
