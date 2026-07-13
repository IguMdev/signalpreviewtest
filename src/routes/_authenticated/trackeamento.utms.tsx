import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Facebook, Search, Tag, Video, Code2, List, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trackeamento/utms")({
  component: UtmsRoute,
});

const UTM_SOURCES = [
  {
    id: "facebook",
    name: "Código de UTMs do Facebook",
    description: "Copie o código para colocar nos anúncios do Facebook",
    icon: <Facebook className="w-6 h-6 text-[#1877F2]" />,
    code: "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}"
  },
  {
    id: "google",
    name: "Código de UTMs do Google",
    description: "Copie o código para colocar nos anúncios do Google",
    icon: <Search className="w-6 h-6 text-[#4285F4]" />,
    code: "utm_source=Google&utm_campaign={campaignid}&utm_medium={adgroupid}&utm_content={creative}&utm_term={keyword}"
  },
  {
    id: "kwai",
    name: "Código de UTMs do Kwai",
    description: "Copie o código para colocar nos anúncios do Kwai",
    icon: <Video className="w-6 h-6 text-[#FF6300]" />, // Placeholder for Kwai
    code: "utm_source=Kwai&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}"
  },
  {
    id: "tiktok",
    name: "Código de UTMs do TikTok",
    description: "Copie o código para colocar nos anúncios do TikTok",
    icon: <Video className="w-6 h-6 text-[#000000] dark:text-white" />, // Placeholder for TikTok
    code: "utm_source=TikTok&utm_campaign=__CAMPAIGN_NAME__|__CAMPAIGN_ID__&utm_medium=__ADGROUP_NAME__|__ADGROUP_ID__&utm_content=__AD_NAME__|__AD_ID__"
  },
  {
    id: "taboola",
    name: "Código de UTMs do Taboola",
    description: "Copie o código para colocar nos anúncios do Taboola",
    icon: <Tag className="w-6 h-6 text-[#0052C2]" />, // Placeholder for Taboola
    code: "utm_source=Taboola&utm_campaign={campaign_name}&utm_medium={site}&utm_content={title}"
  },
];

const SALES_PLATFORMS = [
  { id: "hotmart", name: "Hotmart" },
  { id: "cartpanda", name: "Cartpanda" },
  { id: "kiwify", name: "Kiwify" },
  { id: "braip", name: "Braip" },
  { id: "perfectpay", name: "Perfect Pay" },
  { id: "eduzz", name: "Eduzz" },
  { id: "monetizze", name: "Monetizze" },
  { id: "doppus", name: "Doppus" },
  { id: "yampi", name: "Yampi" },
  { id: "outra", name: "Outra" },
];

function UtmsRoute() {
  const [selectedSource, setSelectedSource] = useState<typeof UTM_SOURCES[0] | null>(null);
  const [testUrl, setTestUrl] = useState("");

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código UTM copiado com sucesso!");
    setSelectedSource(null);
  };

  const handleCopyScript = () => {
    const scriptCode = `<script>\n(function(){\n  var url = new URL(window.location.href);\n  var links = document.querySelectorAll('a');\n  links.forEach(function(link) {\n    var href = new URL(link.href, window.location.href);\n    url.searchParams.forEach(function(value, key) {\n      href.searchParams.set(key, value);\n    });\n    link.href = href.toString();\n  });\n})();\n</script>`;
    navigator.clipboard.writeText(scriptCode);
    toast.success("Script de UTMs copiado com sucesso!");
  };

  const handleTestUrl = () => {
    if (!testUrl) {
      toast.error("Insira uma URL válida.");
      return;
    }
    
    let urlString = testUrl;
    if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
      urlString = "https://" + urlString;
    }
    
    try {
      const url = new URL(urlString);
      url.searchParams.set("utm_source", "telesignal_test");
      url.searchParams.set("utm_medium", "test_medium");
      url.searchParams.set("utm_campaign", "test_campaign");
      url.searchParams.set("utm_content", "test_content");
      url.searchParams.set("utm_term", "test_term");
      window.open(url.toString(), "_blank");
    } catch (e) {
      toast.error("URL inválida.");
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Códigos UTM</h1>
        <p className="text-muted-foreground mt-2">
          Gere e copie os parâmetros e scripts de UTMs para suas campanhas de tráfego pago.
        </p>
      </div>

      <Card className="glass cyber-border">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg">Códigos</CardTitle>
          <CardDescription>
            Obtenha os parâmetros de rastreamento para anexar aos seus links de anúncios.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {UTM_SOURCES.map((source) => (
              <div key={source.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm">
                    {source.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{source.name}</h3>
                    <p className="text-xs text-muted-foreground">{source.description}</p>
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  className="w-full sm:w-auto bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                  onClick={() => setSelectedSource(source)}
                >
                  <List className="w-4 h-4 mr-2" />
                  Ver opções
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass cyber-border">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg">Scripts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm">
                <Code2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Script de UTMs</h3>
                <p className="text-xs text-muted-foreground">Use esse script nas suas PVs para repassar as UTMs para o checkout</p>
              </div>
            </div>
            <Button 
              variant="secondary" 
              className="w-full sm:w-auto bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
              onClick={handleCopyScript}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Script
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass cyber-border">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg">Testar Rastreamento</CardTitle>
          <CardDescription>
            Insira o link da sua página (Landing Page ou Pre-Sell) para abri-la com UTMs de teste e verificar se estão sendo repassadas corretamente para o checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Input 
              placeholder="Ex: https://filhoslibertos.online/deus" 
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="flex-1 bg-black/20 h-11"
            />
            <Button onClick={handleTestUrl} className="w-full sm:w-auto h-11 px-6">
              <ExternalLink className="w-4 h-4 mr-2" />
              Testar UTMs
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedSource} onOpenChange={(open) => !open && setSelectedSource(null)}>
        <DialogContent className="sm:max-w-[500px] glass border border-primary/20">
          <DialogHeader>
            <DialogTitle>Plataforma de Vendas</DialogTitle>
            <DialogDescription>
              Obtenha os códigos de UTMs do {selectedSource?.name.replace("Código de UTMs do ", "")} apropriados para a sua plataforma de vendas:
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2 mt-4">
            {SALES_PLATFORMS.map((platform) => (
              <div key={platform.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-black/20 hover:border-primary/50 transition-colors">
                <span className="font-medium text-sm">{platform.name}</span>
                <Button size="sm" onClick={() => handleCopy(selectedSource?.code || "")}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-4 text-center">
            Utiliza cloaker? Verifique as integrações na documentação.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
