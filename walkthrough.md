# Walkthrough

This walkthrough explains how to demo and verify the Enterprise AI Omnichannel Reputation Management Platform prototype.

## 1. Start The Local App

From `C:\project`:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8000/index.html
```

## 2. Choose A Data Source

Use the data source selector in the dashboard header.

Options:

- `本地示範資料`
- `我的 Supabase 資料庫`

Expected behavior:

- Local demo data is used by default.
- Supabase data is loaded only after selecting `我的 Supabase 資料庫`.
- The dashboard, mention list, alert center, NLP selector, and RAG selector refresh after switching.

## 3. Review The Dashboard

The current dashboard shows:

- Total mention / review count.
- Average rating where available.
- High-risk count.
- Sentiment ratio / NPS-style score.
- Rating distribution.
- Aspect sentiment.
- Store or source-level risk.
- Risk distribution.
- Sentiment timeline.
- Emotion distribution.
- Word cloud.

Note: some visual labels still come from the legacy Google Review prototype, but the data layer now supports multi-source mentions through the Mention Schema adapter.

## 4. Inspect Mentions

Open the mention list tab.

Try:

- Filtering by source/store.
- Filtering by rating.
- Filtering by sentiment.
- Filtering by risk level.
- Searching mention text or author.
- Opening a mention detail modal.

From the modal, you can send a mention into the AI RAG simulator.

## 5. Run The AI RAG Simulator

Open `AI RAG 模擬器`.

Steps:

1. Select a mention.
2. Confirm NLP preview, sentiment, intent, aspect, and risk.
3. Click `啟動 RAG 檢索與回覆生成`.
4. Review matched SOP rules.
5. Review the generated prompt.
6. Compare unsafe reply vs RAG-constrained safe reply.
7. Review the structured JSON output.
8. Edit the `Final AI Reply Draft`.
9. Click `提交處理` or `建立 CRM Ticket`.

Expected behavior:

- Legacy local cases use predefined RAG scenarios when available.
- Any local or Supabase mention without a predefined scenario uses generic RAG rule inference.
- A safe reply draft is generated for all selectable mentions.
- High-risk mentions require human review.
- Google-like sources are routed to manager approval.
- Other sources are suggestion-only and route to CRM / internal handling.

## 6. Understand Reply Capability

Google Business Reviews:

- Can generate AI reply drafts.
- Must be approved by a manager.
- Can later be published through Google Business API when backend support exists.

Other sources:

- Can generate suggested responses.
- Can create CRM tickets.
- Can notify departments.
- Must not publish comments through platform APIs.

The simulator shows the `publish_capability` field in the JSON output.

## 7. Verify AI Reply Output

Every generated AI reply decision should include:

```json
{
  "reply_draft": "string",
  "confidence_score": 0.82,
  "need_human_review": true,
  "suggested_department": "customer_service",
  "risk_level": "medium",
  "publish_capability": "suggestion_only"
}
```

## 8. Verify RAG Guardrails

The safe reply should not:

- Admit liability.
- Promise refunds.
- Promise compensation.
- Invent policies.
- Invent promotions.
- Invent store information.
- Invent business hours.
- Invent phone numbers.
- Invent product information.
- Speculate about unverified events.

If the mention is risky, the output should recommend human review and route to the correct department.

## 9. Supabase Demo Path

To demo Supabase:

1. Select `我的 Supabase 資料庫`.
2. Wait for dashboard refresh.
3. Open `AI RAG 模擬器`.
4. Select a Supabase mention.
5. Generate the AI reply.
6. Confirm the JSON contains a `mention-*` id and source metadata.
7. Submit or create CRM ticket.

Troubleshooting:

- If Supabase fails to load, check RLS read policy for the `review` table.
- Confirm the frontend uses a publishable key only.
- Do not use a `service_role` key in browser code.

## 10. Developer Verification

Run:

```powershell
node --check app.js
```

Optional Supabase REST check:

```powershell
$headers = @{
  apikey = "YOUR_PUBLISHABLE_KEY"
  Authorization = "Bearer YOUR_PUBLISHABLE_KEY"
}

Invoke-RestMethod `
  -Uri "https://mzonkpfagqdhaqwybtuo.supabase.co/rest/v1/review?select=id&limit=1" `
  -Headers $headers `
  -Method Get
```

## 11. Recommended Demo Script

1. Start on local demo data and show dashboard metrics.
2. Switch to Supabase and show live data loading.
3. Open a high-risk mention.
4. Send it to AI RAG simulator.
5. Generate a safe reply.
6. Explain why the unsafe reply violates guardrails.
7. Edit final reply draft.
8. Submit handling.
9. Explain that Google can later publish after approval, while all other sources are CRM/suggestion-only.
