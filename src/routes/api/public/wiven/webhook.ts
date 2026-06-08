import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/wiven/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Logar o payload bruto e os headers para inspeção durante a integração
          const rawBody = await request.text();
          let payload;
          try {
            payload = JSON.parse(rawBody);
          } catch (e) {
            return new Response("Invalid JSON", { status: 400 });
          }

          // Salva o log no banco de dados para podermos inspecionar a primeira compra teste
          await supabaseAdmin.from("message_logs").insert({
            content: `Wiven Webhook Received:\nHeaders: ${JSON.stringify(Object.fromEntries(request.headers))}\nBody: ${rawBody}`,
            ok: true,
          } as any); // Usando 'any' temporariamente pois a estrutura de message_logs não precisa de tipagem estrita aqui

          console.log("=== WIVEN WEBHOOK RECEBIDO ===");
          console.log("Headers:", Object.fromEntries(request.headers));
          console.log("Payload:", payload);

          // Aqui entraremos com a lógica real após vermos o formato do JSON de teste.
          // Basicamente vamos extrair o `wiven_sale_id`, procurar o usuário e o plano.

          return new Response("OK", { status: 200 });
        } catch (err: any) {
          console.error("Wiven Webhook Error:", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
