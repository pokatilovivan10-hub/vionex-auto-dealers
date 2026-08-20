# CRM webhook contract

When `LEAD_WEBHOOK_URL` is configured, the site sends a `POST` request with JSON:

```json
{
  "event": "website.lead.created",
  "version": "1.0",
  "lead": {
    "id": "VL-20260730-ABC12345",
    "createdAt": "2026-07-30T12:00:00.000Z",
    "name": "Иван",
    "phone": "+7 (999) 000-00-00",
    "email": "",
    "company": "Компания",
    "role": "РОП",
    "goal": "warm_leads",
    "monthlyTarget": "20–50 лидов",
    "comment": "Комментарий",
    "consent": {
      "accepted": true,
      "acceptedAt": "2026-07-30T12:00:00.000Z",
      "policyUrl": "https://example.ru/privacy"
    },
    "meta": {
      "page": "/",
      "referrerHost": "",
      "viewport": "desktop",
      "variant": "control",
      "sessionId": "s_...",
      "utm": {}
    }
  }
}
```

Headers:

```text
Authorization: Bearer <LEAD_WEBHOOK_TOKEN>
X-Lead-Id: <lead.id>
Idempotency-Key: <lead.id>
Content-Type: application/json
```

The receiving endpoint should return any `2xx` status. On timeout or non-2xx response, the lead remains in `data/outbox.json` and is retried with exponential backoff.

Before connecting a production CRM:

1. Use a test pipeline or sandbox.
2. Verify field mapping.
3. Deduplicate by `Idempotency-Key`.
4. Never write tokens into frontend files.
5. Restrict the endpoint to HTTPS.
