import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sendVoiceToChat(opts: {
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

export const sendAudioNow = createServerFn({ method: "POST" })
  .inputValidator((data: { audioId: string; accountId: string; chatIds: string[] }) => data)
  .handler(async ({ data }) => {
    try {
      const { data: audio } = await supabaseAdmin
        .from("audios")
        .select("*")
        .eq("id", data.audioId)
        .maybeSingle();

      if (!audio) throw new Error("Áudio não encontrado");

      const { data: account } = await supabaseAdmin
        .from("telegram_accounts")
        .select("bot_token")
        .eq("id", data.accountId)
        .maybeSingle();

      if (!account?.bot_token) throw new Error("Conta de Telegram inválida ou sem token");

      const { data: fileData, error: fileErr } = await supabaseAdmin.storage
        .from("audio-files")
        .download(audio.storage_path);

      if (fileErr || !fileData) throw new Error("Erro ao baixar arquivo do Storage: " + (fileErr?.message || ""));

      const fileBytes = await fileData.arrayBuffer();

      const results = [];
      for (const chatId of data.chatIds) {
        const result = await sendVoiceToChat({
          botToken: account.bot_token,
          chatId,
          fileBytes,
          filename: audio.storage_path.split("/").pop() || "audio.ogg",
          mimeType: audio.mime_type || "audio/ogg",
          duration: audio.duration_seconds,
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
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    try {
      const { data: audio } = await supabaseAdmin
        .from("audios")
        .select("storage_path")
        .eq("id", id)
        .maybeSingle();

      if (audio?.storage_path) {
        await supabaseAdmin.storage.from("audio-files").remove([audio.storage_path]);
      }
      await supabaseAdmin.from("audios").delete().eq("id", id);
      return { ok: true };
    } catch (err: any) {
      throw new Error(err.message);
    }
  });
