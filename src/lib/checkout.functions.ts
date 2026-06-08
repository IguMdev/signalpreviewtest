import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const generateWivenCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d as { planId: string, customPrice?: number, customName?: string, customDescription?: string })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    if (!userId) {
      throw new Error("Não autenticado");
    }

    const { planId, customPrice, customName, customDescription } = data;

    let priceToCharge = customPrice;
    let productName = customName || "Plano Telesignal";

    // Se tiver planId válido do banco, buscamos o preço de lá
    if (planId && !planId.startsWith("salas-") && !planId.startsWith("track-")) {
      const { data: planDb, error } = await (supabaseAdmin as any)
        .from("plans")
        .select("name, price_brl")
        .eq("id", planId)
        .single();

      if (error || !planDb) {
        throw new Error("Plano não encontrado no banco de dados.");
      }
      priceToCharge = Number(planDb.price_brl);
      productName = planDb.name;
    }

    if (!priceToCharge || priceToCharge <= 0) {
      throw new Error("Preço inválido.");
    }

    // A Wiven recebe o preço em REAIS (ex: 150 para R$ 150,00) na API de Checkout
    const priceInCents = Number(priceToCharge);

    const payload = {
      product: {
        name: productName,
        externalId: planId, // Passamos o planId aqui para referência
        offer: {
          name: "Oferta Principal",
          price: priceInCents,
          offerType: "NATIONAL",
          currency: "BRL",
          lang: "pt-BR"
        }
      },
      settings: {
        paymentMethods: ["PIX", "CREDIT_CARD"],
        acceptedDocs: ["CPF"],
        askForAddress: false
      },
      customer: {
        // Enviar os dados básicos do usuário logado se possível
        email: claims?.email || "cliente@telesignal.com.br",
      },
      trackProps: {
        external_id: userId, // O webhook deve nos retornar isso como clientIdentifier
      }
    };

    const pubKey = process.env.WIVEN_PUBLIC_KEY;
    const secKey = process.env.WIVEN_SECRET_KEY;

    if (!pubKey || !secKey) {
      throw new Error("Chaves da Wiven não configuradas no servidor.");
    }

    const response = await fetch("https://app.wiven.com.br/api/v1/gateway/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": pubKey,
        "x-secret-key": secKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Wiven Checkout Error:", text);
      throw new Error("Falha ao se comunicar com a Wiven: " + response.status);
    }

    const result = await response.json();
    
    if (!result || !result.checkoutUrl) {
      console.error("Wiven response:", result);
      throw new Error("Wiven não retornou a URL de checkout.");
    }

    return result.checkoutUrl;
  });

export const generateDirectPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d as { planId: string, customPrice?: number, customName?: string, customDescription?: string, clientDocument?: string, isSubscription?: boolean, billingCycle?: string })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    if (!userId) throw new Error("Não autenticado");

    const { planId, customPrice, customName, clientDocument, isSubscription, billingCycle } = data;
    let priceToCharge = customPrice;
    let productName = customName || "Plano Telesignal";

    if (planId && !planId.startsWith("salas-") && !planId.startsWith("track-")) {
      const { data: planDb, error } = await (supabaseAdmin as any)
        .from("plans")
        .select("name, price_brl")
        .eq("id", planId)
        .single();
      if (error || !planDb) throw new Error("Plano não encontrado");
      priceToCharge = Number(planDb.price_brl);
      productName = planDb.name;
    }

    if (!priceToCharge || priceToCharge <= 0) throw new Error("Preço inválido");

    const pubKey = process.env.WIVEN_PUBLIC_KEY;
    const secKey = process.env.WIVEN_SECRET_KEY;
    if (!pubKey || !secKey) throw new Error("Chaves da Wiven não configuradas");

    const userEmail = claims?.email || "cliente@telesignal.com.br";
    const userName = claims?.user_metadata?.full_name || "Cliente Telesignal";

    if (!clientDocument || clientDocument.length < 11) {
       throw new Error("CPF/CNPJ é obrigatório para gerar o PIX.");
    }

    const payload: any = {
      identifier: `pix-${userId}-${Date.now()}`,
      amount: Number(priceToCharge),
      client: {
        name: userName,
        email: userEmail,
        phone: "(11) 99999-9999", // dummy
        document: clientDocument.replace(/\D/g, '') // Wiven obriga documento válido
      },
      products: [
        {
          id: planId || "custom",
          name: productName,
          quantity: 1,
          price: Number(priceToCharge)
        }
      ],
      metadata: {
        userId: userId,
        planId: planId
      }
    };
    
    if (isSubscription) {
      payload.offerType = "SUBSCRIPTION";
      payload.recurring = true;
      if (billingCycle === "mensal") payload.interval = "MONTHLY";
      else if (billingCycle === "trimestral") payload.interval = "QUARTERLY";
      else if (billingCycle === "anual") payload.interval = "YEARLY";
    }

    const response = await fetch("https://app.wiven.com.br/api/v1/gateway/pix/receive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": pubKey,
        "x-secret-key": secKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Wiven PIX Error:", text);
      throw new Error("Falha ao gerar PIX: " + response.status);
    }

    const result = await response.json();
    if (!result || !result.pix) {
      throw new Error("Wiven não retornou os dados do PIX.");
    }

    // Retorna o base64 (qr code) e o code (copia e cola)
    return {
      transactionId: result.transactionId,
      code: result.pix.code,
      qrCodeBase64: result.pix.base64,
      qrCodeImage: result.pix.image
    };
  });

export const generateDirectCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d as { 
    planId: string, 
    customPrice?: number, 
    customName?: string,
    isSubscription?: boolean,
    billingCycle?: string,
    client: any,
    address: any,
    card: any
  })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    if (!userId) throw new Error("Não autenticado");

    const { planId, customPrice, customName, isSubscription, billingCycle, client, address, card } = data;
    let priceToCharge = customPrice;
    let productName = customName || "Plano Telesignal";

    if (planId && !planId.startsWith("salas-") && !planId.startsWith("track-")) {
      const { data: planDb, error } = await (supabaseAdmin as any)
        .from("plans")
        .select("name, price_brl")
        .eq("id", planId)
        .single();
      if (error || !planDb) throw new Error("Plano não encontrado");
      priceToCharge = Number(planDb.price_brl);
      productName = planDb.name;
    }

    if (!priceToCharge || priceToCharge <= 0) throw new Error("Preço inválido");

    const pubKey = process.env.WIVEN_PUBLIC_KEY;
    const secKey = process.env.WIVEN_SECRET_KEY;
    if (!pubKey || !secKey) throw new Error("Chaves da Wiven não configuradas");

    const payload: any = {
      identifier: `card-${userId}-${Date.now()}`,
      amount: Number(priceToCharge),
      clientIp: "127.0.0.1", // Wiven obriga IP
      client: {
        name: client.name || claims?.user_metadata?.full_name || "Cliente",
        email: client.email || claims?.email,
        phone: client.phone || "(11) 99999-9999",
        document: client.document || "00000000000",
        address: {
          country: address.country || "BR",
          state: address.state || "SP",
          city: address.city || "São Paulo",
          neighborhood: address.neighborhood || "Centro",
          zipCode: address.zipCode || "01000-000",
          street: address.street || "Rua Centro",
          number: address.number || "0",
          complement: address.complement || ""
        }
      },
      card: {
        number: card.number.replace(/\s+/g, ""),
        owner: card.owner,
        expiresAt: card.expiresAt,
        cvv: card.cvv,
        statementDescriptor: "TELESIGNAL"
      },
      installments: 1,
      products: [
        {
          id: planId || "custom",
          name: productName,
          quantity: 1,
          price: Number(priceToCharge)
        }
      ],
      metadata: {
        userId: userId,
        planId: planId
      }
    };

    if (isSubscription) {
      payload.offerType = "SUBSCRIPTION";
      payload.recurring = true;
      if (billingCycle === "mensal") payload.interval = "MONTHLY";
      else if (billingCycle === "trimestral") payload.interval = "QUARTERLY";
      else if (billingCycle === "anual") payload.interval = "YEARLY";
    }

    const response = await fetch("https://app.wiven.com.br/api/v1/gateway/card/receive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": pubKey,
        "x-secret-key": secKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Wiven CARD Error:", text);
      try {
        const errJson = JSON.parse(text);
        if (errJson.details?.issue) {
          throw new Error(`Erro na Wiven: ${errJson.details.issue}`);
        }
        throw new Error(`Erro Wiven: ${errJson.message}`);
      } catch(e) {
        throw new Error("Falha ao gerar Cartão: " + text);
      }
    }

    const result = await response.json();
    return {
      transactionId: result.transactionId,
      status: result.status,
      details: result.details
    };
  });
