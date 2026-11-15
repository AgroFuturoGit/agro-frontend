import { FileQuestion } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-4 py-12">
      <EmptyState
        variant="card"
        headingLevel="h1"
        icon={FileQuestion}
        eyebrow="Erro 404"
        title="Página não encontrada"
        hint="O endereço que você tentou abrir não existe ou foi movido."
        action={{ label: "Voltar ao início", href: "/", variant: "default" }}
        className="w-full max-w-md"
      />
    </main>
  );
}
