export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("LearnOptix Trading Alerts Webhook is ONLINE", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=UTF-8" }
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    let data;
    try {
      data = await request.json();
    } catch (error) {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }

    if (!env.WEBHOOK_SECRET || data.secret !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=UTF-8" }
      });
    }

    delete data.secret;

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return jsonResponse({ success: false, message: "Telegram configuration missing" }, 500);
    }

    const symbol = clean(data.symbol, "-");
    const rawSide = clean(data.side, "") || clean(data.signal, "");
    const side = normalizeSide(rawSide);
    const status = clean(data.status, "") || clean(data.setup, "") || "NEW SETUP";
    const entry = clean(data.entry, "") || clean(data.price, "");
    const timeframe = clean(data.timeframe, "") || clean(data.chart_tf, "") || "1M";
    const setupId = clean(data.setup_id, "") || clean(data.setupId, "");
    const eventTime = clean(data.time, "");

    const alignmentText = `${status} ${data.setup || ""}`.toUpperCase();

    const isAlignment =
      alignmentText.includes("15M") &&
      alignmentText.includes("1M") &&
      alignmentText.includes("ALIGN");

    let telegramText;

    if (isAlignment) {
      const bullish = side === "BULLISH" || alignmentText.includes("BULLISH");
      const bearish = side === "BEARISH" || alignmentText.includes("BEARISH");

      const direction = bullish
        ? "BULLISH"
        : bearish
          ? "BEARISH"
          : side || "ALIGNMENT";

      const directionEmoji =
        direction === "BULLISH"
          ? "🟢"
          : direction === "BEARISH"
            ? "🔴"
            : "🟡";

      telegramText =
        `${directionEmoji} LEARNOPTIX TRADING SIGNAL\n\n` +
        `${symbol} - ${direction}\n\n` +
        `15M + 1M ${direction} ALIGNMENT\n\n` +
        `Price: ${entry || "-"}\n` +
        `Chart TF: ${timeframe || "1M"}` +
        (eventTime ? `\nTime: ${eventTime}` : "") +
        (setupId ? `\nSetup ID: ${setupId}` : "");
    } else {
      const displaySide = side || clean(data.side, "-");

      telegramText =
        `🚨 LEARNOPTIX TRADING SIGNAL\n\n` +
        `${symbol} - ${displaySide || "-"}\n\n` +
        `Status: ${status || "NEW SETUP"}\n\n` +
        `Entry: ${entry || "-"}\n` +
        `SL: ${clean(data.sl, "-")}\n` +
        `TP: ${clean(data.tp, "-")}\n` +
        `R:R: ${clean(data.rr, "-")}\n\n` +
        `15M Bias: ${clean(data.bias, "-")}\n` +
        `M1 CHoCH: ${clean(data.choch, "-")}\n` +
        `POI: ${clean(data.poi, "-")}\n` +
        `Chart TF: ${timeframe || "-"}\n\n` +
        `Setup ID: ${setupId || "-"}`;
    }

    const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    let telegramResponse;
    try {
      telegramResponse = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: telegramText,
          disable_web_page_preview: true
        })
      });
    } catch (error) {
      return jsonResponse({
        success: false,
        message: "Telegram Delivery Failed",
        telegram_status: "NETWORK_ERROR"
      }, 502);
    }

    let telegramResult = null;
    try {
      telegramResult = await telegramResponse.json();
    } catch (_) {
      telegramResult = null;
    }

    if (!telegramResponse.ok || !telegramResult?.ok) {
      return jsonResponse({
        success: false,
        message: "Telegram Delivery Failed",
        telegram_status: telegramResponse.status,
        telegram_description: telegramResult?.description || "Unknown Telegram error"
      }, 502);
    }

    return jsonResponse({
      success: true,
      message: "Signal sent to Telegram",
      type: isAlignment ? "alignment" : "trade"
    }, 200);
  }
};

function clean(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function normalizeSide(value) {
  const text = clean(value, "").toUpperCase();

  if (text.includes("BULL") || text.includes("BUY") || text === "LONG") {
    return "BULLISH";
  }

  if (text.includes("BEAR") || text.includes("SELL") || text === "SHORT") {
    return "BEARISH";
  }

  return text;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" }
  });
}
