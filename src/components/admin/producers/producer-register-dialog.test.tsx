import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { ProducerRegisterDialog } from "@/components/admin/producers/producer-register-dialog";
import {
  parseProducerRegisterFieldErrors,
  registerProducer,
  type Community,
} from "@/lib/communities";
import type { Producer } from "@/lib/producers";

// Nenhum acesso de rede real — o cliente de API do domínio é mockado
// por completo (o `apiRequest` nunca chega a ser alcançado).
vi.mock("@/lib/communities", () => ({
  registerProducer: vi.fn(),
  parseProducerRegisterFieldErrors: vi.fn(() => ({})),
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
  community: { id: "community-1", name: "Comunidade Alfa" },
};

function renderDialog(onCreated: () => void = () => {}) {
  return render(
    <ProducerRegisterDialog
      open
      onOpenChange={() => {}}
      onCreated={onCreated}
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

describe("ProducerRegisterDialog — cadastro por comunidade (spec.md §5)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("submit válido chama registerProducer(communityId, payload) e dispara onCreated", async () => {
    vi.mocked(registerProducer).mockResolvedValue(REGISTERED_PRODUCER);
    const onCreated = vi.fn();

    renderDialog(onCreated);

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
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it("sem comunidade selecionada mostra erro e não chama registerProducer", async () => {
    renderDialog();

    await screen.findByLabelText("Nome completo");
    fillTextFields();

    submitForm();

    expect(
      await screen.findByText("Selecione a comunidade do produtor"),
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

describe("ProducerRegisterDialog — erros de servidor (gap #5 do QA de F02)", () => {
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
    const onCreated = vi.fn();

    renderDialog(onCreated);

    await screen.findByLabelText("Nome completo");
    fillTextFields();
    await selectCommunity("Comunidade Alfa");

    submitForm();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Erro interno do servidor");
    // O diálogo não avança para o painel de sucesso nem notifica o pai.
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByLabelText("Nome completo")).toBeTruthy();
  });
});
