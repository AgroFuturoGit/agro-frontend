import { FileQuestion } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-4 py-12">
      {/* `not-found.js` não aceita `metadata`: o React 19 leva o <title> ao
          <head>, e o anúncio de rota do Next lê este título (A11Y-L6-1). */}
      <title>Página não encontrada · ProduPlan</title>
      {/* A página inteira é o estado: sem região viva (A11Y-L6-2). O CTA vai
          ao painel; sem sessão, o proxy leva ao login (UX-L6-01). */}
      <EmptyState
        variant="card"
        role={null}
        headingLevel="h1"
        icon={FileQuestion}
        eyebrow="Erro 404"
        title="Página não encontrada"
        hint="O endereço que você tentou abrir não existe ou foi movido."
        action={{ label: "Ir para o painel", href: "/admin", variant: "default" }}
        className="w-full max-w-md"
      />
    </main>
  );
}
