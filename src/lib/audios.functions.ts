import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function sendVoiceToChat(opts: {
  botToken: string | null | undefined;
  chatId: number | string;
  fileBytes: ArrayBuffer;
  filename: string;
  mimeType: string;
  duration?: number | null;
  caption?: string | null;
}) {
  if (!opts.botToken) {
    return { ok: false, description: "Conta sem bot_token" } as { ok: boolean; result?: { message_id: number }; description?: string };
  }
  const form = new FormData();
  form.append("chat_id", String(opts.chatId));
  if (opts.duration) form.append("duration", String(opts.duration));
  if (opts.caption) form.append("caption", opts.caption);
  
  form.append(
    "voice",
    new Blob([opts.fileBytes], { type: opts.mimeType || "audio/ogg" }),
    opts.filename,
  );
  
  const res = await fetch(`https://api.telegram.org/bot${opts.botToken}/sendVoice`, {
    method: "POST",
    body: form,
  });
  return (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
}

export async function loadAudio(audioId: string | null | undefined) {
  if (!audioId) return null;
  const { data } = await (supabaseAdmin as any)
    .from("audios" as any)
    .select("storage_path, file_size, duration_seconds, title")
    .eq("id" as any, audioId)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function dispatchAudio(opts: {
  botToken: string | null | undefined;
  chatId: number | string;
  storagePath: string;
  title: string;
  durationSeconds?: number | null;
  caption?: string | null;
}) {
  const { data: fileData, error } = await supabaseAdmin.storage.from("audio-files").download(opts.storagePath);
  if (error || !fileData) {
    return { ok: false, description: "Falha ao baixar áudio do storage" };
  }
  const bytes = await fileData.arrayBuffer();
  return await sendVoiceToChat({
    botToken: opts.botToken,
    chatId: opts.chatId,
    fileBytes: bytes,
    filename: opts.title + ".ogg",
    mimeType: "audio/ogg",
    duration: opts.durationSeconds,
    caption: opts.caption,
  });
}

export const sendAudioNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audioId: string; accountId: string; chatIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    try {
      const { userId } = context;
      const { data: audio } = await (supabaseAdmin as any)
        .from("audios" as any)
        .select("*")
        .eq("id" as any, data.audioId)
        .maybeSingle();

      if (!audio || audio.user_id !== userId) throw new Error("Áudio não encontrado ou sem permissão");

      const { data: account } = await (supabaseAdmin as any)
        .from("telegram_accounts")
        .select("bot_token, user_id")
        .eq("id", data.accountId)
        .maybeSingle();

      if (!account?.bot_token || account.user_id !== userId) throw new Error("Conta de Telegram inválida ou sem permissão");

      const { data: fileData, error: fileErr } = await (supabaseAdmin as any).storage
        .from("audio-files")
        .download((audio as any).storage_path);

      if (fileErr || !fileData) throw new Error("Erro ao baixar arquivo do Storage: " + (fileErr?.message || ""));

      const fileBytes = await fileData.arrayBuffer();

      const results = [];
      for (const chatId of data.chatIds) {
        const result = await sendVoiceToChat({
          botToken: account.bot_token,
          chatId,
          fileBytes,
          filename: (audio as any).storage_path.split("/").pop() || "audio.ogg",
          mimeType: (audio as any).mime_type || "audio/ogg",
          duration: (audio as any).duration_seconds,
        });
        results.push({ chatId, ok: result.ok, error: result.description });
      }

      const allOk = results.every(r => r.ok);
      if (!allOk) {
        const errors = results.filter(r => !r.ok).map(r => `Chat ${r.chatId}: ${r.error}`).join(", ");
        throw new Error(`Alguns envios falharam: ${errors}`);
      }

      return { ok: true };
    } catch (err: any) {
      console.error("[sendAudioNow]", err);
      throw new Error(err.message || "Erro desconhecido ao enviar áudio");
    }
  });

export const deleteAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: string) => id)
  .handler(async ({ data: id, context }) => {
    try {
      const { userId } = context;
      const { data: audio } = await (supabaseAdmin as any)
        .from("audios" as any)
        .select("storage_path, user_id")
        .eq("id" as any, id)
        .maybeSingle();

      if (!audio || audio.user_id !== userId) throw new Error("Áudio não encontrado ou sem permissão");

      if ((audio as any)?.storage_path) {
        await (supabaseAdmin as any).storage.from("audio-files").remove([(audio as any).storage_path]);
      }
      await (supabaseAdmin as any).from("audios" as any).delete().eq("id" as any, id);
      return { ok: true };
    } catch (err: any) {
      throw new Error(err.message);
    }
  });
