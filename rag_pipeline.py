import json
import re
import uuid

def load_json_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def retrieve_sop(review_text, kb):
    """
    Simulates a keyword/semantic search in pgvector database.
    Matches words in review_text against triggers in rag_kb.json.
    """
    matched_rules = []
    text_lower = review_text.lower()
    
    # Standard keyword match simulation
    for rule in kb.get("sop_rules", []):
        for trigger in rule.get("triggers", []):
            if trigger in text_lower:
                matched_rules.append(rule)
                break # Avoid duplicating the same rule
                
    # If no rule matched, fallback to general positive or generic reply SOP
    if not matched_rules:
        # Check rating-based rules or fallback
        matched_rules.append({
            "category": "generic_guideline",
            "action_guideline": "提供禮貌的標準致謝或詢問，引導顧客與官方客服聯繫以提供更多資訊。保持親切且專業的語調，限制在100字內。",
            "prohibited_content": "不可提供具體賠償或承諾內部懲處。"
        })
    return matched_rules

def get_store_info(store_name, kb):
    for store in kb.get("stores", []):
        if store["store_name"] in store_name or store_name in store["store_name"]:
            return store
    return None

def build_prompt_with_rag(review, kb):
    """
    Constructs the prompt by merging RAG retrieved guidelines, store details, and safety parameters.
    Matches the prompt design in Section 9.1 of the design doc.
    """
    raw_text = review["raw_text"]
    store_name = review["store_name"]
    rating = review["rating"]
    sentiment_label = review["sentiment"]["label"]
    
    # RAG Retrieval step
    sop_rules = retrieve_sop(raw_text, kb)
    store_info = get_store_info(store_name, kb)
    
    # 1. Format SOP Context for the prompt
    kb_context_lines = []
    if store_info:
        kb_context_lines.append(f"【門市資訊】分店：{store_info['store_name']}，電話：{store_info['phone']}，地址：{store_info['address']}，主打菜色：{store_info['specialty']}。")
    
    for rule in sop_rules:
        kb_context_lines.append(f"【SOP類別：{rule.get('category')}】\n- 回覆原則：{rule.get('action_guideline')}")
        if "prohibited_content" in rule:
            kb_context_lines.append(f"- 嚴格禁止：{rule.get('prohibited_content')}")
            
    kb_context = "\n".join(kb_context_lines)
    
    # 2. Determine safety flags based on review properties
    need_apology = "true" if rating <= 3 else "false"
    need_compensation = "true" if review["intent"]["primary"] == "refund_request" or review["risk"]["food_safety"] else "false"
    need_human = "true" if review["risk"]["level"] in ["high", "critical"] else "false"
    need_customer_service = "true" if rating <= 3 else "false"
    need_legal = "true" if review["risk"]["legal_risk"] else "false"
    need_sop = "true"
    
    # 3. Format Sentiment JSON and Image Analysis JSON for the prompt
    sentiment_json = json.dumps(review["sentiment"], ensure_ascii=False)
    image_analysis_json = json.dumps({"image_attached": False, "details": {}}, ensure_ascii=False)
    risk_json = json.dumps(review["risk"], ensure_ascii=False)
    
    brand_name = kb["brand_info"]["brand_name"]
    brand_tone = kb["brand_info"]["brand_tone"]
    
    # Constructing System Prompt
    system_prompt = f"""你是 {brand_name} 的 Google 商家評論回覆助手。你只能產生公開、禮貌、自然、100 字以內的繁體中文回覆。
你不得承認未確認事實，不得過度承諾，不得與顧客爭辯，不得透露公司內部資訊。
如果評論涉及食品安全、法律、歧視、個資、媒體、公關危機、暴力威脅或高額補償，必須標記 need_human=true。"""

    # Constructing User Prompt
    user_prompt = f"""請根據以下資料產生 Google 商家回覆草稿。
品牌名稱: {brand_name}
品牌風格: {brand_tone}
門市: {store_name}
評論星等: {rating}
評論內容: {raw_text}
情感分析: {sentiment_json}
圖片分析: {image_analysis_json}
風險分析: {risk_json}
品牌 SOP / 知識庫摘要: 
{kb_context}
是否需要道歉: {need_apology}
是否需要補償: {need_compensation}
是否需要轉人工: {need_human}
是否需要客服介入: {need_customer_service}
是否需要法務介入: {need_legal}
是否需要 SOP: {need_sop}

請輸出 JSON 格式，架構如下：
{{
  "reply_text": "100 字內公開回覆",
  "need_human": {need_human},
  "need_customer_service": {need_customer_service},
  "need_legal": {need_legal},
  "need_apology": {need_apology},
  "risk_flags": [主題標記，如 "food_safety", "service", "cleanliness"],
  "confidence": 0.95,
  "reason_code": "簡短原因，不要輸出完整推理"
}}"""

    return system_prompt, user_prompt, sop_rules, store_info

def simulate_hallucination_reply(review):
    """
    Simulates what a standard unchecked LLM (no RAG constraints or safety guardrails)
    would generate, highlighting the legal and operational risks.
    """
    raw_text = review["raw_text"]
    rating = review["rating"]
    
    if "拉肚子" in raw_text or "發燒" in raw_text:
        return {
            "reply_text": "非常抱歉！這次拉肚子確實是我們台中公益店海鮮不新鮮造成的疏失。為了彌補我們的錯誤，我們將全額退費，並賠償您三倍的醫療費用與5000元慰問金。請您一定要原諒我們，不要向衛生局檢舉，謝謝！",
            "need_human": False,
            "risk_flags": ["food_safety"],
            "confidence": 0.99,
            "reason_code": "已道歉並提供賠償"
        }
    elif "頭髮" in raw_text or "蒼蠅" in raw_text or "蟑螂" in raw_text:
        return {
            "reply_text": "真的很對不起！我們店裡的清潔人員今天偷懶，沒有把廚房清理乾淨，才導致湯裡出現異物。我們已經將該名店員開除處分，下次您來憑此回覆可以免費吃一頓，真的非常抱歉！",
            "need_human": False,
            "risk_flags": ["hygiene"],
            "confidence": 0.95,
            "reason_code": "已開除員工以表誠意"
        }
    elif rating <= 2:
        return {
            "reply_text": "對不起，我們的服務生確實態度不好。我們會扣他這個月的獎金，並賠償您 500 元折價券，請您再次光臨，謝謝！",
            "need_human": False,
            "risk_flags": ["service"],
            "confidence": 0.90,
            "reason_code": "提供折價券"
        }
    else:
        return {
            "reply_text": "謝謝支持！歡迎隨時再來用餐！",
            "need_human": False,
            "risk_flags": [],
            "confidence": 0.95,
            "reason_code": "簡短致謝"
        }

def simulate_rag_constrained_reply(review, sop_rules, store_info):
    """
    Simulates the safe, RAG-constrained LLM output adhering strictly to the guidelines.
    No liability admitted, safety flags populated, and redirects to private manager channel.
    """
    raw_text = review["raw_text"]
    rating = review["rating"]
    store_name = review["store_name"]
    
    need_human = review["risk"]["level"] in ["high", "critical"]
    risk_flags = []
    if review["risk"]["food_safety"]:
        risk_flags.append("food_safety")
    if review["risk"]["hygiene_risk"]:
        risk_flags.append("cleanliness")
    if review["risk"]["level"] in ["medium", "high", "critical"] and "service" in review["topics"][0]["topic"]:
        risk_flags.append("service")
        
    phone = store_info["phone"] if store_info else "門市專線"
    
    # Rule matching and template selection based on retrieved SOP
    matched_category = sop_rules[0].get("category", "") if sop_rules else "generic"
    
    if matched_category == "food_safety_issue":
        if "拉肚子" in raw_text or "發燒" in raw_text:
            reply_text = f"您好，得知此狀況我們極度遺憾與重視。美味花園一向嚴格把關食品安全，我們將立即對此分店啟動食材安全稽核。懇請您撥打{store_name}專線 {phone} 與我們聯繫，我們將由店主管第一時間親自為您協助與處理。謝謝您。"
        else: # e.g. Hair or insects
            reply_text = f"您好，對於您在用餐時遇到餐點異物，我們感到非常抱歉。美味花園非常重視衛生，將立即加強廚房內控與環境消毒。懇請您撥打{store_name}電話 {phone}，讓分店主管能直接為您處理後續，謝謝您。"
    elif matched_category == "service_complaint":
        reply_text = f"您好，很抱歉在{store_name}帶給您不好的用餐體驗。我們非常重視您的反映，會將此情況回報分店經理以加強同仁的服務培訓。若能提供具體用餐時間或細節，歡迎撥打 {phone}，讓我們有改進與補償的機會。"
    elif matched_category == "waiting_time":
        reply_text = f"您好，抱歉讓您久等了！為提供美味餐點我們均現點現做，人多時出餐較慢，敬請見諒。建議您下次可利用線上預約訂位以減少等候時間，我們會持續改進排隊流程，謝謝您的反映。"
    elif matched_category == "cleanliness_issue":
        reply_text = f"感謝您的細心反映。針對{store_name}桌椅與地板清潔不全的疏失，我們深感抱歉。已責令現場人員加強每班的環境清理與清潔維護，期盼下次您光臨時能提供更舒適的環境。謝謝！"
    else: # Positive fallback
        specialty = store_info["specialty"] if store_info else "招牌餐點"
        reply_text = f"非常感謝您的五星好評與熱情支持！聽到您滿意我們的餐點和服務，我們深感榮幸。這也是我們全體同仁前進的动力！下次光臨時，也推薦您嘗試我們的「{specialty}」喔！期待再次為您服務。"
        
    # Ensure word limit (Traditional Chinese characters usually fit under 100 easily)
    if len(reply_text) > 100:
        reply_text = reply_text[:97] + "..."
        
    return {
        "reply_text": reply_text,
        "need_human": need_human,
        "need_customer_service": rating <= 3,
        "need_legal": review["risk"]["legal_risk"],
        "need_apology": rating <= 3,
        "risk_flags": risk_flags,
        "confidence": round(review["confidence"], 2),
        "reason_code": f"SOP_{matched_category.upper()}"
    }

def print_separator():
    print("=" * 90)

def main():
    # 1. Load Data
    try:
        reviews = load_json_file("reviews_data.json")
        kb = load_json_file("rag_kb.json")
    except FileNotFoundError as e:
        print(f"Error: {e}. Please make sure reviews_data.json and rag_kb.json exist in this directory.")
        return

    print_separator()
    print("                Google Review RAG 防幻覺 Pipeline 模擬展示腳本                ")
    print("      (展示當 LLM 接入與未接入品牌 SOP 知識庫時，所產生的回覆差異，以防止 AI 幻覺)")
    print_separator()

    # We will pick three distinct reviews to demonstrate:
    # 1. Critical Food Safety review (拉肚子, extreme legal & reputation risk)
    # 2. Medium Service Complaint (翻白眼, bad attitude)
    # 3. Standard 5-star Positive review
    demo_indices = [5, 6, 0] # r006 (拉肚子), r007 (翻白眼), r001 (烤雞好吃)
    
    for idx in demo_indices:
        review = reviews[idx]
        review_id = review["review_id"]
        reviewer = review["reviewer"]
        rating = review["rating"]
        raw_text = review["raw_text"]
        risk_level = review["risk"]["level"].upper()
        
        print(f"\n【評論診斷】評論編號：{review_id} | 評論者：{reviewer} | 評分：{rating} 星 | 風險等級：{risk_level}")
        print(f"【原始內容】: \"{raw_text}\"")
        print("-" * 50)
        
        # Run RAG Process
        system_prompt, user_prompt, sop_rules, store_info = build_prompt_with_rag(review, kb)
        
        print(">> [RAG 檢索程序] 成功尋找 SOP 規範:")
        for idx_r, rule in enumerate(sop_rules):
            print(f"   符合 SOP 規則 {idx_r+1}：Category: {rule.get('category')} | Triggers: {rule.get('triggers', [])[:5]}...")
            print(f"   限制原則: {rule.get('action_guideline').replace(chr(10), ' ')}")
            
        print("\n>> [模擬生成結果對比]")
        
        # 1. Without RAG constraints (Hallucinating AI)
        bad_reply = simulate_hallucination_reply(review)
        print("\n   [X] 傳統 LLM 回覆 (無 RAG 與 Guardrails 限制，易產生嚴重幻覺/賠償法律風險)：")
        print(f"      回覆內容: {bad_reply['reply_text']}")
        print(f"      是否需人工審核: {bad_reply['need_human']} (風險：高風險內容自動發布！)")
        
        # 2. With RAG constraints (Safe AI)
        safe_reply = simulate_rag_constrained_reply(review, sop_rules, store_info)
        print("\n   [O] 限制型 RAG 回覆 (嚴格遵照 SOP、符合字數限制、引導私下解決、標記人工審核)：")
        print(f"      回覆內容: {safe_reply['reply_text']}")
        print(f"      欄位輸出驗證：")
        print(f"      - need_human: {safe_reply['need_human']} (安全：高風險已成功攔截！)")
        print(f"      - need_apology: {safe_reply['need_apology']}")
        print(f"      - risk_flags: {safe_reply['risk_flags']}")
        print(f"      - reason_code: {safe_reply['reason_code']}")
        
        print_separator()

if __name__ == "__main__":
    main()
