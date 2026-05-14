// Strings centralizadas do fluxo de Conta Premium do Telegram.
// Linguagem padrão: tratamento "você", termos técnicos em inglês mantidos
// (API ID, API Hash, 2FA), nomes de produto sem tradução (Telegram, Premium).

export const premiumStrings = {
  steps: {
    title: "Como conectar sua conta Telegram",
    subtitle: "Passo a passo:",
    items: [
      'Acesse <a>my.telegram.org</a> e faça login',
      'Vá em "API Development Tools" e crie uma aplicação',
      "Copie o <b>API ID</b> e o <b>API Hash</b>",
      "Preencha todos os campos abaixo",
      'Clique em "Solicitar código" — ele chega no <b>app do Telegram</b> (não por SMS)',
      'Digite o código recebido no app e clique em "Conectar"',
    ],
    tip: "Você precisa das credenciais de API para conectar sua conta pessoal.",
  },
  fields: {
    accountName: "Nome da Conta",
    accountNamePlaceholder: "Ex: Minha Conta Premium",
    accountNameHint: "Nome para identificar esta conta no sistema",
    phone: "Número do Telefone",
    phonePlaceholder: "+5511999999999",
    phoneHint: "Número completo com código do país (ex: +55)",
    apiId: "API ID",
    apiIdHint: "API ID obtido em my.telegram.org",
    apiHash: "API Hash",
    apiHashHint: "API Hash obtido em my.telegram.org",
    code: "Código",
    twoFa: "Senha 2FA (verificação em duas etapas)",
  },
  codeStep: {
    heading: "Digite o código recebido no app do Telegram",
    subheading:
      'Abra o app do Telegram e veja a conversa oficial "Telegram". O código não é enviado por SMS e expira em ~5 minutos.',
  },
  buttons: {
    cancel: "Cancelar",
    requestCode: "Solicitar código",
    sendingCode: "Enviando...",
    connect: "Conectar",
    connecting: "Conectando...",
    resend: "Reenviar código",
    resendIn: (s: number) => `Reenviar em ${s}s`,
  },
  toasts: {
    fillAll: "Preencha todos os campos",
    invalidApiId: "API ID inválido",
    codeSent: "Código enviado pelo Telegram",
    codeResent: "Novo código enviado pelo Telegram",
    needs2fa: "Esta conta tem 2FA — informe a senha de nuvem",
    connected: "Conta conectada!",
    emojisSynced: (n: number) => `${n} emojis premium sincronizados`,
    genericFail: "Falha na operação. Tente novamente.",
  },
  errors: {
    timeout:
      "O Telegram demorou demais para responder. Verifique sua conexão e tente novamente.",
    invalidCode:
      "Código inválido. Confira o número que chegou no app do Telegram e tente de novo.",
    expiredCode:
      "Esse código expirou. Clique em \u201cReenviar código\u201d para receber um novo no app do Telegram.".replace(
        /\u201c|\u201d/g,
        '"',
      ),
    floodWait: (s: number) =>
      `Muitas tentativas. Aguarde ${s}s antes de pedir um novo código.`,
    invalid2fa: "Senha 2FA incorreta. Verifique sua senha de nuvem do Telegram.",
    phoneInvalid: "Número de telefone inválido. Use o formato internacional (+55...).",
    apiInvalid:
      "API ID ou API Hash inválidos. Gere novamente em my.telegram.org.",
    notConfigured:
      "Serviço de userbot não configurado. Configure os secrets USERBOT_API_URL e USERBOT_TOKEN.",
  },
} as const;

// Traduz mensagens cruas do Telegram/MTProto para PT-BR claro.
export function translatePremiumError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  const m = msg.toUpperCase();
  if (/PHONE_CODE_INVALID/.test(m)) return premiumStrings.errors.invalidCode;
  if (/PHONE_CODE_EXPIRED/.test(m)) return premiumStrings.errors.expiredCode;
  if (/PHONE_NUMBER_INVALID/.test(m)) return premiumStrings.errors.phoneInvalid;
  if (/API_ID_INVALID|API_HASH_INVALID/.test(m)) return premiumStrings.errors.apiInvalid;
  if (/PASSWORD_HASH_INVALID|PASSWORD_INVALID/.test(m)) return premiumStrings.errors.invalid2fa;
  const flood = m.match(/FLOOD_WAIT_(\d+)/);
  if (flood) return premiumStrings.errors.floodWait(Number(flood[1]));
  if (/TIMEOUT|ETIMEDOUT|FETCH FAILED|NETWORK/.test(m)) return premiumStrings.errors.timeout;
  if (/USERBOT_API_URL|USERBOT_TOKEN/.test(msg)) return premiumStrings.errors.notConfigured;
  return msg || premiumStrings.toasts.genericFail;
}