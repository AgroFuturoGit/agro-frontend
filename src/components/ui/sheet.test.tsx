import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

// Fixture propositalmente genérico: o painel lateral é primitivo de UI e
// não deve saber nada do domínio. Se algum teste aqui precisar de um
// usuário, uma safra ou um produtor, o componente vazou responsabilidade.
function TestSheet({
  showCloseButton,
}: {
  showCloseButton?: boolean;
} = {}) {
  return (
    <Sheet>
      <SheetTrigger>Abrir painel</SheetTrigger>
      <SheetContent showCloseButton={showCloseButton}>
        <SheetHeader>
          <SheetTitle>Título do painel</SheetTitle>
          <SheetDescription>Descrição do painel</SheetDescription>
        </SheetHeader>
        <div>
          <p>Conteúdo filho</p>
          <button type="button">Ação do filho</button>
        </div>
        <SheetFooter>
          <SheetClose>Fechar</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet — abertura e renderização dos filhos", () => {
  afterEach(cleanup);

  it("não renderiza o conteúdo enquanto está fechado", () => {
    render(<TestSheet />);

    expect(screen.getByRole("button", { name: "Abrir painel" })).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo filho")).not.toBeInTheDocument();
    expect(screen.queryByText("Título do painel")).not.toBeInTheDocument();
  });

  it("renderiza título, descrição e os filhos arbitrários ao abrir pelo trigger", async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole("button", { name: "Abrir painel" }));

    expect(await screen.findByText("Título do painel")).toBeInTheDocument();
    expect(screen.getByText("Descrição do painel")).toBeInTheDocument();
    // O painel é agnóstico ao que recebe: um parágrafo e um botão
    // quaisquer precisam chegar intactos ao DOM.
    expect(screen.getByText("Conteúdo filho")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ação do filho" })).toBeInTheDocument();
  });

  it("fecha pelo SheetClose, removendo os filhos do DOM", async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole("button", { name: "Abrir painel" }));
    await screen.findByText("Conteúdo filho");

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByText("Conteúdo filho")).not.toBeInTheDocument();
  });

  it("expõe o botão de fechar padrão, e o omite quando showCloseButton é false", async () => {
    const user = userEvent.setup();

    const { unmount } = render(<TestSheet />);
    await user.click(screen.getByRole("button", { name: "Abrir painel" }));
    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
    unmount();

    render(<TestSheet showCloseButton={false} />);
    await user.click(screen.getByRole("button", { name: "Abrir painel" }));
    await screen.findByText("Conteúdo filho");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});

describe("Sheet — controle externo de abertura", () => {
  afterEach(cleanup);

  it("respeita a prop `open` e notifica `onOpenChange` ao fechar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    function ControlledHost() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet
          open={open}
          onOpenChange={(next: boolean) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Painel controlado</SheetTitle>
              <SheetDescription>Aberto por prop</SheetDescription>
            </SheetHeader>
            <p>Filho controlado</p>
          </SheetContent>
        </Sheet>
      );
    }

    render(<ControlledHost />);

    // Já nasce aberto: quem controla é o estado do pai, não um clique.
    expect(await screen.findByText("Filho controlado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Filho controlado")).not.toBeInTheDocument();
  });
});

describe("Sheet — padding do cabeçalho e rodapé", () => {
  afterEach(cleanup);

  // Contraparte do teste de padding em `user-form-drawer.test.tsx`: aquele
  // guarda o contêiner dos campos, este guarda a origem do valor com que
  // ele precisa se alinhar. Se o `p-4` daqui mudar, o alinhamento vira
  // decisão consciente em vez de descoberta visual.
  it("cabeçalho e rodapé carregam o padding p-4 que o conteúdo precisa acompanhar", async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole("button", { name: "Abrir painel" }));

    const header = (await screen.findByText("Título do painel")).parentElement;
    const footer = screen.getByRole("button", { name: "Fechar" }).parentElement;

    expect(header?.className).toMatch(/\bp-4\b/);
    expect(footer?.className).toMatch(/\bp-4\b/);
  });
});
