import { useState, type ReactNode } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "@/hooks/use-mobile";

import { DataTable } from "./data-table";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

// `useIsMobile` mockado no boundary do hook — cada teste controla o
// viewport explicitamente, sem depender de `window.matchMedia` (que o
// jsdom não implementa).
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));

// Fixture propositalmente genérico: nenhum tipo de entidade concreta do
// domínio aparece aqui, para provar que os componentes são reusáveis.
type Item = {
  id: string;
  label: string;
  category: string;
};

const ITEMS: Item[] = [
  { id: "1", label: "Carlos", category: "Alfa" },
  { id: "2", label: "Ana", category: "Beta" },
  { id: "3", label: "Bruno", category: "Gama" },
];

const columns: ColumnDef<Item>[] = [
  {
    accessorKey: "label",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rótulo" />,
  },
  {
    accessorKey: "category",
    header: "Categoria",
    enableSorting: false,
  },
];

type TestHostProps = {
  data?: Item[];
  isLoading?: boolean;
  hasError?: boolean;
  errorHint?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyActionHref?: string;
  onRetry?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  renderMobileCard?: (row: Row<Item>) => ReactNode;
};

function renderItemCard(row: Row<Item>) {
  return (
    <div data-testid={`card-${row.original.id}`}>
      {row.original.label} — {row.original.category}
    </div>
  );
}

function TestHost({ data = ITEMS, ...rest }: TestHostProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // O React Compiler pula a memoização de componentes que usam
  // `useReactTable` (a instância retorna funções que não podem ser
  // memoizadas com segurança) — é exatamente o comportamento desejado aqui.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <DataTable table={table} columns={columns} {...rest} />;
}

function bodyLabels() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelectorAll("td")[0]?.textContent);
}

function sortableHeader() {
  return screen.getByRole("columnheader", { name: "Rótulo" });
}

describe("DataTable — renderização das linhas", () => {
  afterEach(cleanup);

  it("renderiza uma linha por item do fixture, na ordem original", () => {
    render(<TestHost />);

    expect(bodyLabels()).toEqual(["Carlos", "Ana", "Bruno"]);
    expect(screen.getByText("Gama")).toBeTruthy();
  });
});

describe("DataTable — ordenação por cabeçalho clicável", () => {
  afterEach(cleanup);

  it("alterna asc → desc → asc ao clicar no mesmo cabeçalho, nunca voltando a 'sem ordenação'", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    await user.click(button);
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);

    await user.click(button);
    expect(bodyLabels()).toEqual(["Carlos", "Bruno", "Ana"]);

    await user.click(button);
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);
  });

  it("reflete o estado real da ordenação no aria-sort do <th>", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    expect(sortableHeader().getAttribute("aria-sort")).toBe("none");

    await user.click(button);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("ascending");

    await user.click(button);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("descending");
  });

  it("não expõe aria-sort nem botão em coluna não ordenável", () => {
    render(<TestHost />);

    const header = screen.getByRole("columnheader", { name: "Categoria" });

    expect(header.getAttribute("aria-sort")).toBeNull();
    expect(screen.queryByRole("button", { name: "Categoria" })).toBeNull();
  });

  it("é ativável por teclado (Enter no botão focado), não só por clique de mouse", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });

    // O botão é um `<button type="button">` nativo, então a ativação por
    // Enter depende do comportamento nativo do elemento — que o jsdom não
    // sintetiza em `click` a partir de um `keydown` cru. É exatamente o
    // buraco que o `@testing-library/user-event` preenche: ele reproduz a
    // sequência que o browser dispara, incluindo o `click` resultante.
    // Assim o teste prova a ativação por teclado de verdade, em vez de
    // simular o clique final à mão e presumir o resto.
    await user.tab();
    expect(document.activeElement).toBe(button);

    await user.keyboard("{Enter}");
    expect(bodyLabels()).toEqual(["Ana", "Bruno", "Carlos"]);
    expect(sortableHeader().getAttribute("aria-sort")).toBe("ascending");
  });
});

describe("DataTable — estado de carregamento", () => {
  afterEach(cleanup);

  it("renderiza skeletons no lugar das linhas quando isLoading", () => {
    const { container } = render(<TestHost isLoading />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(
      4 * columns.length,
    );
    expect(screen.queryByText("Carlos")).toBeNull();
  });

  it("anuncia 'Carregando…' numa região aria-live e esconde os skeletons do leitor de tela", () => {
    const { container, rerender } = render(<TestHost isLoading />);

    const live = container.querySelector('[aria-live="polite"].sr-only');
    expect(live).toHaveTextContent("Carregando…");
    expect(container.querySelector("table")).toHaveAttribute("aria-busy", "true");
    container.querySelectorAll('[data-slot="skeleton"]').forEach((skeleton) => {
      expect(skeleton.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    rerender(<TestHost />);
    // Fim do carregamento (M3): frase curta com o total, sem role=status.
    expect(live).toHaveTextContent(`${ITEMS.length} registros carregados.`);
    expect(container.querySelector("table")).not.toHaveAttribute("aria-busy");
  });

  it("fim do carregamento: singular, e nada a anunciar no vazio ou no erro", () => {
    const { container, rerender } = render(<TestHost data={ITEMS.slice(0, 1)} isLoading />);
    const live = container.querySelector('[aria-live="polite"].sr-only');
    rerender(<TestHost data={ITEMS.slice(0, 1)} />);
    expect(live).toHaveTextContent("1 registro carregado.");

    rerender(<TestHost data={[]} isLoading />);
    rerender(<TestHost data={[]} />);
    expect(live).toHaveTextContent("");

    rerender(<TestHost data={[]} isLoading />);
    rerender(<TestHost data={[]} hasError />);
    expect(live).toHaveTextContent("");
  });

  it("a mensagem de fim não muda quando a lista é filtrada depois", () => {
    const { container, rerender } = render(<TestHost isLoading />);
    const live = container.querySelector('[aria-live="polite"].sr-only');
    rerender(<TestHost />);
    rerender(<TestHost data={ITEMS.slice(0, 2)} />);
    expect(live).toHaveTextContent(`${ITEMS.length} registros carregados.`);
  });

  it("no layout de cards, o container fica aria-busy durante o carregamento", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const { container, rerender } = render(
      <TestHost isLoading renderMobileCard={renderItemCard} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();

    rerender(<TestHost renderMobileCard={renderItemCard} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });
});

describe("DataTable — os três estados de DataTableStatus", () => {
  afterEach(cleanup);

  it("erro: anuncia com role='alert', oferece 'Tentar novamente' e nunca cai no texto de vazio", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<TestHost data={[]} hasError onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os dados.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Nenhum registro cadastrado ainda.")).toBeNull();
    expect(screen.queryByText("Nenhum resultado para os filtros aplicados.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("erro: usa o errorHint informado no lugar da dica padrão", () => {
    render(
      <TestHost data={[]} hasError errorHint="Falha de rede ao buscar os dados." />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Falha de rede ao buscar os dados.");
    expect(alert.textContent).not.toContain("Tente novamente em alguns instantes.");
  });

  it("vazio sem filtro ativo: oferece a ação de vazio quando informada", async () => {
    const user = userEvent.setup();
    const onEmptyAction = vi.fn();
    render(
      <TestHost
        data={[]}
        emptyActionLabel="Criar primeiro item"
        onEmptyAction={onEmptyAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Criar primeiro item" }));
    expect(onEmptyAction).toHaveBeenCalledTimes(1);
  });

  it("vazio com filtro ativo: a ação de vazio dá lugar a 'Limpar filtros'", () => {
    render(
      <TestHost
        data={[]}
        hasActiveFilters
        onClearFilters={() => {}}
        emptyActionLabel="Criar primeiro item"
        onEmptyAction={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Criar primeiro item" })).toBeNull();
  });

  it("vazio sem filtro ativo: role='status', mensagem de 'nenhum registro' e nenhuma ação", () => {
    render(<TestHost data={[]} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum registro cadastrado ainda.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });

  it("vazio com filtro ativo: mensagem distinta e ação 'Limpar filtros'", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<TestHost data={[]} hasActiveFilters onClearFilters={onClearFilters} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum resultado para os filtros aplicados.");
    expect(status.textContent).toContain("Tente ajustar ou limpar os filtros.");
    expect(screen.queryByText("Nenhum registro cadastrado ainda.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable — compatibilidade sem renderMobileCard", () => {
  afterEach(cleanup);

  it("em viewport mobile, sem a prop renderMobileCard, continua renderizando <table>", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(<TestHost />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(bodyLabels()).toEqual(["Carlos", "Ana", "Bruno"]);
  });
});

describe("DataTable — modo card (mobile)", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it("em viewport mobile com renderMobileCard, renderiza um card por item e nenhuma <table>", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(<TestHost renderMobileCard={renderItemCard} />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByTestId("card-1")).toBeTruthy();
    expect(screen.getByTestId("card-2")).toBeTruthy();
    expect(screen.getByTestId("card-3")).toBeTruthy();
  });

  it("em viewport desktop, mesmo com renderMobileCard informado, continua renderizando <table>", () => {
    vi.mocked(useIsMobile).mockReturnValue(false);

    render(<TestHost renderMobileCard={renderItemCard} />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByTestId("card-1")).toBeNull();
  });

  it("carregando: cards de skeleton no lugar dos cards de dado, fora de qualquer <table>", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    const { container } = render(
      <TestHost renderMobileCard={renderItemCard} isLoading />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByTestId("card-1")).toBeNull();
  });

  it("erro: mesmo alerta e ação 'Tentar novamente' do modo tabela, fora de qualquer <table>", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <TestHost
        renderMobileCard={renderItemCard}
        data={[]}
        hasError
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os dados.");

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("vazio sem filtro ativo: mesma mensagem do modo tabela, fora de qualquer <table>", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(<TestHost renderMobileCard={renderItemCard} data={[]} />);

    expect(screen.queryByRole("table")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum registro cadastrado ainda.");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it("vazio com filtro ativo: mesma mensagem e ação 'Limpar filtros' do modo tabela", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup();
    const onClearFilters = vi.fn();

    render(
      <TestHost
        renderMobileCard={renderItemCard}
        data={[]}
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Nenhum resultado para os filtros aplicados.");

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable — erro como InlineAlert (UX-3)", () => {
  afterEach(cleanup);

  it("erro usa o InlineAlert destrutivo, sem o visual de estado vazio", () => {
    const { container } = render(<TestHost data={[]} hasError onRetry={() => {}} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "inline-alert");
    expect(alert).toHaveAttribute("data-variant", "destructive");
    expect(alert.textContent).toContain("Tente novamente em alguns instantes.");
    expect(container.querySelector('[data-slot="empty-state"]')).toBeNull();
  });

  it("sem onRetry, não oferece 'Tentar novamente'", () => {
    render(<TestHost data={[]} hasError />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });
});

describe("DataTable — CTA do vazio como link (UX-7)", () => {
  afterEach(cleanup);

  it("emptyActionHref vira link real com o peso do botão principal", () => {
    render(
      <TestHost data={[]} emptyActionLabel="Novo item" emptyActionHref="/admin/itens/novo" />,
    );

    const link = screen.getByRole("link", { name: "Novo item" });
    expect(link).toHaveAttribute("href", "/admin/itens/novo");
    expect(link).toHaveClass("bg-primary");
    expect(screen.queryByRole("button", { name: "Novo item" })).toBeNull();
  });

  it("com filtro ativo o link dá lugar a 'Limpar filtros'", () => {
    render(
      <TestHost
        data={[]}
        hasActiveFilters
        onClearFilters={() => {}}
        emptyActionLabel="Novo item"
        emptyActionHref="/admin/itens/novo"
      />,
    );

    expect(screen.queryByRole("link", { name: "Novo item" })).toBeNull();
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
  });
});

describe("DataTable — columnDef.meta e RowActions (UX-4/UX-5)", () => {
  afterEach(cleanup);

  type Row2 = { id: string; name: string; email: string; qty: number };
  const DATA: Row2[] = [{ id: "1", name: "Ana", email: "ana@x.com", qty: 1200 }];

  function MetaHost({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
    const cols: ColumnDef<Row2>[] = [
      { accessorKey: "name", header: "Nome", meta: { cellVariant: "primary" } },
      { accessorKey: "email", header: "E-mail", meta: { cellVariant: "secondary" } },
      { accessorKey: "qty", header: "Quantidade", meta: { numeric: true } },
      {
        id: "actions",
        header: "Ações",
        cell: ({ row }) => (
          <DataTableRowActions
            actions={[
              { label: `Editar ${row.original.name}`, icon: Pencil, onClick: onEdit },
              {
                label: `Excluir ${row.original.name}`,
                icon: Trash2,
                onClick: onDelete,
                tone: "destructive",
              },
            ]}
          />
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
      data: DATA,
      columns: cols,
      getCoreRowModel: getCoreRowModel(),
    });
    return <DataTable table={table} columns={cols} />;
  }

  it("célula principal/secundária e numérica à direita com tabular-nums", () => {
    render(<MetaHost />);

    expect(screen.getByRole("cell", { name: "Ana" })).toHaveClass("font-medium", "text-foreground");
    expect(screen.getByRole("cell", { name: "ana@x.com" })).toHaveClass("text-muted-foreground");
    const qtyCell = screen.getByRole("cell", { name: "1200" });
    expect(qtyCell).toHaveClass("text-right", "tabular-nums");
    expect(screen.getByRole("columnheader", { name: "Quantidade" })).toHaveClass("text-right");
  });

  it("coluna 'Ações' alinhada à esquerda no cabeçalho e no grupo de botões (Figma 97:91)", () => {
    render(<MetaHost />);

    expect(screen.getByRole("columnheader", { name: "Ações" })).not.toHaveClass("text-right");
    const group = screen
      .getByRole("button", { name: "Editar Ana" })
      .closest('[data-slot="data-table-row-actions"]');
    expect(group).toHaveClass("justify-start", "-ml-2");
    expect(group?.closest("td")).not.toHaveClass("text-right");
  });

  it("colunas sem meta continuam alinhadas à esquerda (compatível)", () => {
    render(<TestHost />);

    const header = screen.getByRole("columnheader", { name: "Categoria" });
    expect(header.className).not.toMatch(/text-right|text-center/);
  });

  it("RowActions: botões só com ícone têm nome, ícone decorativo e tom destrutivo na exclusão", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<MetaHost onEdit={onEdit} onDelete={onDelete} />);

    const edit = screen.getByRole("button", { name: "Editar Ana" });
    const del = screen.getByRole("button", { name: "Excluir Ana" });
    expect(edit.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(edit).toHaveClass("text-muted-foreground");
    expect(del).toHaveClass("text-destructive");
    expect(edit).toHaveClass("size-control-sm");

    await user.click(edit);
    await user.click(del);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("RowActions com href renderiza link", () => {
    render(
      <DataTableRowActions
        actions={[{ label: "Ver plano", icon: Pencil, href: "/admin/planos/1" }]}
      />,
    );

    expect(screen.getByRole("link", { name: "Ver plano" })).toHaveAttribute(
      "href",
      "/admin/planos/1",
    );
  });

  it("cabeçalho ordenável tem anel de foco opaco (A11Y-2)", () => {
    render(<TestHost />);

    const button = screen.getByRole("button", { name: "Rótulo" });
    expect(button).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring");
    expect(button.className).not.toMatch(/ring-ring\/50/);
  });
});


describe("DataTableRowActions — title e tone primary (lote 4)", () => {
  afterEach(cleanup);

  it("title vira tooltip sem trocar o nome acessível (botão e link)", () => {
    render(
      <DataTableRowActions
        actions={[
          { label: "Ocorrências do apontamento", title: "Ocorrências", icon: Pencil, onClick: vi.fn() },
          { label: "Ver plano", title: "Abrir", icon: Pencil, href: "/admin/planos/1" },
          { label: "Sem dica", icon: Pencil, onClick: vi.fn() },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Ocorrências do apontamento" })).toHaveAttribute(
      "title",
      "Ocorrências",
    );
    expect(screen.getByRole("link", { name: "Ver plano" })).toHaveAttribute("title", "Abrir");
    expect(screen.getByRole("button", { name: "Sem dica" })).not.toHaveAttribute("title");
  });

  it("tone primary usa text-primary, sem cor destrutiva nem neutra", () => {
    render(
      <DataTableRowActions
        actions={[{ label: "Validar", icon: Pencil, onClick: vi.fn(), tone: "primary" }]}
      />,
    );
    const button = screen.getByRole("button", { name: "Validar" });
    expect(button).toHaveClass("text-primary");
    expect(button.className).not.toMatch(/text-destructive|text-muted-foreground/);
  });
});

describe("DataTable — foco quando o botão de erro/vazio desmonta (A11Y-L2-R2-2)", () => {
  afterEach(cleanup);

  // Simula a tela: o retry ou o CTA trocam o estado e o botão some.
  function StatefulHost({ start }: { start: "error" | "empty" }) {
    const [state, setState] = useState<"error" | "empty" | "loading" | "data">(start);
    return (
      <TestHost
        data={state === "data" ? ITEMS : []}
        isLoading={state === "loading"}
        hasError={state === "error"}
        onRetry={() => setState("loading")}
        emptyActionLabel="Criar primeiro item"
        onEmptyAction={() => setState("data")}
      />
    );
  }

  it("'Tentar novamente' leva o foco ao contêiner da tabela, não ao body", async () => {
    const user = userEvent.setup();
    render(<StatefulHost start="error" />);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(screen.getByRole("table"));
    expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
  });

  it("A11Y-L6-3: o contêiner focado é uma região com nome", async () => {
    const user = userEvent.setup();
    render(<StatefulHost start="error" />);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    const region = screen.getByRole("region", { name: "Lista de registros" });
    expect(document.activeElement).toBe(region);
  });

  it("CTA do vazio: o foco fica no contêiner quando o primeiro registro aparece", async () => {
    const user = userEvent.setup();
    render(<StatefulHost start="empty" />);

    await user.click(screen.getByRole("button", { name: "Criar primeiro item" }));

    expect(screen.getByText("Carlos")).toBeTruthy();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(screen.getByRole("table"));
  });

  it("'Limpar filtros' também leva o foco ao contêiner", async () => {
    const user = userEvent.setup();
    function FilteredHost() {
      const [filtered, setFiltered] = useState(true);
      return (
        <TestHost
          data={filtered ? [] : ITEMS}
          hasActiveFilters={filtered}
          onClearFilters={() => setFiltered(false)}
        />
      );
    }
    render(<FilteredHost />);

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(screen.getByRole("table"));
  });
});
