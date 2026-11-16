import type { BreadcrumbItem } from "@/components/ui/breadcrumb";
import type { Role } from "@/lib/auth";

export type PlanBreadcrumbPage = "plans" | "detail";

export type PlanBreadcrumbIds = {
  orgId: string;
  communityId: string;
  producerId: string;
};

/** Nomes já resolvidos; ausentes (ou a lista inteira nula) caem nos rótulos reserva. */
export type PlanBreadcrumbNames = {
  org?: string | null;
  community?: string | null;
  producer?: string | null;
  plan?: string | null;
};

export type BuildPlanBreadcrumbInput = {
  role: Role | null;
  page: PlanBreadcrumbPage;
  ids: PlanBreadcrumbIds;
  names?: PlanBreadcrumbNames | null;
};

/**
 * Breadcrumb da página de planos do agricultor e do detalhe do plano,
 * conforme o papel. MANAGER e ADMIN veem a cascata completa (como antes);
 * TECHNICIAN e FARMER só veem níveis que podem abrir: nenhum link para
 * `/organizacoes/{id}` ou `/comunidades/{id}`. Com a role ainda
 * desconhecida (`null`), não há breadcrumb.
 */
export function buildPlanBreadcrumb({
  role,
  page,
  ids,
  names,
}: BuildPlanBreadcrumbInput): BreadcrumbItem[] {
  const { orgId, communityId, producerId } = ids;
  const orgHref = `/admin/organizacoes/${orgId}`;
  const communityHref = `${orgHref}/comunidades/${communityId}`;
  const producerHref = `${communityHref}/produtores/${producerId}`;

  const producerLabel = names?.producer ?? "Agricultor";
  const planLabel = names?.plan ?? "Plano de produção";

  switch (role) {
    case "ADMIN":
    case "MANAGER": {
      const cascade: BreadcrumbItem[] = [
        { label: "Organizações", href: "/admin/organizacoes" },
        { label: names?.org ?? "Organização", href: orgHref },
        { label: names?.community ?? "Comunidade", href: communityHref },
      ];
      return page === "plans"
        ? [...cascade, { label: producerLabel }]
        : [
            ...cascade,
            { label: producerLabel, href: producerHref },
            { label: planLabel },
          ];
    }
    case "TECHNICIAN": {
      const root: BreadcrumbItem = {
        label: "Agricultores atendidos",
        href: "/admin/organizacoes",
      };
      return page === "plans"
        ? [root, { label: producerLabel }]
        : [root, { label: producerLabel, href: producerHref }, { label: planLabel }];
    }
    case "FARMER":
      return page === "plans"
        ? []
        : [{ label: "Meus planos", href: producerHref }, { label: planLabel }];
    default:
      return [];
  }
}
