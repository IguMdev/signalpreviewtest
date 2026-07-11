import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exchangeMetaCode } from "@/lib/meta-ads.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meta-callback")({
  component: MetaCallbackPage,
});

function MetaCallbackPage() {
  const navigate = useNavigate();
  const search = Route.useSearch<{ code?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const exchangeFn = useServerFn(exchangeMetaCode);

  useEffect(() => {
    if (search.error) {
      setStatus("error");
      setErrorMsg(search.error_description || "O Facebook recusou a autenticação.");
      return;
    }

    if (!search.code) {
      setStatus("error");
      setErrorMsg("Nenhum código de autorização fornecido.");
      return;
    }

    // A redirect_uri tem que bater EXATAMENTE com a que foi passada em auth.ts
    // Como estamos rodando na URL atual (sem o query code)
    const redirectUri = window.location.origin + "/meta-callback";

    exchangeFn({ data: { code: search.code, redirectUri } })
      .then((res) => {
        if (res.ok) {
          setStatus("success");
          setTimeout(() => {
            navigate({ to: "/trackeamento/pixels" });
          }, 2000);
        }
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Falha ao se conectar com o Facebook.");
      });
  }, [search.code, search.error, exchangeFn, navigate]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <CardContent className="flex flex-col items-center space-y-4 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Conectando ao Facebook...</h2>
              <p className="text-sm text-muted-foreground">Por favor, aguarde enquanto validamos suas permissões.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-semibold text-emerald-500">Conta conectada!</h2>
              <p className="text-sm text-muted-foreground">Você está sendo redirecionado para a página de Pixels...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <h2 className="text-xl font-semibold text-destructive">Falha na conexão</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <button 
                onClick={() => navigate({ to: "/trackeamento/pixels" })}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Voltar para Pixels
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
