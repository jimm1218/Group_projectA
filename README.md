# Enterprise AI 全通路聲譽管理平台

**連結：https://jimm1218.github.io/Group_projectA/**

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
SUPABASE_URL = "https://mzonkpfagqdhaqwybtuo.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_Yiq2xPuzCm092Hq8HEv-Gg_yuO5eUCw"
SUPABASE_REVIEW_TABLE = "review"
```

前端使用的是 `app.js` 中設定的 Supabase publishable key。請不要把 Supabase `service_role` secret 放進前端程式碼。

目前串接流程：

1. 從 `public.review` 讀取資料。
2. 依序嘗試用 `published_at`、`review_time`、`crawled_at`、`created_at`、`id` 排序。
3. 一次最多讀取 500 筆。
4. 將 Supabase row 轉成系統內部 Mention / Review 格式。
5. 若讀不到資料，系統會回退到本地示範資料，並在瀏覽器 console 顯示診斷資訊。

支援的常見欄位名稱：

```text
內容：content, raw_text, review_text, text, comment, body, message
作者：author, reviewer, user_name, username, name, display_name
時間：published_at, review_time, created_at, crawled_at, updated_at
評分：rating, stars, score, star_rating
來源：platform, source, source_label, channel, review_type
店名：store_name, business_name, location_name, branch_name
```

如果 Supabase Studio 查得到資料，例如：

```sql
select count(*) from public.review;
```

但前端讀到 `[]`，通常是 RLS policy 沒讓 `anon` 角色讀取。Demo 可用下列 policy 驗證：

```sql
alter table public.review enable row level security;

create policy "Allow anon read review"
on public.review
for select
to anon
using (true);
```

正式環境請改成依 tenant、登入使用者或 `client_id` 限制資料可見範圍。

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

## Gemini API 預覽模式

若要讓「待處理回覆」在本地 RAG 草稿後呼叫 Gemini 產生更自然的回覆，請改用 Node 預覽伺服器。API key 只會留在本機後端，不會送到瀏覽器。

```powershell
$env:GEMINI_API_KEY="your_key_here"
$env:GEMINI_MODEL="gemini-2.0-flash"
node gemini_server.js
```

開啟：

```text
http://localhost:8001
```

若沒有設定 `GEMINI_API_KEY`，或 Gemini 呼叫失敗，畫面會保留原本的本地 RAG 草稿。

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
