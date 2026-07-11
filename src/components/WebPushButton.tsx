import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { subscribeToWebPush } from "@/lib/webpush.server";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function WebPushButton() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const subscribeFn = useServerFn(subscribeToWebPush);
  
  // Detecção básica de iOS
  const isIOS = typeof window !== "undefined" && 
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    
  const isStandalone = typeof window !== "undefined" && 
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function handleSubscribe() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permissão de notificação negada.");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
          toast.error("Chave pública VAPID não configurada!");
          setLoading(false);
          return;
        }
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await subscribeFn({ data: { subscription: subscription.toJSON() } });
      setIsSubscribed(true);
      toast.success("Notificações de vendas ativadas!");

      // Envia uma notificação de teste local
      if (registration && registration.showNotification) {
        registration.showNotification("Telesignal", {
          body: "Teste: Sua notificação está configurada!",
          icon: "/favicon.png"
        });
      } else {
        new Notification("Telesignal", {
          body: "Teste: Sua notificação está configurada!",
          icon: "/favicon.png"
        });
      }

    } catch (error: any) {
      console.error("Error subscribing:", error);
      toast.error(`Erro ao ativar: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
      setIsSubscribed(false);
      toast.success("Notificações desativadas.");
    } catch (e) {
      console.error("Error unsubscribing:", e);
      toast.error("Erro ao desativar notificações.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported) {
    if (isIOS && !isStandalone) {
      return (
        <div className="text-sm text-zinc-400 bg-zinc-900/50 p-3 rounded-md border border-zinc-800">
          <p className="font-medium text-white mb-1">Dica para iPhone (iOS):</p>
          Para ativar as notificações push no seu iPhone, toque no botão <strong>Compartilhar</strong> do Safari e depois em <strong>"Adicionar à Tela de Início"</strong>.
        </div>
      );
    }

    return (
      <Button disabled variant="outline">
        Notificações não suportadas neste navegador
      </Button>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={loading}
      className="flex items-center gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="w-4 h-4" />
      ) : (
        <Bell className="w-4 h-4" />
      )}
      {isSubscribed ? "Desativar Notificações" : "Ativar Alertas de Venda (Push)"}
    </Button>
  );
}
