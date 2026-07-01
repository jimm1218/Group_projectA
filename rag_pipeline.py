import json
import re
import uuid
import sys

# Prevent UnicodeEncodeError on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

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

def build_prompt_with_rag(review, kb, fanpage_context=None):
    """
    Constructs the prompt by merging RAG retrieved guidelines, store details, and safety parameters.
    Matches the prompt design in Section 9.1 of the design doc.
    Supports platform-specific tones via fanpage_context.
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
    
    # Platform context handling
    platform = fanpage_context.get("platform", "Google 商家地標") if fanpage_context else "Google 商家地標"
    tone = fanpage_context.get("tone", brand_tone) if fanpage_context else brand_tone
    length_limit = fanpage_context.get("length_limit", "100字以內") if fanpage_context else "100字以內"
    custom_instructions = fanpage_context.get("custom_instructions", "") if fanpage_context else ""
    
    # Constructing System Prompt
    system_prompt = f"""你是 {brand_name} 的社群回覆助手。目標發布平台為：{platform}。
你只能產生公開、禮貌、自然、{length_limit}的繁體中文回覆。
你的回覆風格與語氣需符合此粉專設定：{tone}。
{f'額外發布指令：{custom_instructions}' if custom_instructions else ''}
你不得承認未確認事實，不得過度承諾，不得與顧客爭辯，不得透露公司內部資訊。
如果評論涉及食品安全、法律、歧視、個資、媒體、公關危機、暴力威脅或高額補償，必須標記 need_human=true。"""

    # Constructing User Prompt
    user_prompt = f"""請根據以下資料產生 {platform} 商家回覆草稿。
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
  "reply_text": "{length_limit}公開回覆",
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

def simulate_rag_constrained_reply(review, sop_rules, store_info, fanpage_context=None):
    """
    Simulates the safe, RAG-constrained LLM output adhering strictly to the guidelines.
    No liability admitted, safety flags populated, and redirects to private manager channel.
    Supports platform-specific tone and style.
    """
    raw_text = review["raw_text"]
    rating = review["rating"]
    store_name = review["store_name"]
    
    platform = fanpage_context.get("platform", "Google") if fanpage_context else "Google"
    
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
    if rating >= 4 and not need_human:
        matched_category = "general_positive"
    
    if matched_category == "food_safety_issue":
        if "拉肚子" in raw_text or "發燒" in raw_text:
            if platform == "Facebook":
                reply_text = f"您好，得知此狀況我們極度遺憾與重視！🌸 美味花園一向嚴格把關食品安全，我們將立即對此分店啟動食材安全稽核。懇請您私訊提供電話或撥打專線 {phone}，我們將由店主管親自為您處理。謝謝您！✨"
            elif platform == "Instagram":
                reply_text = f"得知此狀況我們深表遺憾與重視！😢 我們將立即對分店啟動食材稽核。懇請私訊提供聯絡方式或撥打 {phone}，將由店主管親自為您協助！謝謝！#食品安全"
            else:
                reply_text = f"您好，得知此狀況我們極度遺憾與重視。美味花園一向嚴格把關食品安全，我們將立即對此分店啟動食材安全稽核。懇請您撥打{store_name}專線 {phone} 與我們聯繫，我們將由店主管第一時間親自為您協助與處理。謝謝您。"
        else: # e.g. Hair or insects
            if platform == "Facebook":
                reply_text = f"您好，對於您在用餐時遇到餐點異物，我們感到非常抱歉！😢 美味花園非常重視衛生，已責令廚房加強內控。懇請您私訊提供電話，我們將由主管第一時間為您處理，謝謝您！✨"
            elif platform == "Instagram":
                reply_text = f"對於餐點出現異物我們深感抱歉！😢 已加強廚房內控與環境消毒。懇請私訊提供電話，將由主管直接為您處理，謝謝！#環境衛生"
            else:
                reply_text = f"您好，對於您在用餐時遇到餐點異物，我們感到非常抱歉。美味花園非常重視衛生，將立即加強廚房內控與環境消毒。懇請您撥打{store_name}電話 {phone}，讓分店主管能直接為您處理後續，謝謝您。"
    elif matched_category == "service_complaint":
        if platform == "Facebook":
            reply_text = f"您好，很抱歉在{store_name}帶給您不好的用餐體驗！😢 我們非常重視您的反映，會將此情況回報分店經理以加強同仁的服務培訓。若能提供具體用餐細節，歡迎私訊與我們聯繫，謝謝您！🌸"
        elif platform == "Instagram":
            reply_text = f"很抱歉在{store_name}帶給您不好體驗！😢 我們已轉達分店經理加強教育訓練。歡迎私訊告知我們細節，讓我們有機會改進，謝謝！#服務優化"
        else:
            reply_text = f"您好，很抱歉在{store_name}帶給您不好的用餐體驗。我們非常重視您的反映，會將此情況回報分店經理以加強同仁的服務培訓。若能提供具體用餐時間或細節，歡迎撥打 {phone}，讓我們有改進與補償的機會。"
    elif matched_category == "waiting_time":
        if platform == "Facebook":
            reply_text = f"您好，抱歉讓您久等了！為提供美味餐點我們均現點現做，人多時出餐較慢，敬請見諒。😢 建議您下次可利用線上預約系統提前訂位，以減少等候時間，謝謝您的反映！✨"
        elif platform == "Instagram":
            reply_text = f"抱歉讓您久等了！為維持美味餐點均現點現做 😢 建議下次利用線上系統提前預約訂位，以減少等待時間。我們會持續優化流程！✨ #現點現做"
        else:
            reply_text = f"您好，抱歉讓您久等了！為提供美味餐點我們均現點現做，人多時出餐較慢，敬請見諒。建議您下次可利用線上預約訂位以減少等候時間，我們會持續改進排隊流程，謝謝您的反映。"
    elif matched_category == "cleanliness_issue":
        if platform == "Facebook":
            reply_text = f"感謝您的細心反映！針對{store_name}桌椅與地板清潔不全的疏失，我們深感抱歉。已責令現場人員加強每班的清潔維護，期盼下次您光臨時能提供更舒適的環境，謝謝您！🌸"
        elif platform == "Instagram":
            reply_text = f"感謝細心反映！針對{store_name}清潔不全的疏失我們深感抱歉。😢 已責令現場加強環境清理，期盼下次給您舒適空間，謝謝！#環境清潔"
        else:
            reply_text = f"感謝您的細心反映。針對{store_name}桌椅與地板清潔不全的疏失，我們深感抱歉。已責令現場人員加強每班的環境清理與清潔維護，期盼下次您光臨時能提供更舒適的環境。謝謝！"
    else: # Positive fallback
        specialty = store_info["specialty"] if store_info else "招牌餐點"
        if platform == "Facebook":
            reply_text = f"非常感謝您的五星好評與熱情支持！❤️ 聽到您滿意我們的餐點和服務，我們深感榮幸。下次光臨時，也推薦您嘗試我們的「{specialty}」喔！期待再次為您服務！✨"
        elif platform == "Instagram":
            reply_text = f"超感謝您的好評與支持！❤️ 小編也極推我們的「{specialty}」喔！期待下次再為您服務！✨ #美食推薦 #好評回饋"
        else:
            reply_text = f"非常感謝您的五星好評與熱情支持！聽到您滿意我們的餐點 and 服務，我們深感榮幸。這也是我們全體同仁前進的动力！下次光臨時，也推薦您嘗試我們的「{specialty}」喔！期待再次為您服務。"
        
    # Ensure word limit based on platform
    limit = 120 if platform == "Facebook" else (80 if platform == "Instagram" else 100)
    if len(reply_text) > limit:
        reply_text = reply_text[:limit-3] + "..."
        
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
    print("                Google Review & Social RAG 防幻覺 Pipeline 模擬展示腳本                ")
    print("      (展示當 LLM 接入不同社群平台粉專 Context 時，所產生的特定品牌語氣回覆與安全護欄)")
    print_separator()

    # Define mock fanpage contexts for demonstration
    demo_scenarios = [
        {
            "review_idx": 5, # r006 (拉肚子 - 食安問題)
            "context": {
                "platform": "Facebook",
                "tone": "親切、熱情，多使用表情符號，引導留言者私訊聯絡方式",
                "length_limit": "120字以內",
                "custom_instructions": "需引導顧客私訊，祝對方順心。"
            }
        },
        {
            "review_idx": 6, # r007 (翻白眼 - 服務態度)
            "context": {
                "platform": "Google Business Profile",
                "tone": "正式、專業、誠懇，格式清晰",
                "length_limit": "100字以內",
                "custom_instructions": "官方立場，向顧客致謝並承諾檢討。"
            }
        },
        {
            "review_idx": 0, # r001 (烤雞 - 正面稱讚)
            "context": {
                "platform": "Instagram",
                "tone": "簡短、活潑、富感染力，使用 hashtag 如 #美味花園 #好評回饋",
                "length_limit": "80字以內",
                "custom_instructions": "多用愛心與閃亮等表情符號，保持社群熱度。"
            }
        }
    ]
    
    for scenario in demo_scenarios:
        idx = scenario["review_idx"]
        context = scenario["context"]
        
        review = reviews[idx]
        review_id = review["review_id"]
        reviewer = review["reviewer"]
        rating = review["rating"]
        raw_text = review["raw_text"]
        risk_level = review["risk"]["level"].upper()
        
        print(f"\n【留言診斷】編號：{review_id} | 作者：{reviewer} | 評分：{rating} 星 | 風險等級：{risk_level}")
        print(f"【目標平台】：{context['platform']} (設定風格：{context['tone']})")
        print(f"【原始留言】：\"{raw_text}\"")
        print("-" * 50)
        
        # Run RAG Process
        system_prompt, user_prompt, sop_rules, store_info = build_prompt_with_rag(review, kb, fanpage_context=context)
        
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
        
        # 2. With RAG constraints (Safe AI + Platform Context)
        safe_reply = simulate_rag_constrained_reply(review, sop_rules, store_info, fanpage_context=context)
        print(f"\n   [O] 限制型 RAG 回覆 (適配 {context['platform']} 語氣，嚴守 SOP、字數 {context['length_limit']})：")
        print(f"      回覆內容: {safe_reply['reply_text']}")
        print(f"      欄位輸出驗證：")
        print(f"      - need_human: {safe_reply['need_human']} (安全：高風險已成功防護！)")
        print(f"      - need_apology: {safe_reply['need_apology']}")
        print(f"      - risk_flags: {safe_reply['risk_flags']}")
        print(f"      - reason_code: {safe_reply['reason_code']}")
        
        print_separator()

if __name__ == "__main__":
    main()
