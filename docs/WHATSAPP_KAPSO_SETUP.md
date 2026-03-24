# WhatsApp Kapso Setup

This project now supports Kapso as a WhatsApp provider alongside Twilio and Meta.

## Required env vars

```bash
WHATSAPP_PROVIDER=kapso
KAPSO_API_KEY=your_kapso_api_key
KAPSO_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
KAPSO_WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
KAPSO_WHATSAPP_BASE_URL=https://api.kapso.ai/meta/whatsapp
```

If you leave `WHATSAPP_PROVIDER=auto`, the app will prefer Kapso when the Kapso variables are present.

## What the bot supports

- Text replies
- Interactive buttons
- Interactive lists
- Twilio webhook fallback during migration
- Kapso WhatsApp webhooks in JSON format
- Meta raw webhook forwarding through Kapso

## Webhook endpoint

Point your Kapso WhatsApp webhook to:

```bash
/api/bot
```

The route accepts:

- Twilio `application/x-www-form-urlencoded`
- Kapso WhatsApp JSON payloads
- Meta webhook JSON payloads forwarded by Kapso
- Botpress JSON payloads

## Recommended setup flow

1. Add the Kapso env vars.
2. Set `WHATSAPP_PROVIDER=auto` or `WHATSAPP_PROVIDER=kapso`.
3. Register the Kapso webhook in the Kapso dashboard.
4. Test an inbound text message.
5. Test one interactive button and one list reply.
6. Confirm outgoing messages are stored in `bot_messages`.

## Notes

- Keep Twilio configured only if you want a fallback while testing.
- Use `WHATSAPP_ENABLE_BUTTONS=true` if you want interactive menus.
- If webhook signatures are enabled, the app will validate them when the secret is present.
