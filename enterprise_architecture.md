# Enterprise SaaS Architecture

## Positioning

This system is an Enterprise AI Omnichannel Reputation Management Platform. It monitors and governs reputation signals across review sites, social platforms, forums, video platforms, news/RSS, CSV imports, and Supabase-backed internal data.

## Core Principle

No downstream AI module should consume platform-specific raw data directly. Every source must first be normalized into the unified Mention Schema.

## Logical Architecture

```text
Connectors
  Google Business Reviews
  PTT / Mobile01 / Dcard
  Facebook / Instagram / Threads
  YouTube
  News / RSS
  CSV Import
  Supabase

Ingestion Layer
  crawler jobs
  webhook receivers
  CSV upload parser
  Supabase table sync

Normalization Layer
  source-specific parser
  unified Mention Schema
  tenant and business attribution
  deduplication

AI Processing Layer
  NLP Pipeline
  Vision Pipeline
  Risk Engine
  RAG Knowledge Base retrieval
  AI Reply Engine

Governance Layer
  Reply Capability Layer
  Manager Approval
  Escalation Rules
  Audit Log

Workflow Layer
  CRM Ticket
  Department Notification
  n8n Workflow Automation
  Future AI Agent / MCP execution
```

## Reply Capability Governance

Only Google Business Reviews may eventually support official publishing through Google Business API.

All other supported sources are suggestion-only. The system may generate internal response guidance, create tickets, or notify teams, but must not call platform APIs to publish comments.

## Target Backend

Recommended production stack:

- FastAPI for public and internal APIs
- PostgreSQL / Supabase for transactional data
- Redis for cache, locks, and queues
- Celery for async jobs
- Object storage for screenshots, media, CSV files, and raw payload archives
- Vector database for RAG retrieval
- n8n for workflow automation
- MCP servers for controlled enterprise tool access

## Multi-tenant Model

Production tables should be tenant-scoped:

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

Every API query and worker job must include tenant isolation.

## AI Decision Center

The AI Decision Center should show risk reason codes, confidence score, recommended department, need human review, allowed actions, blocked actions, RAG guardrails applied, and final approval state.

## Crisis Monitoring

Crisis monitoring should aggregate sudden mention volume spikes, negative sentiment spikes, source concentration, repeated keywords, legal or food safety flags, and news-source amplification.
