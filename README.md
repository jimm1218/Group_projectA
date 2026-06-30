# Enterprise AI Omnichannel Reputation Management Platform

This project is an Enterprise AI Omnichannel Reputation Management Platform. It started as a Google Review AI dashboard prototype, but has now been repositioned as a multi-source reputation command center that can ingest, normalize, analyze, govern, and route brand mentions across channels.

The current frontend prototype connects to Supabase, supports local demo data, maps Supabase `review` rows into a unified Mention Schema, and demonstrates AI-assisted RAG reply generation with reply capability governance.

## What The Platform Does

- Ingests mentions from Google Business Reviews, PTT, Mobile01, Facebook, Instagram, Threads, Dcard, YouTube, News/RSS, CSV Import, and Supabase.
- Converts every source record into a unified Mention Schema before AI processing.
- Runs mentions through NLP, risk scoring, RAG knowledge retrieval, and AI reply decision logic.
- Separates official reply capability from internal suggested-response workflows.
- Prevents unsafe AI replies through RAG guardrails and human-review gates.
- Preserves a future SaaS path for FastAPI, Celery, Redis, vector database, n8n, AI Agents, MCP, and multi-tenant governance.

## Current Prototype Status

Implemented in the current codebase:

- Local demo dataset mode.
- Supabase dataset mode using project `mzonkpfagqdhaqwybtuo`.
- Data source selector in the dashboard header.
- Supabase `review` table adapter.
- Unified Mention Schema adapter in `app.js`.
- Reply Capability Layer.
- Generic RAG reply generation for both local and Supabase data.
- Editable AI reply draft.
- Submit handling that routes Google-like sources to manager approval and other sources to CRM/suggested-response flow.

## Data Sources

Supported source categories:

- Google Business Reviews
- PTT
- Mobile01
- Facebook
- Instagram
- Threads
- Dcard
- YouTube
- News / RSS
- CSV Import
- Supabase

Every source must be normalized before downstream AI processing:

```text
Source Connectors
  -> Mention Normalization Layer
  -> NLP Pipeline
  -> Vision Pipeline
  -> Risk Engine
  -> RAG Knowledge Base
  -> AI Reply Engine
  -> Reply Capability Layer
  -> Decision / Escalation / CRM Workflows
```

## Supabase Connection

The prototype currently uses:

```js
SUPABASE_URL = "https://mzonkpfagqdhaqwybtuo.supabase.co"
SUPABASE_REVIEW_TABLE = "review"
```

The frontend uses the publishable key configured in `app.js`. Do not place a Supabase `service_role` secret in frontend code.

## Reply Capability Layer

Google Business Reviews:

- AI can generate a reply draft.
- Manager approval is required.
- Approved replies may be published through Google Business API in a future backend implementation.

Other social, forum, video, news, CSV, and Supabase sources:

- AI can generate suggested responses only.
- The system must not publish comments through platform APIs.
- The system may create CRM tickets.
- The system may notify customer service, PR, legal, operations, or store managers.

## AI Reply Output Contract

Every AI reply decision must produce:

```json
{
  "reply_draft": "",
  "confidence_score": 0.82,
  "need_human_review": true,
  "suggested_department": "customer_service",
  "risk_level": "medium",
  "publish_capability": "suggestion_only"
}
```

## RAG Guardrails

The AI Reply Engine must not:

- Admit liability.
- Promise refunds.
- Promise compensation.
- Fabricate company policy.
- Fabricate promotions.
- Fabricate store information.
- Fabricate business hours.
- Fabricate phone numbers.
- Fabricate product information.
- Speculate about unverified events.

## Dashboard Modules

Current prototype modules:

- Multi-source Reputation Dashboard
- Mention list and filtering
- AI RAG simulator
- RAG knowledge base
- NLP analysis simulator
- Risk alert center

Target enterprise modules:

- AI Decision Center
- Escalation Center
- Mention Timeline
- Crisis Monitoring
- Brand Health Score
- Competitor Comparison
- AI Suggested Actions

## Project Files

```text
index.html                    Frontend dashboard shell
styles.css                    Dashboard styling
app.js                        Supabase connection, Mention adapter, charts, filters, RAG simulator
mention_schema.md             Unified Mention Schema and AI reply output contract
enterprise_architecture.md    Enterprise SaaS target architecture
implementation_plan.md        Phased implementation plan
walkthrough.md                User walkthrough and demo guide
rag_kb.json                   Prototype RAG policy knowledge base
rag_pipeline.py               Prototype Python RAG simulation
reviews_data.json             Legacy local Google Review demo dataset
```

## Local Run

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8000/index.html
```

## Verification

Recommended checks:

```powershell
node --check app.js
```

Then verify in the browser:

- Switch between `本地示範資料` and `我的 Supabase 資料庫`.
- Open the AI RAG simulator.
- Select a local or Supabase mention.
- Generate an AI reply draft.
- Edit the final draft.
- Submit handling or create a CRM ticket.
