# 操作導覽

本文件說明如何展示與驗證 Enterprise AI Omnichannel Reputation Management Platform prototype。

## 1. 啟動本機服務

在 `C:\project` 執行：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

開啟：

```text
http://127.0.0.1:8000/index.html
```

## 2. 選擇資料來源

Dashboard header 右上角有資料來源選單。

選項：

- `本地示範資料`
- `我的 Supabase 資料庫`

預期行為：

- 預設使用本地示範資料。
- 只有選擇 `我的 Supabase 資料庫` 後才會讀取 Supabase。
- 切換後 Dashboard、Mention list、Alert Center、NLP selector 與 RAG selector 都會更新。

## 3. 查看 Dashboard

目前 Dashboard 會顯示：

- Mention / review 總數。
- 平均評分。
- 高風險數量。
- Sentiment ratio / 類 NPS 指標。
- Rating distribution。
- Aspect sentiment。
- Store 或 source 層級風險。
- Risk distribution。
- Sentiment timeline。
- Emotion distribution。
- Word cloud。

注意：部分 UI 文案仍沿用 legacy Google Review prototype，但資料層已可透過 Mention Schema adapter 支援多來源 Mention。

## 4. 查看 Mentions

開啟 Mention list tab。

可以測試：

- 依 source / store 篩選。
- 依 rating 篩選。
- 依 sentiment 篩選。
- 依 risk level 篩選。
- 搜尋 Mention 文字或 author。
- 開啟 Mention detail modal。

在 modal 中，可以將 Mention 送進 AI RAG simulator。

## 5. 執行 AI RAG Simulator

開啟 `AI RAG 模擬器`。

步驟：

1. 選擇一筆 Mention。
2. 確認 NLP preview、sentiment、intent、aspect 與 risk。
3. 點擊 `啟動 RAG 檢索與回覆生成`。
4. 查看 matched SOP rules。
5. 查看 generated prompt。
6. 比較 unsafe reply 與 RAG-constrained safe reply。
7. 查看 structured JSON output。
8. 編輯 `Final AI Reply Draft`。
9. 點擊 `提交處理` 或 `建立 CRM Ticket`。

預期行為：

- Legacy local cases 若有預設 RAG scenario，會使用預設劇本。
- 任何沒有預設 scenario 的本地或 Supabase Mention，都會使用 generic RAG rule inference。
- 所有可選 Mention 都能產生安全回覆草稿。
- 高風險 Mention 會要求 human review。
- Google 類來源會進入 manager approval。
- 其他來源只能 suggestion-only，並進入 CRM / internal handling。

## 6. 理解 Reply Capability

Google Business Reviews：

- 可產生 AI reply draft。
- 必須經過 manager approval。
- 未來後端支援後，核准內容才可透過 Google Business API 發布。

其他來源：

- 可產生 suggested response。
- 可建立 CRM ticket。
- 可通知部門。
- 不可透過平台 API 發布留言。

Simulator 的 JSON output 會顯示 `publish_capability`。

## 7. 驗證 AI Reply Output

每一次 AI reply decision 都應包含：

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

## 8. 驗證 RAG Guardrails

安全回覆不應該：

- 承認責任。
- 承諾退款。
- 承諾賠償。
- 編造政策。
- 編造優惠。
- 編造門市資訊。
- 編造營業時間。
- 編造電話。
- 編造產品資訊。
- 推測未確認事件。

如果 Mention 具風險，輸出應建議 human review 並分派給適當部門。

## 9. Supabase Demo 流程

展示 Supabase 時：

1. 選擇 `我的 Supabase 資料庫`。
2. 等待 Dashboard 更新。
3. 開啟 `AI RAG 模擬器`。
4. 選擇一筆 Supabase Mention。
5. 產生 AI reply。
6. 確認 JSON 中包含 `mention-*` id 與 source metadata。
7. Submit 或建立 CRM ticket。

疑難排解：

- 如果 Supabase 讀不到資料，檢查 `review` table 的 RLS read policy。
- 確認前端只使用 publishable key。
- 不要在瀏覽器程式碼使用 `service_role` key。

## 10. 開發者驗證

執行：

```powershell
node --check app.js
```

可選的 Supabase REST 測試：

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

## 11. 建議 Demo Script

1. 從本地示範資料開始，展示 Dashboard metrics。
2. 切換到 Supabase，展示 live data loading。
3. 開啟一筆高風險 Mention。
4. 送到 AI RAG simulator。
5. 產生安全回覆。
6. 解釋 unsafe reply 為什麼違反 guardrails。
7. 編輯 final reply draft。
8. Submit handling。
9. 說明 Google 未來可在核准後發布，其他來源只能 CRM / suggestion-only。
