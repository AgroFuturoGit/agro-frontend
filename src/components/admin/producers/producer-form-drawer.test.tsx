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
vi.mock("@/lib/producers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/producers")>("@/lib/producers");
  return { ...actual, updateProducer: vi.fn() };
});

// CPF com dígitos verificadores válidos.
const VALID_CPF = "52998224725";

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
  fullName: "José da Silva",
  cpf: VALID_CPF,
  dateOfBirth: "1985-03-10",
  motherName: "Maria da Silva",
  origin: "Assentamento",
  educationLevel: "Ensino médio",
  phone: "82999990000",
  localName: "Sítio Zé do Milho",
  street: "Estrada Velha, 10",
  city: "Maceió",
  state: "AL",
  ibgeCode: "2704302",
  latitude: -9.66,
  longitude: -35.73,
  isCompliant: true,
  registrationSource: "MANAGER",
  createdAt: null,
  updatedAt: null,
  user: {
    id: "user-1",
    fullName: "José da Silva",
    email: "jose@agro.com",
    cpf: VALID_CPF,
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

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequiredFields() {
  change("Nome completo", "José da Silva");
  change("E-mail", "jose@agro.com");
  change("CPF", VALID_CPF);
  change("Senha", "supersecreta");
}

function fillTextFields() {
  fillRequiredFields();
  change("Data de nascimento", "1985-03-10");
  change("Nome da mãe", "Maria da Silva");
  change("Telefone", "82999990000");
  change("Escolaridade", "Ensino médio");
  change("Origem", "Assentamento");
  change("Endereço/Nome local", "Sítio Zé do Milho");
  change("Rua", "Estrada Velha, 10");
  change("Cidade", "Maceió");
  change("UF", "al");
  change("Código IBGE", "2704302");
  change("Latitude", "-9.66");
  change("Longitude", "-35.73");
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
        cpf: "529.982.247-25",
        email: "jose@agro.com",
        password: "supersecreta",
        dateOfBirth: "1985-03-10",
        motherName: "Maria da Silva",
        phone: "82999990000",
        educationLevel: "Ensino médio",
        origin: "Assentamento",
        localName: "Sítio Zé do Milho",
        street: "Estrada Velha, 10",
        city: "Maceió",
        state: "AL",
        ibgeCode: "2704302",
        latitude: -9.66,
        longitude: -35.73,
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("UNIT-003: envia só obrigatórios + e-mail/senha quando o resto está vazio", async () => {
    vi.mocked(registerProducer).mockResolvedValue(REGISTERED_PRODUCER);
    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillRequiredFields();
    await selectCommunity("Comunidade Alfa");
    submitForm();

    await waitFor(() =>
      expect(registerProducer).toHaveBeenCalledWith("community-1", {
        fullName: "José da Silva",
        cpf: "529.982.247-25",
        email: "jose@agro.com",
        password: "supersecreta",
      }),
    );
  });

  it("UNIT-001: mostra as seções tituladas na ordem e o rótulo Endereço/Nome local", async () => {
    renderDialog();

    await screen.findByLabelText("Nome completo");
    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Comunidade",
      "Dados pessoais",
      "Acesso",
      "Endereço",
      "Localização",
    ]);
    expect(screen.getByLabelText("Endereço/Nome local")).toBeTruthy();
    expect(screen.queryByText(/Nome de exibição/i)).toBeNull();
  });

  it("UNIT-001: o drawer do agricultor é mais largo e a grade usa duas colunas a partir de sm", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("data-[side=right]:sm:max-w-2xl");
    const grid = screen.getByLabelText("CPF").closest(".grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
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

describe("ProducerFormDrawer — validações (BR-006)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  async function submitWith(overrides: Record<string, string>) {
    renderDialog();
    await screen.findByLabelText("Nome completo");
    fillTextFields();
    for (const [label, value] of Object.entries(overrides)) change(label, value);
    await selectCommunity("Comunidade Alfa");
    submitForm();
  }

  it.each([
    ["CPF", "529.982.247-24", "CPF inválido"],
    ["UF", "A", "Informe a UF com 2 letras"],
    ["Código IBGE", "123", "O código IBGE deve ter 7 dígitos"],
    ["Latitude", "91", "A latitude deve estar entre -90 e 90"],
    ["Longitude", "-181", "A longitude deve estar entre -180 e 180"],
    ["Longitude", "", "Informe a longitude junto com a latitude"],
    ["Data de nascimento", "2999-01-01", "A data de nascimento não pode ser futura"],
  ])("UNIT-004: %s=%s bloqueia o envio com mensagem no campo", async (label, value, message) => {
    await submitWith({ [label]: value });

    expect(await screen.findByText(message)).toBeTruthy();
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

function renderEditWith(
  producer: Producer,
  onSaved: () => void = () => {},
  onOpenChange: (open: boolean) => void = () => {},
) {
  return render(
    <ProducerFormDrawer
      mode="edit"
      producer={producer}
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

  it("UNIT-005: CPF, e-mail e comunidade somente leitura; demais campos preenchidos e editáveis", async () => {
    renderEditDrawer();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    expect(dialog).toHaveAttribute("data-side", "right");

    expect(screen.getByLabelText("Comunidade")).toHaveValue("Comunidade Alfa");
    expect(screen.getByLabelText("Comunidade")).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    expect(screen.getByLabelText("CPF")).toBeDisabled();
    expect(screen.queryByLabelText("Senha")).toBeNull();

    expect(screen.getByLabelText("Nome completo")).toHaveValue("José da Silva");
    expect(screen.getByLabelText("Nome completo")).toBeEnabled();
    expect(screen.getByLabelText("Endereço/Nome local")).toHaveValue(
      "Sítio Zé do Milho",
    );
    expect(screen.getByLabelText("Latitude")).toHaveValue("-9.66");
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue("1985-03-10");
  });

  it("UNIT-005: salva alterações via updateProducer, sem CPF no corpo", async () => {
    vi.mocked(updateProducer).mockResolvedValue(EXISTING_PRODUCER);
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderEditDrawer(onSaved, onOpenChange);

    const local = await screen.findByLabelText("Endereço/Nome local");
    await user.clear(local);
    await user.type(local, "Seu Zé");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateProducer).toHaveBeenCalledWith("producer-1", {
        fullName: "José da Silva",
        dateOfBirth: "1985-03-10",
        motherName: "Maria da Silva",
        phone: "82999990000",
        educationLevel: "Ensino médio",
        origin: "Assentamento",
        localName: "Seu Zé",
        street: "Estrada Velha, 10",
        city: "Maceió",
        state: "AL",
        ibgeCode: "2704302",
        latitude: -9.66,
        longitude: -35.73,
        isCompliant: true,
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(vi.mocked(updateProducer).mock.calls[0][1]).not.toHaveProperty("cpf");
    expect(registerProducer).not.toHaveBeenCalled();
  });

  it("UNIT-005: texto esvaziado vai como \"\" e o que já era vazio segue null", async () => {
    vi.mocked(updateProducer).mockResolvedValue(EXISTING_PRODUCER);
    const user = userEvent.setup();

    renderEditWith({ ...EXISTING_PRODUCER, street: null });

    await user.clear(await screen.findByLabelText("Nome da mãe"));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(updateProducer).toHaveBeenCalledWith(
        "producer-1",
        expect.objectContaining({ motherName: "", street: null }),
      ),
    );
  });

  it("UNIT-005: data de nascimento e GPS já definidos não podem ser esvaziados", async () => {
    const user = userEvent.setup();

    renderEditDrawer();

    fireEvent.change(await screen.findByLabelText("Data de nascimento"), {
      target: { value: "" },
    });
    change("Latitude", "");
    change("Longitude", "");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findAllByText(
        "Não é possível remover este valor depois de definido; altere para outro valor",
      ),
    ).toHaveLength(3);
    expect(updateProducer).not.toHaveBeenCalled();
  });

  it("UNIT-005: agricultor sem data/GPS pode salvar sem preenchê-los (envia null = manter)", async () => {
    vi.mocked(updateProducer).mockResolvedValue(EXISTING_PRODUCER);
    const user = userEvent.setup();

    renderEditWith({
      ...EXISTING_PRODUCER,
      dateOfBirth: null,
      latitude: null,
      longitude: null,
    });

    await user.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(updateProducer).toHaveBeenCalledWith(
        "producer-1",
        expect.objectContaining({
          dateOfBirth: null,
          latitude: null,
          longitude: null,
        }),
      ),
    );
  });
});

describe("ProducerFormDrawer — UF/IBGE legados (CR-003)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("UNIT-004: UF e IBGE legados inalterados não bloqueiam o envio", async () => {
    vi.mocked(updateProducer).mockResolvedValue(EXISTING_PRODUCER);
    const user = userEvent.setup();

    renderEditWith({
      ...EXISTING_PRODUCER,
      state: "Alagoas",
      ibgeCode: "123",
    });
    await user.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(updateProducer).toHaveBeenCalledWith(
        "producer-1",
        expect.objectContaining({ state: "ALAGOAS", ibgeCode: "123" }),
      ),
    );
    expect(screen.queryByText("Informe a UF com 2 letras")).toBeNull();
  });

  it("UNIT-004: UF alterada para valor inválido continua bloqueada", async () => {
    const user = userEvent.setup();

    renderEditWith({ ...EXISTING_PRODUCER, state: "Alagoas", ibgeCode: "123" });
    const state = await screen.findByLabelText("UF");
    fireEvent.change(state, { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Código IBGE"), {
      target: { value: "12" },
    });
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Informe a UF com 2 letras")).toBeTruthy();
    expect(screen.getByText("O código IBGE deve ter 7 dígitos")).toBeTruthy();
    expect(updateProducer).not.toHaveBeenCalled();
  });
});
