const API_BASE = "https://api.telegram.org";

export type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramResponse<T>> {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()) as TelegramResponse<T>;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: { chat: TelegramChat };
  channel_post?: { chat: TelegramChat };
  my_chat_member?: { chat: TelegramChat };
}