# 實作計畫

## 目標

將本專案重新定位並演進為 Enterprise AI Omnichannel Reputation Management Platform。

平台需支援多來源聲譽資料匯入，將所有來源資料標準化為統一 Mention Schema，交由 AI Pipeline 分析，並透過 RAG Guardrails 與 Reply Capability Layer 管理 AI 回覆是否能正式發布，或只能作為內部 Suggested Response。

## 目前基底

目前 prototype 已具備：

- 以 `index.html` 為主的前端 Dashboard。
- 主要邏輯集中於 `app.js`。
- 本地示範評論資料。
- Supabase `review` table 整合。
- 本地資料與 Supabase 資料切換器。
- Supabase row 到 Mention Schema 的 adapter。
- 可產生通用回覆草稿的 RAG simulator。
- 可編輯 AI reply draft 與提交模擬。
- Reply Capability Layer 規則。
- 架構與 Schema 文件。

## Phase 1：資料來源切換

狀態：已完成。

目標：

- 讓使用者可選擇本地示範資料或 Supabase 線上資料。
- 保留本地資料，方便離線展示與測試。
- 只有使用者選擇 Supabase 時才讀取線上資料。
- 切換後重新渲染圖表、Mention list、Alert Center、NLP selector 與 RAG selector。

關鍵檔案：

- `index.html`：`data-source-select`
- `app.js`：`LOCAL_REVIEWS`、`activeDataSource`、`switchDataSource()`、`setupDataSourceSelector()`

驗證方式：

- 預設載入本地示範資料。
- 選擇 Supabase 後載入 `review` table。
- 重整資料時會依照目前資料來源重新載入。

## Phase 2：統一 Mention Schema

狀態：已在前端 adapter 實作。

目標：

- 將 Supabase `review` row 視為來源資料。
- 來源資料必須先轉換成統一 Mention Schema，才進入 AI 流程。
- 保留 raw source payload，以便未來稽核與後端處理。

目前 adapter：

- `mapSupabaseRowToMention(row)`
- `mapSupabaseReview(row)`

目標 Schema 欄位：

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

參考文件：

- `mention_schema.md`

## Phase 3：Reply Capability Layer

狀態：已在 prototype 邏輯中實作。

規則：

Google Business Reviews：

- 可產生 AI reply draft。
- 必須經過 Manager Approval。
- 未來後端可在核准後透過 Google Business API 發布。

其他來源：

- 只能產生 Suggested Response。
- 不可透過平台 API 發布留言。
- 可建立 CRM Ticket。
- 可通知部門。

目前實作：

- `REPLY_CAPABILITY_LAYER`
- `getReplyCapability(source)`
- `submitAiReplyDraft()`
- `createCrmTicketFromDraft()`

下一步後端工作：

- 持久化 reply decisions。
- 持久化 approval requests。
- 持久化 CRM tickets。
- 增加 audit logs。
- 僅在核准後才允許 Google Business API 發布。

## Phase 4：RAG Guardrails 與 AI Reply Engine

狀態：prototype 已完成。

目前行為：

- 若本地 legacy case 有預先寫好的 `RAG_RESPONSES`，則使用預設劇本。
- 其他 Mention 使用通用 RAG rule inference。
- 產生安全回覆草稿。
- 顯示包含 AI decision fields 的 JSON output。
- 允許 Manager 編輯草稿後提交。

Guardrails：

- 不承認責任。
- 不承諾退款。
- 不承諾賠償。
- 不編造政策。
- 不編造優惠。
- 不編造門市資訊。
- 不編造營業時間。
- 不編造電話。
- 不編造產品資訊。
- 不推測未確認事件。

目前實作：

- `RAG_REPLY_GUARDRAILS`
- `inferMatchedRagRules(review)`
- `generateSafeReplyDraft(review)`
- `buildGenericRagData(review)`
- `runRAGSimulation()`

下一步後端工作：

- 用 vector retrieval 取代 heuristic retrieval。
- 將 KB entries 存入 tenant-scoped tables。
- 增加 reply validation service。
- 增加 structured output validation。
- 將模型呼叫移至後端，不直接放在瀏覽器。

## Phase 5：Dashboard 演進

目前 UI 仍有一部分繼承自 legacy Google Review dashboard。

目標模組：

- Multi-source Reputation Dashboard
- AI Decision Center
- Escalation Center
- Mention Timeline
- Crisis Monitoring
- Brand Health Score
- Competitor Comparison
- AI Suggested Actions

建議下一批 UI 任務：

1. 將 `reviews` tab 改名為 `Mentions`。
2. 增加 source filter 與 publish-capability filter。
3. 新增 AI Decision Center table，顯示 risk、confidence、department、allowed actions、blocked actions。
4. 新增 Escalation Center，支援 legal、PR、customer service、operations、store manager queue。
5. 新增 Mention Timeline，依來源與風險等級顯示趨勢。
6. 新增 Crisis Monitoring panel，追蹤負評暴增與高風險關鍵字群。
7. 新增 Brand Health Score，整合 sentiment、risk、velocity、unresolved escalations。

## Phase 6：Enterprise SaaS 後端

目標 production architecture：

- FastAPI 作為 API layer。
- PostgreSQL / Supabase 作為交易資料庫。
- Redis 作為 cache、queue、lock。
- Celery 處理 async ingestion 與 AI jobs。
- Vector database 或 pgvector 處理 RAG retrieval。
- Object storage 保存 raw payload、CSV、screenshot、media。
- n8n 處理 workflow automation。
- MCP 處理受控企業工具整合。
- Multi-tenant authorization 與 audit logging。

建議資料表：

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

## Phase 7：驗證計畫

前端檢查：

- `node --check app.js`
- 頁面可在 `http://127.0.0.1:8000/index.html` 開啟。
- 預設為本地示範資料。
- 可切換至 Supabase 資料來源。
- 切換後 Mention list 與圖表會更新。
- AI RAG simulator 可處理本地資料。
- AI RAG simulator 可處理 Supabase 資料。
- Final reply draft 可編輯。
- Google 類來源 submit 後進入 manager approval。
- 非 Google 來源 submit 後進入 CRM / Suggested Response 流程。

Supabase 檢查：

- Publishable key 可讀取 `review`。
- RLS policy 僅允許預期的匿名讀取。
- 前端不可暴露 `service_role` key。

## 尚待決策

- Supabase 是否只作為 demo direct-from-browser，或正式版全部改由 FastAPI 代理。
- Production RAG retrieval 要採用哪一種 vector store。
- Google Business API 發布要由後端直接執行，還是交由 n8n workflow。
- 第一版 production 的 tenant identity 如何解析。
- Google 與 Supabase 之後，優先開發哪個 source connector。
