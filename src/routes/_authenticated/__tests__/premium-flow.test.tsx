function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  apiId = "12345",
) {
  return (async () => {
    await user.type(
      within(dialog).getByPlaceholderText(S.fields.accountNamePlaceholder),
      "Conta",
    );
    await user.type(
      within(dialog).getByPlaceholderText(S.fields.phonePlaceholder),
      "+5511999999999",
    );
    await user.type(within(dialog).getByPlaceholderText("12345678"), apiId);
    await user.type(
      within(dialog).getByPlaceholderText("abcdef1234567890..."),
      "abcdefabcdef",
    );
  })();
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- Mocks ANTES do import do componente ----
const reqCodeMock = vi.fn().mockResolvedValue({ ok: true });
const confirmCodeMock = vi
  .fn()
  .mockResolvedValueOnce({ ok: true, needsPassword: false });
const syncEmojisMock = vi.fn().mockResolvedValue({ ok: true, count: 0 });

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "acc-1" }, error: null }),
        }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/accounts.functions", () => ({
  verifyAccount: vi.fn(),
  sendTestMessage: vi.fn(),
  refreshChats: vi.fn(),
}));

vi.mock("@/lib/telegram-tracking.functions", () => ({
  enableMemberTracking: vi.fn(),
}));

vi.mock("@/lib/premium-account.functions", () => ({
  requestPremiumCode: (...a: unknown[]) => reqCodeMock(...a),
  confirmPremiumCode: (...a: unknown[]) => confirmCodeMock(...a),
  syncPremiumEmojis: (...a: unknown[]) => syncEmojisMock(...a),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastMessage = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
    message: (m: string) => toastMessage(m),
  }),
  Toaster: () => null,
}));

// Importa o componente após os mocks.
import { Route as TelegramAccountsRoute } from "@/routes/_authenticated/telegram-accounts";
import { premiumStrings as S } from "@/lib/premium-strings";

const Page = (TelegramAccountsRoute as unknown as { component?: React.FC }).component
  ?? (() => null);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Page />
    </QueryClientProvider>,
  );
}

async function abrirDialogPremium(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Adicionar conta/i }));
  const dialog = await screen.findByRole("dialog");
  // abre o select de tipo de conta e escolhe Premium
  await user.click(within(dialog).getByRole("combobox"));
  const option = await screen.findByRole("option", { name: /Conta Premium/i });
  await user.click(option);
  return dialog;
}

describe("Fluxo Premium e2e (componente)", () => {
  beforeEach(() => {
    reqCodeMock.mockClear();
    confirmCodeMock.mockClear();
    syncEmojisMock.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    toastMessage.mockClear();
    confirmCodeMock.mockResolvedValue({ ok: true, needsPassword: false });
  });

  it("mostra labels do passo de formulário e do passo de código (linguagem central)", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await abrirDialogPremium(user);

    expect(within(dialog).getByText(S.steps.title)).toBeInTheDocument();
    expect(within(dialog).getByText(S.fields.accountName)).toBeInTheDocument();
    expect(within(dialog).getByText(S.fields.phone)).toBeInTheDocument();
    expect(within(dialog).getByText(S.fields.apiId)).toBeInTheDocument();
    expect(within(dialog).getByText(S.fields.apiHash)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: S.buttons.requestCode }),
    ).toBeInTheDocument();
  });

  it("valida campos vazios com toast de erro", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await abrirDialogPremium(user);
    await user.click(within(dialog).getByRole("button", { name: S.buttons.requestCode }));
    expect(toastError).toHaveBeenCalledWith(S.toasts.fillAll);
  });

  it("valida API ID não numérico", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await abrirDialogPremium(user);
    await fillForm(user, dialog, "abc");
    await user.click(within(dialog).getByRole("button", { name: S.buttons.requestCode }));
    expect(toastError).toHaveBeenCalledWith(S.toasts.invalidApiId);
  });

  it("avança para o passo de código, mostra rótulos e botão de reenviar", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await abrirDialogPremium(user);
    await fillForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: S.buttons.requestCode }));

    await waitFor(() => expect(reqCodeMock).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(S.toasts.codeSent);
    expect(await within(dialog).findByText(S.codeStep.heading)).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("12345")).toBeInTheDocument();
    // botão reenviar começa em cooldown
    const resendBtn = within(dialog).getByRole("button", { name: /Reenviar em \d+s/ });
    expect(resendBtn).toBeDisabled();
  });

  it("trata 2FA quando confirmCode pede senha", async () => {
    confirmCodeMock.mockReset();
    confirmCodeMock.mockResolvedValueOnce({ ok: false, needsPassword: true });
    const user = userEvent.setup();
    renderPage();
    const dialog = await abrirDialogPremium(user);
    await fillForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: S.buttons.requestCode }));
    await within(dialog).findByText(S.codeStep.heading);
    await user.type(within(dialog).getByPlaceholderText("12345"), "12345");
    await user.click(within(dialog).getByRole("button", { name: S.buttons.connect }));
    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(S.toasts.needs2fa));
    expect(await within(dialog).findByText(S.fields.twoFa)).toBeInTheDocument();
  });
});