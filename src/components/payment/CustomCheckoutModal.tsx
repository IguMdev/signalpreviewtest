import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, CheckCircle2, Lock, User, CreditCard, Calendar, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateDirectPix, generateDirectCard } from "@/lib/checkout.functions";

export function CustomCheckoutModal({
  open,
  onOpenChange,
  planId,
  customPrice,
  customName,
  customDescription,
  isSubscription,
  billingCycle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  customPrice?: number;
  customName?: string;
  customDescription?: string;
  isSubscription?: boolean;
  billingCycle?: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedMethod, setSelectedMethod] = useState<"card" | "pix">("card");
  
  // States
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ code: string; qrCodeBase64?: string; qrCodeImage?: string; } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form States
  const [clientData, setClientData] = useState({ name: "", email: "", phone: "", document: "" });
  const [addressData, setAddressData] = useState({ zipCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [cardData, setCardData] = useState({ number: "", owner: "", expiresAt: "", cvv: "" });

  const handleCepChange = async (val: string) => {
    let cep = val.replace(/\D/g, '').substring(0, 8);
    let formattedCep = cep;
    if (cep.length > 5) {
      formattedCep = cep.replace(/^(\d{5})(\d)/, "$1-$2");
    }

    setAddressData(prev => ({...prev, zipCode: formattedCep}));
    
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddressData(prev => ({
            ...prev,
            zipCode: formattedCep,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state
          }));
        }
      } catch (e) {
        // ignora se falhar
      }
    }
  };

  const handleGeneratePix = useServerFn(generateDirectPix);
  const handleGenerateCard = useServerFn(generateDirectCard);

  const isStep1Valid = clientData.name && clientData.email && clientData.document && addressData.zipCode && addressData.street && addressData.number;

  async function processPayment(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!isStep1Valid) {
        toast.error("Preencha os campos obrigatórios para continuar.");
        return;
      }
      setStep(2);
      return;
    }
    
    if (!clientData.document || clientData.document.length < 11) {
      toast.error("O CPF/CNPJ é obrigatório.");
      return;
    }

    setLoading(true);

    if (selectedMethod === "pix") {
      try {
        const data = await handleGeneratePix({
          data: { planId, customPrice, customName, customDescription, clientDocument: clientData.document, isSubscription, billingCycle }
        });
        setPixData(data);
      } catch (e: any) {
        toast.error(e.message || "Erro ao gerar PIX");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const res = await handleGenerateCard({
          data: {
            planId, customPrice, customName, isSubscription, billingCycle,
            client: clientData,
            address: { ...addressData, country: "BR" },
            card: cardData
          }
        });
        if (res.status === "OK" || res.status === "PENDING") {
          toast.success("Pagamento aprovado com sucesso!");
          onOpenChange(false);
        } else {
          toast.error("Pagamento recusado ou falhou. Verifique os dados.");
        }
      } catch (e: any) {
        toast.error(e.message || "Erro ao processar cartão");
      } finally {
        setLoading(false);
      }
    }
  }

  // Limpa estado ao fechar
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPixData(null);
        setCopied(false);
        setStep(1);
      }, 300);
    }
  }, [open]);

  const copyToClipboard = () => {
    if (!pixData?.code) return;
    navigator.clipboard.writeText(pixData.code);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const renderInputWithIcon = (label: string, placeholder: string, value: string, onChange: (val: string) => void, Icon: any, type = "text", autoComplete?: string) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input 
          required
          type={type}
          name={autoComplete}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background border-input h-12 text-[15px] text-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-lg pl-3 pr-10"
        />
        <Icon className="w-5 h-5 text-muted-foreground absolute right-3 top-3.5" />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Checkout</DialogTitle>
      <DialogDescription className="sr-only">Finalize seu pagamento</DialogDescription>

      <DialogContent className="max-w-[900px] w-full min-h-[780px] max-h-[90vh] p-0 gap-0 overflow-hidden bg-background rounded-2xl shadow-2xl border flex flex-col">
        
        {/* Altura mínima FIXA para garantir que o modal não encolha no Pix e comporte o Passo 1 sem barra de rolagem */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden h-full min-h-[780px]">
          
          {/* Lado Esquerdo - Formulário */}
          <div className="flex-1 flex flex-col bg-card overflow-hidden">
            
            {/* Stepper Superior (Fixo no Topo) */}
            <div className="flex-none px-16 pt-8 pb-4 relative">
              <div className="flex items-center justify-between relative">
                {/* Linha de Fundo */}
                <div className="absolute top-3 left-4 right-4 h-[2px] bg-muted z-0" />
                {/* Linha Ativa */}
                <div className="absolute top-3 left-4 h-[2px] bg-primary transition-all duration-500 z-0" style={{ width: step === 2 ? 'calc(100% - 32px)' : '0%' }} />
                
                <div className="flex flex-col items-center gap-2 relative z-10 bg-card px-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>1</div>
                  <span className={`text-xs font-medium ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>Contato</span>
                </div>
                <div className="flex flex-col items-center gap-2 relative z-10 bg-card px-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-500 ${step >= 2 ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>2</div>
                  <span className={`text-xs font-medium transition-colors duration-500 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>Pagamento</span>
                </div>
              </div>
            </div>

            {/* Conteúdo Rolável */}
            <div className="flex-1 overflow-y-auto px-8 py-6 checkout-scrollbar min-h-0">
              
              {pixData ? (
                // Tela de Sucesso PIX
                <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300 h-full min-h-[300px]">
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Escaneie o QR Code</h2>
                  
                  <div className="p-4 bg-white rounded-2xl border border-border shadow-xl shadow-primary/5 flex items-center justify-center">
                    <img 
                      src={
                        pixData.qrCodeBase64 
                          ? (pixData.qrCodeBase64.startsWith('data:image') ? pixData.qrCodeBase64 : `data:image/png;base64,${pixData.qrCodeBase64}`)
                          : (pixData.qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixData.code)}`)
                      } 
                      onError={(e) => { e.currentTarget.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixData.code)}`; }}
                      alt="QR Code PIX" 
                      className="w-48 h-48 object-contain" 
                    />
                  </div>

                  <div className="text-center space-y-3 w-full max-w-sm">
                    <div className="flex-1 overflow-hidden bg-muted p-4 rounded-xl border border-border text-xs text-muted-foreground break-all text-left font-mono shadow-inner">
                      {pixData.code}
                    </div>
                    <Button onClick={copyToClipboard} className="w-full h-12 text-base font-semibold rounded-xl gap-2 shadow-lg transition-all">
                      {copied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                      {copied ? "Copiado!" : "Copiar código PIX"}
                    </Button>
                  </div>
                </div>
              ) : (
                <form id="checkout-form" onSubmit={processPayment} className="space-y-6 flex flex-col">
                  
                  {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground tracking-tight">Detalhes do Contato</h2>
                        <p className="text-sm text-muted-foreground mt-1">Para onde enviaremos o recibo e o acesso.</p>
                      </div>

                      <div className="space-y-4">
                        {renderInputWithIcon("Nome Completo", "João da Silva", clientData.name, (val) => setClientData({...clientData, name: val}), User, "text", "name")}
                        <div className="grid grid-cols-2 gap-4">
                          {renderInputWithIcon("CPF / CNPJ", "000.000.000-00", clientData.document, (val) => setClientData({...clientData, document: val}), ShieldCheck)}
                          {renderInputWithIcon("Telefone", "(11) 99999-9999", clientData.phone, (val) => setClientData({...clientData, phone: val}), User, "tel", "tel")}
                        </div>
                        {renderInputWithIcon("E-mail", "joao@gmail.com", clientData.email, (val) => setClientData({...clientData, email: val}), User, "email", "email")}
                      </div>

                      <div className="pt-4 space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">Endereço de Faturamento</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-1">
                            {renderInputWithIcon("CEP", "00000-000", addressData.zipCode, handleCepChange, Lock, "text", "postal-code")}
                          </div>
                          <div className="col-span-2">
                            {renderInputWithIcon("Rua", "Rua Principal", addressData.street, (val) => setAddressData({...addressData, street: val}), Lock, "text", "address-line1")}
                          </div>
                          <div className="col-span-1">
                            {renderInputWithIcon("Número", "123", addressData.number, (val) => setAddressData({...addressData, number: val}), Lock)}
                          </div>
                          <div className="col-span-2">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground">Complemento (opc.)</label>
                              <Input placeholder="Apto 1" name="address-line2" autoComplete="address-line2" value={addressData.complement} onChange={(e) => setAddressData({...addressData, complement: e.target.value})} className="bg-background border-input h-12 text-foreground rounded-lg" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <button type="button" onClick={() => setStep(1)} className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground">
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <h2 className="text-2xl font-bold text-foreground tracking-tight">Pagamento</h2>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-primary" /> Transação segura e criptografada
                        </p>
                      </div>

                      {/* Acordeão de Pagamento */}
                      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                        
                        {/* Cartão de Crédito */}
                        <div 
                          className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${selectedMethod === 'card' ? 'bg-accent/50' : 'hover:bg-accent/30'}`}
                          onClick={() => setSelectedMethod("card")}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === 'card' ? 'border-primary bg-primary' : 'border-border'}`}>
                              {selectedMethod === 'card' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className="font-semibold text-[15px] text-foreground">Cartão de crédito</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-80">
                            <div className="w-8 h-5 bg-[#1a1f71] rounded flex items-center justify-center text-[8px] font-bold text-white italic">VISA</div>
                            <div className="w-8 h-5 bg-[#eb001b] rounded flex items-center justify-center overflow-hidden">
                              <div className="w-3 h-3 rounded-full bg-[#f79e1b] -ml-1 mix-blend-screen opacity-90" />
                            </div>
                          </div>
                        </div>

                        {selectedMethod === "card" && (
                          <div className="p-5 pt-2 bg-accent/20 border-t border-border animate-in fade-in duration-300 space-y-4">
                            {renderInputWithIcon("Nome no Cartão", "Jannatul Ferdous", cardData.owner, (val) => setCardData({...cardData, owner: val.toUpperCase()}), User, "text", "cc-name")}
                            {renderInputWithIcon("Número do Cartão", "0000 0000 0000 0000", cardData.number, (val) => setCardData({...cardData, number: val}), CreditCard, "text", "cc-number")}
                            
                            <div className="grid grid-cols-2 gap-4">
                              {renderInputWithIcon("Data de Vencimento", "19/28", cardData.expiresAt, (val) => setCardData({...cardData, expiresAt: val}), Calendar, "text", "cc-exp")}
                              {renderInputWithIcon("CVV", "•••", cardData.cvv, (val) => setCardData({...cardData, cvv: val}), ShieldCheck, "password", "cc-csc")}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-border" />

                        {/* Pix */}
                        <div 
                          className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${selectedMethod === 'pix' ? 'bg-accent/50' : 'hover:bg-accent/30'}`}
                          onClick={() => setSelectedMethod("pix")}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === 'pix' ? 'border-primary bg-primary' : 'border-border'}`}>
                              {selectedMethod === 'pix' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className="font-semibold text-[15px] text-foreground">Pix Instantâneo</span>
                          </div>
                          <svg className="w-12 h-4 text-[#32BCAD]" viewBox="0 0 100 25" fill="currentColor">
                            <path d="M26.4 17.6L31 22.2L35.6 17.6L31 13L26.4 17.6ZM31 3.8L26.4 8.4L31 13L35.6 8.4L31 3.8ZM16.3 12.5C16.3 15.6 18.8 18.1 21.9 18.1H24.3L28.9 22.7L31 24.8L33.1 22.7L37.7 18.1H40.1C43.2 18.1 45.7 15.6 45.7 12.5C45.7 9.4 43.2 6.9 40.1 6.9H37.7L33.1 2.3L31 0.2L28.9 2.3L24.3 6.9H21.9C18.8 6.9 16.3 9.4 16.3 12.5ZM21.9 8.9H24.3L28.9 13.5L31 15.6L33.1 13.5L37.7 8.9H40.1C42.1 8.9 43.7 10.5 43.7 12.5C43.7 14.5 42.1 16.1 40.1 16.1H37.7L33.1 11.5L31 9.4L28.9 11.5L24.3 16.1H21.9C19.9 16.1 18.3 14.5 18.3 12.5C18.3 10.5 19.9 8.9 21.9 8.9Z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                </form>
              )}
            </div>

            {/* Rodapé com Botão Fixo */}
            {!pixData && (
              <div className="flex-none p-6 bg-card border-t border-border z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.2)]">
                <Button 
                  form="checkout-form"
                  type="submit" 
                  disabled={loading}
                  className="w-full h-[52px] text-base font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                    step === 1 ? <>Avançar para Pagamento <ArrowRight className="w-4 h-4 ml-1" /></> : "Processar Checkout"
                  }
                </Button>
              </div>
            )}
          </div>

          {/* Lado Direito - Resumo do Produto */}
          <div className="hidden md:flex w-[380px] relative bg-[#111116] flex-col justify-center p-10 overflow-hidden border-l border-border">
            {/* Background Gradiente Abstrato usando CSS nativo com overlay mix-blend */}
            <div className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4), transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1), transparent 50%)' }} />

            {/* Conteúdo sobre o gradiente */}
            <div className="relative z-10 text-center text-white space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mx-auto flex items-center justify-center mb-6 shadow-2xl">
                <ShieldCheck className="w-8 h-8 text-white/80" />
              </div>
              
              <h2 className="text-3xl font-extrabold tracking-tight">
                {customName || "Plano Telesignal"}
              </h2>
              <p className="text-white/60 text-sm font-medium">
                {customDescription || "Acesso premium imediato."}
              </p>
              
              <div className="pt-4">
                <span className="text-5xl font-black tracking-tight text-white">
                  R$ {customPrice ? Number(customPrice).toFixed(2).replace(".", ",") : "..."}
                </span>
                {isSubscription && (
                  <span className="text-white/40 text-sm font-medium ml-1">
                    {billingCycle === "mensal" ? "/mês" : billingCycle === "trimestral" ? "/trimestre" : "/ano"}
                  </span>
                )}
              </div>
            </div>
            
            {/* Linhas de design sutis no fundo */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%23ffffff' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E\")" }} />
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
}
