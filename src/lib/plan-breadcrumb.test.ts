import { describe, expect, it } from "vitest";

import type { Role } from "./auth";
import { buildPlanBreadcrumb, type PlanBreadcrumbPage } from "./plan-breadcrumb";

const ids = { orgId: "org-1", communityId: "com-1", producerId: "prod-1" };
const names = {
  org: "Cooperativa Verde",
  community: "Vale do Sol",
  producer: "Maria Souza",
  plan: "Milho — AG 1051",
};
const producerHref = "/admin/organizacoes/org-1/comunidades/com-1/produtores/prod-1";

describe("buildPlanBreadcrumb", () => {
  describe.each<Role>(["ADMIN", "MANAGER"])("%s (igual ao atual)", (role) => {
    it("página de planos: cascata de 4 níveis", () => {
      expect(buildPlanBreadcrumb({ role, page: "plans", ids, names })).toEqual([
        { label: "Organizações", href: "/admin/organizacoes" },
        { label: "Cooperativa Verde", href: "/admin/organizacoes/org-1" },
        {
          label: "Vale do Sol",
          href: "/admin/organizacoes/org-1/comunidades/com-1",
        },
        { label: "Maria Souza" },
      ]);
    });

    it("detalhe do plano: cascata + agricultor com link + plano", () => {
      expect(buildPlanBreadcrumb({ role, page: "detail", ids, names })).toEqual([
        { label: "Organizações", href: "/admin/organizacoes" },
        { label: "Cooperativa Verde", href: "/admin/organizacoes/org-1" },
        {
          label: "Vale do Sol",
          href: "/admin/organizacoes/org-1/comunidades/com-1",
        },
        { label: "Maria Souza", href: producerHref },
        { label: "Milho — AG 1051" },
      ]);
    });

    it("names nulo: rótulos reserva", () => {
      expect(buildPlanBreadcrumb({ role, page: "plans", ids, names: null })).toEqual([
        { label: "Organizações", href: "/admin/organizacoes" },
        { label: "Organização", href: "/admin/organizacoes/org-1" },
        {
          label: "Comunidade",
          href: "/admin/organizacoes/org-1/comunidades/com-1",
        },
        { label: "Agricultor" },
      ]);
      expect(buildPlanBreadcrumb({ role, page: "detail", ids, names: null })).toEqual([
        { label: "Organizações", href: "/admin/organizacoes" },
        { label: "Organização", href: "/admin/organizacoes/org-1" },
        {
          label: "Comunidade",
          href: "/admin/organizacoes/org-1/comunidades/com-1",
        },
        { label: "Agricultor", href: producerHref },
        { label: "Plano de produção" },
      ]);
    });
  });

  describe("TECHNICIAN", () => {
    it("página de planos: Agricultores atendidos > agricultor", () => {
      expect(
        buildPlanBreadcrumb({ role: "TECHNICIAN", page: "plans", ids, names }),
      ).toEqual([
        { label: "Agricultores atendidos", href: "/admin/organizacoes" },
        { label: "Maria Souza" },
      ]);
    });

    it("detalhe do plano: Agricultores atendidos > agricultor (link) > plano", () => {
      expect(
        buildPlanBreadcrumb({ role: "TECHNICIAN", page: "detail", ids, names }),
      ).toEqual([
        { label: "Agricultores atendidos", href: "/admin/organizacoes" },
        { label: "Maria Souza", href: producerHref },
        { label: "Milho — AG 1051" },
      ]);
    });

    it("names nulo: rótulos reserva", () => {
      expect(
        buildPlanBreadcrumb({ role: "TECHNICIAN", page: "plans", ids, names: null }),
      ).toEqual([
        { label: "Agricultores atendidos", href: "/admin/organizacoes" },
        { label: "Agricultor" },
      ]);
      expect(
        buildPlanBreadcrumb({ role: "TECHNICIAN", page: "detail", ids, names: null }),
      ).toEqual([
        { label: "Agricultores atendidos", href: "/admin/organizacoes" },
        { label: "Agricultor", href: producerHref },
        { label: "Plano de produção" },
      ]);
    });
  });

  describe("FARMER", () => {
    it("página de planos: sem breadcrumb", () => {
      expect(buildPlanBreadcrumb({ role: "FARMER", page: "plans", ids, names })).toEqual([]);
    });

    it("detalhe do plano: Meus planos > plano", () => {
      expect(
        buildPlanBreadcrumb({ role: "FARMER", page: "detail", ids, names }),
      ).toEqual([
        { label: "Meus planos", href: producerHref },
        { label: "Milho — AG 1051" },
      ]);
    });

    it("names nulo: rótulos reserva", () => {
      expect(
        buildPlanBreadcrumb({ role: "FARMER", page: "plans", ids, names: null }),
      ).toEqual([]);
      expect(
        buildPlanBreadcrumb({ role: "FARMER", page: "detail", ids, names: null }),
      ).toEqual([
        { label: "Meus planos", href: producerHref },
        { label: "Plano de produção" },
      ]);
    });
  });

  it("role desconhecida (null): sem breadcrumb", () => {
    expect(buildPlanBreadcrumb({ role: null, page: "plans", ids, names })).toEqual([]);
    expect(buildPlanBreadcrumb({ role: null, page: "detail", ids, names })).toEqual([]);
  });

  describe.each<Role>(["TECHNICIAN", "FARMER"])(
    "%s: nenhum link para rota bloqueada",
    (role) => {
      it.each<PlanBreadcrumbPage>(["plans", "detail"])("página %s", (page) => {
        for (const n of [names, null]) {
          const hrefs = buildPlanBreadcrumb({ role, page, ids, names: n })
            .map((item) => item.href)
            .filter((href): href is string => href !== undefined);
          for (const href of hrefs) {
            expect(href).not.toMatch(/\/organizacoes\/[^/]+$/);
            expect(href).not.toMatch(/\/comunidades\/[^/]+$/);
          }
        }
      });
    },
  );
});
