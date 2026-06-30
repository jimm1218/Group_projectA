# Implementation Plan

## Objective

Reposition and evolve the project into an Enterprise AI Omnichannel Reputation Management Platform.

The platform must support multi-source reputation ingestion, normalize all records into a unified Mention Schema, process mentions through AI pipelines, enforce RAG safety guardrails, and govern whether a response can be officially published or only used internally as a suggested response.

## Current Baseline

The current prototype already includes:

- A browser-based dashboard in `index.html`.
- Core logic in `app.js`.
- Local demo review data.
- Supabase `review` table integration.
- Data source selector for local demo data vs Supabase data.
- Mention Schema adapter for Supabase rows.
- RAG simulator with generic reply generation.
- Editable AI reply draft and submission simulation.
- Reply Capability Layer rules.
- Documentation files for architecture and schema.

## Phase 1: Data Source Selection

Status: implemented.

Goals:

- Allow the user to choose between local demo data and Supabase data.
- Preserve local data for offline demos.
- Load Supabase data only when selected.
- Re-render charts, mention list, alerts, NLP selector, and RAG selector after switching.

Key files:

- `index.html`: `data-source-select`
- `app.js`: `LOCAL_REVIEWS`, `activeDataSource`, `switchDataSource()`, `setupDataSourceSelector()`

Verification:

- Default page load shows local demo data.
- Selecting Supabase loads `review` rows from Supabase.
- Refresh respects the active data source.

## Phase 2: Unified Mention Schema

Status: implemented as frontend adapter.

Goals:

- Treat Supabase `review` rows as source records.
- Convert source records into a unified Mention Schema before AI processing.
- Preserve raw source payload for audit and future backend processing.

Current adapter:

- `mapSupabaseRowToMention(row)`
- `mapSupabaseReview(row)`

Target schema fields:

- `mention_id`
- `tenant_id`
- `business_id`
- `source`
- `source_label`
- `external_id`
- `author`
- `content`
- `rating`
- `url`
- `published_at`
- `raw_payload`
- `nlp`
- `vision`
- `risk`
- `reply_capability`
- `ai_reply_output`

Reference:

- `mention_schema.md`

## Phase 3: Reply Capability Layer

Status: implemented in prototype logic.

Rules:

Google Business Reviews:

- Generate AI reply draft.
- Require manager approval.
- Future backend may publish approved replies via Google Business API.

Other sources:

- Generate suggested response only.
- Do not publish through platform APIs.
- Allow CRM ticket creation.
- Allow department notification.

Current implementation:

- `REPLY_CAPABILITY_LAYER`
- `getReplyCapability(source)`
- `submitAiReplyDraft()`
- `createCrmTicketFromDraft()`

Next backend work:

- Persist reply decisions.
- Persist approval requests.
- Persist CRM tickets.
- Add audit logs.
- Add actual Google Business API publishing only after approval.

## Phase 4: RAG Guardrails And AI Reply Engine

Status: prototype implemented.

Current behavior:

- Uses predefined `RAG_RESPONSES` for legacy local cases when available.
- Uses generic RAG rule inference for all other mentions.
- Generates a safe reply draft.
- Displays JSON output with required AI decision fields.
- Allows manager editing before submission.

Guardrails:

- No admission of liability.
- No refund promise.
- No compensation promise.
- No fabricated policy.
- No fabricated promotion.
- No fabricated store information.
- No fabricated business hours.
- No fabricated phone number.
- No fabricated product information.
- No speculation about unverified events.

Current implementation:

- `RAG_REPLY_GUARDRAILS`
- `inferMatchedRagRules(review)`
- `generateSafeReplyDraft(review)`
- `buildGenericRagData(review)`
- `runRAGSimulation()`

Next backend work:

- Replace heuristic retrieval with vector retrieval.
- Store KB entries in tenant-scoped tables.
- Add reply validation service.
- Add structured output validation.
- Add model call layer through backend, not directly from browser.

## Phase 5: Dashboard Evolution

Current UI is still adapted from the legacy Google Review dashboard.

Target modules:

- Multi-source Reputation Dashboard
- AI Decision Center
- Escalation Center
- Mention Timeline
- Crisis Monitoring
- Brand Health Score
- Competitor Comparison
- AI Suggested Actions

Recommended next UI tasks:

1. Rename `reviews` tab to `Mentions`.
2. Add source filter and publish-capability filter.
3. Add AI Decision Center table with risk, confidence, department, allowed actions, blocked actions.
4. Add Escalation Center for legal, PR, customer service, operations, and store manager queues.
5. Add Mention Timeline by source and risk level.
6. Add Crisis Monitoring panel for negative spikes and high-risk keyword clusters.
7. Add Brand Health Score based on sentiment, risk, velocity, and unresolved escalations.

## Phase 6: Enterprise SaaS Backend

Target production architecture:

- FastAPI for API layer.
- PostgreSQL / Supabase for transactional storage.
- Redis for cache, queues, and locks.
- Celery for async ingestion and AI jobs.
- Vector database or pgvector for RAG retrieval.
- Object storage for raw payloads, CSV files, screenshots, and media.
- n8n for workflow automation.
- MCP for controlled enterprise tool integrations.
- Multi-tenant authorization and audit logging.

Recommended tables:

- `tenant`
- `client`
- `business`
- `source_account`
- `mention`
- `mention_analysis`
- `reply_decision`
- `approval_request`
- `crm_ticket`
- `knowledge_base`
- `policy_rule`
- `audit_log`

## Phase 7: Verification Plan

Frontend checks:

- `node --check app.js`
- Page loads at `http://127.0.0.1:8000/index.html`.
- Local demo data is selected by default.
- Supabase data source can be selected.
- Mention list and charts update after data source switch.
- AI RAG simulator works for local data.
- AI RAG simulator works for Supabase data.
- Final reply draft is editable.
- Submit action routes Google-like sources to manager approval.
- Non-Google sources route to CRM/suggested-response handling.

Supabase checks:

- Publishable key can read `review`.
- RLS policy allows intended anonymous read only.
- No `service_role` key is exposed in frontend code.

## Open Decisions

- Whether to keep Supabase direct-from-browser for demo only or move all Supabase reads behind FastAPI.
- Which vector store to use for production RAG retrieval.
- Whether Google Business API publishing should be a direct backend action or an n8n workflow.
- How tenant identity will be resolved in the first production version.
- Which source connectors should be built first after Google and Supabase.
