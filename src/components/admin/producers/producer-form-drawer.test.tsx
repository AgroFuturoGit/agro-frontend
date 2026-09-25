import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { ProducerFormDrawer } from "@/components/admin/producers/producer-form-drawer";
import {
  parseProducerRegisterFieldErrors,
  registerProducer,
  type Community,
} from "@/lib/communities";
import { updateProducer, type Producer } from "@/lib/producers";

// Nenhum acesso de rede real — o cliente de API do domínio é mockado
// por completo (o `apiRequest` nunca chega a ser alcançado).
vi.mock("@/lib/communities", () => ({
  registerProducer: vi.fn(),
  parseProducerRegisterFieldErrors: vi.fn(() => ({})),
}));
vi.mock("@/lib/producers", () => ({
  updateProducer: vi.fn(),
}));

const COMMUNITIES: Community[] = [
  {
    id: "community-1",
    name: "Comunidade Alfa",
    organization: {
      id: "org-1",
      name: "Cooperativa Alfa",
      taxId: "11222333000181",
      type: "COOP",
    },
  },
  {
    id: "community-2",
    name: "Comunidade Beta",
    organization: {
      id: "org-1",
      name: "Cooperativa Alfa",
      taxId: "11222333000181",
      type: "COOP",
    },
  },
];

const REGISTERED_PRODUCER: Producer = {
  id: "producer-1",
  aliasName: "Zé do Milho",
  isCompliant: true,
  user: {
    id: "user-1",
    fullName: "José da Silva",
    email: "jose@agro.com",
    cpf: "12345678901",
  },
  community: {
    id: "community-1",
    name: "Comunidade Alfa",
    organization: COMMUNITIES[0].organization,
  },
};

function renderDialog(
  onSaved: () => void = () => {},
  onOpenChange: (open: boolean) => void = () => {},
) {
  return render(
    <ProducerFormDrawer
      mode="create"
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      communities={COMMUNITIES}
      loadingCommunities={false}
    />,
  );
}

function fillTextFields() {
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: "José da Silva" },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "jose@agro.com" },
  });
  fireEvent.change(screen.getByLabelText("CPF"), {
    target: { value: "12345678901" },
  });
  fireEvent.change(screen.getByLabelText("Data de nascimento"), {
    target: { value: "1985-03-10" },
  });
  fireEvent.change(screen.getByLabelText("Nome de exibição (opcional)"), {
    target: { value: "Zé do Milho" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "supersecreta" },
  });
}

// O `Select` do base-ui é portalizado: abrimos pelo trigger (rotulado
// "Comunidade") e clicamos no item pelo texto quando ele monta.
async function selectCommunity(name: string) {
  fireEvent.click(screen.getByLabelText("Comunidade"));
  await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
  fireEvent.click(screen.getByText(name));
}

// Disparamos o evento "submit" diretamente no <form> (via document, pois
// o diálogo é portalizado fora do container de render) para contornar a
// validação nativa HTML5 dos campos `required`/`minLength` e exercitar a
// validação client-side do componente.
function submitForm() {
  const form = document.querySelector("form");
  expect(form).toBeTruthy();
  fireEvent.submit(form as HTMLFormElement);
}

describe("ProducerFormDrawer — cadastro por comunidade (spec.md §5)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("submit válido chama registerProducer(communityId, payload) e dispara onSaved", async () => {
    vi.mocked(registerProducer).mockResolvedValue(REGISTERED_PRODUCER);
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();

    renderDialog(onSaved, onOpenChange);

    await screen.findByLabelText("Nome completo");
    fillTextFields();
    await selectCommunity("Comunidade Alfa");

    submitForm();

    // `communityId` vai como path param (1º argumento), nunca no corpo.
    // O CPF chega mascarado porque `formatCpf` roda no `onChange`.
    await waitFor(() =>
      expect(registerProducer).toHaveBeenCalledWith("community-1", {
        fullName: "José da Silva",
        email: "jose@agro.com",
        password: "supersecreta",
        cpf: "123.456.789-01",
        dateOfBirth: "1985-03-10",
        aliasName: "Zé do Milho",
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renderiza o cadastro em uma barra lateral", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    expect(dialog).toHaveAttribute("data-side", "right");
  });

  it("sem comunidade selecionada mostra erro e não chama registerProducer", async () => {
    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillTextFields();

    submitForm();

    expect(
      await screen.findByText("Selecione a comunidade do agricultor"),
    ).toBeTruthy();
    expect(registerProducer).not.toHaveBeenCalled();
  });

  it("senha com menos de 8 caracteres bloqueia o submit client-side", async () => {
    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillTextFields();
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "1234567" },
    });
    await selectCommunity("Comunidade Alfa");

    submitForm();

    expect(
      await screen.findByText("A senha deve ter no mínimo 8 caracteres"),
    ).toBeTruthy();
    expect(registerProducer).not.toHaveBeenCalled();
  });
});

describe("ProducerFormDrawer — erros de servidor (gap #5 do QA de F02)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("erro do servidor com campo específico é exibido junto ao campo email", async () => {
    const { ApiError } = await import("@/lib/api");
    const errorPayload = { message: "email: já cadastrado" };
    vi.mocked(registerProducer).mockRejectedValue(
      new ApiError(422, "email: já cadastrado", errorPayload),
    );
    vi.mocked(parseProducerRegisterFieldErrors).mockReturnValue({
      email: "já cadastrado",
    });

    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillTextFields();
    await selectCommunity("Comunidade Alfa");

    submitForm();

    const fieldError = await screen.findByText("já cadastrado");
    expect(fieldError).toBeTruthy();
    expect(parseProducerRegisterFieldErrors).toHaveBeenCalledWith(errorPayload);
    // A mensagem fica no mesmo bloco do input de e-mail.
    const emailInput = screen.getByLabelText("E-mail");
    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(fieldError.parentElement).toBe(emailInput.parentElement);
  });

  it("erro geral 500 exibe role=alert e mantém o formulário aberto", async () => {
    const { ApiError } = await import("@/lib/api");
    vi.mocked(registerProducer).mockRejectedValue(
      new ApiError(500, "Erro interno do servidor", {
        message: "Erro interno do servidor",
      }),
    );
    vi.mocked(parseProducerRegisterFieldErrors).mockReturnValue({});
    const onSaved = vi.fn();

    renderDialog(onSaved);

    await screen.findByLabelText("Nome completo");
    fillTextFields();
    await selectCommunity("Comunidade Alfa");

    submitForm();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Erro interno do servidor");
    // O drawer continua aberto e não notifica o pai.
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome completo")).toBeTruthy();
  });
});

const EXISTING_PRODUCER: Producer = {
  ...REGISTERED_PRODUCER,
  isCompliant: false,
};

function renderEditDrawer(
  onSaved: () => void = () => {},
  onOpenChange: (open: boolean) => void = () => {},
) {
  return render(
    <ProducerFormDrawer
      mode="edit"
      producer={EXISTING_PRODUCER}
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />,
  );
}

describe("ProducerFormDrawer — edição", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("mostra os dados do usuário e a comunidade como somente leitura", async () => {
    renderEditDrawer();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    expect(dialog).toHaveAttribute("data-side", "right");

    expect(screen.getByLabelText("Comunidade")).toHaveValue("Comunidade Alfa");
    expect(screen.getByLabelText("Comunidade")).toBeDisabled();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("José da Silva");
    expect(screen.getByLabelText("Nome completo")).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByLabelText("CPF")).toHaveValue("123.456.789-01");
    expect(screen.getByLabelText("CPF")).toBeDisabled();
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("salva apelido e conformidade via updateProducer e fecha o drawer", async () => {
    vi.mocked(updateProducer).mockResolvedValue(EXISTING_PRODUCER);
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderEditDrawer(onSaved, onOpenChange);

    const alias = await screen.findByLabelText("Nome de exibição (opcional)");
    await user.clear(alias);
    await user.type(alias, "Seu Zé");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateProducer).toHaveBeenCalledWith("producer-1", {
        aliasName: "Seu Zé",
        isCompliant: true,
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(registerProducer).not.toHaveBeenCalled();
  });

  it("apelido vazio é enviado como null", async () => {
    vi.mocked(updateProducer).mockResolvedValue(EXISTING_PRODUCER);
    const user = userEvent.setup();

    renderEditDrawer();

    await user.clear(await screen.findByLabelText("Nome de exibição (opcional)"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(updateProducer).toHaveBeenCalledWith("producer-1", {
        aliasName: null,
        isCompliant: false,
      }),
    );
  });
});
