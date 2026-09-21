# LearnOptix Trading Alerts

Cloudflare Worker relay for TradingView alerts to Telegram.

## Runtime secrets

Configure these in Cloudflare Workers (do **not** commit their values):

- `WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## Alignment payload

Bullish example:

```json
{
  "secret": "YOUR_WEBHOOK_SECRET",
  "symbol": "{{ticker}}",
  "side": "BULLISH",
  "status": "15M + 1M BULLISH ALIGNMENT",
  "entry": "{{close}}",
  "timeframe": "1M",
  "setup_id": "MTF-BULL-{{ticker}}"
}
```

Bearish example:

```json
{
  "secret": "YOUR_WEBHOOK_SECRET",
  "symbol": "{{ticker}}",
  "side": "BEARISH",
  "status": "15M + 1M BEARISH ALIGNMENT",
  "entry": "{{close}}",
  "timeframe": "1M",
  "setup_id": "MTF-BEAR-{{ticker}}"
}
```

The Worker also preserves compatibility with the earlier trade-planner payload containing Entry, SL, TP, R:R, bias, CHoCH and POI fields.
