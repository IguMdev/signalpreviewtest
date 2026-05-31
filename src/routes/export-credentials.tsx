import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/export-credentials")({
  component: ExportCredentialsPage,
});

function ExportCredentialsPage() {
  const [json, setJson] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const { data, error } = await supabase.functions.invoke("temp-export-credentials");
      if (error) throw error;
      setJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <div
        style={{
          background: "#dc2626",
          color: "white",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        ⚠️ APAGUE DEPOIS DO USO ⚠️
        <div style={{ fontWeight: 400, fontSize: 14, marginTop: 8 }}>
          Esta tela e a Edge Function expõem credenciais sensíveis. Delete imediatamente após a migração.
        </div>
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Exportar Credenciais</h1>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <button
          onClick={handleExport}
          disabled={loading}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Exportando..." : "Exportar Credenciais"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          Erro: {error}
        </div>
      )}

      {json && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                background: "#16a34a",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {copied ? "✅ Copiado!" : "📋 Copiar JSON"}
            </button>
          </div>
          <pre
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 16,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}