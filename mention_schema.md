# Unified Mention Schema

Every source record must be transformed into this schema before entering NLP, vision, risk, RAG, and reply workflows.

```json
{
  "schema_version": "enterprise-mention-v1",
  "mention_id": "mention-google_business_reviews-123",
  "tenant_id": "tenant_001",
  "business_id": "business_001",
  "source": "google_business_reviews",
  "source_label": "Google",
  "external_id": "platform-native-id",
  "author": "display name",
  "title": "",
  "content": "raw mention text",
  "rating": 4.0,
  "url": "https://...",
  "published_at": "2026-06-30T12:00:00Z",
  "crawled_at": "2026-06-30T12:05:00Z",
  "raw_payload": {},
  "nlp": {
    "sentiment": { "label": "positive", "score": 0.82 },
    "emotion": { "joy": 0.75, "anger": 0.0, "disappointment": 0.1 },
    "intent": { "primary": "praise", "secondary": [] },
    "topics": [],
    "aspects": [],
    "confidence": 0.85
  },
  "vision": {
    "has_media": false,
    "labels": [],
    "risk_flags": []
  },
  "risk": {
    "score": 10,
    "level": "low",
    "legal_risk": false,
    "food_safety": false,
    "hygiene_risk": false,
    "escalation_type": "none"
  },
  "reply_capability": {
    "publish_capability": "suggestion_only",
    "can_generate_reply": true,
    "requires_manager_approval": true,
    "can_publish_via_platform_api": false,
    "can_create_crm_ticket": true,
    "allowed_actions": ["suggested_response", "crm_ticket", "notify_department"]
  },
  "ai_reply_output": {
    "reply_draft": "",
    "confidence_score": 0.82,
    "need_human_review": true,
    "suggested_department": "customer_service",
    "risk_level": "medium",
    "publish_capability": "suggestion_only"
  }
}
```

## Source Values

- `google_business_reviews`
- `ptt`
- `mobile01`
- `facebook`
- `instagram`
- `threads`
- `dcard`
- `youtube`
- `news_rss`
- `csv_import`
- `supabase`

## Publish Capability Values

- `official_publish`: Google Business Reviews only, after approval.
- `suggestion_only`: all other sources.
- `none`: sources or records where AI reply should be disabled.

## Required AI Reply Fields

- `reply_draft`
- `confidence_score`
- `need_human_review`
- `suggested_department`
- `risk_level`
- `publish_capability`
