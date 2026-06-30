# Enterprise AI 全通路聲譽管理平台

本專案是一套 Enterprise AI Omnichannel Reputation Management Platform。它最初是 Google Review AI Dashboard prototype，現在已重新定位為「多來源輿情與品牌聲譽管理平台」，負責蒐集、標準化、分析、治理並分派各通路的品牌 Mention。

目前前端 prototype 已串接 Supabase，支援本地示範資料與 Supabase 線上資料切換，並會將 Supabase `review` table 的資料轉換成統一 Mention Schema，再進入 NLP、風險判斷、RAG 知識庫檢索與 AI 回覆治理流程。

## 平台目標

- 整合 Google Business Reviews、PTT、Mobile01、Facebook、Instagram、Threads、Dcard、YouTube、News/RSS、CSV Import 與 Supabase 等來源。
- 所有來源資料必須先轉換為統一 Mention Schema，才進入後續 AI Pipeline。
- Mention 會經過 NLP、Risk Engine、RAG Knowledge Base 與 AI Reply Engine 處理。
- 透過 Reply Capability Layer 區分「可官方發布」與「只能內部建議回覆」的來源。
- 透過 RAG Guardrails 與人工審核機制，避免 AI 產生高風險或不合規回覆。
- 保留未來擴充 FastAPI、Celery、Redis、向量資料庫、n8n、AI Agent、MCP 與多租戶 SaaS 架構的能力。

## 目前 Prototype 狀態

目前已完成：

- 本地示範資料模式。
- Supabase 線上資料模式，使用 project `mzonkpfagqdhaqwybtuo`。
- Dashboard 右上角資料來源切換器。
- Supabase `review` table adapter。
- `app.js` 中的 Unified Mention Schema adapter。
- Reply Capability Layer。
- 本地資料與 Supabase 資料皆可使用的通用 RAG 回覆生成。
- 可編輯的 AI 回覆草稿。
- 提交流程模擬：Google 類來源進入 Manager Approval，其餘來源建立 CRM / Suggested Response 流程。

## 支援資料來源

目前平台設計支援以下來源：

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

資料流設計如下：

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

## Supabase 連線

目前 prototype 使用：

```js
SUPABASE_URL = ""
SUPABASE_REVIEW_TABLE = "review"
```

前端使用的是 `app.js` 中設定的 Supabase publishable key。請不要把 Supabase `service_role` secret 放進前端程式碼。

## Reply Capability Layer

Google Business Reviews：

- AI 可以產生官方回覆草稿。
- 必須經過 Manager Approve。
- 未來後端完成後，核准的回覆才可透過 Google Business API 發布。

其他社群、論壇、影音、新聞、CSV 與 Supabase 來源：

- AI 只能產生 Suggested Response。
- 系統不得呼叫平台 API 發布留言。
- 可以建立 CRM Ticket。
- 可以通知客服、公關、法務、營運或門市主管。

## AI 回覆輸出格式

每一次 AI 回覆決策都必須產生：

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

AI Reply Engine 不得：

- 承認責任。
- 承諾退款。
- 承諾賠償。
- 編造公司政策。
- 編造優惠方案。
- 編造門市資訊。
- 編造營業時間。
- 編造電話。
- 編造產品資訊。
- 推測未經確認的事件。

## Dashboard 模組

目前 prototype 已包含：

- Multi-source Reputation Dashboard
- Mention list and filtering
- AI RAG simulator
- RAG knowledge base
- NLP analysis simulator
- Risk alert center

目標 Enterprise 模組：

- AI Decision Center
- Escalation Center
- Mention Timeline
- Crisis Monitoring
- Brand Health Score
- Competitor Comparison
- AI Suggested Actions

## 專案檔案

```text
index.html                    前端 Dashboard 主體
styles.css                    Dashboard 樣式
app.js                        Supabase 連線、Mention adapter、圖表、篩選、RAG simulator
mention_schema.md             統一 Mention Schema 與 AI Reply Output Contract
enterprise_architecture.md    Enterprise SaaS 目標架構
implementation_plan.md        分階段實作計畫
walkthrough.md                操作導覽與 Demo 流程
rag_kb.json                   Prototype RAG policy knowledge base
rag_pipeline.py               Prototype Python RAG simulation
reviews_data.json             Legacy local Google Review demo dataset
```

## 本機啟動

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

開啟：

```text
http://127.0.0.1:8000/index.html
```

## 驗證方式

建議先執行：

```powershell
node --check app.js
```

接著在瀏覽器確認：

- 可在 `本地示範資料` 與 `我的 Supabase 資料庫` 之間切換。
- 可開啟 AI RAG simulator。
- 可選擇本地或 Supabase Mention。
- 可產生 AI reply draft。
- 可編輯 final draft。
- 可提交處理或建立 CRM Ticket。
