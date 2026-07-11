import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders } from "@/lib/tracking.server";

// @ts-ignore
export const Route = createFileRoute("/api/public/track/script/js")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // Garante que usa https em produção se não for localhost
        const origin = url.hostname === "localhost" ? url.origin : `https://${url.hostname}`;
        const scriptContent = `
(function() {
  if (window.__TELE_SIGNAL_TRACKED) return;
  window.__TELE_SIGNAL_TRACKED = true;

  const PIXEL_ID = window.pixelId;
  if (!PIXEL_ID) {
    console.warn("Telesignal: window.pixelId não definido.");
    return;
  }

  const endpoint = "${origin}/api/public/track/dr/" + PIXEL_ID;
  const urlParams = new URLSearchParams(window.location.search);
  
  // Extrai as UTMs e ids
  const payload = {
    stage: 'view',
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
    utm_content: urlParams.get('utm_content') || undefined,
    utm_term: urlParams.get('utm_term') || undefined,
    fbclid: urlParams.get('fbclid') || undefined,
    gclid: urlParams.get('gclid') || undefined,
    ttclid: urlParams.get('ttclid') || undefined,
    url: window.location.href,
  };

  // 1. Manda o evento de view imediatamente
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data && data.click_id) {
      // Salva o click_id no sessionStorage ou localStorage para recuperar depois
      sessionStorage.setItem('__ts_click_id', data.click_id);
    }
  })
  .catch(err => console.error("Telesignal Track Error:", err));

  // 2. Intercepta cliques nos links para registrar checkout
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a');
    if (!target) return;
    
    const href = target.getAttribute('href');
    if (!href) return;

    // Se tiver click_id, adiciona na URL de destino (ex: checkout) para que o webhook identifique
    const clickId = sessionStorage.getItem('__ts_click_id');
    if (clickId) {
      try {
        const targetUrl = new URL(href, window.location.origin);
        // Evita adicionar duas vezes
        if (!targetUrl.searchParams.has('click_id')) {
          targetUrl.searchParams.set('click_id', clickId);
          target.setAttribute('href', targetUrl.toString());
        }
      } catch (err) {}
    }

    // Avisa o servidor que o usuário clicou num botão (que provavelmente é o checkout)
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: 'checkout',
        click_id: clickId
      }),
      // keepalive garante que a request não é cancelada se a página descarregar
      keepalive: true 
    }).catch(()=>{});

  });
})();
`;
        return new Response(scriptContent, {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=3600"
          }
        });
      },
    },
  },
});
