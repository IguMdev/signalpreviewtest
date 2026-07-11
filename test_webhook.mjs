async function testWebhook() {
  const payload = {
    event_type: "compra_aprovada",
    customer: {
      email: "test@example.com"
    },
    amount: 99.90,
    currency: "BRL",
    metadata: {
      click_id: "telesignal_test"
    },
    utm_source: "telesignal_test"
  };

  console.log("Sending POST to Wiven webhook...");
  try {
    const res = await fetch("https://telesignal.com.br/api/public/wiven/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testWebhook();
