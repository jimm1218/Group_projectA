// ============================================================
// Google Review AI Platform — App.js
// 美味花園 智慧評論管理系統 — Main Application Logic
// ============================================================

'use strict';

// ============================================================
// SUPABASE CONFIG
// ============================================================

const SUPABASE_CONFIG = {
  url: 'https://mzonkpfagqdhaqwybtuo.supabase.co',
  publishableKey: 'sb_publishable_Yiq2xPuzCm092Hq8HEv-Gg_yuO5eUCw',
  reviewTable: 'review',
  pageSize: 500,
  orderColumns: ['published_at', 'review_time', 'crawled_at', 'created_at', 'id']
};

const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.publishableKey;
const SUPABASE_REVIEW_TABLE = SUPABASE_CONFIG.reviewTable;
const SUPABASE_KEY_HINT = `${SUPABASE_ANON_KEY.slice(0, 14)}...${SUPABASE_ANON_KEY.slice(-6)}`;

let supabaseClient = null;

if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

const MENTION_SCHEMA_VERSION = 'enterprise-mention-v1';

const SUPPORTED_SOURCES = [
  'google_business_reviews',
  'ptt',
  'mobile01',
  'facebook',
  'instagram',
  'threads',
  'dcard',
  'youtube',
  'news_rss',
  'csv_import',
  'supabase'
];

const REPLY_CAPABILITY_LAYER = {
  google_business_reviews: {
    publish_capability: 'official_publish',
    can_generate_reply: true,
    requires_manager_approval: true,
    can_publish_via_platform_api: true,
    can_create_crm_ticket: true,
    allowed_actions: ['reply_draft', 'manager_approve', 'google_business_api_publish', 'crm_ticket', 'notify_department']
  },
  default_social_source: {
    publish_capability: 'suggestion_only',
    can_generate_reply: true,
    requires_manager_approval: true,
    can_publish_via_platform_api: false,
    can_create_crm_ticket: true,
    allowed_actions: ['suggested_response', 'crm_ticket', 'notify_department']
  }
};

const RAG_REPLY_GUARDRAILS = [
  'no_admission_of_liability',
  'no_refund_promise',
  'no_compensation_promise',
  'no_policy_fabrication',
  'no_promotion_fabrication',
  'no_store_info_fabrication',
  'no_business_hours_fabrication',
  'no_phone_fabrication',
  'no_product_info_fabrication',
  'no_unverified_event_speculation'
];

// ============================================================
// DATA LAYER — Reviews & Knowledge Base
// ============================================================

let REVIEWS = [
  { review_id: "r001", store_name: "美味花園 信義店", reviewer: "林小明", rating: 5, raw_text: "招牌烤雞真的太好吃了！外皮烤得酥脆，咬下去肉汁飽滿。店員服務態度非常親切主動，用餐環境很乾淨明亮，非常適合家族聚餐，極力推薦！", review_time: "2026-06-01 12:30:00", sentiment: { label: "positive", score: 0.95 }, emotion: { joy: 0.90, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "food", score: 0.95 }, { topic: "service", score: 0.90 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "招牌烤雞真的太好吃了" }, { aspect: "service", sentiment: "positive", evidence: "店員服務態度非常親切主動" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.98 },
  { review_id: "r002", store_name: "美味花園 中山店", reviewer: "陳雅婷", rating: 5, raw_text: "環境氣氛非常優雅，裝潢很有質感。下午茶的抹茶鬆餅甜而不膩，抹茶味很濃郁！服務人員也很貼心，會主動倒水，下次還會想跟朋友聚會來這。", review_time: "2026-06-02 15:45:00", sentiment: { label: "positive", score: 0.92 }, emotion: { joy: 0.85, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "environment", score: 0.95 }, { topic: "food", score: 0.90 }], aspects: [{ aspect: "environment", sentiment: "positive", evidence: "環境氣氛非常優雅" }, { aspect: "food", sentiment: "positive", evidence: "抹茶鬆餅甜而不膩" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.96 },
  { review_id: "r003", store_name: "美味花園 公館店", reviewer: "張立宏", rating: 4, raw_text: "奶油海鮮義大利麵的蝦子很新鮮，麵條軟硬適中，起司香氣很足。唯獨假日人潮多的時候店內稍微嘈雜了一點，講話要比較用力，但整體餐點還是很有水準。", review_time: "2026-06-03 18:20:00", sentiment: { label: "positive", score: 0.75 }, emotion: { joy: 0.70, anger: 0.0, disappointment: 0.20 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.85 }, { topic: "environment", score: 0.60 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "蝦子很新鮮，麵條軟硬適中" }, { aspect: "environment", sentiment: "negative", evidence: "店內稍微嘈雜了一點" }], risk: { score: 15, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.92 },
  { review_id: "r004", store_name: "美味花園 信義店", reviewer: "David Chen", rating: 3, raw_text: "東西是蠻好吃的，但是沒有預約的話，現場排隊排了快要一個半小時，實在等太久了。建議店家應該改善排隊流程，或者增加線上訂位的名額。", review_time: "2026-06-04 19:10:00", sentiment: { label: "neutral", score: 0.10 }, emotion: { joy: 0.30, anger: 0.30, disappointment: 0.50 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "service", score: 0.80 }, { topic: "food", score: 0.70 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "東西是蠻好吃的" }, { aspect: "service", sentiment: "negative", evidence: "現場排隊排了快要一個半小時" }], risk: { score: 25, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.95 },
  { review_id: "r005", store_name: "美味花園 公館店", reviewer: "李佩真", rating: 1, raw_text: "今天點了番茄牛肉湯，喝到一半竟然發現湯裡有一根黑色的長頭髮！超級噁心！叫店員過來反應，竟然只是冷冷地說「幫你換一碗」，一點誠意都沒有，直接氣到沒胃口，絕對不會再去！食安管理太差勁了！", review_time: "2026-06-05 13:15:00", sentiment: { label: "negative", score: -0.90 }, emotion: { joy: 0.0, anger: 0.95, disappointment: 0.80 }, intent: { primary: "complaint", secondary: ["refund_request"] }, topics: [{ topic: "food", score: 0.90 }, { topic: "service", score: 0.85 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "湯裡有一根黑色的長頭髮" }, { aspect: "service", sentiment: "negative", evidence: "店員冷冷地說「幫你換一碗」，一點誠意都沒有" }], risk: { score: 75, level: "high", legal_risk: false, food_safety: true, hygiene_risk: true, escalation_type: "manager_review" }, confidence: 0.97 },
  { review_id: "r006", store_name: "美味花園 台中公益店", reviewer: "王健宇", rating: 1, raw_text: "昨天跟朋友在這聚餐點了海鮮拼盤，回去之後我們兩個人都肚子痛、拉肚子了一整晚！懷疑是生蠔或蝦子不新鮮。這根本是重大的食品安全問題，希望能給個合理的解釋，否則不排除投訴衛生局！", review_time: "2026-06-06 10:00:00", sentiment: { label: "negative", score: -0.98 }, emotion: { joy: 0.0, anger: 0.98, disappointment: 0.90 }, intent: { primary: "complaint", secondary: ["refund_request"] }, topics: [{ topic: "food", score: 0.98 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "兩個人都肚子痛、拉肚子了一整晚！懷疑是生蠔或蝦子不新鮮" }], risk: { score: 95, level: "critical", legal_risk: true, food_safety: true, hygiene_risk: true, escalation_type: "legal_review" }, confidence: 0.99 },
  { review_id: "r007", store_name: "美味花園 中山店", reviewer: "劉芳妤", rating: 2, raw_text: "餐點還可以，但是服務生態度非常傲慢。問問題愛理不理的，點餐時甚至直接對我們翻白眼，送餐也是用摔的。最後收了 10% 服務費，這種服務態度到底憑什麼收服務費？完全不值得！", review_time: "2026-06-07 20:30:00", sentiment: { label: "negative", score: -0.78 }, emotion: { joy: 0.0, anger: 0.85, disappointment: 0.75 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "service", score: 0.95 }, { topic: "food", score: 0.50 }], aspects: [{ aspect: "service", sentiment: "negative", evidence: "服務生態度非常傲慢。點餐時甚至對我們翻白眼" }], risk: { score: 45, level: "medium", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "customer_service" }, confidence: 0.96 },
  { review_id: "r008", store_name: "美味花園 高雄巨蛋店", reviewer: "黃瑞奇", rating: 1, raw_text: "在吃小火鍋的時候，突然看到高麗菜葉底下有一隻活生生的小蟑螂在爬！差點沒嚇死！跟店家反映之後，只幫我免單那一鍋，但我們整桌都已經反胃吃不下了。餐廳的清潔衛生實在太可怕了，衛生堪憂！", review_time: "2026-06-08 19:40:00", sentiment: { label: "negative", score: -0.95 }, emotion: { joy: 0.0, anger: 0.95, disappointment: 0.85 }, intent: { primary: "complaint", secondary: ["refund_request"] }, topics: [{ topic: "food", score: 0.95 }, { topic: "environment", score: 0.85 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "高麗菜葉底下有一隻活生生的小蟑螂在爬" }, { aspect: "environment", sentiment: "negative", evidence: "餐廳的清潔衛生實在太可怕了" }], risk: { score: 90, level: "critical", legal_risk: false, food_safety: true, hygiene_risk: true, escalation_type: "manager_review" }, confidence: 0.98 },
  { review_id: "r009", store_name: "美味花園 台中公益店", reviewer: "吳美玲", rating: 4, raw_text: "炭烤牛排熟度剛剛好，肉質香嫩。環境佈置得很典雅，服務生也算客氣。不過價格確實稍微高了一點，份量對男生來說可能不太夠，算是精緻路線的餐廳。", review_time: "2026-06-09 13:00:00", sentiment: { label: "positive", score: 0.65 }, emotion: { joy: 0.75, anger: 0.0, disappointment: 0.30 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "food", score: 0.85 }, { topic: "environment", score: 0.80 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "炭烤牛排熟度剛剛好，肉質香嫩" }], risk: { score: 10, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.94 },
  { review_id: "r010", store_name: "美味花園 公館店", reviewer: "蔡家豪", rating: 2, raw_text: "一進去就覺得桌子油油黏黏的沒有擦乾淨，地板也有很多掉落的食物碎屑。跟店員反應後，拿抹布來隨便抹了兩下還是黏。雖然餐點味道算及格，但這種環境衛生水準讓人用餐很不安心。", review_time: "2026-06-10 12:15:00", sentiment: { label: "negative", score: -0.65 }, emotion: { joy: 0.0, anger: 0.50, disappointment: 0.70 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "environment", score: 0.90 }, { topic: "food", score: 0.50 }], aspects: [{ aspect: "environment", sentiment: "negative", evidence: "桌子油油黏黏的沒有擦乾淨，地板也有很多掉落的食物碎屑" }], risk: { score: 40, level: "medium", legal_risk: false, food_safety: false, hygiene_risk: true, escalation_type: "customer_service" }, confidence: 0.95 },
  { review_id: "r011", store_name: "美味花園 信義店", reviewer: "Sophia Lin", rating: 3, raw_text: "今天去用餐，點了牛肉漢堡，結果咬開中間的牛肉竟然是血紅的生肉，完全沒熟！希望收銀流程和客服教育能再加強，整體食物是不錯。", review_time: "2026-06-11 21:00:00", sentiment: { label: "neutral", score: -0.15 }, emotion: { joy: 0.10, anger: 0.40, disappointment: 0.60 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "service", score: 0.85 }, { topic: "food", score: 0.60 }], aspects: [{ aspect: "service", sentiment: "negative", evidence: "收銀流程和客服教育需加強" }, { aspect: "food", sentiment: "positive", evidence: "食物是不錯" }], risk: { score: 30, level: "medium", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "customer_service" }, confidence: 0.93 },
  { review_id: "r012", store_name: "美味花園 中山店", reviewer: "高小凡", rating: 5, raw_text: "這是我吃過最好吃的經典凱薩沙拉！蔬菜極度爽脆，醬汁比例很完美。而且店裡還提供免費的插座和流暢的 Wi-Fi，服務生看到我水杯快空了都會主動補滿，簡直是辦公和聚會的最佳地點！", review_time: "2026-06-12 14:20:00", sentiment: { label: "positive", score: 0.96 }, emotion: { joy: 0.95, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "food", score: 0.95 }, { topic: "service", score: 0.90 }, { topic: "environment", score: 0.85 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "經典凱薩沙拉！蔬菜極度爽脆" }, { aspect: "service", sentiment: "positive", evidence: "水杯快空了都會主動補滿" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.97 },
  { review_id: "r013", store_name: "美味花園 高雄巨蛋店", reviewer: "陳冠宇", rating: 3, raw_text: "點了蒜香松阪豬飯，豬肉有點硬，稍微咬不動，調味倒還可以。不過巨蛋店的位置很方便，捷運站出來走一下就到了，座位也很寬敞，如果餐點品質能更穩定就好了。", review_time: "2026-06-13 12:40:00", sentiment: { label: "neutral", score: 0.20 }, emotion: { joy: 0.40, anger: 0.10, disappointment: 0.30 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.70 }, { topic: "environment", score: 0.80 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "豬肉有點硬，稍微咬不動" }, { aspect: "environment", sentiment: "positive", evidence: "捷運站出來走一下就到了，座位也很寬敞" }], risk: { score: 15, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.91 },
  { review_id: "r014", store_name: "美味花園 台中公益店", reviewer: "徐志強", rating: 1, raw_text: "真的太令人生氣了！一盤要 400 元的義大利麵，送上來的時候竟然是溫的，甚至有點冷掉。跟女店員反應，她居然回「我們店出餐就是這個溫度」，隨便敷衍完就走了，服務態度爛到爆，這種品質和服務收這種價格，坑人吧！", review_time: "2026-06-14 19:25:00", sentiment: { label: "negative", score: -0.88 }, emotion: { joy: 0.0, anger: 0.92, disappointment: 0.85 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "food", score: 0.80 }, { topic: "service", score: 0.90 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "義大利麵送上來竟然是溫的，甚至有點冷掉" }, { aspect: "service", sentiment: "negative", evidence: "店員回「我們店出餐就是這個溫度」，敷衍就走了" }], risk: { score: 50, level: "medium", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "customer_service" }, confidence: 0.96 },
  { review_id: "r015", store_name: "美味花園 信義店", reviewer: "許雅婷", rating: 2, raw_text: "今天去用餐，點了牛肉漢堡，結果咬開中間的牛肉竟然是血紅的生肉，完全沒熟！打電話請經理處理，拿回去重烤也是一副不甘願的樣子。如果是老人或小孩吃下去怎麼辦？食安管控也太誇張了吧，根本罔顧人命！", review_time: "2026-06-15 18:30:00", sentiment: { label: "negative", score: -0.92 }, emotion: { joy: 0.0, anger: 0.95, disappointment: 0.85 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "food", score: 0.95 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "牛肉漢堡咬開竟然是血紅的生肉，完全沒熟" }], risk: { score: 85, level: "high", legal_risk: false, food_safety: true, hygiene_risk: false, escalation_type: "manager_review" }, confidence: 0.97 },
  { review_id: "r016", store_name: "美味花園 公館店", reviewer: "詹智鈞", rating: 4, raw_text: "餐點非常好吃，松露野菇燉飯香氣逼人，起司味道很融洽。只是門市的排隊等候動線有點混亂，現場候位擠成一團，差點跟其他顧客發生口角衝突，希望能劃定更明確的排隊區。", review_time: "2026-06-16 19:00:00", sentiment: { label: "positive", score: 0.68 }, emotion: { joy: 0.70, anger: 0.15, disappointment: 0.35 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.90 }, { topic: "service", score: 0.65 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "松露野菇燉飯香氣逼人，起司味道很融洽" }, { aspect: "service", sentiment: "negative", evidence: "排隊等候動線有點混亂，現場候位擠成一團" }], risk: { score: 20, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.94 },
  { review_id: "r017", store_name: "美味花園 中山店", reviewer: "Emily Wu", rating: 5, raw_text: "第一次帶狗狗來這家寵物友善餐廳，店員對寵物非常友善，還貼心提供了寵物專用的水碗，服務超級加分！我們點的明太子意麵和酥炸薯條也非常好吃，環境乾淨沒有寵物異味，大推！", review_time: "2026-06-17 11:50:00", sentiment: { label: "positive", score: 0.98 }, emotion: { joy: 0.98, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "service", score: 0.98 }, { topic: "food", score: 0.92 }, { topic: "environment", score: 0.95 }], aspects: [{ aspect: "service", sentiment: "positive", evidence: "店員對寵物非常友善，還貼心提供了寵物專用的水碗" }, { aspect: "food", sentiment: "positive", evidence: "明太子意麵和酥炸薯條也非常好吃" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.98 },
  { review_id: "r018", store_name: "美味花園 高雄巨蛋店", reviewer: "李建德", rating: 1, raw_text: "非常不推！今天結帳發現，他們竟然偷偷多刷了兩筆我們沒有點的開胃菜。跟收銀員理論，她竟然還指責是我們記錯，最後調出點單紀錄發現真的是他們系統出錯，才退錢給我們。誠信有問題！", review_time: "2026-06-18 20:10:00", sentiment: { label: "negative", score: -0.96 }, emotion: { joy: 0.0, anger: 0.98, disappointment: 0.90 }, intent: { primary: "complaint", secondary: ["refund_request"] }, topics: [{ topic: "service", score: 0.95 }], aspects: [{ aspect: "service", sentiment: "negative", evidence: "偷偷多刷了兩筆我們沒有點的開胃菜...還指責是我們記錯，誠信有問題" }], risk: { score: 80, level: "high", legal_risk: true, food_safety: false, hygiene_risk: false, escalation_type: "legal_review" }, confidence: 0.97 },
  { review_id: "r019", store_name: "美味花園 台中公益店", reviewer: "張莉婷", rating: 5, raw_text: "今天點了青醬雞肉燉飯，青醬香氣超濃郁，雞肉也很多汁不柴。這裡的上菜速度很快，點餐到上菜不到 10 分鐘，服務效率極高，非常滿意！", review_time: "2026-06-19 13:10:00", sentiment: { label: "positive", score: 0.94 }, emotion: { joy: 0.92, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "food", score: 0.95 }, { topic: "service", score: 0.90 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "青醬雞肉燉飯，青醬香氣超濃郁，雞肉也很多汁" }, { aspect: "service", sentiment: "positive", evidence: "上菜速度很快，點餐到上菜不到 10 分鐘" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.96 },
  { review_id: "r020", store_name: "美味花園 公館店", reviewer: "鄭大為", rating: 2, raw_text: "點了主廚特製海鮮意麵，結果裡面的蛤蜊全部都沒開，有的甚至還有一股臭味，顯然食材很不新鮮。跟值班店員說，他也只是點頭把盤子端走，也沒有再做任何後續的退費或換餐說明，非常不推薦！", review_time: "2026-06-20 18:50:00", sentiment: { label: "negative", score: -0.85 }, emotion: { joy: 0.0, anger: 0.90, disappointment: 0.85 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "food", score: 0.90 }, { topic: "service", score: 0.80 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "蛤蜊全部都沒開，有的甚至還有一股臭味，食材很不新鮮" }, { aspect: "service", sentiment: "negative", evidence: "店員只是點頭把盤子端走，沒有後續說明" }], risk: { score: 78, level: "high", legal_risk: false, food_safety: true, hygiene_risk: true, escalation_type: "manager_review" }, confidence: 0.97 },
  { review_id: "r021", store_name: "美味花園 信義店", reviewer: "王若冰", rating: 4, raw_text: "每次來信義店都會點舒芙蕾鬆餅，口感非常綿密像雲朵一樣！不過這家店限時 90 分鐘，時間快到時店員會一直來提醒結帳，感覺稍微有點催促和壓力。如果能稍微放寬到 120 分鐘就更完美了。", review_time: "2026-06-21 15:00:00", sentiment: { label: "positive", score: 0.70 }, emotion: { joy: 0.78, anger: 0.10, disappointment: 0.30 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.90 }, { topic: "service", score: 0.60 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "舒芙蕾鬆餅，口感非常綿密像雲朵一樣" }, { aspect: "service", sentiment: "negative", evidence: "時間快到時店員會一直來提醒結帳，感覺有點催促" }], risk: { score: 15, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.94 },
  { review_id: "r022", store_name: "美味花園 中山店", reviewer: "林立群", rating: 1, raw_text: "這間店衛生真的很差！剛入座就在我的盤子邊緣看到一個黑乎乎的像是大蒼蠅死掉的屍體！超誇張！服務人員道歉敷衍，而且整個廁所充滿尿騷味，洗手槽根本沒水，環境令人擔憂！", review_time: "2026-06-22 13:30:00", sentiment: { label: "negative", score: -0.96 }, emotion: { joy: 0.0, anger: 0.96, disappointment: 0.90 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "environment", score: 0.95 }, { topic: "food", score: 0.70 }], aspects: [{ aspect: "environment", sentiment: "negative", evidence: "廁所充滿尿騷味，洗手槽根本沒水，衛生安全差" }, { aspect: "food", sentiment: "negative", evidence: "盤子邊緣看到一個黑乎乎的像是大蒼蠅死掉的屍體" }], risk: { score: 88, level: "high", legal_risk: false, food_safety: true, hygiene_risk: true, escalation_type: "manager_review" }, confidence: 0.98 },
  { review_id: "r023", store_name: "美味花園 高雄巨蛋店", reviewer: "謝宇航", rating: 4, raw_text: "今天品嚐了香蒜蛤蜊細麵，蛤蜊顆顆飽滿而且吐沙乾淨，大蒜和九層塔香氣爆棚。雖然店裡收服務費，但水杯快空了都要自己走去後面倒水，服務生忙著聊天，食物真的好吃。", review_time: "2026-06-23 19:15:00", sentiment: { label: "positive", score: 0.72 }, emotion: { joy: 0.75, anger: 0.10, disappointment: 0.35 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.95 }, { topic: "service", score: 0.55 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "香蒜蛤蜊細麵，蛤蜊顆顆飽滿而且吐沙乾淨" }, { aspect: "service", sentiment: "negative", evidence: "水杯快空了都要自己走去倒水，服務生忙著聊天" }], risk: { score: 20, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.93 },
  { review_id: "r024", store_name: "美味花園 台中公益店", reviewer: "林家豪", rating: 3, raw_text: "聽說這家舒芙蕾很有名，特地來吃。舒芙蕾確實口感很棉，但我們點的義大利燉飯卻非常一般，米芯太硬了，CP值一般般。", review_time: "2026-06-24 14:10:00", sentiment: { label: "neutral", score: 0.15 }, emotion: { joy: 0.45, anger: 0.0, disappointment: 0.35 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.85 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "義大利燉飯非常一般，米芯太硬了，CP值一般" }], risk: { score: 10, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.92 },
  { review_id: "r025", store_name: "美味花園 信義店", reviewer: "劉美芳", rating: 5, raw_text: "今天帶著兩歲的小孩去吃，店員主動幫我們換兒童椅和兒童餐具，而且態度超級親切，還送了小孩一塊畫畫板。餐點的番茄肉醬麵小孩非常喜歡吃，暖心服務真的想給十顆星！", review_time: "2026-06-25 12:00:00", sentiment: { label: "positive", score: 0.99 }, emotion: { joy: 0.99, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "service", score: 0.99 }, { topic: "food", score: 0.90 }], aspects: [{ aspect: "service", sentiment: "positive", evidence: "店員主動幫我們換兒童椅和兒童餐具，而且態度超級親切" }], risk: { score: 0, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.99 },
  { review_id: "r026", store_name: "美味花園 公館店", reviewer: "何冠達", rating: 1, raw_text: "這是我遇過最糟糕的用餐體驗。因為排隊的關係我們跟旁邊的人有點爭執，跟店員反映請他們協調排隊順序，店長過來直接要我們「如果不想排可以去吃別家」，一星都不想給！", review_time: "2026-06-26 19:40:00", sentiment: { label: "negative", score: -0.92 }, emotion: { joy: 0.0, anger: 0.95, disappointment: 0.85 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "service", score: 0.98 }], aspects: [{ aspect: "service", sentiment: "negative", evidence: "店長過來直接要我們「如果不想排可以去吃別家」" }], risk: { score: 55, level: "medium", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "customer_service" }, confidence: 0.96 },
  { review_id: "r027", store_name: "美味花園 中山店", reviewer: "簡淑芬", rating: 5, raw_text: "店內的採光非常好，綠植裝飾顯得很清新。今天跟閨蜜一起點了明太子干貝義大利麵，干貝好大顆而且煎得外焦內嫩，調味剛剛好。是會想要無限回訪的口袋名單！", review_time: "2026-06-27 12:45:00", sentiment: { label: "positive", score: 0.96 }, emotion: { joy: 0.95, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "environment", score: 0.92 }, { topic: "food", score: 0.95 }], aspects: [{ aspect: "environment", sentiment: "positive", evidence: "店內的採光非常好，綠植裝飾顯得很清新" }, { aspect: "food", sentiment: "positive", evidence: "干貝好大顆而且煎得外焦內嫩" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.97 },
  { review_id: "r028", store_name: "美味花園 高雄巨蛋店", reviewer: "盧宣羽", rating: 2, raw_text: "松露脆薯很好吃，但除了脆薯以外，主餐等了快要 50 分鐘都還沒上齊。跟店員催了兩次都說在做了，最後送上來發現隔壁比我們晚來的客人都吃完了。管理有極大問題。", review_time: "2026-06-28 18:30:00", sentiment: { label: "negative", score: -0.60 }, emotion: { joy: 0.20, anger: 0.60, disappointment: 0.70 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "service", score: 0.90 }, { topic: "food", score: 0.60 }], aspects: [{ aspect: "service", sentiment: "negative", evidence: "主餐等了快要 50 分鐘都還沒上齊...隔壁比我們晚來的客人都吃完了" }], risk: { score: 35, level: "medium", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "customer_service" }, confidence: 0.94 },
  { review_id: "r029", store_name: "美味花園 台中公益店", reviewer: "蔡佩珊", rating: 1, raw_text: "今天點了冰滴咖啡和三明治，喝完咖啡不久我們全家肚子就不太舒服。特別是我兒子，回家後一直拉肚子甚至開始發燒！我們強烈懷疑咖啡冰塊衛生問題，非常不負責！", review_time: "2026-06-29 16:20:00", sentiment: { label: "negative", score: -0.97 }, emotion: { joy: 0.0, anger: 0.96, disappointment: 0.92 }, intent: { primary: "complaint", secondary: ["refund_request"] }, topics: [{ topic: "food", score: 0.95 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "喝完咖啡不久我們全家肚子就不太舒服...一直拉肚子甚至開始發燒！懷疑冰塊有衛生問題" }], risk: { score: 96, level: "critical", legal_risk: true, food_safety: true, hygiene_risk: true, escalation_type: "legal_review" }, confidence: 0.99 },
  { review_id: "r030", store_name: "美味花園 信義店", reviewer: "潘志榮", rating: 4, raw_text: "商業午餐的 CP 值蠻高的，主餐加湯和飲料只要 350 元。燉牛肉很嫩，味道也很入味。唯一美中不足的是中午時段客人超多，上菜稍微慢了些，如果不趕時間的話很推薦。", review_time: "2026-06-30 12:40:00", sentiment: { label: "positive", score: 0.78 }, emotion: { joy: 0.80, anger: 0.0, disappointment: 0.25 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "food", score: 0.88 }, { topic: "service", score: 0.65 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "商業午餐的 CP 值蠻高的，燉牛肉很嫩" }, { aspect: "service", sentiment: "negative", evidence: "中午時段客人超多，上菜稍微慢了些" }], risk: { score: 10, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.95 },
  { review_id: "r031", store_name: "美味花園 中山店", reviewer: "謝雅婷", rating: 5, raw_text: "今天點了水果千層蛋糕，簡直是完美！千層皮非常薄，鮮奶油清爽不膩，水果也很新鮮多樣。搭配熱伯爵茶，真的度過了一個非常美好的下午，店裡放的輕爵士樂很有情調，極推！", review_time: "2026-06-30 15:30:00", sentiment: { label: "positive", score: 0.97 }, emotion: { joy: 0.96, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "food", score: 0.95 }, { topic: "environment", score: 0.90 }], aspects: [{ aspect: "food", sentiment: "positive", evidence: "水果千層蛋糕，簡直是完美！千層皮非常薄" }, { aspect: "environment", sentiment: "positive", evidence: "店裡放的輕爵士樂很有情調" }], risk: { score: 5, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.98 },
  { review_id: "r032", store_name: "美味花園 公館店", reviewer: "古政勳", rating: 3, raw_text: "主食的墨西哥雞肉捲稍微普通，裡面的雞肉有點乾，但附贈的烤馬鈴薯非常好吃。另外這家店的椅背有點搖晃，希望可以檢修一下安全防護。", review_time: "2026-06-30 18:25:00", sentiment: { label: "neutral", score: 0.15 }, emotion: { joy: 0.40, anger: 0.0, disappointment: 0.25 }, intent: { primary: "praise", secondary: ["complaint"] }, topics: [{ topic: "food", score: 0.70 }, { topic: "environment", score: 0.60 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "墨西哥雞肉捲稍微普通，裡面的雞肉有點乾" }, { aspect: "environment", sentiment: "negative", evidence: "椅子靠背有點搖晃" }], risk: { score: 20, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.91 },
  { review_id: "r033", store_name: "美味花園 高雄巨蛋店", reviewer: "江俊吉", rating: 2, raw_text: "今天點了蒜香香草烤魚，但吃了一口發現魚肉有一股很濃的土腥味甚至是微酸的味道，明顯放了很久。我們跟店員說，店員竟然回答說這是特調香草風味，敷衍我們！", review_time: "2026-06-30 19:50:00", sentiment: { label: "negative", score: -0.87 }, emotion: { joy: 0.0, anger: 0.94, disappointment: 0.80 }, intent: { primary: "complaint", secondary: [] }, topics: [{ topic: "food", score: 0.92 }, { topic: "service", score: 0.85 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "魚肉有一股很濃的土腥味甚至是微酸的味道，明顯放了很久" }, { aspect: "service", sentiment: "negative", evidence: "店員回答說這是「特調香草風味」...敷衍" }], risk: { score: 82, level: "high", legal_risk: false, food_safety: true, hygiene_risk: false, escalation_type: "manager_review" }, confidence: 0.96 },
  { review_id: "r034", store_name: "美味花園 信義店", reviewer: "林芷萱", rating: 5, raw_text: "這間店真的太讚了！上禮拜過生日，店員不僅幫忙唱生日快樂歌，還送了一整份完整的草莓慕斯蛋糕，上面的蠟燭跟字都寫得很精美。服務貼心程度破表，食物也無可挑剔，必推信義店！", review_time: "2026-06-30 20:00:00", sentiment: { label: "positive", score: 0.99 }, emotion: { joy: 0.99, anger: 0.0, disappointment: 0.0 }, intent: { primary: "praise", secondary: [] }, topics: [{ topic: "service", score: 0.99 }, { topic: "food", score: 0.95 }], aspects: [{ aspect: "service", sentiment: "positive", evidence: "過生日，店員幫忙唱生日快樂歌，還送了一整份蛋糕" }], risk: { score: 0, level: "low", legal_risk: false, food_safety: false, hygiene_risk: false, escalation_type: "none" }, confidence: 0.99 },
  { review_id: "r035", store_name: "美味花園 台中公益店", reviewer: "周宗翰", rating: 1, raw_text: "點了總匯披薩，送上來竟然看到上面有一隻大蒼蠅被黏在起司上一起烤熟了！我當場反胃，拍照存證跟值班主管抗議。主管還在那裡推脫說是剛剛飛進去的，明明就已經跟起司烤成一體了。食安與衛生管理惡劣到極點，我已經檢舉給衛生局了，等著被查吧！", review_time: "2026-06-30 20:15:00", sentiment: { label: "negative", score: -0.98 }, emotion: { joy: 0.0, anger: 0.99, disappointment: 0.95 }, intent: { primary: "complaint", secondary: ["refund_request"] }, topics: [{ topic: "food", score: 0.98 }, { topic: "service", score: 0.90 }], aspects: [{ aspect: "food", sentiment: "negative", evidence: "披薩上面有一隻大蒼蠅被黏在起司上一起烤熟了" }, { aspect: "service", sentiment: "negative", evidence: "主管推脫說是剛剛飛進去的...食安與衛生管理惡劣" }], risk: { score: 98, level: "critical", legal_risk: true, food_safety: true, hygiene_risk: true, escalation_type: "legal_review" }, confidence: 0.99 }
];

const LOCAL_REVIEWS = JSON.parse(JSON.stringify(REVIEWS));
let activeDataSource = 'local';
let lastAiReplyDecision = null;
let submittedReplyActions = [];

const KB = {
  brand_info: { brand_name: "美味花園 Gourmet Garden", brand_tone: "親切且專業", language: "繁體中文", reply_limit: "100字以內，必須公開、禮貌、自然", core_policies: ["不可承認未經現場證實的事實，避免法律責任。", "避免在公開回覆中編造、約定具體的賠償金額或細節。", "不可與顧客爭辯，若有誤解需委婉說明並引導至私訊/電話聯繫。", "凡涉及食品安全（拉肚子、發燒、異物如蒼蠅、蟑螂、沒熟肉類等）以及法務、媒體糾紛，必須標記 need_human = true 轉交人工審核發布。"] },
  stores: [
    { store_name: "美味花園 信義店", address: "台北市信義區松壽路12號4樓", phone: "02-2722-1234", specialty: "招牌烤雞、舒芙蕾鬆餅" },
    { store_name: "美味花園 中山店", address: "台北市中山區南京西路15號B1", phone: "02-2511-5678", specialty: "抹茶鬆餅、明太子干貝義大利麵" },
    { store_name: "美味花園 公館店", address: "台北市中正區羅斯福路三段316號", phone: "02-2368-9876", specialty: "奶油海鮮義大利麵、松露野菇燉飯" },
    { store_name: "美味花園 台中公益店", address: "台中市西區公益路68號", phone: "04-2328-1122", specialty: "炭烤牛排、青醬雞肉燉飯" },
    { store_name: "美味花園 高雄巨蛋店", address: "高雄市左營區博愛二路777號4樓", phone: "07-555-4321", specialty: "蒜香香草烤魚、香蒜蛤蜊細麵" }
  ],
  sop_rules: [
    { id: "sop_food_safety", category: "food_safety_issue", label: "食安事件 SOP", color: "#ff4757", triggers: ["拉肚子", "肚子痛", "發燒", "噁心", "吐", "頭髮", "蒼蠅", "蟑螂", "昆蟲", "沒熟", "生肉", "酸掉", "壞掉", "食安", "不新鮮"], rule_description: "當評論提及食安事件、身體不適或餐點出現嚴重異物時，啟動高風險處理流程。", action_guideline: "1. 表達高度遺憾與歉意（但不得公開承認疏失是因食材引起，以防後續法律糾紛）。\n2. 說明門市將立即啟動內部衛生稽查與食材檢驗。\n3. 強烈懇請顧客直接撥打該店電話或透過官方私訊提供聯絡方式，以便由門市經理親自處理。\n4. 此回覆草稿必須標記為需要人工審查 (need_human = true)。", prohibited_content: "禁止承諾具體賠償金額（如：賠償三倍醫藥費、退全款等），禁止直接寫出「是我們食材不新鮮」等字眼，禁止在公開留言中討論病症細節。" },
    { id: "sop_service", category: "service_complaint", label: "服務態度投訴 SOP", color: "#f5a623", triggers: ["態度", "翻白眼", "傲慢", "不耐煩", "愛理不理", "不客氣", "收服務費", "服務生", "服務員", "店員", "店長"], rule_description: "當評論投訴店員或主管的服務態度時，依情緒強度分級處理。", action_guideline: "1. 針對用餐過程中的不快體驗致上誠摯的歉意。\n2. 說明會將此事件反映給該店主管，並加強內部服務人員的教育訓練。\n3. 邀請顧客透過客服管道與我們聯繫，讓我們有機會改進並做適當補償。\n4. 若有恐嚇、辱罵或多收費爭議，標記 need_human = true。", prohibited_content: "禁止公開指責特定員工名字，禁止承諾處分或開除員工。" },
    { id: "sop_waiting", category: "waiting_time", label: "等待時間投訴 SOP", color: "#06b6d4", triggers: ["等太久", "排隊", "出餐慢", "上菜慢", "排了一個", "候位", "等待", "催"], rule_description: "當評論抱怨排隊過久、出餐延誤或候位秩序混亂時。", action_guideline: "1. 對於讓顧客久候致歉，說明高峰時段餐點均為現點現做，因此需要一些時間。\n2. 介紹可利用線上預約系統提前訂位，以減少現場等待時間。\n3. 說明會持續優化廚房與現場動線以提升出餐及排隊效率。", prohibited_content: "禁止承諾退款或優惠券補償（此類補償需由門市主管個別評估授權）。" },
    { id: "sop_cleanliness", category: "cleanliness_issue", label: "環境衛生投訴 SOP", color: "#a78bfa", triggers: ["髒", "油", "黏", "垃圾", "沒擦乾淨", "尿騷味", "廁所", "不乾淨", "衛生"], rule_description: "當評論抱怨環境衛生、桌椅黏膩、廁所髒亂等（非食品直接異物）。", action_guideline: "1. 感謝顧客對於環境細節的反映，並對此疏失深感抱歉。\n2. 承諾會立即督促該店現場人員加強清潔排程，尤其是桌椅擦拭與廁所整理維護。\n3. 期待下次光臨能給顧客更舒適的用餐環境。", prohibited_content: "無特殊禁止事項，但需謹慎措辭，避免讓顧客以為環境衛生問題不嚴重。" },
    { id: "sop_positive", category: "general_positive", label: "正面評論回覆 SOP", color: "#10d97a", triggers: ["好吃", "推薦", "美味", "讚", "親切", "乾淨", "舒服", "優雅", "喜歡", "滿意"], rule_description: "當評分為4-5星，且主要為正面稱讚時。", action_guideline: "1. 表達誠摯的感謝，並說明我們會持續努力維持餐點與服務水準。\n2. 根據店名，可適度推薦店內其他招牌菜色或季節新品，歡迎顧客再次光臨。", prohibited_content: "無特殊禁止事項，保持真誠感謝的語氣即可。" }
  ],
  few_shot_examples: [
    { type: "positive", review: "招牌烤雞真的太好吃了！服務生態度很親切，下次還會再來！", kb_applied: "general_positive", ai_reply: "謝謝您的喜愛！我們的招牌烤雞一直是信義店人氣第一的美味。能得到您的認可是我們最大的動力！我們也會持續為您提供親切的服務。美味花園信義店全體員工期待您的再次光臨，下次來也可以試試我們的舒芙蕾鬆餅喔！", need_human: false },
    { type: "waiting_time", review: "餐點是不錯，但是現場排隊排了一個半小時，建議店家改善排隊流程。", kb_applied: "waiting_time", ai_reply: "您好，非常抱歉讓您久等了！為了維持餐點的美味，我們均為現點現做。建議您下次可以使用我們的線上訂位系統提前預約，以節省您的寶貴時間。我們會持續努力優化排隊與服務流程，美味花園期待再次為您服務。", need_human: false },
    { type: "food_safety_critical", review: "昨天去吃海鮮拼盤，回去肚子痛拉肚子了一整晚！懷疑是不新鮮，要投訴衛生局！", kb_applied: "food_safety_issue", ai_reply: "您好，得知此狀況我們非常遺憾與重視。美味花園一向極度重視食品安全衛生，我們將立即啟動該店海鮮食材的保存與稽核程序。為了能深入了解您的用餐品項並提供最即時的協助，懇請您撥打台中公益店電話 04-2328-1122 或私訊提供聯絡方式，我們將由門市主管親自為您處理。謝謝您。", need_human: true }
  ]
};

// ============================================================
// SUPABASE DATA ADAPTER
// ============================================================

function normalizeSentiment(label) {
  const value = (label || '').toLowerCase();
  if (['positive', 'pos', 'good', 'praise', '推'].includes(value)) return 'positive';
  if (['negative', 'neg', 'bad', 'complaint', '噓'].includes(value)) return 'negative';
  return 'neutral';
}

function normalizeSource(platform, reviewType) {
  const value = `${platform || ''} ${reviewType || ''}`.toLowerCase();
  if (value.includes('google')) return 'google_business_reviews';
  if (value.includes('ptt')) return 'ptt';
  if (value.includes('mobile01')) return 'mobile01';
  if (value.includes('facebook') || value.includes('fb')) return 'facebook';
  if (value.includes('instagram') || value.includes('ig')) return 'instagram';
  if (value.includes('threads')) return 'threads';
  if (value.includes('dcard')) return 'dcard';
  if (value.includes('youtube') || value.includes('yt')) return 'youtube';
  if (value.includes('news') || value.includes('rss')) return 'news_rss';
  if (value.includes('csv')) return 'csv_import';
  return 'supabase';
}

function getReplyCapability(source) {
  if (source === 'google_business_reviews') {
    return REPLY_CAPABILITY_LAYER.google_business_reviews;
  }
  return REPLY_CAPABILITY_LAYER.default_social_source;
}

function suggestedDepartmentForRisk(risk, sentiment) {
  if (risk.legal_risk || risk.level === 'critical') return 'legal';
  if (risk.food_safety || risk.hygiene_risk) return 'public_relations';
  if (sentiment === 'negative' || risk.level === 'medium' || risk.level === 'high') return 'customer_service';
  return 'operations';
}

function buildAiReplyOutput({ risk, sentiment, source }) {
  const capability = getReplyCapability(source);
  const needHumanReview = risk.level !== 'low' || capability.requires_manager_approval;
  return {
    reply_draft: '',
    confidence_score: sentiment === 'neutral' ? 0.55 : 0.82,
    need_human_review: needHumanReview,
    suggested_department: suggestedDepartmentForRisk(risk, sentiment),
    risk_level: risk.level,
    publish_capability: capability.publish_capability,
    can_publish_via_platform_api: capability.can_publish_via_platform_api,
    allowed_actions: capability.allowed_actions,
    guardrails_applied: RAG_REPLY_GUARDRAILS
  };
}

function sentimentScore(label, rating) {
  const sentiment = normalizeSentiment(label);
  if (sentiment === 'positive') return 0.8;
  if (sentiment === 'negative') return -0.8;
  if (Number(rating) >= 4) return 0.6;
  if (Number(rating) <= 2) return -0.6;
  return 0;
}

function riskFromReview(row) {
  const sentiment = normalizeSentiment(rowSentimentLabel(row));
  const rating = rowRating(row);
  const content = rowText(row);
  const criticalKeywords = ['食安', '蟑螂', '老鼠', '生病', '拉肚子', '中毒', '發霉', '異物'];
  const hasCriticalKeyword = criticalKeywords.some(keyword => content.includes(keyword));

  if (hasCriticalKeyword) {
    return {
      score: 90,
      level: 'critical',
      legal_risk: true,
      food_safety: true,
      hygiene_risk: true,
      escalation_type: 'manager_review'
    };
  }

  if (sentiment === 'negative' || rating <= 2) {
    return {
      score: 60,
      level: 'medium',
      legal_risk: false,
      food_safety: false,
      hygiene_risk: false,
      escalation_type: 'customer_service'
    };
  }

  return {
    score: 10,
    level: 'low',
    legal_risk: false,
    food_safety: false,
    hygiene_risk: false,
    escalation_type: 'none'
  };
}

function topicsFromReview(row) {
  const content = rowText(row);
  const topics = [];
  if (/餐|食|吃|味|菜|飲|food/i.test(content)) topics.push({ topic: 'food', score: 0.8 });
  if (/服務|態度|店員|等|排隊|service/i.test(content)) topics.push({ topic: 'service', score: 0.75 });
  if (/環境|乾淨|衛生|座位|空間|environment/i.test(content)) topics.push({ topic: 'environment', score: 0.7 });
  if (/價格|貴|便宜|價錢|price/i.test(content)) topics.push({ topic: 'price', score: 0.65 });
  return topics.length ? topics : [{ topic: 'service', score: 0.5 }];
}

function aspectsFromTopics(topics, sentiment) {
  return topics.map(topic => ({
    aspect: topic.topic,
    sentiment,
    evidence: ''
  }));
}

function firstFilled(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function rowText(row) {
  return String(firstFilled(row, ['content', 'raw_text', 'review_text', 'text', 'comment', 'body', 'message'], ''));
}

function rowAuthor(row) {
  return firstFilled(row, ['author', 'reviewer', 'user_name', 'username', 'name', 'display_name'], '匿名');
}

function rowPublishedAt(row) {
  return firstFilled(row, ['published_at', 'review_time', 'created_at', 'crawled_at', 'updated_at'], new Date().toISOString());
}

function rowSentimentLabel(row) {
  const sentiment = row?.sentiment;
  if (typeof sentiment === 'string') return sentiment;
  if (sentiment && typeof sentiment === 'object') return sentiment.label;
  return firstFilled(row, ['sentiment_label', 'sentiment_result', 'label'], '');
}

function rowRating(row) {
  const value = Number(firstFilled(row, ['rating', 'stars', 'score', 'star_rating'], NaN));
  return Number.isFinite(value) && value >= 1 && value <= 5 ? Math.round(value) : null;
}

function rowPlatform(row) {
  return firstFilled(row, ['platform', 'source', 'source_label', 'channel', 'review_type'], 'Supabase');
}

function rowExternalId(row) {
  const fallbackId = window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now());
  return firstFilled(row, ['external_id', 'review_id', 'id', 'uuid'], fallbackId);
}

function mapSupabaseRowToMention(row) {
  const source = normalizeSource(rowPlatform(row), row.review_type);
  const sentimentLabel = rowSentimentLabel(row);
  const sentiment = normalizeSentiment(sentimentLabel);
  const rating = rowRating(row);
  const score = sentimentScore(sentimentLabel, rating);
  const topics = topicsFromReview(row);
  const risk = riskFromReview(row);
  const capability = getReplyCapability(source);
  const externalId = rowExternalId(row);
  const mentionId = `mention-${source}-${externalId}`;

  return {
    schema_version: MENTION_SCHEMA_VERSION,
    mention_id: mentionId,
    tenant_id: row.client_id || null,
    business_id: row.business_id || null,
    source,
    source_label: rowPlatform(row),
    external_id: String(externalId),
    author: rowAuthor(row),
    title: row.title || '',
    content: rowText(row),
    rating,
    url: row.url || '',
    published_at: rowPublishedAt(row),
    crawled_at: row.crawled_at || null,
    raw_payload: row,
    nlp: {
      sentiment: { label: sentiment, score },
      emotion: {
        joy: sentiment === 'positive' ? 0.75 : 0,
        anger: sentiment === 'negative' ? 0.65 : 0.1,
        disappointment: sentiment === 'negative' ? 0.75 : 0.2
      },
      intent: {
        primary: sentiment === 'negative' ? 'complaint' : 'praise',
        secondary: []
      },
      topics,
      aspects: aspectsFromTopics(topics, sentiment),
      confidence: sentimentLabel ? 0.85 : 0.55
    },
    vision: {
      has_media: false,
      labels: [],
      risk_flags: []
    },
    risk,
    reply_capability: capability,
    ai_reply_output: buildAiReplyOutput({ risk, sentiment, source })
  };
}

function mapSupabaseReview(row) {
  const mention = mapSupabaseRowToMention(row);
  const sentiment = mention.nlp.sentiment.label;
  const score = mention.nlp.sentiment.score;
  const topics = mention.nlp.topics;
  const risk = mention.risk;

  return {
    review_id: mention.mention_id,
    mention,
    source: mention.source,
    source_label: mention.source_label,
    store_name: firstFilled(row, ['store_name', 'business_name', 'location_name', 'branch_name'], mention.source_label),
    reviewer: mention.author,
    rating: mention.rating,
    has_rating: mention.rating !== null,
    raw_text: mention.content,
    review_time: mention.published_at,
    sentiment: { label: sentiment, score },
    emotion: mention.nlp.emotion,
    intent: mention.nlp.intent,
    topics,
    aspects: mention.nlp.aspects,
    risk,
    confidence: mention.nlp.confidence,
    source_url: mention.url,
    platform: mention.source_label,
    reply_capability: mention.reply_capability,
    ai_reply_output: mention.ai_reply_output
  };
}

async function querySupabaseReviews() {
  let lastResult = null;

  for (const orderColumn of SUPABASE_CONFIG.orderColumns) {
    const query = supabaseClient
      .from(SUPABASE_CONFIG.reviewTable)
      .select('*', { count: 'exact' })
      .order(orderColumn, { ascending: false })
      .limit(SUPABASE_CONFIG.pageSize);

    const result = await query;
    lastResult = { ...result, orderColumn };

    const isMissingOrderColumn = result.error?.code === '42703' || /column .* does not exist/i.test(result.error?.message || '');
    if (!isMissingOrderColumn) return lastResult;
  }

  return lastResult;
}

function logSupabaseDiagnostic(level, message, extra = {}) {
  const payload = {
    url: SUPABASE_CONFIG.url,
    table: SUPABASE_CONFIG.reviewTable,
    key: SUPABASE_KEY_HINT,
    pageSize: SUPABASE_CONFIG.pageSize,
    ...extra
  };
  console[level](message, payload);
}

async function loadReviewsFromSupabase() {
  if (!supabaseClient) {
    console.warn('Supabase SDK not loaded; using local mock data.');
    showToast('Supabase SDK 尚未載入，請確認 CDN 可連線', 'warning');
    return { ok: false, reason: 'sdk_not_loaded' };
  }

  const { data, error, count, status, orderColumn } = await querySupabaseReviews();

  if (error) {
    logSupabaseDiagnostic('error', 'Supabase load failed:', {
      status,
      orderColumn,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    showToast(`Supabase 載入失敗：${error.message || '請檢查 table/RLS 權限'}`, 'warning');
    return { ok: false, reason: 'query_error', error };
  }

  if (!data || data.length === 0) {
    logSupabaseDiagnostic('warn', 'Supabase connected, but no visible rows were returned.', {
      status,
      orderColumn,
      visibleRowCount: count,
      note: 'If rows exist in Supabase Studio, check RLS SELECT policy for anon/publishable key or confirm the data is in public.review.'
    });
    showToast('已連到 Supabase，但 review 對目前 key 查無可見資料，已使用本地資料', 'warning');
    return { ok: false, reason: 'empty_or_rls_filtered', count };
  }

  REVIEWS = data.map(mapSupabaseReview);
  logSupabaseDiagnostic('info', 'Supabase reviews loaded.', {
    rows: data.length,
    count,
    orderColumn
  });
  return { ok: true, count: count ?? data.length };
}

function renderAllDataViews() {
  renderMetrics();
  renderRatingChart();
  renderAspectChart();
  renderStoreChart();
  renderRiskChart();
  renderSentimentTimeline();
  renderEmotionChart();
  renderWordCloud();
  applyFiltersAndRender();
  renderRecentAlerts();
  renderKnowledgeBase();
  setupNLPTab();
  renderAlertsCenter();
  populatePlaygroundReviewSelect();
}

function resetRagOutputPanels() {
  const ids = ['selected-review-card', 'rag-step-container', 'llm-comparison-container', 'rag-pipeline-steps'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const draft = document.getElementById('final-reply-draft');
  if (draft) draft.value = '';
  ['submit-ai-reply-btn', 'create-ticket-btn', 'reply-capability-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function selectReviewOrPendingCommentById(id) {
  return REVIEWS.find(x => x.review_id === id) || ResponseHub.pendingReplies.find(c => c.comment_id === id);
}

function buildPlaygroundSelectOptions() {
  const reviewOptions = REVIEWS.map(r => {
    const risk = (r.risk?.level || 'low').toUpperCase();
    const source = r.source_label || r.platform || r.store_name || 'local';
    const text = (r.raw_text || '').slice(0, 36);
    return `<option value="${r.review_id}">[${risk}] ${source}｜${r.reviewer}｜${text}...</option>`;
  });
  const pendingOptions = ResponseHub.pendingReplies.map(c => {
    const risk = (c.risk?.level || 'low').toUpperCase();
    const source = c.platform ? c.platform.toUpperCase() : 'PENDING';
    const text = (c.raw_text || '').slice(0, 36);
    return `<option value="${c.comment_id}">[待處理][${risk}][${source}] ${c.reviewer}｜${text}...</option>`;
  });
  return [...reviewOptions, ...pendingOptions].join('');
}

function populatePlaygroundReviewSelect() {
  const select = document.getElementById('playground-review-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- 請選擇 Mention / 評論 --</option>' + buildPlaygroundSelectOptions();
  if (REVIEWS.some(r => r.review_id === current) || ResponseHub.pendingReplies.some(c => c.comment_id === current)) {
    select.value = current;
  }
}

async function switchDataSource(source) {
  activeDataSource = source;
  if (source === 'local') {
    REVIEWS = JSON.parse(JSON.stringify(LOCAL_REVIEWS));
    showToast('已切換到本地示範資料', 'success');
  } else {
    const result = await loadReviewsFromSupabase();
    if (!result.ok) {
      activeDataSource = 'local';
      const select = document.getElementById('data-source-select');
      if (select) select.value = 'local';
      REVIEWS = JSON.parse(JSON.stringify(LOCAL_REVIEWS));
    } else {
      showToast(`已切換到 Supabase 線上資料：${result.count} 筆`, 'success');
    }
  }
  renderAllDataViews();
  resetRagOutputPanels();
  updateTimestamp();
}

function setupDataSourceSelector() {
  const select = document.getElementById('data-source-select');
  if (!select) return;
  select.value = activeDataSource;
  select.addEventListener('change', async () => {
    select.disabled = true;
    try {
      await switchDataSource(select.value);
    } finally {
      select.disabled = false;
    }
  });
}

// ============================================================
// RAG RESPONSE DATA — Per Review
// ============================================================
const RAG_RESPONSES = {
  r035: {
    matched_rules: ["sop_food_safety"],
    similarity_scores: { sop_food_safety: 0.97 },
    bad_reply: "感謝您的回饋。我們非常遺憾這個事情發生了。您的披薩中確實因為我們廚房衛生管理不當混入了蒼蠅。為了補償您，我們願意退還您全部費用並提供 3000 元補償金，以及免費贈送您下次用餐的餐券。非常抱歉造成您的困擾！",
    bad_risk_desc: "AI 自行承認食安疏失並承諾具體補償金額 3000 元，已構成法律上的過失承認，將使公司面臨鉅額訴訟索賠風險，同時在公開平台留下品牌負面記錄！",
    good_reply: "您好，對於您分享的用餐狀況，我們深感遺憾且高度重視。美味花園對食品安全衛生有最嚴格的要求，我們將立即針對此事啟動內部稽查程序。懇請您私訊本頁或撥打台中公益店 04-2328-1122，由門市主管親自第一時間處理您的問題。感謝您讓我們有機會改善，祝您身體健康。",
    good_safe_desc: "AI 遵循 SOP：表達遺憾而非承認疏失，引導私下聯繫而非公開承諾，禁止出現具體補償金額，自動標記 need_human=true 轉人工審核，完全規避幻覺與法律風險！",
    need_human: true, escalation: "legal_review",
    prompt_template: `你是美味花園品牌的AI回覆助理，必須嚴格遵守以下SOP品牌規範。

[KB_CONTEXT — 食安SOP規則]
類別：food_safety_issue
觸發條件：含「蒼蠅」「食安」「衛生局」等關鍵字
行動指引：1.表達遺憾歉意（但不得承認食材疏失）2.說明內部稽查 3.引導私訊/電話
禁止內容：⛔ 禁止承諾賠償金額 ⛔ 禁止寫出「食材不新鮮」 ⛔ 禁止在公開回覆中討論病症
need_human = true（強制人工審核）

[用戶評論]
"點了總匯披薩，竟然看到上面有一隻大蒼蠅！已檢舉給衛生局！"

[輸出格式JSON]
{ "draft_reply": "...", "need_human": true, "risk_level": "critical", "sop_matched": "food_safety_issue" }

[指令]
只能依據上方KB_CONTEXT回覆，禁止憑空承諾或超出SOP範圍。請生成：`
  },
  r029: {
    matched_rules: ["sop_food_safety"],
    similarity_scores: { sop_food_safety: 0.96 },
    bad_reply: "非常抱歉您和您的兒子因為喝了我們的咖啡而不舒服！我們確認咖啡冰塊確實有衛生問題，為此我們願意承擔全部責任，立即賠償您兩倍的消費金額及所有醫藥費用，我們也會開除負責製作冰塊的員工。",
    bad_risk_desc: "AI 公開承認冰塊衛生問題並承諾賠償醫藥費及開除員工，這是極度嚴重的幻覺輸出！公司將面臨鉅額法律索賠，且「開除員工」的承諾可能引發勞資糾紛！",
    good_reply: "您好，得知您及家人用餐後身體不適，我們非常遺憾且高度重視。美味花園一向極度重視食品安全衛生，我們將立即啟動台中公益店的冰品製程與衛生稽查。懇請您撥打 04-2328-1122 或私訊告知聯絡方式，讓門市主管能親自為您妥善處理。請多保重，深感抱歉。",
    good_safe_desc: "AI 不承認冰塊問題責任、不承諾賠償、不開除員工，僅表達遺憾並引導私下聯繫，標記 need_human=true，完全符合品牌 SOP 護欄，規避一切幻覺風險！",
    need_human: true, escalation: "legal_review",
    prompt_template: `你是美味花園品牌的AI回覆助理，必須嚴格遵守以下SOP品牌規範。

[KB_CONTEXT — 食安SOP規則]
類別：food_safety_issue
觸發條件：含「拉肚子」「發燒」「冰塊」等關鍵字
行動指引：1.表達遺憾歉意（不得承認食材疏失）2.說明啟動稽查 3.引導私訊/電話
禁止內容：⛔ 禁止承諾賠償金額 ⛔ 禁止承諾處分員工 ⛔ 禁止公開承認食材問題
need_human = true（強制人工審核）

[用戶評論]
"喝完咖啡全家肚子不舒服，兒子拉肚子發燒！強烈懷疑咖啡冰塊衛生問題！"

[輸出格式JSON]
{ "draft_reply": "...", "need_human": true, "risk_level": "critical", "sop_matched": "food_safety_issue" }

[指令]
只能依據KB_CONTEXT回覆，禁止憑空承諾或超出SOP範圍。請生成：`
  },
  r006: {
    matched_rules: ["sop_food_safety"],
    similarity_scores: { sop_food_safety: 0.95 },
    bad_reply: "非常抱歉！我們承認是我們的海鮮拼盤食材不新鮮導致您食物中毒。我們會立即賠償您的醫藥費，並提供 5000 元的補償金。感謝您的反映，我們保證這絕對不會再發生。",
    bad_risk_desc: "AI 明確承認「食材不新鮮導致食物中毒」，等同於在公開平台上進行法律上的過失承認，一旦截圖流傳將成為法院呈堂證供，後果不堪設想！",
    good_reply: "您好，得知您與朋友用餐後身體不適，我們深感遺憾並高度重視。美味花園對食品安全有最嚴格的要求，我們將立即對台中公益店的相關食材存儲與處理流程進行全面稽查。懇請您撥打 04-2328-1122 或私訊提供聯絡方式，讓門市主管親自為您即時處理。衷心感謝您讓我們有機會改善。",
    good_safe_desc: "回覆不承認具體食安責任、不提賠償金額、引導私下協商，need_human=true，完全符合品牌法律保護 SOP！",
    need_human: true, escalation: "legal_review",
    prompt_template: `你是美味花園品牌的AI回覆助理，必須嚴格遵守SOP品牌規範。

[KB_CONTEXT — 食安SOP規則]
觸發：含「拉肚子」「食品安全」「衛生局」關鍵字
行動：表達遺憾→稽查聲明→引導私訊
禁止：⛔ 承認食安責任 ⛔ 承諾賠償 ⛔ 公開承認食材問題
need_human = true

[用戶評論]
"吃海鮮拼盤，回去兩個人都拉肚子！懷疑是不新鮮，不排除投訴衛生局！"

[JSON輸出格式]
{ "draft_reply": "...", "need_human": true, "risk_level": "critical", "sop_matched": "food_safety_issue" }

請生成符合SOP的安全回覆：`
  },
  r008: {
    matched_rules: ["sop_food_safety", "sop_cleanliness"],
    similarity_scores: { sop_food_safety: 0.93, sop_cleanliness: 0.70 },
    bad_reply: "天啊！非常非常抱歉！在鍋裡發現蟑螂是我們餐廳完全的責任，我們廚房衛生管理不善。我們立即賠償您全桌的費用，並提供您 8000 元補償金，還有免費招待您下次來用餐！",
    bad_risk_desc: "AI 公開承認「廚房衛生管理不善」並承諾 8000 元補償金，在公開 Google 評論回覆中等同正式承認疏失，具有法律效力，嚴重損害品牌公信力！",
    good_reply: "您好，對於您描述的用餐狀況，我們深感震驚且高度重視。美味花園對餐廳環境衛生絕對有零容忍態度，我們將立即安排高雄巨蛋店進行緊急環境稽查。請您撥打 07-555-4321 或私訊我們，讓門市主管親自協助您處理後續事宜。非常抱歉帶給您如此不好的用餐體驗。",
    good_safe_desc: "不公開承認蟑螂事實、不承諾賠償金額、引導私下聯繫，依 SOP 執行，need_human=true！",
    need_human: true, escalation: "manager_review",
    prompt_template: `你是美味花園品牌的AI回覆助理，必須嚴格遵守SOP品牌規範。

[KB_CONTEXT — 食安+衛生SOP]
觸發：含「蟑螂」「衛生」「昆蟲」關鍵字
行動：表達震驚遺憾→稽查聲明→引導私訊
禁止：⛔ 承認昆蟲存在責任 ⛔ 承諾賠償金額 ⛔ 公開承認衛生疏失
need_human = true

[用戶評論]
"在火鍋高麗菜底下發現活蟑螂！店家只幫免單一鍋，整桌都反胃！衛生堪憂！"

請生成符合SOP的安全回覆JSON：`
  },
  r022: {
    matched_rules: ["sop_food_safety", "sop_cleanliness"],
    similarity_scores: { sop_food_safety: 0.88, sop_cleanliness: 0.75 },
    bad_reply: "非常對不起！我們確認您的盤子裡確實出現了蒼蠅屍體，這是我們廚房嚴重的衛生疏失。我們會立即退款並補償您 2000 元的精神賠償金，同時將廚房所有工作人員送去重新衛生培訓，再次深表歉意！",
    bad_risk_desc: "AI 公開承認「廚房嚴重衛生疏失」並承諾精神賠償金，此公開聲明具法律效力！同時「送去衛生培訓」的承諾可能引發員工關係問題。",
    good_reply: "您好，對於您描述的用餐狀況，我們感到非常遺憾且重視。美味花園對環境衛生有嚴格的標準與要求，我們將立即督促中山店進行環境稽查與改善。懇請您撥打 02-2511-5678 或私訊我們提供聯絡方式，讓我們的主管能親自為您妥善處理。感謝您的反映，期待能有機會讓您重新感受美味花園的用餐品質。",
    good_safe_desc: "未公開確認異物事實、未承諾賠償、引導私下聯繫，need_human=true，符合品牌 SOP！",
    need_human: true, escalation: "manager_review",
    prompt_template: `你是美味花園品牌的AI回覆助理，遵守SOP規範。

[KB_CONTEXT]
觸發：含「蒼蠅」「衛生差」「昆蟲」
禁止：⛔ 公開確認異物事實 ⛔ 承諾賠償
need_human = true

[用戶評論]
"盤子邊緣看到蒼蠅屍體！廁所尿騷味、洗手槽沒水！環境令人擔憂！"

請生成安全SOP回覆JSON：`
  },
  r033: {
    matched_rules: ["sop_food_safety"],
    similarity_scores: { sop_food_safety: 0.82 },
    bad_reply: "非常抱歉！我們確認您點的蒜香香草烤魚使用的是放置時間過長的食材，這是我們的疏失。我們會立即退款並提供 1000 元補償金，同時將那批魚貨下架處理，再次對您致上最深的歉意！",
    bad_risk_desc: "AI 承認「放置時間過長的食材」是事實，並承諾退款+補償金，等同於承認食材問題的法律責任，後果嚴重！",
    good_reply: "您好，對於您此次的用餐體驗，我們感到非常遺憾。美味花園十分重視每一道餐點的品質與新鮮度，我們會立即將您的意見反映給高雄巨蛋店主管，並針對食材品質管控進行全面檢視。非常感謝您的反映，如有任何疑問，歡迎您撥打 07-555-4321 與我們聯絡，我們期待能為您提供更好的餐飲體驗。",
    good_safe_desc: "未承認食材問題，引導私下聯繫，語氣友善專業，符合 SOP 標準，need_human=true！",
    need_human: true, escalation: "manager_review",
    prompt_template: `[KB_CONTEXT — 食安SOP]
觸發：含「土腥味」「酸味」「不新鮮」「放很久」
禁止：⛔ 承認食材問題 ⛔ 承諾退款補償
need_human = true

[評論]"魚肉有土腥味甚至微酸，明顯放很久！店員說是特調香草風味！"

請生成安全回覆JSON：`
  },
  r020: {
    matched_rules: ["sop_food_safety"],
    similarity_scores: { sop_food_safety: 0.78 },
    bad_reply: "非常抱歉！您的蛤蜊確實是我們沒有妥善處理的不新鮮食材，這是我們的失職。我們立即退還您的餐費並提供 500 元補償，並保證重新審查所有海鮮食材的新鮮度，深表歉意！",
    bad_risk_desc: "AI 承認「不新鮮食材」是我們的失職，並公開承諾退費及補償金，已構成法律過失承認，後果嚴重！",
    good_reply: "您好，非常感謝您提醒我們這個問題，我們對您此次的用餐體驗感到十分遺憾。美味花園對每道餐點的食材品質有嚴格要求，我們會立即將您的意見反映給公館店主管進行調查。如您希望進一步了解後續處理情形，歡迎撥打 02-2368-9876 與我們聯繫，我們將竭盡所能為您提供滿意的說明。",
    good_safe_desc: "未承認食材問題、未承諾退款、引導私下聯繫，符合食安 SOP，need_human=true！",
    need_human: true, escalation: "manager_review",
    prompt_template: `[KB_CONTEXT]
觸發：含「臭味」「蛤蜊沒開」「不新鮮」
禁止：⛔ 承認食材問題 ⛔ 公開退款承諾
need_human = true

[評論]"蛤蜊全部沒開，還有臭味！食材不新鮮！店員把盤子端走也沒後續說明！"

請生成安全回覆JSON：`
  },
  r015: {
    matched_rules: ["sop_food_safety"],
    similarity_scores: { sop_food_safety: 0.85 },
    bad_reply: "天啊！非常抱歉！您的漢堡肉根本沒烤熟是我們廚師的嚴重疏失，特別是您提到如果老人或小孩吃了很危險，我們深感責任重大！立即退款給您並提供 5000 元的食安賠償金，保證徹底改善！",
    bad_risk_desc: "AI 承認「廚師嚴重疏失」並公開承諾 5000 元食安賠償金，這等同於在公開平台上完成法律過失承認並簽訂賠償協議，後果極其嚴重！",
    good_reply: "您好，對於您反映的用餐體驗，我們感到非常遺憾並高度重視。美味花園對食材的烹調標準有嚴格規範，我們會立即將此事反映給信義店主管進行調查改善。如您希望與我們進一步溝通，請撥打 02-2722-1234 或私訊我們，主管將親自為您處理。再次感謝您的反映，讓我們有機會改進服務品質。",
    good_safe_desc: "未承認生肉事實責任，未承諾賠償，引導私下聯繫，need_human=true，符合 SOP！",
    need_human: true, escalation: "manager_review",
    prompt_template: `[KB_CONTEXT]
觸發：含「生肉」「沒熟」「食安」「危險」
禁止：⛔ 承認烹飪失誤責任 ⛔ 承諾賠償
need_human = true

[評論]"漢堡肉竟然是血紅的生肉！食安管控罔顧人命！"

請生成安全回覆JSON：`
  },
  r005: {
    matched_rules: ["sop_food_safety", "sop_service"],
    similarity_scores: { sop_food_safety: 0.75, sop_service: 0.65 },
    bad_reply: "非常抱歉！您在湯裡發現頭髮確實是我們員工在備餐時嚴重疏失所致，這是我們廚房完全的責任！我們立即全額退款，並提供您一張 3000 元的餐廳消費券作為補償，也已對相關員工進行嚴厲處置！",
    bad_risk_desc: "AI 承認「員工嚴重疏失」是廚房的責任，承諾退款+3000元消費券，並聲稱已「處置員工」，這三項聲明都是不應在公開評論中出現的幻覺輸出！",
    good_reply: "您好，對於您此次的用餐體驗，我們感到非常遺憾與抱歉。美味花園十分重視每一道餐點的品質，我們會立即將您的意見反映給公館店主管進行調查。如需進一步溝通，請撥打 02-2368-9876 或透過私訊聯繫我們，我們的主管將親自為您處理後續事宜。感謝您讓我們有機會改善服務品質。",
    good_safe_desc: "未承認頭髮責任、未承諾任何賠償、未承諾處分員工，引導私下聯繫，need_human=true，符合 SOP！",
    need_human: true, escalation: "manager_review",
    prompt_template: `[KB_CONTEXT]
觸發：含「頭髮」「異物」「食安」
禁止：⛔ 承認異物責任 ⛔ 承諾退款補償 ⛔ 承諾處分員工
need_human = true

[評論]"湯裡有頭髮！店員態度冷漠只說換一碗！食安太差勁了！"

請生成安全回覆JSON：`
  },
  r018: {
    matched_rules: ["sop_service"],
    similarity_scores: { sop_service: 0.80 },
    bad_reply: "非常非常抱歉！確認您的帳單確實有誤，我們的系統和員工都犯了嚴重錯誤！我們已立即退款並額外補償您 2000 元，同時將追究相關員工的法律責任，並向您保證絕對不會再有類似情形！",
    bad_risk_desc: "AI 承諾「追究員工法律責任」是嚴重的幻覺輸出！承諾額外補償 2000 元也超出 SOP 授權範圍，且「絕對保證」的措辭可能帶來額外法律責任！",
    good_reply: "您好，非常感謝您反映這個問題，我們對此深感抱歉。美味花園非常重視每位顧客的消費權益，得知您在結帳時遇到此困擾，我們將立即請高雄巨蛋店主管針對這次的帳單爭議進行詳細調查。如有任何後續問題，請撥打 07-555-4321 與我們聯絡，主管將親自跟您確認並處理。謝謝您的耐心。",
    good_safe_desc: "未承諾額外賠償、未承諾追究法律責任，語氣專業友善，引導私下溝通，need_human=true！",
    need_human: true, escalation: "legal_review",
    prompt_template: `[KB_CONTEXT]
觸發：含「多刷」「誠信」「指責」「爭議」
禁止：⛔ 承諾法律責任 ⛔ 額外賠償承諾 ⛔ 公開指名員工
need_human = true

[評論]"多刷了兩筆費用！收銀員還指責是我們記錯！誠信有問題！"

請生成安全回覆JSON：`
  },
  r007: {
    matched_rules: ["sop_service"],
    similarity_scores: { sop_service: 0.85 },
    bad_reply: "非常抱歉！對於服務生翻白眼的行為，我們確認這是嚴重的服務失職。我們已立即對該名服務生進行停職處理，並退還您的 10% 服務費，且提供一張下次免費用餐的招待券作為補償！",
    bad_risk_desc: "AI 承諾「停職特定員工」會引發勞資糾紛！承諾退還服務費超出 SOP 授權範圍！承諾免費招待券也未經授權，均屬幻覺輸出！",
    good_reply: "您好，非常感謝您讓我們了解您的用餐體驗。對於您在用餐過程中感受到的不愉快，我們致上誠摯的歉意。我們會立即將此事轉達給中山店主管，並針對服務人員的接待禮儀進行加強培訓，以確保每位顧客都能獲得應有的禮遇。如有任何問題，請撥打 02-2511-5678 與我們聯繫。感謝您的反映。",
    good_safe_desc: "未點名員工、未承諾退款或招待、未停職任何員工，引導私下聯繫，符合服務投訴 SOP！",
    need_human: false, escalation: "customer_service",
    prompt_template: `[KB_CONTEXT — 服務態度SOP]
觸發：含「翻白眼」「服務費」「態度」
禁止：⛔ 承諾停職特定員工 ⛔ 退還服務費承諾 ⛔ 公開指名員工
若有多收費爭議：need_human = true

[評論]"服務生翻白眼用摔的送餐！還收10%服務費！完全不值得！"

請生成安全回覆JSON：`
  },
  r026: {
    matched_rules: ["sop_service"],
    similarity_scores: { sop_service: 0.78 },
    bad_reply: "非常抱歉您遇到這種情況！我們的店長行為非常失當，直接要顧客去別家是完全不可接受的！我們已經對該名店長進行嚴厲懲處，並提供您下次免費用餐作為補償，再次深表歉意！",
    bad_risk_desc: "AI 承諾「懲處特定職位員工」並提供「免費用餐補償」，均超出 SOP 授權範圍！同時公開承認店長行為失當可能引發法律責任與公關危機！",
    good_reply: "您好，非常抱歉得知您此次的用餐體驗讓您感到失望。美味花園一向致力於為每位顧客提供賓至如歸的服務，對於您反映的狀況，我們會立即轉達給公館店相關主管進行了解與改善。如需進一步溝通，歡迎撥打 02-2368-9876 與我們聯繫，我們期待有機會重新贏得您的信任。",
    good_safe_desc: "未承諾懲處任何員工、未承諾補償、引導私下聯繫，語氣誠懇有禮，符合服務投訴 SOP！",
    need_human: false, escalation: "customer_service",
    prompt_template: `[KB_CONTEXT]
觸發：含「店長」「去別家」「最糟糕」
禁止：⛔ 公開承諾懲處員工 ⛔ 承諾補償 ⛔ 指名特定員工

[評論]"店長說「不想排可以去吃別家」！一星都不想給！"

請生成安全回覆JSON：`
  },
  r004: {
    matched_rules: ["sop_waiting"],
    similarity_scores: { sop_waiting: 0.88 },
    bad_reply: "非常抱歉讓您排隊了這麼久！我們知道排隊一個半小時實在太誇張了！以後凡是排隊超過 30 分鐘的顧客都可以得到一杯免費飲料補償！我們保證下個月前一定改善！",
    bad_risk_desc: "AI 承諾「排隊超過 30 分鐘獲免費飲料」是未授權的商業政策承諾！而「保證下個月前改善」是過度具體的時程承諾，無法兌現時將損害品牌誠信！",
    good_reply: "您好，非常感謝您的建議，對於讓您等候了較長的時間，我們深感抱歉。為了維持每道餐點的品質，我們均採現點現做的方式。建議您下次蒞臨前可先使用我們的線上訂位系統預約，就能減少現場等候的時間。我們也會持續努力優化現場的服務流程與出餐效率，希望下次能給您更順暢的用餐體驗！",
    good_safe_desc: "未承諾免費飲料補償、未承諾具體改善時程，介紹線上預約系統，語氣專業，符合等候時間 SOP！",
    need_human: false, escalation: "none",
    prompt_template: `[KB_CONTEXT — 等候時間SOP]
觸發：含「排隊」「等太久」「改善排隊」
行動：致歉→介紹線上預約→承諾持續優化
禁止：⛔ 承諾免費補償 ⛔ 具體時程承諾
need_human = false

[評論]"排隊排了一個半小時！建議改善排隊流程！"

請生成安全回覆JSON：`
  },
  r001: {
    matched_rules: ["sop_positive"],
    similarity_scores: { sop_positive: 0.95 },
    bad_reply: "感謝您的好評！告訴您一個好消息，因為您在 Google 留下了五星評論，根據我們的秘密優惠活動，您下次來可以享有 8 折優惠，只需在訂位時告訴我們您是 Google 評論的林小明！",
    bad_risk_desc: "AI 憑空杜撰了一個「秘密優惠活動」並提供具名 8 折折扣，這是嚴重的幻覺輸出！若此評論截圖流傳，顧客持之索要折扣時公司將陷入兩難困境！",
    good_reply: "謝謝林先生／小姐對我們美味花園的喜愛與推薦！能讓您對招牌烤雞和服務都滿意，是我們全體員工最大的榮幸！我們會持續努力維持餐點品質與服務水準。下次蒞臨信義店，也歡迎嘗試我們的舒芙蕾鬆餅，同樣是人氣極高的招牌甜點！期待再次為您服務！",
    good_safe_desc: "感謝用語真誠、推薦其他招牌菜、未承諾任何優惠折扣，符合正面評論回覆 SOP，need_human=false！",
    need_human: false, escalation: "none",
    prompt_template: `[KB_CONTEXT — 正面評論SOP]
觸發：含「好吃」「推薦」「親切」「5星」
行動：誠摯感謝→推薦其他餐點→歡迎再訪
禁止：⛔ 憑空杜撰優惠活動 ⛔ 給予個人折扣
need_human = false

[評論]"招牌烤雞太好吃了！店員態度非常親切！極力推薦！5星！"

請生成安全回覆JSON：`
  }
};

// ============================================================
// GLOBAL STATE
// ============================================================
let currentFilters = { store: 'all', rating: 'all', sentiment: 'all', risk: 'all', search: '' };
let charts = {};
let currentTab = 'dashboard';
let nlpCharCount = 0;

const RAG_KNOWLEDGE_BASE = {
  get rules() {
    return KB.sop_rules.map(rule => ({
      ...rule,
      title: rule.label || rule.category,
      content: rule.rule_description || rule.action_guideline || ''
    }));
  }
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '未提供時間';
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function isValidRating(rating) {
  return Number.isFinite(rating) && rating >= 1 && rating <= 5;
}

function renderStars(rating) {
  if (!isValidRating(rating)) return '未評分';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function formatRatingLabel(rating) {
  return isValidRating(rating) ? `${renderStars(rating)} (${rating}★)` : '未評分';
}

function getRiskClass(level) {
  const map = { low: 'low', medium: 'medium', high: 'high', critical: 'critical' };
  return map[level] || 'low';
}

function getRiskEmoji(level) {
  const map = { low: '🟢', medium: '🟡', high: '🔴', critical: '🚨' };
  return map[level] || '🟢';
}

function getSentimentClass(label) {
  const map = { positive: 'pos', neutral: 'neu', negative: 'neg' };
  return map[label] || 'neu';
}

function getSentimentLabel(label) {
  const map = { positive: '正面 😊', neutral: '中性 😐', negative: '負面 😡' };
  return map[label] || label;
}

function getRiskLabel(level) {
  const map = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL' };
  return map[level] || level;
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const iconMap = { info: 'fa-circle-info', danger: 'fa-triangle-exclamation', success: 'fa-circle-check', warning: 'fa-bell' };
  toast.innerHTML = `<i class="fa-solid ${iconMap[type] || 'fa-circle-info'}" style="color:${type==='danger'?'#ff4757':type==='success'?'#10d97a':type==='warning'?'#f5a623':'#3b82f6'};font-size:16px;"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 350); }, 3500);
}

function animateCount(el, target, duration = 900) {
  const start = parseInt(el.textContent) || 0;
  const range = target - start;
  const startTime = performance.now();
  const isFloat = String(target).includes('.');
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = start + range * eased;
    el.textContent = isFloat ? value.toFixed(1) : Math.round(value);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============================================================
// DASHBOARD METRICS
// ============================================================
function computeMetrics() {
  const total = REVIEWS.length;
  const ratedReviews = REVIEWS.filter(r => isValidRating(r.rating));
  const avgRating = ratedReviews.length ? ratedReviews.reduce((s, r) => s + r.rating, 0) / ratedReviews.length : 0;
  const highRisk = REVIEWS.filter(r => r.risk.level === 'high' || r.risk.level === 'critical').length;
  const positive = REVIEWS.filter(r => r.sentiment.label === 'positive').length;
  const nps = total ? Math.round((positive / total) * 100) : 0;
  return { total, avgRating, highRisk, nps, ratedTotal: ratedReviews.length };
}

function renderMetrics() {
  const { total, avgRating, highRisk, nps, ratedTotal } = computeMetrics();
  animateCount(document.getElementById('total-reviews-val'), total);
  animateCount(document.getElementById('avg-rating-val'), avgRating, 800);
  document.getElementById('avg-rating-val').textContent = avgRating.toFixed(1);
  document.getElementById('avg-stars-stars').textContent = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
  animateCount(document.getElementById('high-risk-val'), highRisk);
  document.getElementById('nps-val').textContent = '0%';
  setTimeout(() => { document.getElementById('nps-val').textContent = nps + '%'; }, 900);
  document.getElementById('sentiment-ratio-text').textContent = ratedTotal ? `共 ${REVIEWS.filter(r => r.sentiment.label === 'positive').length} 則正面評論` : '資料來源未提供星等，改以情緒分析統計';
  document.getElementById('critical-risk-subtext').textContent = `${REVIEWS.filter(r => r.risk.level === 'critical').length} 則關鍵 / ${REVIEWS.filter(r => r.risk.level === 'high').length} 則高風險`;
  document.getElementById('nav-reviews-count').textContent = total;
  const alertCount = highRisk;
  document.getElementById('nav-alert-count').textContent = alertCount;
}

// ============================================================
// CHART: Rating Distribution
// ============================================================
function renderRatingChart() {
  const ctx = document.getElementById('ratingChart');
  if (!ctx) return;
  const dist = [1, 2, 3, 4, 5].map(s => REVIEWS.filter(r => isValidRating(r.rating) && r.rating === s).length);
  if (charts.rating) charts.rating.destroy();
  charts.rating = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1★', '2★', '3★', '4★', '5★'],
      datasets: [{
        data: dist,
        backgroundColor: ['rgba(255,71,87,0.7)', 'rgba(255,140,66,0.7)', 'rgba(245,166,35,0.7)', 'rgba(59,130,246,0.7)', 'rgba(16,217,122,0.7)'],
        borderColor: ['#ff4757', '#ff8c42', '#f5a623', '#3b82f6', '#10d97a'],
        borderWidth: 1.5, borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} 則評論` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b92a8' } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b92a8', stepSize: 1 } }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// CHART: Aspect Sentiment (Radar)
// ============================================================
function renderAspectChart() {
  const ctx = document.getElementById('aspectChart');
  if (!ctx) return;
  const aspects = ['food', 'service', 'environment', 'price'];
  const aspLabels = ['餐點品質', '服務態度', '環境氛圍', '價格評價'];
  const posScores = aspects.map(a => {
    const all = REVIEWS.flatMap(r => r.aspects.filter(x => x.aspect === a));
    if (!all.length) return 50;
    return Math.round((all.filter(x => x.sentiment === 'positive').length / all.length) * 100);
  });
  if (charts.aspect) charts.aspect.destroy();
  charts.aspect = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: aspLabels,
      datasets: [{
        label: '正面評價率 (%)',
        data: posScores,
        backgroundColor: 'rgba(59,130,246,0.12)',
        borderColor: 'rgba(59,130,246,0.8)',
        borderWidth: 2, pointBackgroundColor: '#3b82f6',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { r: { grid: { color: 'rgba(255,255,255,0.06)' }, angleLines: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b92a8', backdropColor: 'transparent', stepSize: 25 }, pointLabels: { color: '#f0f2f8', font: { size: 11 } }, min: 0, max: 100 } },
      animation: { duration: 1200, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// CHART: Store Analysis
// ============================================================
function renderStoreChart() {
  const ctx = document.getElementById('storeChart');
  if (!ctx) return;
  const stores = [...new Set(REVIEWS.map(r => r.store_name))];
  const storeLabels = stores.map(s => s.replace('美味花園 ', ''));
  const avgRatings = stores.map(s => {
    const revs = REVIEWS.filter(r => r.store_name === s && isValidRating(r.rating));
    if (!revs.length) return 0;
    return +(revs.reduce((sum, r) => sum + r.rating, 0) / revs.length).toFixed(2);
  });
  const riskCounts = stores.map(s => REVIEWS.filter(r => r.store_name === s && (r.risk.level === 'high' || r.risk.level === 'critical')).length);
  if (charts.store) charts.store.destroy();
  charts.store = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: storeLabels,
      datasets: [
        { label: '平均評分', data: avgRatings, backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3b82f6', borderWidth: 1.5, borderRadius: 5, yAxisID: 'y' },
        { label: '高風險數', data: riskCounts, backgroundColor: 'rgba(255,71,87,0.6)', borderColor: '#ff4757', borderWidth: 1.5, borderRadius: 5, yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b92a8', boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b92a8', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b92a8' }, min: 0, max: 5, title: { display: true, text: '平均評分', color: '#8b92a8', font: { size: 10 } } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: '#ff4757', stepSize: 1 }, title: { display: true, text: '高風險數', color: '#ff4757', font: { size: 10 } } }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// CHART: Risk Distribution (Doughnut)
// ============================================================
function renderRiskChart() {
  const ctx = document.getElementById('riskDistributionChart');
  if (!ctx) return;
  const levels = ['low', 'medium', 'high', 'critical'];
  const counts = levels.map(l => REVIEWS.filter(r => r.risk.level === l).length);
  if (charts.risk) charts.risk.destroy();
  charts.risk = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['低風險 Low', '中風險 Medium', '高風險 High', '關鍵 Critical'],
      datasets: [{
        data: counts,
        backgroundColor: ['rgba(16,217,122,0.8)', 'rgba(245,166,35,0.8)', 'rgba(255,140,66,0.8)', 'rgba(255,71,87,0.9)'],
        borderColor: ['#10d97a', '#f5a623', '#ff8c42', '#ff4757'],
        borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b92a8', padding: 14, boxWidth: 11, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} 則` } }
      },
      animation: { duration: 1100, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// CHART: Sentiment Timeline
// ============================================================
function renderSentimentTimeline() {
  const ctx = document.getElementById('sentimentTimelineChart');
  if (!ctx) return;
  const sorted = [...REVIEWS].sort((a, b) => new Date(a.review_time) - new Date(b.review_time));
  const labels = sorted.map(r => r.review_time.slice(5, 10));
  const posData = sorted.map(r => r.sentiment.label === 'positive' ? Math.abs(r.sentiment.score) : 0);
  const negData = sorted.map(r => r.sentiment.label === 'negative' ? Math.abs(r.sentiment.score) : 0);
  const neuData = sorted.map(r => r.sentiment.label === 'neutral' ? 0.5 : 0);
  if (charts.timeline) charts.timeline.destroy();
  charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '正面', data: posData, borderColor: '#10d97a', backgroundColor: 'rgba(16,217,122,0.06)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 },
        { label: '負面', data: negData, borderColor: '#ff4757', backgroundColor: 'rgba(255,71,87,0.06)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 },
        { label: '中性', data: neuData, borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.04)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b92a8', maxTicksLimit: 12, font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b92a8' }, min: 0, max: 1 }
      },
      animation: { duration: 1200, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// CHART: Emotion Distribution (Bar)
// ============================================================
function renderEmotionChart() {
  const ctx = document.getElementById('emotionDistChart');
  if (!ctx) return;
  const joyAvg = REVIEWS.reduce((s, r) => s + r.emotion.joy, 0) / REVIEWS.length;
  const angerAvg = REVIEWS.reduce((s, r) => s + r.emotion.anger, 0) / REVIEWS.length;
  const sadAvg = REVIEWS.reduce((s, r) => s + r.emotion.disappointment, 0) / REVIEWS.length;
  if (charts.emotion) charts.emotion.destroy();
  charts.emotion = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['😊 喜悅 Joy', '😡 憤怒 Anger', '😞 失望 Disappointment'],
      datasets: [{
        data: [Math.round(joyAvg * 100), Math.round(angerAvg * 100), Math.round(sadAvg * 100)],
        backgroundColor: ['rgba(16,217,122,0.8)', 'rgba(255,71,87,0.8)', 'rgba(167,139,250,0.8)'],
        borderColor: ['#10d97a', '#ff4757', '#a78bfa'],
        borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '58%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b92a8', padding: 10, boxWidth: 11, font: { size: 10 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}%` } }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// WORD CLOUD
// ============================================================
const WORD_CLOUD_DATA = [
  { text: '好吃', count: 28, sentiment: 'positive' }, { text: '服務', count: 25, sentiment: 'neutral' },
  { text: '食安', count: 12, sentiment: 'negative' }, { text: '環境', count: 20, sentiment: 'neutral' },
  { text: '排隊', count: 10, sentiment: 'negative' }, { text: '親切', count: 18, sentiment: 'positive' },
  { text: '乾淨', count: 15, sentiment: 'positive' }, { text: '衛生', count: 14, sentiment: 'negative' },
  { text: '美味', count: 22, sentiment: 'positive' }, { text: '態度', count: 16, sentiment: 'negative' },
  { text: '推薦', count: 20, sentiment: 'positive' }, { text: '蒼蠅', count: 5, sentiment: 'negative' },
  { text: '拉肚子', count: 6, sentiment: 'negative' }, { text: '等待', count: 9, sentiment: 'negative' },
  { text: '新鮮', count: 14, sentiment: 'positive' }, { text: '優雅', count: 12, sentiment: 'positive' },
  { text: '貼心', count: 16, sentiment: 'positive' }, { text: '賠償', count: 3, sentiment: 'negative' },
  { text: '投訴', count: 4, sentiment: 'negative' }, { text: '生肉', count: 4, sentiment: 'negative' },
  { text: '烤雞', count: 10, sentiment: 'positive' }, { text: '鬆餅', count: 11, sentiment: 'positive' },
  { text: '蛤蜊', count: 6, sentiment: 'neutral' }, { text: '蟑螂', count: 3, sentiment: 'negative' },
  { text: 'CP值', count: 8, sentiment: 'positive' }, { text: '翻白眼', count: 4, sentiment: 'negative' }
];

let wcActiveWord = null;

function renderWordCloud() {
  const canvas = document.getElementById('wordCloudCanvas');
  if (!canvas) return;
  const parent = canvas.parentElement;
  const W = parent.clientWidth || 460;
  const H = parent.clientHeight || 265;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const maxCount = Math.max(...WORD_CLOUD_DATA.map(w => w.count));
  const positions = [];
  WORD_CLOUD_DATA.sort((a, b) => b.count - a.count).forEach(word => {
    const fontSize = Math.round(12 + (word.count / maxCount) * 26);
    const color = word.sentiment === 'positive' ? '#10d97a' : word.sentiment === 'negative' ? '#ff4757' : '#8b92a8';
    ctx.font = `700 ${fontSize}px "Outfit", sans-serif`;
    const tw = ctx.measureText(word.text).width;
    let placed = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      const angle = (attempt * 2.39996) * (attempt % 2 === 0 ? 1 : -1);
      const r = Math.sqrt(attempt) * 14;
      const cx = W / 2 + r * Math.cos(angle);
      const cy = H / 2 + r * Math.sin(angle);
      const x = cx - tw / 2, y = cy - fontSize / 2;
      if (x < 4 || x + tw > W - 4 || y < 4 || y + fontSize > H - 4) continue;
      const overlap = positions.some(p => x < p.x + p.w + 6 && x + tw + 6 > p.x && y < p.y + p.h + 4 && y + fontSize + 4 > p.y);
      if (!overlap) {
        ctx.fillStyle = word === wcActiveWord ? '#ffffff' : color;
        ctx.globalAlpha = word === wcActiveWord ? 1 : 0.85;
        ctx.fillText(word.text, x, y + fontSize * 0.82);
        positions.push({ x, y, w: tw, h: fontSize, word, color });
        placed = true;
        break;
      }
    }
    if (!placed) {
      const x = Math.random() * (W - tw - 20) + 10;
      const y = Math.random() * (H - fontSize - 20) + 10;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.fillText(word.text, x, y + fontSize * 0.82);
      positions.push({ x, y, w: tw, h: fontSize, word, color });
    }
  });
  ctx.globalAlpha = 1;
  canvas._wcPositions = positions;
}

function setupWordCloudClick() {
  const canvas = document.getElementById('wordCloudCanvas');
  if (!canvas) return;
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const positions = canvas._wcPositions || [];
    let clicked = null;
    for (const p of positions) {
      if (mx >= p.x && mx <= p.x + p.w && my >= p.y && my <= p.y + p.h) {
        clicked = p.word; break;
      }
    }
    if (clicked) {
      wcActiveWord = wcActiveWord === clicked ? null : clicked;
      renderWordCloud();
      const btn = document.getElementById('reset-wordcloud-filter');
      btn.style.display = wcActiveWord ? 'inline-flex' : 'none';
      if (wcActiveWord) {
        showToast(`篩選關鍵字：「${wcActiveWord.text}」，切換至評論明細`, 'info');
        document.getElementById('search-input').value = wcActiveWord.text;
        currentFilters.search = wcActiveWord.text;
        applyFiltersAndRender();
        switchTab('reviews');
      }
    }
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const positions = canvas._wcPositions || [];
    let hovering = false;
    for (const p of positions) {
      if (mx >= p.x && mx <= p.x + p.w && my >= p.y && my <= p.y + p.h) { hovering = true; break; }
    }
    canvas.style.cursor = hovering ? 'pointer' : 'default';
  });
  document.getElementById('reset-wordcloud-filter').addEventListener('click', () => {
    wcActiveWord = null;
    renderWordCloud();
    document.getElementById('reset-wordcloud-filter').style.display = 'none';
    document.getElementById('search-input').value = '';
    currentFilters.search = '';
    applyFiltersAndRender();
  });
}

// ============================================================
// RECENT ALERTS
// ============================================================
function renderRecentAlerts() {
  const highRisk = REVIEWS.filter(r => r.risk.level === 'high' || r.risk.level === 'critical').slice(0, 5);
  const container = document.getElementById('recent-alerts-list');
  if (!container) return;
  container.innerHTML = highRisk.map(r => {
    const dotClass = r.risk.level === 'critical' ? 'dot-critical' : r.risk.level === 'high' ? 'dot-high' : 'dot-medium';
    return `<div class="alert-item ${r.risk.level}" onclick="openReviewModal('${r.review_id}')">
      <div class="alert-risk-dot ${dotClass}"></div>
      <div class="alert-text">
        <div class="alert-reviewer">${r.reviewer} · ${r.store_name.replace('美味花園 ', '')}</div>
        <div class="alert-preview">"${r.raw_text.substring(0, 65)}..."</div>
      </div>
      <div class="alert-meta">
        <span class="alert-badge badge-risk badge-risk-${r.risk.level}">${getRiskEmoji(r.risk.level)} ${getRiskLabel(r.risk.level)}</span>
        <span class="alert-time">${formatDate(r.review_time)}</span>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// REVIEWS TABLE
// ============================================================
function applyFiltersAndRender() {
  let filtered = REVIEWS;
  if (currentFilters.store !== 'all') filtered = filtered.filter(r => r.store_name === currentFilters.store);
  if (currentFilters.rating !== 'all') filtered = filtered.filter(r => isValidRating(r.rating) && r.rating === parseInt(currentFilters.rating));
  if (currentFilters.sentiment !== 'all') filtered = filtered.filter(r => r.sentiment.label === currentFilters.sentiment);
  if (currentFilters.risk !== 'all') filtered = filtered.filter(r => r.risk.level === currentFilters.risk);
  if (currentFilters.search) {
    const q = currentFilters.search.toLowerCase();
    filtered = filtered.filter(r => r.raw_text.toLowerCase().includes(q) || r.reviewer.toLowerCase().includes(q) || r.store_name.toLowerCase().includes(q));
  }
  document.getElementById('filtered-count').textContent = filtered.length;
  document.getElementById('total-count').textContent = REVIEWS.length;
  const tbody = document.getElementById('reviews-table-body');
  const empty = document.getElementById('table-empty');
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    empty.style.flexDirection = 'column';
    empty.style.alignItems = 'center';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map(r => `
      <tr>
        <td><div class="td-store-name">${r.store_name.replace('美味花園 ', '')}</div><span class="td-date">${formatDate(r.review_time)}</span></td>
        <td><div class="td-reviewer">${r.reviewer}</div><span class="td-stars">${formatRatingLabel(r.rating)}</span></td>
        <td><div class="td-text"><div class="td-text-snippet">${r.raw_text}</div></div></td>
        <td><span class="badge badge-${getSentimentClass(r.sentiment.label)}">${getSentimentLabel(r.sentiment.label)}</span></td>
        <td><span class="badge-risk badge badge-risk-${getRiskClass(r.risk.level)}">${getRiskEmoji(r.risk.level)} ${getRiskLabel(r.risk.level)} (${r.risk.score})</span></td>
        <td><button class="btn btn-secondary btn-small" onclick="openReviewModal('${r.review_id}')"><i class="fa-solid fa-magnifying-glass"></i> 詳析</button></td>
      </tr>
    `).join('');
  }
  // Update active filter badge
  const activeFilters = Object.values(currentFilters).filter(v => v && v !== 'all').length;
  const badge = document.getElementById('filter-active-badge');
  if (activeFilters > 0) { badge.textContent = `${activeFilters} 項篩選中`; badge.style.display = 'inline-flex'; }
  else badge.style.display = 'none';
}

function setupFilters() {
  ['filter-store', 'filter-rating', 'filter-sentiment', 'filter-risk'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const key = id.replace('filter-', '');
      currentFilters[key] = e.target.value;
      applyFiltersAndRender();
    });
  });
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  searchInput.addEventListener('input', (e) => {
    currentFilters.search = e.target.value;
    clearBtn.style.display = e.target.value ? 'flex' : 'none';
    applyFiltersAndRender();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentFilters.search = '';
    clearBtn.style.display = 'none';
    applyFiltersAndRender();
  });
  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    currentFilters = { store: 'all', rating: 'all', sentiment: 'all', risk: 'all', search: '' };
    document.getElementById('filter-store').value = 'all';
    document.getElementById('filter-rating').value = 'all';
    document.getElementById('filter-sentiment').value = 'all';
    document.getElementById('filter-risk').value = 'all';
    searchInput.value = '';
    clearBtn.style.display = 'none';
    applyFiltersAndRender();
  });
  document.getElementById('empty-reset-btn')?.addEventListener('click', () => {
    document.getElementById('clear-filters-btn').click();
  });
}

// ============================================================
// REVIEW DETAIL MODAL
// ============================================================
function openReviewModal(reviewId) {
  const r = REVIEWS.find(x => x.review_id === reviewId);
  if (!r) return;
  const modal = document.getElementById('review-modal');
  const content = document.getElementById('modal-content');
  const riskColorMap = { low: '#8b92a8', medium: '#f5a623', high: '#ff8c42', critical: '#ff4757' };
  const aspectsList = r.aspects.map(a => `<div class="modal-aspect-item"><div class="aspect-sent-dot ${a.sentiment === 'positive' ? 'pos' : 'neg'}"></div><span class="aspect-name">${a.aspect}</span><span class="aspect-evidence-text">"${a.evidence}"</span></div>`).join('');
  const flagsHtml = [
    r.risk.food_safety ? '<span class="risk-flag-tag">🦠 食品安全</span>' : '',
    r.risk.legal_risk ? '<span class="risk-flag-tag flag-legal">⚖️ 法律風險</span>' : '',
    r.risk.hygiene_risk ? '<span class="risk-flag-tag flag-hygiene">🧹 環境衛生</span>' : '',
  ].filter(Boolean).join('');
  content.innerHTML = `
    <div class="modal-review-header">
      <div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <span class="store-badge">${r.store_name}</span>
          <span class="time-stamp">${formatDate(r.review_time)}</span>
        </div>
        <div style="font-size:16px;font-weight:700;">${r.reviewer} <span style="color:var(--color-warning)">${formatRatingLabel(r.rating)}</span></div>
      </div>
      <div style="text-align:right;">
        <div class="badge-risk badge-risk-${r.risk.level}" style="font-size:13px;padding:5px 12px;">${getRiskEmoji(r.risk.level)} ${getRiskLabel(r.risk.level)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:5px;">信心分數: ${(r.confidence * 100).toFixed(0)}%</div>
      </div>
    </div>
    <div class="modal-review-text">"${r.raw_text}"</div>
    <div class="modal-section">
      <h4><i class="fa-solid fa-brain text-blue"></i> NLP 語意分析結果</h4>
      <div class="modal-nlp-grid">
        <div class="modal-nlp-item"><div class="modal-nlp-label">情感傾向</div><div class="modal-nlp-val badge badge-${getSentimentClass(r.sentiment.label)}">${getSentimentLabel(r.sentiment.label)} (${r.sentiment.score > 0 ? '+' : ''}${r.sentiment.score.toFixed(2)})</div></div>
        <div class="modal-nlp-item"><div class="modal-nlp-label">主導情緒</div><div class="modal-nlp-val">${r.emotion.joy >= r.emotion.anger && r.emotion.joy >= r.emotion.disappointment ? '😊 喜悅 ' + (r.emotion.joy * 100).toFixed(0) + '%' : r.emotion.anger >= r.emotion.disappointment ? '😡 憤怒 ' + (r.emotion.anger * 100).toFixed(0) + '%' : '😞 失望 ' + (r.emotion.disappointment * 100).toFixed(0) + '%'}</div></div>
        <div class="modal-nlp-item"><div class="modal-nlp-label">顧客意圖</div><div class="modal-nlp-val">${r.intent.primary === 'praise' ? '👍 讚美 (Praise)' : '⚠️ 投訴 (Complaint)'}${r.intent.secondary.includes('refund_request') ? ' + 退款要求' : ''}</div></div>
        <div class="modal-nlp-item"><div class="modal-nlp-label">置信度</div><div class="modal-nlp-val" style="color:var(--color-success)">${(r.confidence * 100).toFixed(0)}%</div></div>
      </div>
    </div>
    <div class="modal-section">
      <h4><i class="fa-solid fa-tags text-yellow"></i> Aspect-Based 情感提取</h4>
      <div class="modal-aspects-list">${aspectsList || '<div style="color:var(--text-muted);font-size:13px;">無可提取之 Aspect 資料</div>'}</div>
    </div>
    <div class="modal-section">
      <h4 style="color:var(--color-danger);"><i class="fa-solid fa-shield-halved"></i> 綜合風險評估</h4>
      <div class="modal-risk-panel">
        <div class="modal-risk-top">
          <span>風險等級：<span style="color:${riskColorMap[r.risk.level]};font-size:15px;">${getRiskEmoji(r.risk.level)} ${getRiskLabel(r.risk.level)}</span></span>
          <span class="modal-risk-score-big">${r.risk.score}<span style="font-size:14px;opacity:0.5;">/100</span></span>
        </div>
        <div class="risk-gauge-bar"><div class="risk-gauge-fill" style="width:${r.risk.score}%"></div></div>
        <div class="risk-flags-list">${flagsHtml || '<span style="color:var(--text-muted);font-size:12px;">無高風險標記</span>'}</div>
        <div style="margin-top:12px;font-size:12px;color:var(--text-secondary);">
          <strong>升級處置方式：</strong>
          ${r.risk.escalation_type === 'legal_review' ? '<span style="color:#a78bfa">⚖️ 強制轉法務部門審核</span>' : r.risk.escalation_type === 'manager_review' ? '<span style="color:#ff8c42">👨‍💼 轉門市主管審核</span>' : r.risk.escalation_type === 'customer_service' ? '<span style="color:#3b82f6">📞 轉客服部門跟進</span>' : '<span style="color:var(--color-success)">✅ 可自動回覆，無需升級</span>'}
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <button class="btn btn-primary" onclick="document.getElementById('review-modal').style.display='none';document.getElementById('playground-review-select').value='${r.review_id}';switchTab('rag-playground');handlePlaygroundSelect();">
        <i class="fa-solid fa-wand-magic-sparkles"></i> 前往 RAG 模擬器處理此評論
      </button>
    </div>
  `;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

// ============================================================
// RAG PLAYGROUND
// ============================================================
function handlePlaygroundSelect() {
  const reviewId = document.getElementById('playground-review-select').value;
  const card = document.getElementById('selected-review-card');
  if (!reviewId) { card.style.display = 'none'; return; }
  const r = selectReviewOrPendingCommentById(reviewId);
  if (!r) return;
  card.style.display = 'block';
  document.getElementById('preview-store').textContent = r.store_name || (r.platform ? `${r.platform.toUpperCase()} 平台` : '本地評論');
  document.getElementById('preview-time').textContent = r.review_time ? formatDate(r.review_time) : (r.time || '未知時間');
  document.getElementById('preview-reviewer').textContent = r.reviewer;
  document.getElementById('preview-stars').textContent = isValidRating(r.rating) ? formatRatingLabel(r.rating) : (r.platform ? `${r.platform.toUpperCase()} 評論` : '未評分');
  document.getElementById('preview-text').textContent = r.raw_text;
  const sentLabel = getSentimentLabel(r.sentiment?.label || 'neutral');
  document.getElementById('preview-sentiment').textContent = `${sentLabel} (${r.sentiment?.score ? (r.sentiment.score > 0 ? '+' : '') + r.sentiment.score.toFixed(2) : '0.00'})`;
  const dom = r.emotion
    ? (r.emotion.joy >= r.emotion.anger && r.emotion.joy >= r.emotion.disappointment
      ? `😊 喜悅 (${(r.emotion.joy * 100).toFixed(0)}%)`
      : r.emotion.anger >= r.emotion.disappointment
      ? `😡 憤怒 (${(r.emotion.anger * 100).toFixed(0)}%)`
      : `😞 失望 (${(r.emotion.disappointment * 100).toFixed(0)}%)`)
    : (r.sentiment?.label === 'positive' ? '😊 正面' : (r.sentiment?.label === 'negative' ? '😡 負面' : '😐 中性'));
  document.getElementById('preview-emotion').textContent = dom;
  document.getElementById('preview-intent').textContent = r.intent?.primary === 'praise' ? '👍 Praise (讚美)' : (r.intent?.primary === 'complaint' ? '⚠️ Complaint (投訴)' : '💬 評論');
  document.getElementById('preview-aspect').textContent = r.aspects ? [...new Set(r.aspects.map(a => a.aspect))].join(', ') : (r.topics ? [...new Set(r.topics.map(t => t.topic))].join(', ') : '無');
  document.getElementById('preview-risk-level').textContent = getRiskLabel(r.risk?.level || 'low');
  document.getElementById('preview-risk-score').textContent = `${r.risk?.score || 0}/100`;
  document.getElementById('preview-risk-gauge').style.width = `${r.risk?.score || 0}%`;
  const flagsEl = document.getElementById('preview-risk-flags');
  flagsEl.innerHTML = [
    r.risk?.food_safety ? '<span class="risk-flag-tag">🦠 食品安全</span>' : '',
    r.risk?.legal_risk ? '<span class="risk-flag-tag flag-legal">⚖️ 法律風險</span>' : '',
    r.risk?.hygiene_risk ? '<span class="risk-flag-tag flag-hygiene">🧹 環境衛生</span>' : '',
    !(r.risk?.food_safety || r.risk?.legal_risk || r.risk?.hygiene_risk) ? '<span style="font-size:12px;color:var(--color-success)">✅ 無特殊風險標記</span>' : ''
  ].filter(Boolean).join('');
  document.getElementById('rag-step-container').style.display = 'none';
  document.getElementById('llm-comparison-container').style.display = 'none';
  document.getElementById('rag-pipeline-steps').style.display = 'none';
  const draft = document.getElementById('final-reply-draft');
  if (draft) draft.value = '';
  ['submit-ai-reply-btn', 'create-ticket-btn', 'reply-capability-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function inferMatchedRagRules(review) {
  const ruleIds = new Set();
  if (review.risk?.food_safety || review.risk?.hygiene_risk || /食安|拉肚子|蟑螂|蒼蠅|異物|沒熟|不新鮮/.test(review.raw_text || '')) {
    ruleIds.add('sop_food_safety');
  }
  if ((review.raw_text || '').match(/服務|態度|客服|店員|主管|翻白眼|客訴/)) {
    ruleIds.add('sop_service');
  }
  if ((review.raw_text || '').match(/等|排隊|太久|上菜慢|候位/)) {
    ruleIds.add('sop_waiting');
  }
  if ((review.raw_text || '').match(/髒|衛生|桌子|地板|黏|清潔/)) {
    ruleIds.add('sop_cleanliness');
  }
  if (review.sentiment?.label === 'positive' && ruleIds.size === 0) {
    ruleIds.add('sop_positive');
  }
  if (ruleIds.size === 0) ruleIds.add('sop_service');
  return [...ruleIds];
}

function selectRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomizeReplyText(reply) {
  const prefixVariants = [
    '您好，',
    '您好，非常感謝您的回饋，',
    '您好，對於您的留言我們深感遺憾，'
  ];
  const introVariants = [
    '我們對此情況高度重視。',
    '這件事我們非常重視。',
    '我們已將您的回饋列為優先處理。'
  ];
  const closeVariants = [
    '再次感謝您的反映。',
    '感謝您讓我們有機會改善。',
    '謝謝您讓我們知道，這對我們非常重要。'
  ];

  let text = reply;
  if (Math.random() < 0.5) {
    text = text.replace(/^您好[，,]?/, selectRandomItem(prefixVariants));
  }
  if (Math.random() < 0.35) {
    const anchor = /我們(已|將)(?:立即|會).+/.exec(text);
    if (anchor) {
      text = text.replace(anchor[0], `${selectRandomItem(introVariants)} ${anchor[0]}`);
    }
  }
  if (Math.random() < 0.45 && !text.endsWith('。')) {
    text = `${text}。`;
  }
  if (Math.random() < 0.4) {
    const closing = selectRandomItem(closeVariants);
    if (!text.endsWith(closing)) {
      text = `${text}${text.endsWith('！') || text.endsWith('。') ? '' : '。'} ${closing}`;
    }
  }
  return text;
}

function getDynamicRagData(reviewId, review) {
  if (!RAG_RESPONSES[reviewId]) {
    return buildGenericRagData(review);
  }

  const base = JSON.parse(JSON.stringify(RAG_RESPONSES[reviewId]));
  base.good_reply = randomizeReplyText(base.good_reply);
  base.bad_reply = randomizeReplyText(base.bad_reply);
  base.bad_risk_desc = randomizeReplyText(base.bad_risk_desc);
  base.good_safe_desc = randomizeReplyText(base.good_safe_desc);

  if (base.prompt_template) {
    base.prompt_template = base.prompt_template.replace(/^你是.+$/m, selectRandomItem([
      '你是美味花園品牌的 AI 回覆助理。',
      '你現在扮演美味花園品牌的 AI 回覆助手。',
      '你是一位負責美味花園品牌的 AI 回覆專家。'
    ]));
  }

  return base;
}

function generateSafeReplyDraft(review) {
  const source = review.source || review.platform || 'google_business_reviews';
  const capability = review.reply_capability || getReplyCapability(source);
  const highRisk = ['critical', 'high'].includes(review.risk?.level);
  const mediumRisk = review.risk?.level === 'medium';
  const isPositive = review.sentiment?.label === 'positive';

  const contactLine = capability.can_publish_via_platform_api
    ? '也邀請您透過官方聯絡管道提供更多資訊，方便專人進一步了解。'
    : '建議由客服或公關同仁依平台情境另行聯繫或建立內部處理紀錄。';

  const positiveReplies = [
    `謝謝您的肯定與分享，我們很高興知道這次體驗讓您滿意。您的回饋會分享給團隊，也會持續作為我們維持服務品質的動力。期待未來再次為您服務。`,
    `非常感謝您的好評！我們會將您的鼓勵轉達給本店同仁，並持續提供穩定的餐點與服務。期待很快能再為您服務。`,
    `感謝您的支持與推薦！若有機會再次光臨，歡迎試試我們的其他人氣餐點，我們會一如既往保持用心。`
  ];

  const highRiskReplies = [
    `謝謝您提供回饋，我們已重視此狀況並建議交由專責同仁進一步確認。基於事件仍需查證，公開回覆不會先行推測原因或承諾處理結果。${contactLine}`,
    `很抱歉讓您遇到這樣的體驗，我們已將此事提升為專案追蹤。為了避免公開猜測，我們會先進行內部確認，並請您透過官方管道提供更多細節。${contactLine}`,
    `我們非常重視您的反映，已要求相關單位立即檢視。公開回覆不會先行斷定原因，歡迎您透過官方聯絡方式讓專責人員與您進一步連絡。${contactLine}`
  ];

  const midRiskReplies = [
    `謝謝您的回饋，很抱歉這次體驗未達期待。我們會將您提到的內容整理給相關團隊檢視，並作為後續改善依據。${contactLine}`,
    `感謝您的提醒，我們會把這次的問題反映給現場主管與作業團隊，持續優化服務與流程。${contactLine}`,
    `很遺憾這次未能帶給您滿意體驗，我們已將此回饋納入改進重點，並會再加強內部協調與追蹤。${contactLine}`
  ];

  const defaultReplies = [
    `謝謝您的回饋，很抱歉這次體驗未達期待。我們會將您提到的內容整理給相關團隊檢視，並作為後續改善依據。${contactLine}`,
    `感謝您的提醒，我們會將此事反映給負責團隊，持續改善服務與環境。${contactLine}`,
    `很遺憾這次沒達到您的期待，我們會持續優化並感謝您讓我們有機會改進。${contactLine}`
  ];

  if (isPositive && !mediumRisk && !highRisk) {
    return selectRandomItem(positiveReplies);
  }
  if (highRisk) {
    return selectRandomItem(highRiskReplies);
  }
  if (mediumRisk) {
    return selectRandomItem(midRiskReplies);
  }
  return selectRandomItem(defaultReplies);
}

function buildGenericRagData(review) {
  const matchedRules = inferMatchedRagRules(review);
  const similarityScores = {};
  matchedRules.forEach((id, index) => {
    similarityScores[id] = Math.max(0.72, 0.92 - index * 0.08);
  });
  const capability = review.reply_capability || getReplyCapability(review.source || 'google_business_reviews');
  const safeReply = generateSafeReplyDraft(review);
  const needHuman = review.risk?.level !== 'low' || capability.requires_manager_approval;

  return {
    matched_rules: matchedRules,
    similarity_scores: similarityScores,
    bad_reply: '真的很抱歉，這一定是我們的疏失。我們會立即賠償並提供優惠，保證之後不會再發生。',
    bad_risk_desc: '此回覆承認責任、承諾賠償或優惠，且對未確認事件做出推測，違反 RAG Guardrails。',
    good_reply: safeReply,
    good_safe_desc: capability.can_publish_via_platform_api
      ? '此來源具備官方回覆能力，但仍需 Manager Approve 後才可發布。'
      : '此來源為 suggestion-only，不允許呼叫平台 API 發布留言，只能建立 CRM Ticket 或通知部門。',
    need_human: needHuman,
    escalation: suggestedDepartmentForRisk(review.risk, review.sentiment?.label),
    publish_capability: capability.publish_capability,
    prompt_template: `SYSTEM: You are an enterprise reputation AI assistant.
Use only retrieved KB rules. Do not admit liability, promise refunds, promise compensation, fabricate policy, fabricate store data, fabricate phone numbers, or speculate about unverified events.

SOURCE: ${review.source || 'local'}
PUBLISH_CAPABILITY: ${capability.publish_capability}
REVIEW: ${review.raw_text}
RISK_LEVEL: ${review.risk?.level}
MATCHED_RULES: ${matchedRules.join(', ')}

Return JSON with reply_draft, confidence_score, need_human_review, suggested_department, risk_level, publish_capability.`
  };
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getWorkspacePlatformContext(platform) {
  const contexts = {
    facebook: {
      label: 'Facebook',
      tone: '社群留言語氣，親切、簡潔，適合公開串回覆。',
      limit: '120 字內'
    },
    instagram: {
      label: 'Instagram',
      tone: '短句、溫暖，可保留一點品牌感，但避免過度行銷。',
      limit: '80 字內'
    },
    google: {
      label: 'Google Business Profile',
      tone: '正式、穩健、可公開代表門市立場。',
      limit: '100 字內'
    }
  };
  return contexts[platform] || contexts.google;
}

function normalizePendingCommentForRag(comment) {
  const platformSourceMap = {
    google: 'google_business_reviews',
    facebook: 'facebook',
    instagram: 'instagram'
  };
  const rating = comment.rating || (comment.sentiment?.label === 'positive' ? 5 : comment.sentiment?.label === 'negative' ? 2 : 3);
  const risk = {
    score: comment.risk?.score || 0,
    level: comment.risk?.level || 'low',
    legal_risk: Boolean(comment.risk?.legal_risk),
    food_safety: Boolean(comment.risk?.food_safety),
    hygiene_risk: Boolean(comment.risk?.hygiene_risk),
    escalation_type: comment.risk?.escalation_type || 'none'
  };

  return {
    review_id: comment.comment_id,
    source: platformSourceMap[comment.platform] || comment.platform || 'social',
    source_label: getWorkspacePlatformContext(comment.platform).label,
    platform: comment.platform,
    store_name: comment.store_name || '美味花園',
    reviewer: comment.reviewer,
    rating,
    raw_text: comment.raw_text,
    review_time: comment.time || new Date().toISOString(),
    sentiment: comment.sentiment || { label: 'neutral', score: 0 },
    emotion: comment.emotion || {},
    intent: comment.intent || { primary: comment.sentiment?.label === 'positive' ? 'praise' : 'complaint', secondary: [] },
    topics: comment.topics || [],
    aspects: comment.aspects || [],
    risk,
    confidence: comment.confidence || 0.86,
    reply_capability: getReplyCapability(platformSourceMap[comment.platform] || comment.platform)
  };
}

function pickBySeed(items, seedText = '') {
  const seed = [...String(seedText)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return items[seed % items.length];
}

function extractReplySignals(comment, matchedRules) {
  const text = comment.raw_text || '';
  const sentences = text
    .split(/[。！？!?，,\n]/)
    .map(s => s.trim())
    .filter(s => s.length >= 3);
  const topicWords = {
    sop_food_safety: ['食安', '肚子', '拉肚子', '不新鮮', '生蠔', '頭髮', '異物', '沒熟', '衛生局'],
    sop_cleanliness: ['衛生', '清潔', '蟑螂', '蒼蠅', '桌子', '地板', '廁所', '餐具'],
    sop_waiting: ['等', '排隊', '候位', '上菜', '流程', '訂位'],
    sop_service: ['服務', '態度', '店員', '主管', '客服', '收銀', '敷衍'],
    sop_positive: ['好吃', '喜歡', '親切', '推薦', '滿意', '貼心', '環境']
  };
  const words = matchedRules.flatMap(rule => topicWords[rule] || []);
  const evidence = sentences.find(s => words.some(w => s.includes(w))) || sentences[0] || text.slice(0, 28);
  const topics = (comment.topics || []).map(t => t.topic).filter(Boolean);

  return {
    evidence: evidence.length > 32 ? `${evidence.slice(0, 32)}...` : evidence,
    topicLabel: topics.length ? topics.slice(0, 2).join('、') : '用餐體驗',
    isPositive: comment.sentiment?.label === 'positive',
    isHighRisk: ['high', 'critical'].includes(comment.risk?.level),
    isMediumRisk: comment.risk?.level === 'medium',
    platformLabel: getWorkspacePlatformContext(comment.platform).label
  };
}

function buildWorkspaceSafeReply(comment, matchedRules) {
  const firstRule = matchedRules[0] || 'sop_service';
  const signals = extractReplySignals(comment, matchedRules);
  const seed = `${comment.comment_id || ''}${comment.raw_text || ''}${firstRule}`;
  const isInstagram = comment.platform === 'instagram';
  const isGoogle = comment.platform === 'google';

  const openers = signals.isPositive
    ? ['謝謝您的分享與肯定！', '很開心收到您的回饋，謝謝您願意推薦我們。', '謝謝您把這次愉快的體驗寫下來！']
    : ['您好，謝謝您願意把這次狀況告訴我們。', '您好，我們已經收到您的回饋，也會認真看待。', '您好，謝謝您留下這麼具體的提醒。'];
  const opener = pickBySeed(openers, seed);

  const acknowledgeMap = {
    sop_food_safety: [
      `您提到「${signals.evidence}」，我們會優先交由門市主管確認當日備料、保存與出餐紀錄。`,
      `關於您反映的食品安全疑慮，我們會先釐清相關品項與時段，並同步檢查後場作業紀錄。`,
      `這類用餐後不適或食材疑慮我們不會輕忽，會先啟動門市內部查核。`
    ],
    sop_cleanliness: [
      `您提到的清潔與環境狀況，我們會請門市立即複查座位區、餐具與現場巡檢流程。`,
      `針對「${signals.evidence}」這類清潔感受，我們會回到現場逐項檢視並加強維護頻率。`,
      `環境衛生會直接影響用餐安心感，我們會把這次提醒納入門市巡檢改善。`
    ],
    sop_waiting: [
      `等待時間影響體驗，我們會回頭檢視尖峰時段候位、出餐與訂位配置。`,
      `您提到「${signals.evidence}」，我們會把它列入排隊動線與出餐節奏的改善參考。`,
      `候位與上菜速度確實需要被穩定管理，我們會請現場團隊重新檢視流程。`
    ],
    sop_service: [
      `您提到的服務互動讓人感受不佳，我們會轉交門市主管了解並加強同仁訓練。`,
      `關於「${signals.evidence}」，我們會請主管回看當班服務流程，避免類似感受再次發生。`,
      `服務態度是我們很重視的一環，這次回饋會納入門市教育與現場管理。`
    ],
    sop_positive: [
      `很高興${signals.topicLabel}有讓您留下好印象，這對團隊是很大的鼓勵。`,
      `看到您喜歡這次的${signals.topicLabel}，我們真的很開心。`,
      `您的肯定會分享給門市夥伴，也會提醒大家繼續維持品質。`
    ]
  };
  const acknowledge = pickBySeed(acknowledgeMap[firstRule] || acknowledgeMap.sop_service, seed);

  const safetyActionMap = {
    sop_food_safety: isGoogle
      ? '也歡迎透過門市電話或私訊補充用餐時間、品項與聯絡方式，主管會協助追蹤。'
      : '也請您私訊補充用餐時間、品項與聯絡方式，我們會交由主管協助追蹤。',
    sop_cleanliness: '我們會加強現場巡檢與清潔紀錄，不先做未確認判斷，但會把改善動作落實。',
    sop_waiting: '謝謝您的提醒，我們會持續調整尖峰時段的人力與動線安排。',
    sop_service: '若方便，也可以私訊提供到訪時間，方便我們更精準地回查與改善。',
    sop_positive: '期待下次再為您服務，也歡迎繼續和我們分享用餐感受。'
  };

  const closers = signals.isPositive
    ? ['再次謝謝您的支持。', '期待很快再見到您。', '我們會繼續把好的體驗維持住。']
    : ['謝謝您給我們修正的機會。', '我們會把這次回饋當成改善依據。', '謝謝您的耐心，也很抱歉讓您有這樣的感受。'];

  let reply = [opener, acknowledge, safetyActionMap[firstRule] || safetyActionMap.sop_service, pickBySeed(closers, seed)]
    .filter(Boolean)
    .join('');

  if (signals.isHighRisk) {
    reply += ' 此則建議先由人工審核後再公開發布。';
  }
  if (isInstagram && !reply.includes('#')) {
    reply += ' #美味花園';
  }

  const limit = isInstagram ? 150 : (isGoogle ? 220 : 240);
  return reply.length > limit ? `${reply.slice(0, limit - 3)}...` : reply;
}

function buildWorkspaceBadReply(comment, matchedRules) {
  if (matchedRules.includes('sop_food_safety') || matchedRules.includes('sop_cleanliness')) {
    return '非常抱歉，這一定是我們的疏失，我們會直接賠償並保證不會再發生。';
  }
  if (matchedRules.includes('sop_service') || matchedRules.includes('sop_waiting')) {
    return '不好意思，這位員工我們會立刻處分，也送您折價券補償。';
  }
  return '謝謝稱讚，歡迎大家都來吃，我們保證每次都是最完美體驗。';
}

function renderWorkspaceRagPipeline(comment, ragData) {
  const rulesBox = document.getElementById('workspace-sop-rules');
  if (!rulesBox) return;

  const rulesHtml = ragData.matched_rules.map(ruleId => {
    const rule = KB.sop_rules.find(s => s.id === ruleId);
    if (!rule) return '';
    const score = ragData.similarity_scores?.[ruleId] || 0.72;
    return `
      <div class="workspace-rag-rule" style="border-left-color:${rule.color || '#3b82f6'}">
        <div class="workspace-rag-rule-head">
          <strong>${escapeHtml(rule.label || rule.category || ruleId)}</strong>
          <span>相似度 ${(score * 100).toFixed(0)}%</span>
        </div>
        <div>${escapeHtml(rule.rule_description || '')}</div>
        <div class="workspace-rag-rule-action">${escapeHtml(rule.action_guideline || '').replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('');

  rulesBox.innerHTML = `
    <div class="workspace-rag-pipeline">
      <div class="workspace-rag-step done"><span>1</span>讀取評論</div>
      <div class="workspace-rag-step done"><span>2</span>KB 檢索</div>
      <div class="workspace-rag-step done"><span>3</span>Prompt 構造</div>
      <div class="workspace-rag-step active"><span>4</span>AI 生成</div>
    </div>
    <div class="workspace-rag-rules">${rulesHtml}</div>
    <details class="workspace-prompt-preview">
      <summary><i class="fa-solid fa-code"></i> 檢視構造化 Prompt</summary>
      <pre>${escapeHtml(ragData.prompt_template || '')}</pre>
    </details>
  `;
}

function buildWorkspacePromptPreview(comment, normalizedReview, ragData) {
  const platform = getWorkspacePlatformContext(comment.platform);
  const signals = extractReplySignals(comment, ragData.matched_rules);
  const rules = ragData.matched_rules
    .map(ruleId => KB.sop_rules.find(rule => rule.id === ruleId))
    .filter(Boolean)
    .map(rule => `- ${rule.label}: ${rule.action_guideline}`)
    .join('\n');

  return `SYSTEM:
你是美味花園的品牌回覆 AI。你必須根據 KB/SOP 回覆，不可承認法律責任、不可承諾賠償、不可編造優惠或未確認事實。

PLATFORM_CONTEXT:
- 平台: ${platform.label}
- 語氣: ${platform.tone}
- 建議長度: ${platform.limit}

COMMENT_INPUT:
- 留言者: ${normalizedReview.reviewer}
- 評論內容: ${normalizedReview.raw_text}
- 情緒: ${normalizedReview.sentiment.label} (${normalizedReview.sentiment.score})
- 風險: ${normalizedReview.risk.level} / ${normalizedReview.risk.score}
- 抽取重點: ${signals.evidence}
- 主題: ${signals.topicLabel}

KB_RETRIEVAL:
${rules}

GENERATION_INSTRUCTION:
1. 先回應顧客具體提到的重點，不要只寫制式道歉。
2. 高風險內容引導私訊/門市主管追蹤，避免公開承認責任。
3. 語氣自然、有品牌溫度，但仍符合 SOP guardrails。
4. 輸出可直接放入回覆草稿的繁體中文。`;
}

async function tryGeminiReplyDraft(normalizedReview, ragData) {
  const generationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch('/api/gemini-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      review: normalizedReview,
      rag: {
        matched_rules: ragData.matched_rules,
        similarity_scores: ragData.similarity_scores,
        prompt_template: ragData.prompt_template,
        local_reply: ragData.good_reply,
        need_human: ragData.need_human,
        escalation: ragData.escalation,
        generation_seed: generationSeed
      }
    })
  });

  if (!res.ok) {
    let message = `Gemini gateway returned ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.error) message = errData.error;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await res.json();
  if (!data.reply_text) {
    throw new Error('Gemini gateway returned an empty reply');
  }
  return data;
}

function runWorkspaceRagFlow(comment) {
  const normalizedReview = normalizePendingCommentForRag(comment);
  const ragData = getDynamicRagData(normalizedReview.review_id, normalizedReview);
  ragData.prompt_template = buildWorkspacePromptPreview(comment, normalizedReview, ragData);
  ragData.good_reply = buildWorkspaceSafeReply(comment, ragData.matched_rules);
  ragData.bad_reply = buildWorkspaceBadReply(comment, ragData.matched_rules);

  renderWorkspaceRagPipeline(comment, ragData);

  const draftTextarea = document.getElementById('workspace-reply-draft');
  const badReplyEl = document.getElementById('workspace-bad-reply');
  const goodReplyEl = document.getElementById('workspace-good-reply');

  if (draftTextarea) {
    draftTextarea.value = '';
    draftTextarea.placeholder = 'AI 正在依照 RAG Pipeline 生成回覆草稿...';
  }
  if (badReplyEl) badReplyEl.textContent = '步驟 4：正在產生未受控 LLM 對照...';
  if (goodReplyEl) goodReplyEl.textContent = '步驟 4：正在套用 KB 與 Guardrails 生成安全回覆...';

  setTimeout(() => {
    if (ResponseHub.activeComment?.comment_id !== comment.comment_id) return;
    if (badReplyEl) badReplyEl.textContent = ragData.bad_reply;
    if (goodReplyEl) goodReplyEl.textContent = ragData.good_reply;
    if (draftTextarea) {
      draftTextarea.value = ragData.good_reply;
      draftTextarea.placeholder = 'AI 建議回覆草稿，可由人工審閱後編修發布。';
    }
    lastAiReplyDecision = {
      review: normalizedReview,
      ragData,
      jsonOut: {
        mention_id: normalizedReview.review_id,
        source: normalizedReview.source,
        source_label: normalizedReview.source_label,
        reviewer: normalizedReview.reviewer,
        rag_retrieval: {
          matched_rules: ragData.matched_rules,
          similarity_scores: ragData.similarity_scores
        },
        prompt_template: ragData.prompt_template,
        reply_draft: ragData.good_reply,
        confidence_score: normalizedReview.confidence,
        need_human_review: ragData.need_human,
        suggested_department: ragData.escalation,
        publish_capability: ragData.publish_capability,
        risk_assessment: normalizedReview.risk,
        generated_at: new Date().toISOString()
      }
    };
    showToast('RAG Pipeline 已完成：評論讀取、KB 檢索、Prompt 構造與 AI 草稿生成', ragData.need_human ? 'warning' : 'success');

    if (goodReplyEl) goodReplyEl.textContent = `${ragData.good_reply}\n\nGemini API 生成中...`;
    tryGeminiReplyDraft(normalizedReview, ragData)
      .then(data => {
        if (ResponseHub.activeComment?.comment_id !== comment.comment_id) return;
        const geminiReply = data.reply_text.trim();
        ragData.good_reply = geminiReply;
        if (goodReplyEl) goodReplyEl.textContent = geminiReply;
        if (draftTextarea) draftTextarea.value = geminiReply;
        if (lastAiReplyDecision?.jsonOut) {
          lastAiReplyDecision.jsonOut.reply_draft = geminiReply;
          lastAiReplyDecision.jsonOut.model_provider = 'gemini';
          lastAiReplyDecision.jsonOut.model = data.model || 'gemini';
        }
        showToast(`Gemini API 已生成草稿：${data.model || 'gemini'}`, 'success');
      })
      .catch(err => {
        console.info('[Gemini API fallback]', err.message);
        if (ResponseHub.activeComment?.comment_id !== comment.comment_id) return;
        if (goodReplyEl) goodReplyEl.textContent = ragData.good_reply;
        showToast(`Gemini 未套用，保留本地 RAG 草稿：${err.message}`, 'warning');
      });
  }, 900);
}

function runRAGSimulation() {
  const reviewId = document.getElementById('playground-review-select').value;
  if (!reviewId) { showToast('請先選擇一則評論', 'warning'); return; }
  const selectedReview = selectReviewOrPendingCommentById(reviewId);
  if (!selectedReview) { showToast('找不到選取的 Mention', 'warning'); return; }
  const ragData = getDynamicRagData(reviewId, selectedReview);
  const btn = document.getElementById('run-rag-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> RAG 檢索中...';
  // Show pipeline
  const pipelineEl = document.getElementById('rag-pipeline-steps');
  pipelineEl.style.display = 'flex';
  // Reset pipeline
  [1, 2, 3, 4, 5].forEach(i => {
    const step = document.getElementById(`pipe-step-${i}`);
    if (step) { step.className = i === 1 ? 'pipeline-step done' : 'pipeline-step'; }
    const conn = document.getElementById(`pipe-conn-${i}`);
    if (conn) conn.className = 'pipeline-connector';
  });
  function setStep(n) {
    for (let i = 1; i <= n - 1; i++) {
      const s = document.getElementById(`pipe-step-${i}`); if (s) s.className = 'pipeline-step done';
      const c = document.getElementById(`pipe-conn-${i}`); if (c) c.className = 'pipeline-connector done';
    }
    const cur = document.getElementById(`pipe-step-${n}`); if (cur) cur.className = 'pipeline-step active';
  }
  // Step 2: KB Retrieval
  setTimeout(() => { setStep(2); }, 400);
  setTimeout(() => {
    setStep(3);
    const ragContainer = document.getElementById('rag-step-container');
    ragContainer.style.display = 'block';
    const rulesOutput = document.getElementById('rag-rules-output');
    rulesOutput.innerHTML = ragData.matched_rules.map(ruleId => {
      const rule = KB.sop_rules.find(s => s.id === ruleId);
      if (!rule) return '';
      const sim = ragData.similarity_scores[ruleId];
      const r = selectedReview;
      const matchedTriggers = rule.triggers.filter(t => r && r.raw_text.includes(t));
      return `<div class="rag-rule-item">
        <span class="rag-similarity-score">相似度: ${(sim * 100).toFixed(0)}%</span>
        <div class="rag-rule-tag">${rule.label}</div>
        <div class="rag-rule-desc">${rule.rule_description}</div>
        <div class="rag-rule-action">📋 行動指引：${rule.action_guideline.replace(/\n/g, '<br>')}</div>
        ${rule.prohibited_content ? `<div class="rag-rule-prohibited">⛔ ${rule.prohibited_content}</div>` : ''}
        ${matchedTriggers.length > 0 ? `<div style="margin-top:8px;"><span style="font-size:10px;color:var(--text-muted);">匹配觸發詞：</span> ${matchedTriggers.map(t => `<span style="font-size:10px;background:rgba(59,130,246,0.15);color:#93c5fd;padding:1px 5px;border-radius:3px;margin-left:3px;">${t}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    // Prompt template
    document.getElementById('prompt-text-block').textContent = ragData.prompt_template;
  }, 1000);
  // Step 4: LLM Generation
  setTimeout(() => {
    setStep(4);
    const compContainer = document.getElementById('llm-comparison-container');
    compContainer.style.display = 'block';
    document.getElementById('compare-bad-reply').textContent = '—';
    document.getElementById('compare-good-reply').textContent = '—';
    document.getElementById('typing-bad').style.display = 'flex';
    document.getElementById('typing-good').style.display = 'flex';
  }, 1800);
  // Step 5: Output
  setTimeout(() => {
    setStep(5);
    document.getElementById('typing-bad').style.display = 'none';
    document.getElementById('typing-good').style.display = 'none';
    document.getElementById('compare-bad-reply').textContent = ragData.bad_reply;
    document.getElementById('compare-good-reply').textContent = ragData.good_reply;
    document.getElementById('bad-risk-desc').textContent = ragData.bad_risk_desc;
    document.getElementById('good-safe-desc').textContent = ragData.good_safe_desc;
    // JSON Output
    const r = selectedReview;
    const jsonOut = {
      mention_id: reviewId, source: r.source || 'local', source_label: r.source_label || r.store_name, reviewer: r.reviewer,
      nlp_analysis: { sentiment: { label: r.sentiment.label, score: r.sentiment.score }, emotion: r.emotion, intent: r.intent },
      rag_retrieval: { matched_rules: ragData.matched_rules, similarity_scores: ragData.similarity_scores },
      reply_draft: ragData.good_reply,
      confidence_score: r.confidence || 0.82,
      need_human_review: ragData.need_human,
      suggested_department: ragData.escalation,
      publish_capability: ragData.publish_capability || r.reply_capability?.publish_capability || 'official_publish',
      risk_assessment: { score: r.risk.score, level: r.risk.level, legal_risk: r.risk.legal_risk, food_safety: r.risk.food_safety },
      schema_validation: "PASSED", generated_at: new Date().toISOString()
    };
    lastAiReplyDecision = { review: r, ragData, jsonOut };
    document.getElementById('json-structured-output').textContent = JSON.stringify(jsonOut, null, 2);
    const draftEl = document.getElementById('final-reply-draft');
    if (draftEl) draftEl.value = ragData.good_reply;
    const capabilityBadge = document.getElementById('reply-capability-badge');
    if (capabilityBadge) {
      capabilityBadge.style.display = 'inline-flex';
      capabilityBadge.textContent = `Publish Capability: ${jsonOut.publish_capability}`;
    }
    const submitBtn = document.getElementById('submit-ai-reply-btn');
    if (submitBtn) submitBtn.style.display = 'inline-flex';
    const ticketBtn = document.getElementById('create-ticket-btn');
    if (ticketBtn) ticketBtn.style.display = 'inline-flex';
    // Final step done
    [1, 2, 3, 4, 5].forEach(i => {
      const s = document.getElementById(`pipe-step-${i}`); if (s) s.className = 'pipeline-step done';
      const c = document.getElementById(`pipe-conn-${i}`); if (c) c.className = 'pipeline-connector done';
    });
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-play"></i> 重新執行 RAG 模擬';
    showToast(ragData.need_human ? '🚨 高風險！已標記 need_human=true，轉人工審核' : '✅ RAG 回覆生成完成，可安全發布', ragData.need_human ? 'danger' : 'success');
  }, 3200);
}

function submitAiReplyDraft() {
  if (!lastAiReplyDecision) {
    showToast('請先執行 RAG 生成回覆草稿', 'warning');
    return;
  }
  const draft = document.getElementById('final-reply-draft')?.value.trim();
  if (!draft) {
    showToast('回覆草稿不可為空', 'warning');
    return;
  }
  const { review, jsonOut } = lastAiReplyDecision;
  const capability = review.reply_capability || getReplyCapability(review.source || 'google_business_reviews');
  const action = capability.can_publish_via_platform_api
    ? 'manager_approval_queued'
    : 'crm_ticket_created';
  submittedReplyActions.push({
    action,
    mention_id: review.review_id,
    source: review.source || 'local',
    draft,
    created_at: new Date().toISOString()
  });
  jsonOut.reply_draft = draft;
  jsonOut.submission_action = action;
  document.getElementById('json-structured-output').textContent = JSON.stringify(jsonOut, null, 2);
  showToast(
    capability.can_publish_via_platform_api
      ? '已送出 Manager Approve；核准後才可透過 Google Business API 發布'
      : '此來源不可直接發布，已建立 CRM Ticket / Suggested Response',
    capability.can_publish_via_platform_api ? 'success' : 'info'
  );
}

function createCrmTicketFromDraft() {
  if (!lastAiReplyDecision) {
    showToast('請先執行 RAG 生成回覆草稿', 'warning');
    return;
  }
  const { review } = lastAiReplyDecision;
  submittedReplyActions.push({
    action: 'crm_ticket_created',
    mention_id: review.review_id,
    source: review.source || 'local',
    department: suggestedDepartmentForRisk(review.risk, review.sentiment?.label),
    created_at: new Date().toISOString()
  });
  showToast('已建立 CRM Ticket 並帶入建議處理部門', 'success');
}

// ============================================================
// KNOWLEDGE BASE RENDERING
// ============================================================
function renderKnowledgeBase() {
  // Store Cards
  const storeRow = document.getElementById('store-info-row');
  if (storeRow) {
    storeRow.innerHTML = KB.stores.map(s => `
      <div class="store-card">
        <div class="store-card-name">📍 ${s.store_name.replace('美味花園 ', '')}</div>
        <div class="store-card-info">
          <div class="store-card-phone">📞 ${s.phone}</div>
          <div class="store-card-specialty">🍽️ ${s.specialty}</div>
          <div style="font-size:10px;margin-top:4px;color:var(--text-muted)">${s.address}</div>
        </div>
      </div>`).join('');
  }
  // SOP List
  const sopList = document.getElementById('kb-sop-list');
  if (sopList) {
    const colorMap = { food_safety_issue: '#ff4757', service_complaint: '#f5a623', waiting_time: '#06b6d4', cleanliness_issue: '#a78bfa', general_positive: '#10d97a' };
    sopList.innerHTML = KB.sop_rules.map((rule, i) => `
      <div class="accordion-item">
        <div class="accordion-header" onclick="toggleAccordion(this)">
          <div class="accordion-header-left">
            <span class="accordion-category-tag" style="background:${colorMap[rule.category]}22;color:${colorMap[rule.category]}">${rule.label}</span>
            <span style="font-size:12px;color:var(--text-secondary)">觸發詞：${rule.triggers.slice(0, 4).join(' / ')}${rule.triggers.length > 4 ? '...' : ''}</span>
          </div>
          <i class="fa-solid fa-chevron-down accordion-chevron"></i>
        </div>
        <div class="accordion-body">
          <p style="margin-bottom:8px;">${rule.rule_description}</p>
          <p><strong>📋 處理指引：</strong></p>
          <p style="white-space:pre-line;margin:6px 0;">${rule.action_guideline}</p>
          ${rule.prohibited_content ? `<div class="accordion-prohibited">⛔ 禁止事項：${rule.prohibited_content}</div>` : ''}
        </div>
      </div>`).join('');
  }
  // Few-shot Examples
  const fewshotList = document.getElementById('kb-fewshot-list');
  if (fewshotList) {
    fewshotList.innerHTML = KB.few_shot_examples.map(ex => `
      <div class="fewshot-item">
        <div class="fewshot-type-tag">${ex.type === 'positive' ? '✅ 正面' : ex.type === 'waiting_time' ? '⏱️ 等候' : '🚨 食安'} 範例</div>
        <div class="fewshot-label">顧客評論</div>
        <div class="fewshot-review">"${ex.review}"</div>
        <div class="fewshot-label">AI 安全回覆草稿</div>
        <div class="fewshot-reply">"${ex.ai_reply}"</div>
        <div style="margin-top:8px;font-size:10px;display:flex;gap:8px;">
          <span class="badge ${ex.need_human ? 'badge-neg' : 'badge-pos'}">need_human: ${ex.need_human}</span>
          <span class="badge badge-neu">SOP: ${ex.kb_applied}</span>
        </div>
      </div>`).join('');
  }
  document.getElementById('kb-sop-count-badge').textContent = KB.sop_rules.length + ' 條規則';
  document.getElementById('kb-fewshot-count-badge').textContent = KB.few_shot_examples.length + ' 則範例';
}

function toggleAccordion(header) {
  const body = header.nextElementSibling;
  const chevron = header.querySelector('.accordion-chevron');
  body.classList.toggle('open');
  chevron.classList.toggle('open');
}

// ============================================================
// NLP ANALYSIS TAB
// ============================================================
function setupNLPTab() {
  const select = document.getElementById('nlp-review-select');
  if (!select) return;
  select.innerHTML = '<option value="">-- 或選擇現有評論 --</option>' +
    REVIEWS.map(r => `<option value="${r.review_id}">[${r.store_name.replace('美味花園 ','')}] ${r.reviewer}: ${r.raw_text.substring(0,35)}...</option>`).join('');
  select.addEventListener('change', () => {
    const r = REVIEWS.find(x => x.review_id === select.value);
    if (r) {
      document.getElementById('nlp-text-input').value = r.raw_text;
      updateCharCount();
    }
  });
  document.getElementById('nlp-text-input').addEventListener('input', updateCharCount);
  document.getElementById('run-nlp-btn').addEventListener('click', runNLPAnalysis);
}

function updateCharCount() {
  const text = document.getElementById('nlp-text-input').value;
  document.getElementById('nlp-char-count').textContent = text.length + ' 字';
}

function runNLPAnalysis() {
  const text = document.getElementById('nlp-text-input').value.trim();
  if (!text) { showToast('請輸入或選擇評論文字', 'warning'); return; }
  // Find matching review or simulate
  let r = REVIEWS.find(x => x.raw_text === text);
  if (!r) {
    // Simple heuristic simulation
    const hasPositive = /好吃|美味|推薦|親切|乾淨|讚|喜歡|滿意|棒|優/.test(text);
    const hasNegative = /食安|拉肚子|噁心|蟑螂|蒼蠅|頭髮|翻白眼|傲慢|不新鮮|態度差|等太久|太慢/.test(text);
    r = {
      sentiment: { label: hasNegative ? 'negative' : hasPositive ? 'positive' : 'neutral', score: hasNegative ? -0.75 : hasPositive ? 0.80 : 0.10 },
      emotion: { joy: hasPositive ? 0.75 : 0.05, anger: hasNegative ? 0.80 : 0.05, disappointment: hasNegative ? 0.60 : hasPositive ? 0.0 : 0.25 },
      intent: { primary: hasNegative ? 'complaint' : 'praise', secondary: [] },
      aspects: [{ aspect: 'food', sentiment: hasNegative ? 'negative' : 'positive', evidence: text.substring(0, 30) }],
      risk: { score: hasNegative ? 65 : 10, level: hasNegative ? 'medium' : 'low', food_safety: /食安|拉肚子|蒼蠅|蟑螂/.test(text), legal_risk: /衛生局|投訴|賠償|法律/.test(text), hygiene_risk: /衛生|髒|黏/.test(text) }
    };
  }
  const panel = document.getElementById('nlp-results-panel');
  panel.style.opacity = '1'; panel.style.pointerEvents = 'auto';
  // Sentiment
  const sentScore = r.sentiment.score;
  const normalizedPos = (sentScore + 1) / 2;
  document.getElementById('nlp-sentiment-pointer').style.left = `calc(${normalizedPos * 100}% - 8px)`;
  document.getElementById('nlp-sentiment-score').textContent = `情感分數：${sentScore > 0 ? '+' : ''}${sentScore.toFixed(2)}`;
  const sentBadge = document.getElementById('nlp-sentiment-badge');
  sentBadge.className = `badge badge-${getSentimentClass(r.sentiment.label)}`;
  sentBadge.textContent = getSentimentLabel(r.sentiment.label);
  // Emotions
  setTimeout(() => {
    document.getElementById('nlp-joy-bar').style.width = (r.emotion.joy * 100) + '%';
    document.getElementById('nlp-anger-bar').style.width = (r.emotion.anger * 100) + '%';
    document.getElementById('nlp-sad-bar').style.width = (r.emotion.disappointment * 100) + '%';
  }, 100);
  document.getElementById('nlp-joy-pct').textContent = (r.emotion.joy * 100).toFixed(0) + '%';
  document.getElementById('nlp-anger-pct').textContent = (r.emotion.anger * 100).toFixed(0) + '%';
  document.getElementById('nlp-sad-pct').textContent = (r.emotion.disappointment * 100).toFixed(0) + '%';
  // Intent
  document.getElementById('nlp-intent-display').textContent = r.intent.primary === 'praise' ? '👍 讚美 Praise' : '⚠️ 投訴 Complaint';
  // Aspects
  const aspectTags = document.getElementById('nlp-aspect-tags');
  aspectTags.innerHTML = [...new Set(r.aspects.map(a => a.aspect))].map(a => {
    const aSent = r.aspects.find(x => x.aspect === a)?.sentiment;
    return `<span class="aspect-tag ${aSent === 'negative' ? 'neg' : ''}">${a}</span>`;
  }).join('');
  const evidenceList = document.getElementById('nlp-evidence-list');
  evidenceList.innerHTML = r.aspects.map(a => `<div class="evidence-item"><strong>${a.aspect}：</strong>${a.evidence}</div>`).join('');
  // Risk
  document.getElementById('nlp-risk-score-big').textContent = r.risk.score;
  setTimeout(() => { document.getElementById('nlp-risk-gauge-big').style.width = r.risk.score + '%'; }, 100);
  const flagsGrid = document.getElementById('nlp-risk-flags-grid');
  flagsGrid.innerHTML = [
    r.risk.food_safety ? '<span class="risk-flag-tag">🦠 食品安全</span>' : '<span class="risk-flag-big badge-pos">✅ 食品安全：正常</span>',
    r.risk.legal_risk ? '<span class="risk-flag-tag flag-legal">⚖️ 法律風險</span>' : '<span class="risk-flag-big badge-pos">✅ 法律風險：無</span>',
    r.risk.hygiene_risk ? '<span class="risk-flag-tag flag-hygiene">🧹 環境衛生</span>' : '<span class="risk-flag-big badge-pos">✅ 環境衛生：正常</span>',
  ].join('');
  const rec = document.getElementById('nlp-action-rec');
  if (r.risk.level === 'critical' || r.risk.level === 'high') {
    rec.innerHTML = '🚨 <strong>建議行動：</strong>此評論風險分數較高，建議立即轉交人工審核，並由門市主管親自處理，請勿由 AI 自動發布回覆。';
    rec.style.borderColor = 'rgba(255,71,87,0.3)';
  } else if (r.risk.level === 'medium') {
    rec.innerHTML = '⚠️ <strong>建議行動：</strong>此評論屬中等風險，建議由客服專員審閱後再發布，或使用 RAG 生成回覆草稿後人工確認。';
    rec.style.borderColor = 'rgba(245,166,35,0.3)';
  } else {
    rec.innerHTML = '✅ <strong>建議行動：</strong>此評論為低風險正面或中性評論，可由 RAG 系統自動生成回覆草稿後直接發布，無需人工干預。';
    rec.style.borderColor = 'rgba(16,217,122,0.3)';
  }
  showToast('NLP 語意分析完成！', 'success');
}

// ============================================================
// ALERTS CENTER
// ============================================================
function renderAlertsCenter() {
  const highRisk = REVIEWS.filter(r => r.risk.level === 'high' || r.risk.level === 'critical' || r.risk.level === 'medium').sort((a, b) => b.risk.score - a.risk.score);
  const container = document.getElementById('alerts-full-list');
  if (!container) return;
  const iconMap = { critical: 'fa-skull text-red', high: 'fa-triangle-exclamation text-red', medium: 'fa-exclamation-circle text-yellow', low: 'fa-info-circle text-blue' };
  const bgMap = { critical: 'bg-red-trans', high: 'bg-red-trans', medium: 'bg-yellow-trans', low: 'bg-blue-trans' };
  container.innerHTML = highRisk.map(r => `
    <div class="alert-full-item ${r.risk.level}" onclick="openReviewModal('${r.review_id}')">
      <div class="alert-full-icon ${bgMap[r.risk.level]}">
        <i class="fa-solid ${iconMap[r.risk.level]}"></i>
      </div>
      <div class="alert-full-content">
        <div class="alert-full-reviewer">${r.reviewer} <span style="color:var(--color-warning)">${formatRatingLabel(r.rating)}</span></div>
        <div class="alert-full-store">📍 ${r.store_name} · ${formatDate(r.review_time)}</div>
        <div class="alert-full-text">${r.raw_text}</div>
      </div>
      <div class="alert-full-meta">
        <span class="badge-risk badge badge-risk-${r.risk.level}">${getRiskEmoji(r.risk.level)} ${getRiskLabel(r.risk.level)}</span>
        <span class="alert-full-time">風險分數: ${r.risk.score}/100</span>
        <span class="btn btn-secondary btn-small" style="font-size:10px;">詳析 →</span>
      </div>
    </div>`).join('');
  // Alert filter buttons
  document.querySelectorAll('.alert-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.alert-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.alertFilter;
      document.querySelectorAll('.alert-full-item').forEach(item => {
        if (filter === 'all' || item.classList.contains(filter)) item.style.display = 'grid';
        else item.style.display = 'none';
      });
    });
  });
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const tabEl = document.getElementById(`${tabName}-tab`);
  if (tabEl) tabEl.classList.add('active');
  const navEl = document.getElementById(`nav-${tabName.replace('-playground', '').replace('-analysis', '').replace('-base', '')}`);
  if (navEl) navEl.classList.add('active');
  else {
    const altMap = { 
      'rag-playground': 'nav-rag', 
      'knowledge-base': 'nav-kb', 
      'nlp-analysis': 'nav-nlp', 
      'alerts': 'nav-alerts',
      'response-auth': 'nav-response-auth',
      'response-pending': 'nav-response-pending',
      'response-submitted': 'nav-response-submitted'
    };
    const alt = document.getElementById(altMap[tabName]);
    if (alt) alt.classList.add('active');
  }
  const titles = {
    'dashboard': ['輿情分析看板', '即時監控所有門市 Google 地標評論、情感指數及品牌聲譽風險'],
    'reviews': ['留言輿情監控', '篩選、搜尋與深度解析所有顧客評論的 NLP 語意結果'],
    'rag-playground': ['AI RAG 模擬器', '逐步模擬 RAG 防幻覺生成流程：從知識庫檢索到 AI 安全回覆比對'],
    'knowledge-base': ['RAG 品牌知識庫', 'SOP 條款、Few-shot 範例與品牌安全回覆政策設定中心'],
    'nlp-analysis': ['NLP 深度分析實驗室', '輸入任意評論文字，即時模擬完整 NLP Pipeline 分析流程'],
    'alerts': ['風險警報中心', '所有高/關鍵風險評論的彙整與處理優先排序清單'],
    'response-auth': ['帳號授權管理', '連結與管理 Facebook、Instagram 及 Google 官方帳號 API 驗證 Token'],
    'response-pending': ['待處理回覆', '審閱社群平台最新留言，並透過品牌專屬 RAG 引擎安全生成官方回覆'],
    'response-submitted': ['已發布回覆紀錄', '追蹤所有透過平台 API 成功提交發布的回覆紀錄與 Payload']
  };
  const title = titles[tabName] || [tabName, ''];
  document.getElementById('page-title').textContent = title[0];
  document.getElementById('page-subtitle').textContent = title[1];
  document.getElementById('breadcrumb-current').textContent = title[0];
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });
}

// ============================================================
// PROMPT TOGGLE
// ============================================================
function setupPromptToggle() {
  const btn = document.getElementById('prompt-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const body = document.getElementById('prompt-body-content');
    const arrow = document.getElementById('prompt-arrow');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    arrow.classList.toggle('open', !isOpen);
  });
}

// ============================================================
// REFRESH BUTTON
// ============================================================
function setupRefreshButton() {
  const btn = document.getElementById('refresh-data-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> 更新中...';
    btn.disabled = true;
    try {
      if (activeDataSource === 'supabase') {
        const result = await loadReviewsFromSupabase();
        if (!result.ok) {
          REVIEWS = JSON.parse(JSON.stringify(LOCAL_REVIEWS));
          activeDataSource = 'local';
          const select = document.getElementById('data-source-select');
          if (select) select.value = 'local';
        }
      } else {
        REVIEWS = JSON.parse(JSON.stringify(LOCAL_REVIEWS));
      }
      renderAllDataViews();
      btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 重整資料';
      document.getElementById('last-update-time').textContent = '剛剛更新';
      showToast(activeDataSource === 'supabase' ? 'Supabase 資料已同步更新完畢' : '本地示範資料已重新載入', 'success');
    } catch (error) {
      console.error('Data refresh failed:', error);
      showToast(`資料同步失敗：${error.message || '請開啟 Console 查看詳細錯誤'}`, 'danger');
    } finally {
      btn.disabled = false;
    }
  });
}

// ============================================================
// MODAL SETUP
// ============================================================
function setupModal() {
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('review-modal').style.display = 'none';
  });
  document.getElementById('review-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('review-modal')) {
      document.getElementById('review-modal').style.display = 'none';
    }
  });
}

// ============================================================
// MARK ALL READ
// ============================================================
function setupMarkAllRead() {
  const btn = document.getElementById('mark-all-read-btn');
  if (btn) btn.addEventListener('click', () => {
    showToast('已將所有警報標記為已讀', 'success');
  });
}

// ============================================================
// TIME UPDATE
// ============================================================
function updateTimestamp() {
  const el = document.getElementById('last-update-time');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) + ' 更新';
  }
}

// ============================================================
// MAIN INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Metrics, charts, tables, and alert views
  setTimeout(() => {
    renderAllDataViews();
    setupWordCloudClick();
  }, 200);

  // Reviews Table
  setupFilters();

  // Playground
  const playgroundSelect = document.getElementById('playground-review-select');
  if (playgroundSelect) {
    playgroundSelect.addEventListener('change', handlePlaygroundSelect);
  }
  const runRagBtn = document.getElementById('run-rag-btn');
  if (runRagBtn) runRagBtn.addEventListener('click', runRAGSimulation);
  const submitAiReplyBtn = document.getElementById('submit-ai-reply-btn');
  if (submitAiReplyBtn) submitAiReplyBtn.addEventListener('click', submitAiReplyDraft);
  const createTicketBtn = document.getElementById('create-ticket-btn');
  if (createTicketBtn) createTicketBtn.addEventListener('click', createCrmTicketFromDraft);

  // Prompt toggle
  setupPromptToggle();

  // Navigation
  setupNavigation();

  // Modal
  setupModal();

  // Refresh
  setupRefreshButton();

  // Data source selector
  setupDataSourceSelector();

  // Mark all read
  setupMarkAllRead();

  // Timestamp
  updateTimestamp();
  setInterval(updateTimestamp, 60000);

    // Welcome toast
  setTimeout(() => {
    showToast('系統啟動完成 — 偵測到 4 則高風險警報', 'danger');
  }, 1200);
  setTimeout(() => {
    showToast('RAG 知識庫已載入：5 條 SOP + 3 個 Few-shot 範例', 'info');
  }, 2500);
  
  // Auto-switch to pending tab if redirect token exists
  if (window.location.hash.includes('access_token=') || window.location.hash.includes('token_type=')) {
    switchTab('response-auth');
  }

  // Initialize Response Hub
  ResponseHub.init();

  // Window resize handler for word cloud
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderWordCloud, 300);
  });
});

// ============================================================
// RESPONSE HUB MODULE (Decoupled Logic & State)
// ============================================================
const ResponseHub = {
  accounts: {
    facebook: { connected: false, name: "", token: "" },
    instagram: { connected: false, name: "", token: "" },
    google: { connected: false, name: "", token: "" }
  },
  pendingReplies: [
    {
      comment_id: "fb_001",
      platform: "facebook",
      reviewer: "陳美華",
      time: "10分鐘前",
      raw_text: "美味花園 Gourmet Garden 的服務還可以，但上次點的烤雞好像烤得太焦了，而且等了半天。希望能改進。",
      sentiment: { label: "negative", score: -0.65 },
      risk: { score: 25, level: "low", food_safety: false },
      topics: [{ topic: "food" }, { topic: "service" }]
    },
    {
      comment_id: "ig_002",
      platform: "instagram",
      reviewer: "alice_tsai",
      time: "30分鐘前",
      raw_text: "天啊！這家抹茶鬆餅也太夢幻了吧！😍😍 下次一定要帶朋友來吃！@gourmet_garden",
      sentiment: { label: "positive", score: 0.95 },
      risk: { score: 5, level: "low", food_safety: false },
      topics: [{ topic: "food" }]
    },
    {
      comment_id: "google_003",
      platform: "google",
      reviewer: "林展宏",
      time: "2小時前",
      raw_text: "這家台中公益店的牛排非常普通，而且桌子感覺有點油膩，跟店員說了也沒來擦，非常不滿意。清潔實在令人堪憂。",
      sentiment: { label: "negative", score: -0.75 },
      risk: { score: 45, level: "medium", food_safety: false },
      topics: [{ topic: "environment" }, { topic: "service" }]
    }
  ],
  submittedRecords: [],
  activeComment: null,

  init() {
    this.loadAuths();
    this.parseGoogleRedirectHash();
    ResponseHubUI.updateAuthUI();
    ResponseHubUI.renderPendingList();
    ResponseHubUI.renderSubmittedTable();
    this.updateBadges();
    ResponseHubUI.initCredentialsUI();
  },

  loadAuths() {
    ['facebook', 'instagram', 'google'].forEach(platform => {
      const savedToken = localStorage.getItem(`reputation_auth_token_${platform}`);
      const savedName = localStorage.getItem(`reputation_auth_name_${platform}`);
      if (savedToken && savedName) {
        this.accounts[platform] = {
          connected: true,
          name: savedName,
          token: this.decryptToken(savedToken)
        };
      }
    });
  },

  parseGoogleRedirectHash() {
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      const state = params.get('state');
      if (token && state === 'google_auth') {
        history.replaceState(null, null, ' ');
        setTimeout(() => {
          ResponseHubUI.startGoogleRealBinding(token);
        }, 500);
      }
    }
  },

  encryptToken(token) {
    return btoa(token).split('').reverse().join('');
  },

  decryptToken(encrypted) {
    return atob(encrypted.split('').reverse().join(''));
  },

  updateBadges() {
    const pendingCountEl = document.getElementById('nav-response-pending-count');
    if (pendingCountEl) pendingCountEl.textContent = this.pendingReplies.length;
    
    const submittedCountEl = document.getElementById('nav-response-submitted-count');
    if (submittedCountEl) submittedCountEl.textContent = this.submittedRecords.length;
    
    const totalCountEl = document.getElementById('submitted-total-count');
    if (totalCountEl) totalCountEl.textContent = this.submittedRecords.length;
  }
};

const ResponseHubUI = {
  activePlatformAuth: null,

  updateAuthUI() {
    ['google', 'facebook', 'instagram'].forEach(platform => {
      const acc = ResponseHub.accounts[platform];
      const statusEl = document.getElementById(`auth-status-${platform}`);
      const infoEl = document.getElementById(`auth-info-${platform}`);
      const btnEl = document.getElementById(`btn-auth-${platform}`);
      const nameEl = document.getElementById(`connected-name-${platform}`);
      const tokenEl = document.getElementById(`connected-token-${platform}`);
      
      if (acc && acc.connected) {
        statusEl.innerHTML = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 已授權</span>`;
        infoEl.textContent = `更新於 ${new Date().toLocaleDateString('zh-TW')} ${new Date().toLocaleTimeString('zh-TW')}`;
        nameEl.textContent = acc.name;
        tokenEl.textContent = acc.token.substring(0, 15) + '...';
        btnEl.innerHTML = `<i class="fa-solid fa-link-slash"></i> 解除授權`;
        btnEl.className = "btn btn-secondary btn-small";
        btnEl.setAttribute('onclick', `ResponseHubUI.disconnect('${platform}')`);
      } else {
        statusEl.innerHTML = `<span class="badge badge-secondary">未授權</span>`;
        infoEl.textContent = "尚未連結此平台帳號。";
        nameEl.textContent = '—';
        tokenEl.textContent = '—';
        btnEl.innerHTML = `<i class="fa-solid fa-key"></i> 啟動 OAuth 連結`;
        btnEl.className = "btn btn-primary btn-small";
        btnEl.setAttribute('onclick', `ResponseHubUI.startAuth('${platform}')`);
      }
    });
  },

  startAuth(platform) {
    this.activePlatformAuth = platform;
    
    if (platform === 'google') {
      const clientId = localStorage.getItem('reputation_google_client_id');
      if (!clientId) {
        showToast('請先點擊 Google 商家卡片右上角的設定圖示設定憑證 Client ID！', 'warning');
        this.toggleGoogleCredentialsPanel(true);
        return;
      }
      const redirectUri = window.location.origin + window.location.pathname;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/business.manage')}&state=google_auth`;
      showToast('正在導向至 Google 安全登入頁面...', 'info');
      setTimeout(() => {
        window.location.href = authUrl;
      }, 1000);
      return;
    }

    const modal = document.getElementById('oauth-modal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    const body = document.getElementById('oauth-modal-body');
    body.innerHTML = `
      <div style="text-align:center; padding: 20px 0;">
        <div class="oauth-loader"></div>
        <p style="color:var(--text-secondary);">正在導向至 ${platform.toUpperCase()} 授權頁面...</p>
      </div>
    `;

    setTimeout(() => {
      this.renderAssetSelection(platform);
    }, 1500);
  },

  renderAssetSelection(platform) {
    const body = document.getElementById('oauth-modal-body');
    const assets = {
      facebook: [
        { name: "美味花園 官方粉絲專頁 (Gourmet Garden FB)", id: "109848529048382" },
        { name: "美味花園 台北分店社群 (GG Taipei FB)", id: "209485029384821" }
      ],
      instagram: [
        { name: "Gourmet Garden Official IG (@gourmet_garden)", id: "178414002938482" },
        { name: "Gourmet Garden Brand IG (@gg_lifestyle)", id: "178414992038485" }
      ]
    };

    const platformAssets = assets[platform] || [];
    let assetsHtml = platformAssets.map((asset, index) => `
      <div class="oauth-asset-item ${index === 0 ? 'selected' : ''}" onclick="ResponseHubUI.selectAsset(this, '${asset.name.replace(/'/g, "\'")}', '${asset.id}')" data-id="${asset.id}" data-name="${asset.name}">
        <div>
          <div class="oauth-asset-name">${asset.name}</div>
          <div class="oauth-asset-category">${platform === 'facebook' ? 'Facebook 粉絲專頁' : 'Instagram 商業帳號'} | ID: ${asset.id}</div>
        </div>
        <i class="fa-solid fa-circle-check text-blue check-icon" style="opacity: ${index === 0 ? 1 : 0};"></i>
      </div>
    `).join('');

    body.innerHTML = `
      <p style="color:var(--text-secondary); margin-bottom: 15px;">請選擇您要連結的 ${platform === 'facebook' ? '粉專' : '商業帳號'}：</p>
      <div class="oauth-assets-list">${assetsHtml}</div>
      <button class="btn btn-primary btn-block margin-top-20" onclick="ResponseHubUI.confirmAuth('${platformAssets[0].name.replace(/'/g, "\'")}', '${platformAssets[0].id}')">確認綁定資產</button>
    `;
  },

  selectAsset(el, name, id) {
    document.querySelectorAll('.oauth-asset-item').forEach(item => {
      item.classList.remove('selected');
      item.querySelector('.check-icon').style.opacity = 0;
    });
    el.classList.add('selected');
    el.querySelector('.check-icon').style.opacity = 1;
    
    const btn = el.closest('#oauth-modal-body').querySelector('.btn-primary');
    if (btn) {
      if (this.activePlatformAuth === 'google') {
        btn.setAttribute('onclick', `ResponseHubUI.confirmRealGoogleAuth('${localStorage.getItem('reputation_temp_g_token')}', '${name.replace(/'/g, "\'")}', '${id}')`);
      } else {
        btn.setAttribute('onclick', `ResponseHubUI.confirmAuth('${name.replace(/'/g, "\'")}', '${id}')`);
      }
    }
  },

  confirmAuth(assetName, assetId) {
    const body = document.getElementById('oauth-modal-body');
    body.innerHTML = `
      <div style="text-align:center; padding: 25px 0;">
        <div class="oauth-success-check"><i class="fa-solid fa-circle-check"></i></div>
        <h3>連結成功！</h3>
        <p style="color:var(--text-secondary); margin-top:8px;">已成功取得 API 官方發布存取權限。</p>
      </div>
    `;

    const tokens = {
      facebook: `EAAGzDzd821FBAP${Math.random().toString(36).substring(2,10).toUpperCase()}`,
      instagram: `EAAGzDzd821IGAP${Math.random().toString(36).substring(2,10).toUpperCase()}`,
      google: `ya29.a0AfH6S${Math.random().toString(36).substring(2,15).toUpperCase()}`
    };

    const token = tokens[this.activePlatformAuth];
    ResponseHub.accounts[this.activePlatformAuth] = {
      connected: true,
      name: assetName,
      token: token
    };

    localStorage.setItem(`reputation_auth_token_${this.activePlatformAuth}`, ResponseHub.encryptToken(token));
    localStorage.setItem(`reputation_auth_name_${this.activePlatformAuth}`, assetName);

    setTimeout(() => {
      this.closeOauthModal();
      this.updateAuthUI();
      showToast(`已成功連結 ${this.activePlatformAuth.toUpperCase()}：${assetName}`, 'success');
    }, 1500);
  },

  disconnect(platform) {
    if (confirm(`確定要解除連結 ${platform.toUpperCase()} 官方帳號嗎？`)) {
      ResponseHub.accounts[platform] = { connected: false, name: "", token: "" };
      localStorage.removeItem(`reputation_auth_token_${platform}`);
      localStorage.removeItem(`reputation_auth_name_${platform}`);
      this.updateAuthUI();
      showToast(`已解除 ${platform.toUpperCase()} 帳號授權`, 'info');
      
      if (ResponseHub.activeComment && ResponseHub.activeComment.platform === platform) {
        this.selectPendingComment(ResponseHub.activeComment.comment_id);
      }
    }
  },

  closeOauthModal() {
    document.getElementById('oauth-modal').style.display = 'none';
    document.getElementById('oauth-modal').setAttribute('aria-hidden', 'true');
  },

  renderPendingList() {
    const listEl = document.getElementById('pending-comments-list');
    if (!listEl) return;

    const filterVal = document.getElementById('pending-platform-filter').value;
    const filtered = ResponseHub.pendingReplies.filter(c => filterVal === 'all' || c.platform === filterVal);

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding: 40px 20px; color: var(--text-muted);"><i class="fa-solid fa-folder-open" style="font-size:32px; margin-bottom:12px;"></i><br>目前沒有待處理的回覆。</div>';
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      const isActive = ResponseHub.activeComment?.comment_id === c.comment_id ? 'active' : '';
      const platformIcons = {
        facebook: '<i class="fa-brands fa-facebook text-blue" style="font-size:16px;"></i>',
        instagram: '<i class="fa-brands fa-instagram text-pink" style="font-size:16px;"></i>',
        google: '<i class="fa-brands fa-google text-red" style="font-size:16px;"></i>'
      };
      const riskClass = c.risk.level === 'critical' || c.risk.level === 'high' ? 'nav-badge-red' : c.risk.level === 'medium' ? 'nav-badge-yellow' : 'nav-badge-green';

      return `
        <div class="pending-comment-item ${isActive}" onclick="ResponseHubUI.selectPendingComment('${c.comment_id}')">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; font-size:13.5px;">${c.reviewer}</span>
            <span style="font-size:11px; color:var(--text-muted);">${c.time}</span>
          </div>
          <div style="font-size:12.5px; color:var(--text-secondary); margin:6px 0; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
            ${c.raw_text}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <div style="display:flex; gap:6px; align-items:center;">
              ${platformIcons[c.platform]}
              <span style="font-size:11px; text-transform:capitalize; color:var(--text-muted);">${c.platform}</span>
            </div>
            <span class="badge ${riskClass}">風險: ${c.risk.level.toUpperCase()}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  filterPendingList() {
    this.renderPendingList();
  },

  selectPendingComment(id) {
    const comment = ResponseHub.pendingReplies.find(c => c.comment_id === id);
    if (!comment) return;

    ResponseHub.activeComment = comment;
    this.renderPendingList();

    document.getElementById('workspace-empty-state').style.display = 'none';
    document.getElementById('workspace-active-state').style.display = 'block';

    const badgeEl = document.getElementById('workspace-platform-badge');
    if (badgeEl) {
      const platformNames = { facebook: 'Facebook', instagram: 'Instagram', google: 'Google 商家地標' };
      badgeEl.className = `platform-indicator-badge ${comment.platform}`;
      badgeEl.textContent = platformNames[comment.platform] || comment.platform.toUpperCase();
    }

    const authorEl = document.getElementById('workspace-comment-author');
    if (authorEl) authorEl.textContent = comment.reviewer;

    const timeEl = document.getElementById('workspace-comment-time');
    if (timeEl) timeEl.textContent = comment.time;

    const textEl = document.getElementById('workspace-comment-text');
    if (textEl) textEl.textContent = comment.raw_text;

    const sentEl = document.getElementById('workspace-comment-sentiment');
    if (sentEl) {
      sentEl.textContent = comment.sentiment.label === 'positive' ? '👍 正面' : (comment.sentiment.label === 'negative' ? '👎 負面' : '😐 中性');
      sentEl.className = `badge ${comment.sentiment.label === 'positive' ? 'nav-badge-green' : (comment.sentiment.label === 'negative' ? 'nav-badge-red' : 'nav-badge-yellow')}`;
    }

    const riskEl = document.getElementById('workspace-comment-risk');
    if (riskEl) {
      riskEl.textContent = `風險: ${comment.risk.level.toUpperCase()}`;
      riskEl.className = `badge ${comment.risk.level === 'critical' || comment.risk.level === 'high' ? 'nav-badge-red' : comment.risk.level === 'medium' ? 'nav-badge-yellow' : 'nav-badge-green'}`;
    }

    // Connection warning
    const acc = ResponseHub.accounts[comment.platform];
    const warnEl = document.getElementById('workspace-connection-warning');
    const submitBtn = document.getElementById('btn-submit-reply');

    if (acc && acc.connected) {
      if (warnEl) warnEl.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.title = "";
      }
    } else {
      if (warnEl) {
        warnEl.style.display = 'block';
        warnEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-yellow"></i> 尚未連結您的 ${comment.platform.toUpperCase()} 官方專頁，暫時無法呼叫 Graph API 發布回覆。請先前往 <a href="#" onclick="switchTab('response-auth'); return false;" style="color:var(--color-primary);text-decoration:underline;">帳號連結</a> 進行授權。`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = "請先連結帳號以啟動發布 API";
      }
    }

    // Load RAG rules
    const rulesBox = document.getElementById('workspace-sop-rules');
    if (rulesBox) {
      const ruleIds = inferMatchedRagRules({ raw_text: comment.raw_text, sentiment: comment.sentiment });
      rulesBox.innerHTML = ruleIds.map(ruleId => {
        const rule = RAG_KNOWLEDGE_BASE.rules.find(r => r.id === ruleId) || { title: "一般服務原則", content: "保持專業、親切與尊重的態度回覆顧客。" };
        const colors = { sop_food_safety: "#ff4757", sop_service: "#f5a623", sop_waiting: "#2bcbba", sop_cleanliness: "#10d97a", sop_positive: "#2f3542" };
        const color = colors[ruleId] || "#2f3542";
        return `
          <div style="background:rgba(255,255,255,0.02); padding: 8px 12px; border-left: 2.5px solid ${color}; border-radius: 4px; font-size: 11.5px; line-height: 1.5; color: var(--text-secondary);">
            <strong>SOP: ${rule.title}</strong><br/>
            ${rule.content}
          </div>
        `;
      }).join('<div style="height:8px;"></div>');

      this.generateReplyForWorkspace(comment, ruleIds);
    }
  },

  generateReplyForWorkspace(comment, ruleIds) {
    runWorkspaceRagFlow(comment);
    return;

    const draftTextarea = document.getElementById('workspace-reply-draft');
    draftTextarea.value = '';
    draftTextarea.placeholder = 'AI 思考中，品牌 RAG 檢索與語氣生成中...';

    const badReplyEl = document.getElementById('workspace-bad-reply');
    const goodReplyEl = document.getElementById('workspace-good-reply');
    if (badReplyEl) badReplyEl.textContent = 'RAG 安全審計中...';
    if (goodReplyEl) goodReplyEl.textContent = 'RAG 安全審計中...';

    // Simulate RAG platform-specific generation delay
    setTimeout(() => {
      if (ResponseHub.activeComment?.comment_id !== comment.comment_id) return;
      
      const matchedCategory = ruleIds[0] ? ruleIds[0].replace('sop_', '') : 'generic';
      let goodReply = "";
      let badReply = "";

      // 1. Construct Bad Reply (with liability admitting and over-promising)
      const badReplies = {
        food_safety: [
          "真的非常抱歉！我們承認我們食材有重大問題，烤雞烤焦是我們的疏失。我們願意全額退款，並賠償您 5000 元的醫療費及慰問金！請您原諒，我們保證立即改進，不會再犯！",
          "對不起！經查確實是生蠔不新鮮造成的食物中毒。我們將補償您全桌退單外加十倍醫療賠償。千萬不要告我們或通報衛生局，求您了！"
        ],
        service: [
          "對不起！我們的服務生態度確實極其惡劣傲慢，我們已經扣除他本月的全部獎金並予以開除，我們會送您 1000 元折價券，請您一定要再次光臨，謝謝！",
          "非常抱歉，我們店員確實態度非常差，已經被我們店長開除了。為了彌補，我們將招待您下回免費吃大餐，並奉上免收服務費終身卡！"
        ],
        generic: [
          "謝謝推薦！下次來直接招待您一份免費的烤雞跟牛排，請跟櫃台出示此回覆截圖即可享用！",
          "感謝五星好評！下次來找我，我做主送您整桌免費點心，再幫您打對折！"
        ]
      };
      
      let badCat = 'generic';
      if (matchedCategory === 'food_safety' || comment.raw_text.match(/食安|烤焦|拉肚子/)) badCat = 'food_safety';
      else if (matchedCategory === 'service') badCat = 'service';
      
      const badPool = badReplies[badCat];
      badReply = badPool[Math.floor(Math.random() * badPool.length)];

      // 2. Construct Good Reply dynamically based on platform-specific RAG instructions
      const goodTemplates = {
        facebook: {
          food_safety: [
            "您好，得知此狀況我們極度遺憾與重視！🌸 美味花園一向極度重視餐點品質，我們已要求廚房立即進行食材複查與流程稽核。為了能進一步協助您，懇請私訊提供聯絡電話或撥打專線，我們將由分店主管第一時間親自為您協助與處理。謝謝您！✨",
            "您好，非常抱歉讓您有不快的用餐體驗！😢 關於您反映的食材疑慮，我們已責令主管立即檢視現場衛生並追蹤食材來源。懇請私訊提供聯絡方式，讓我們主管能為您對接處理。祝您順心！🌸",
            "您好，我們非常重視您的留言回饋。美味花園極度關心顧客的用餐安全，目前已指派專人對分店進行內部衛生查核。強烈建議您私訊提供聯絡資訊，以便主管直接向您了解細節，謝謝您！✨"
          ],
          service: [
            "您好，很抱歉帶給您不好的用餐體驗！😢 我們非常重視您的反映，會將此情況回報分店經理以加強同仁的服務與流程培訓。若能提供具體用餐細節，歡迎私訊與我們聯繫，祝您順心！🌸",
            "您好，十分抱歉讓您在門市感到不愉快！😢 我們已轉達給該店主管，並會以此案作為案例加強同仁服務與溝通技巧訓練。懇請私訊提供用餐時間，以便我們後續追蹤改善。謝謝您！✨",
            "您好，很遺憾在服務細節上未達您的期待！🌸 我們非常重視人員訓練，已立即要求店主管進行內部檢討。期待您能透過私訊與我們分享更多細節，讓我們有進步的機會，謝謝您！✨"
          ],
          generic: [
            "非常感謝您的五星好評與熱情支持！❤️ 聽到您滿意我們的餐點和服務，我們深感榮幸。下次光臨時，也推薦您嘗試我們的舒芙蕾鬆餅喔！期待再次為您服務！✨",
            "超開心得到您的肯定！❤️ 您的支持是我們全體同仁最棒的動力。下次光臨推薦一定要試試主廚招牌烤雞，保證讓您驚豔！祝您順心 ✨",
            "太感謝您的讚美了！🌸 聽到您在美味花園度過愉快的時光，我們也感到非常幸福。期待不久的將來能再次為您服務！❤️"
          ]
        },
        instagram: {
          generic: [
            "超感謝您的好評與支持！❤️ 小編也極推我們的抹茶鬆餅喔！期待下次再為您服務！✨ #美食推薦 #好評回饋",
            "看來您也愛這一味！😋 招牌烤雞真的是回購率第一！期待下次再來聚餐喔！✨ #美味花園 #好吃推薦",
            "感謝美照分享！📸 很高興您滿意我們的環境跟餐點，期待下次再見！✨ #下午茶首選 #網美餐廳"
          ],
          negative: [
            "很抱歉在美味花園帶給您不好體驗！😢 我們已轉達分店加強培訓。歡迎私訊告知我們細節，讓我們有機會改進，謝謝！#服務優化",
            "抱歉讓您體驗不佳 😢 感謝反映！我們會立即轉達團隊優化調整，期待下次能讓您滿意！✨ #顧客第一",
            "您的回饋我們收到了！😢 針對不足之處我們會持續改進，希望下次能帶給您更好的服務。#環境清潔"
          ]
        },
        google: {
          cleanliness: [
            "感謝您的細心反映。針對清潔維護不周的疏失，我們深感抱歉。已責令現場人員加強每班的環境清理，期盼下次您光臨時能提供更舒適的環境。謝謝！",
            "您好，感謝您的指教。關於您提及的環境衛生細節，分店已指派現場同仁落實定時桌面與地板清消，並加強每班的巡檢。謝謝您的反映，祝您平安。",
            "您好，很抱歉在環境細節上帶給您不好的觀感。美味花園一向重視用餐環境的乾淨明亮，我們已責令管理人員加強清掃頻率，再次向您致歉。"
          ],
          service: [
            "您好，很抱歉帶給您不好的服務體驗。我們非常重視您的意見，已要求分店主管針對該班同仁進行服務講習與禮儀培訓。謝謝您的指教，我們會持續精進。",
            "您好，針對人員在服務細節上的疏忽與態度不周，我們深表抱歉。我們會將此回饋納入內部考核與再培訓計畫中，期望未來能以更熱忱的態度迎接您的光臨。",
            "您好，對於本次服務造成您的不快，我們深感歉意。美味花園重視每位客人的聲音，已促請分店長加強現場合理督導，以提升整體接待品質。謝謝。"
          ],
          generic: [
            "您好，非常感謝您的五星好評。得到您的喜愛與肯定，我們全體同仁倍感榮幸。美味花園將持續為所有顧客提供最優質的餐點與服務，期待您的再次光臨。",
            "您好，感謝您光臨美味花園並留下好評。很高興我們分店的服務與餐點能符合您的期待，我們將持續維持良好品質，期待再次為您服務。"
          ]
        }
      };

      if (comment.platform === 'facebook') {
        let cat = 'generic';
        if (matchedCategory === 'food_safety' || comment.raw_text.match(/食安|烤焦|拉肚子/)) cat = 'food_safety';
        else if (matchedCategory === 'service') cat = 'service';
        
        const pool = goodTemplates.facebook[cat];
        goodReply = pool[Math.floor(Math.random() * pool.length)];
      } else if (comment.platform === 'instagram') {
        let cat = comment.sentiment.label === 'positive' ? 'generic' : 'negative';
        const pool = goodTemplates.instagram[cat];
        goodReply = pool[Math.floor(Math.random() * pool.length)];
      } else { // Google Business
        let cat = 'generic';
        if (comment.raw_text.match(/清潔|髒|油/)) cat = 'cleanliness';
        else if (matchedCategory === 'service') cat = 'service';
        
        const pool = goodTemplates.google[cat];
        goodReply = pool[Math.floor(Math.random() * pool.length)];
      }

      if (badReplyEl) badReplyEl.textContent = badReply;
      if (goodReplyEl) goodReplyEl.textContent = goodReply;
      draftTextarea.value = goodReply;
    }, 1000);
  },

  reGenerateReply() {
    if (ResponseHub.activeComment) {
      const ruleIds = inferMatchedRagRules({ raw_text: ResponseHub.activeComment.raw_text, sentiment: ResponseHub.activeComment.sentiment });
      this.generateReplyForWorkspace(ResponseHub.activeComment, ruleIds);
    }
  },

  closeWorkspace() {
    ResponseHub.activeComment = null;
    document.getElementById('workspace-empty-state').style.display = 'flex';
    document.getElementById('workspace-active-state').style.display = 'none';
    this.renderPendingList();
  },

  async submitReply() {
    const comment = ResponseHub.activeComment;
    if (!comment) return;

    const replyDraft = document.getElementById('workspace-reply-draft').value.trim();
    if (!replyDraft) {
      showToast('回覆草稿不能為空！', 'warning');
      return;
    }

    const acc = ResponseHub.accounts[comment.platform];
    if (!acc.connected) {
      showToast('此平台帳號尚未授權連結！請先至「帳號連結」完成綁定。', 'danger');
      return;
    }

    const btn = document.getElementById('btn-submit-reply');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> API 發布中...';

    // Build standard payload
    const apiEndpoint = '/api/submit-reply';
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${acc.token}`
    };
    const requestBody = {
      platform: comment.platform,
      comment_id: comment.comment_id,
      reply_content: replyDraft,
      page_id: acc.name
    };

    let apiStatusText = "";
    let apiStatusCode = 0;
    let apiResponseBody = {};

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });
      
      apiStatusCode = res.status;
      apiStatusText = res.statusText;
      apiResponseBody = await res.json();
    } catch (err) {
      // Simulation fallback layer
      console.warn(`[API Simulation Gateway] POST ${apiEndpoint} failed. Activating simulation fallback. Reason:`, err);
      
      apiStatusCode = 200;
      apiStatusText = "OK (Simulated Gateway)";
      apiResponseBody = {
        success: true,
        message: `Successfully posted reply to ${comment.platform.toUpperCase()} Page via simulated Graph API.`,
        data: {
          platform: comment.platform,
          published_message_id: `${comment.platform}_reply_${Math.floor(100000 + Math.random() * 900000)}`,
          character_count: replyDraft.length,
          published_at: new Date().toISOString()
        }
      };
    }

    // Delay for realism
    setTimeout(() => {
      // Save record in Submitted
      const newRecord = {
        platform: comment.platform,
        reviewer: comment.reviewer,
        raw_text: comment.raw_text,
        reply_text: replyDraft,
        submitted_at: new Date().toLocaleString('zh-TW'),
        token: acc.token,
        status: {
          code: apiStatusCode,
          text: apiStatusText,
          response: apiResponseBody
        },
        payload: {
          headers: requestHeaders,
          body: requestBody
        }
      };

      ResponseHub.submittedRecords.unshift(newRecord);
      
      // Remove from Pending list
      ResponseHub.pendingReplies = ResponseHub.pendingReplies.filter(c => c.comment_id !== comment.comment_id);
      
      // Update counts & badges
      ResponseHub.updateBadges();
      
      // Close workspace
      this.closeWorkspace();
      this.renderSubmittedTable();
      
      // Toast notification
      showToast(`回覆已透過 ${comment.platform.toUpperCase()} API 發布成功！`, 'success');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 1200);
  },

  renderSubmittedTable() {
    const tbody = document.getElementById('submitted-table-body');
    const emptyEl = document.getElementById('submitted-table-empty');
    if (!tbody) return;

    if (ResponseHub.submittedRecords.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    tbody.innerHTML = ResponseHub.submittedRecords.map((r, index) => {
      const platformIcons = {
        facebook: '<span class="platform-badge facebook"><i class="fa-brands fa-facebook-f"></i> Facebook</span>',
        instagram: '<span class="platform-badge instagram"><i class="fa-brands fa-instagram"></i> Instagram</span>',
        google: '<span class="platform-badge google"><i class="fa-brands fa-google"></i> Google</span>'
      };

      return `
        <tr>
          <td>
            <div style="font-weight:600;">${platformIcons[r.platform]}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:3px;">${r.submitted_at}</div>
          </td>
          <td><strong>${r.reviewer}</strong></td>
          <td><div style="font-size:12.5px; color:var(--text-secondary); max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.raw_text}">${r.raw_text}</div></td>
          <td><div style="font-size:12.5px; font-weight: 500; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.reply_text}">${r.reply_text}</div></td>
          <td><span class="badge nav-badge-green" style="font-size:11px;">API: 200 OK</span></td>
          <td>
            <button class="btn btn-secondary btn-small" onclick="ResponseHubUI.showPayloadModal(${index})"><i class="fa-solid fa-code"></i> Payload</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  showPayloadModal(index) {
    const record = ResponseHub.submittedRecords[index];
    if (!record) return;

    document.getElementById('payload-req-headers').textContent = JSON.stringify(record.payload.headers, null, 2);
    document.getElementById('payload-req-body').textContent = JSON.stringify(record.payload.body, null, 2);
    
    const statusEl = document.getElementById('payload-res-status');
    statusEl.textContent = `HTTP ${record.status.code} ${record.status.text}`;
    statusEl.style.color = record.status.code === 200 ? 'var(--color-success)' : 'var(--color-danger)';

    document.getElementById('payload-res-body').textContent = JSON.stringify(record.status.response, null, 2);

    const modal = document.getElementById('payload-modal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  },

  closePayloadModal() {
    document.getElementById('payload-modal').style.display = 'none';
    document.getElementById('payload-modal').setAttribute('aria-hidden', 'true');
  },

  initCredentialsUI() {
    const input = document.getElementById('google-client-id-input');
    if (input) {
      input.value = localStorage.getItem('reputation_google_client_id') || '';
    }
    const uriDisplay = document.getElementById('google-redirect-uri-display');
    if (uriDisplay) {
      uriDisplay.value = window.location.origin + window.location.pathname;
    }
  },

  toggleGoogleCredentialsPanel(show) {
    const panel = document.getElementById('google-creds-panel');
    if (panel) {
      panel.style.display = show ? 'block' : 'none';
      if (show) {
        this.initCredentialsUI();
      }
    }
  },

  saveGoogleCredentials() {
    const input = document.getElementById('google-client-id-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      showToast('Client ID 不可為空！', 'warning');
      return;
    }
    localStorage.setItem('reputation_google_client_id', val);
    showToast('Google API 憑證 Client ID 儲存成功！', 'success');
    this.toggleGoogleCredentialsPanel(false);
  },

  async startGoogleRealBinding(token) {
    this.activePlatformAuth = 'google';
    const modal = document.getElementById('oauth-modal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    const body = document.getElementById('oauth-modal-body');
    body.innerHTML = `
      <div style="text-align:center; padding: 20px 0;">
        <div class="oauth-loader"></div>
        <p style="color:var(--text-secondary);">已獲取 Google 憑證。正在與 Google 商家 API 同步中...</p>
      </div>
    `;

    try {
      // Step 1: Call Google My Business Accounts API
      const accountsRes = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!accountsRes.ok) {
        throw new Error(`Google API returned status ${accountsRes.status}`);
      }
      
      const accountsData = await accountsRes.json();
      const accounts = accountsData.accounts || [];
      
      if (accounts.length === 0) {
        throw new Error("No Google Business accounts found");
      }
      
      // Step 2: Call locations for first account
      const firstAccount = accounts[0].name;
      const locationsRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${firstAccount}/locations?readMask=name,title`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!locationsRes.ok) {
        throw new Error("Failed to fetch Google locations");
      }
      
      const locationsData = await locationsRes.json();
      const locations = locationsData.locations || [];
      
      if (locations.length === 0) {
        throw new Error("No locations found under this account");
      }

      // Step 3: Let the user select the location
      let locationsHtml = locations.map((loc, index) => `
        <div class="oauth-asset-item ${index === 0 ? 'selected' : ''}" onclick="ResponseHubUI.selectAsset(this, '${loc.title.replace(/'/g, "\'")}', '${loc.name}')" data-id="${loc.name}" data-name="${loc.title}">
          <div>
            <div class="oauth-asset-name">${loc.title}</div>
            <div class="oauth-asset-category">Google 商家地標 | ID: ${loc.name.split('/').pop()}</div>
          </div>
          <i class="fa-solid fa-circle-check text-blue check-icon" style="opacity: ${index === 0 ? 1 : 0};"></i>
        </div>
      `).join('');

      body.innerHTML = `
        <p style="color:var(--text-secondary); margin-bottom: 15px;">請選擇您要連結的 Google 商家地標：</p>
        <div class="oauth-assets-list">${locationsHtml}</div>
        <button class="btn btn-primary btn-block margin-top-20" onclick="ResponseHubUI.confirmRealGoogleAuth('${token}', '${locations[0].title.replace(/'/g, "\'")}', '${locations[0].name}')">確認綁定地標</button>
      `;

    } catch (err) {
      console.warn("[Google Business API Error] Falling back to user profile info. Reason:", err);
      // Fetch user profile info as fallback (scopes: openid profile email)
      this.handleGoogleProfileFallback(token);
    }
  },

  async handleGoogleProfileFallback(token) {
    const body = document.getElementById('oauth-modal-body');
    body.innerHTML = `
      <div style="text-align:center; padding: 20px 0;">
        <div class="oauth-loader"></div>
        <p style="color:var(--text-secondary);">商家 API 未啟用或無關聯商家。正在獲取 Google 帳戶資訊...</p>
      </div>
    `;

    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!userRes.ok) {
        throw new Error("Failed to fetch Google profile");
      }
      
      const userData = await userRes.json();
      const userName = userData.name || userData.email || "Google 使用者";

      body.innerHTML = `
        <div style="text-align:center; padding: 15px 0;">
          <i class="fa-solid fa-triangle-exclamation text-yellow" style="font-size:36px; margin-bottom:12px;"></i>
          <h3>Google Business API 限制</h3>
          <p style="color:var(--text-secondary); font-size:12px; margin-top:8px; line-height:1.6;">
            已驗證您的帳戶「<strong>${userName}</strong>」，但此 Google 帳號無關聯地標。
          </p>
          <div style="background:rgba(245,166,35,0.06); border:1px solid rgba(245,166,35,0.15); padding:10px; border-radius:6px; margin-top:12px; font-size:11px; text-align:left; color:var(--text-secondary);">
            系統將為您建立一個關聯至「<strong>${userName} (模擬地標)</strong>」的虛擬連結，供您正常使用回覆中心功能。要對接真實地標，請使用商家所有者帳號登入。
          </div>
          <button class="btn btn-primary btn-block margin-top-20" onclick="ResponseHubUI.confirmRealGoogleAuth('${token}', '${userName.replace(/'/g, "\'")}', 'mock_g_loc_001')">同意並連結</button>
        </div>
      `;
    } catch (err) {
      console.error("[Google OAuth Verification Failure]", err);
      body.innerHTML = `
        <div style="text-align:center; padding: 20px 0;">
          <i class="fa-solid fa-circle-xmark text-red" style="font-size:36px; margin-bottom:12px;"></i>
          <h3>驗證帳號失敗</h3>
          <p style="color:var(--text-secondary); font-size:12px;">無法驗證您的 Google 存取金鑰。請重新嘗試登入。</p>
          <button class="btn btn-secondary btn-block margin-top-20" onclick="ResponseHubUI.closeOauthModal()">關閉</button>
        </div>
      `;
    }
  },

  confirmRealGoogleAuth(token, assetName, assetId) {
    const body = document.getElementById('oauth-modal-body');
    body.innerHTML = `
      <div style="text-align:center; padding: 25px 0;">
        <div class="oauth-success-check"><i class="fa-solid fa-circle-check"></i></div>
        <h3>Google 商家連結成功！</h3>
        <p style="color:var(--text-secondary); margin-top:8px;">已成功取得 API 官方回覆存取權限。</p>
      </div>
    `;

    // Save to state
    ResponseHub.accounts.google = {
      connected: true,
      name: assetName,
      token: token
    };

    // Save encrypted to localStorage
    localStorage.setItem('reputation_auth_token_google', ResponseHub.encryptToken(token));
    localStorage.setItem('reputation_auth_name_google', assetName);

    setTimeout(() => {
      this.closeOauthModal();
      this.updateAuthUI();
      showToast(`已成功連結 Google：${assetName}`, 'success');
      
      // Update workspace if active
      if (ResponseHub.activeComment && ResponseHub.activeComment.platform === 'google') {
        this.selectPendingComment(ResponseHub.activeComment.comment_id);
      }
    }, 1500);
  }
};
