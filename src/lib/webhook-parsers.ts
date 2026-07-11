export type StandardizedWebhookEvent = {
  status: "purchased" | "refunded" | "chargeback" | "abandoned_cart" | "checkout_started" | "lead" | "ignored";
  email: string | null;
  value: number | null;
  currency: string;
  clickId: string | null;
};

// Tradutor Universal Inteligente (Fallback)
function universalParser(payload: any, query: any): StandardizedWebhookEvent {
  const strPayload = JSON.stringify(payload).toLowerCase();
  
  // 1. Achar E-mail
  let email = payload?.email || payload?.customer?.email || payload?.buyer?.email || payload?.client?.email || null;
  if (!email) {
    const emailMatch = strPayload.match(/"([^"]+@[^"]+\.[^"]+)"/);
    if (emailMatch) email = emailMatch[1];
  }

  // 2. Achar Status
  let status: StandardizedWebhookEvent["status"] = "ignored";
  const st = String(payload?.status || payload?.event_type || payload?.event || payload?.order_status || payload?.transaction?.status || "").toLowerCase();
  
  if (st.includes("paid") || st.includes("approved") || st.includes("compra_aprovada")) status = "purchased";
  else if (st.includes("refund") || st.includes("reembolso") || st.includes("devolvido")) status = "refunded";
  else if (st.includes("chargeback") || st.includes("dispute")) status = "chargeback";
  else if (st.includes("abandon") || st.includes("cart")) status = "abandoned_cart";
  else if (st.includes("checkout") || st.includes("started") || st.includes("initiated")) status = "checkout_started";
  else if (st.includes("lead") || st.includes("registered")) status = "lead";
  else {
    // Busca profunda
    if (strPayload.includes("approved") || strPayload.includes("paid")) status = "purchased";
    else if (strPayload.includes("refund")) status = "refunded";
  }

  // 3. Achar Valor
  let value = payload?.amount || payload?.value || payload?.price || payload?.transaction?.amount || payload?.transaction?.price || null;
  if (!value && payload?.comissions) value = payload.comissions[0]?.value; // comum em algumas
  
  if (typeof value === "string") {
    value = parseFloat(value.replace(/[^0-9.-]+/g,""));
  }

  // 4. Achar Moeda
  const currency = payload?.currency || payload?.transaction?.currency || "BRL";

  // 5. Achar Click ID (UTM / SubID)
  let clickId = query?.sub1 || query?.click_id || query?.src || payload?.metadata?.click_id || payload?.utm_source || payload?.tracking?.utm_source || null;

  return { status, email, value, currency, clickId };
}

export function parseWebhookPayload(platform: string, payload: any, query: any): StandardizedWebhookEvent {
  const p = platform.toLowerCase();

  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (e) {}
  }

  const result: StandardizedWebhookEvent = {
    status: "ignored", email: null, value: null, currency: "BRL", clickId: query?.sub1 || query?.click_id || null
  };

  switch (p) {
    case "hotmart":
      const hStatus = payload?.event || payload?.status;
      if (hStatus === "PURCHASE_APPROVED" || hStatus === "approved") result.status = "purchased";
      else if (hStatus === "PURCHASE_REFUNDED" || hStatus === "refunded") result.status = "refunded";
      else if (hStatus === "PURCHASE_CHARGEBACK" || hStatus === "chargeback") result.status = "chargeback";
      
      result.email = payload?.data?.buyer?.email || payload?.email;
      result.value = payload?.data?.purchase?.price?.value || payload?.price;
      result.currency = payload?.data?.purchase?.price?.currency_code || "BRL";
      if (!result.clickId) result.clickId = payload?.data?.purchase?.tracking?.source || null;
      break;

    case "kiwify":
      const kStatus = payload?.order_status;
      if (kStatus === "paid") result.status = "purchased";
      else if (kStatus === "refunded") result.status = "refunded";
      else if (kStatus === "chargeback") result.status = "chargeback";
      
      result.email = payload?.Customer?.email;
      result.value = payload?.Commissions?.charge_amount || payload?.amount;
      if (!result.clickId) result.clickId = payload?.TrackingParameters?.src || null;
      break;

    case "perfectpay":
      const pStatus = payload?.transaction_status || payload?.status;
      if (pStatus === "approved" || pStatus === "2") result.status = "purchased";
      else if (pStatus === "refunded" || pStatus === "6") result.status = "refunded";
      else if (pStatus === "chargeback" || pStatus === "7") result.status = "chargeback";

      result.email = payload?.customer?.email;
      result.value = payload?.sale_amount || payload?.amount;
      if (!result.clickId) result.clickId = payload?.tracking?.src || null;
      break;
      
    case "cakto":
      const cStatus = payload?.event || payload?.status;
      if (cStatus === "transaction.approved") result.status = "purchased";
      else if (cStatus === "transaction.refunded") result.status = "refunded";
      else if (cStatus === "transaction.chargeback") result.status = "chargeback";

      result.email = payload?.data?.customer?.email;
      result.value = payload?.data?.amount || payload?.data?.value;
      if (!result.clickId) result.clickId = payload?.data?.metadata?.utm_source || null;
      break;

    case "appmax":
      const aStatus = payload?.event || payload?.data?.status;
      if (aStatus === "OrderApproved") result.status = "purchased";
      else if (aStatus === "OrderRefunded") result.status = "refunded";
      else if (aStatus === "OrderChargeback") result.status = "chargeback";

      result.email = payload?.data?.customer_email || payload?.data?.email;
      result.value = payload?.data?.payment_total || payload?.data?.amount;
      if (!result.clickId) result.clickId = payload?.data?.tracking?.src || null;
      break;

    case "wiven":
      const wStatus = payload?.status || payload?.event_type;
      if (wStatus === "paid" || wStatus === "approved") result.status = "purchased";
      else if (wStatus === "refunded") result.status = "refunded";
      else if (wStatus === "chargeback") result.status = "chargeback";

      result.email = payload?.customer?.email || payload?.email;
      result.value = payload?.amount || payload?.value;
      if (!result.clickId) result.clickId = payload?.metadata?.click_id || payload?.utm_source || null;
      break;

    case "kirvano":
      const krStatus = payload?.status || payload?.event;
      if (krStatus === "PAID" || krStatus === "approved") result.status = "purchased";
      else if (krStatus === "REFUNDED") result.status = "refunded";
      else if (krStatus === "CHARGEBACK") result.status = "chargeback";

      result.email = payload?.customer?.email;
      result.value = payload?.amount;
      if (!result.clickId) result.clickId = payload?.tracking?.utm_source || null;
      break;

    case "ironpay":
    case "ggcheckout":
    case "wiapy":
    case "greenn":
    case "lastlink":
    case "goatpay":
    default:
      return universalParser(payload, query);
  }

  if (result.value !== null && typeof result.value === "string") {
    result.value = parseFloat((result.value as string).replace(/[^0-9.-]+/g,""));
  }

  return result;
}
