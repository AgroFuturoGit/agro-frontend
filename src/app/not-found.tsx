import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">Erro 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        O endereço que você tentou abrir não existe ou foi movido.
      </p>
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </main>
  );
}
