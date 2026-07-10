// Sanitized demo dataset for the public portfolio repository.
// This file intentionally contains only mock content.

const INGREDIENTS = {
  "닭안심": { level: "safe", cal: 165, note: "기본 단백질 예시 재료입니다.", servingPerKg: 8 },
  "연어": { level: "safe", cal: 208, note: "오메가-3가 풍부한 예시 재료입니다.", servingPerKg: 4 },
  "고구마": { level: "safe", cal: 86, note: "포만감과 식이섬유를 보여주기 위한 예시입니다.", servingPerKg: 6 },
  "당근": { level: "safe", cal: 41, note: "채소 조합 예시용 재료입니다.", servingPerKg: 8 },
  "단호박": { level: "safe", cal: 49, note: "부드러운 식감의 예시 재료입니다.", servingPerKg: 8 },
  "블루베리": { level: "safe", cal: 57, note: "과일 카테고리 예시 재료입니다.", servingPerKg: 4 },
  "사과": { level: "caution", cal: 52, note: "씨와 심은 제거 후 소량 급여 예시입니다.", servingPerKg: 4 },
  "브로콜리": { level: "caution", cal: 34, note: "과량 급여 시 복부 팽만 주의 예시입니다.", servingPerKg: 3 },
  "양파": { level: "danger", cal: 40, note: "반려견에게 위험한 예시 재료입니다.", servingPerKg: 0 },
  "초콜릿": { level: "danger", cal: 546, note: "반려견에게 위험한 예시 재료입니다.", servingPerKg: 0 },
}

const INGREDIENT_TREE = [
  {
    major: "단백질",
    subs: [
      { name: "육류", items: ["닭안심"] },
      { name: "어류", items: ["연어"] },
    ],
  },
  {
    major: "채소",
    subs: [
      { name: "뿌리채소", items: ["당근", "고구마"] },
      { name: "기타 채소", items: ["단호박", "브로콜리"] },
    ],
  },
  {
    major: "과일",
    subs: [
      { name: "베리류", items: ["블루베리"] },
      { name: "일반 과일", items: ["사과"] },
    ],
  },
  {
    major: "위험 재료",
    subs: [
      { name: "금지 예시", items: ["양파", "초콜릿"] },
    ],
  },
]

const MAJOR_TONES = {
  "단백질": "#C77E68",
  "채소": "#7EA86B",
  "과일": "#C28BA5",
  "위험 재료": "#C62828",
}

const TREAT_TYPES = ["동결건조", "쿠키류", "육포류", "초간식", "찜간식"]
const MEAT_JERKY_SNACK_TYPES = ["육포", "스틱", "육포류"]

const TREAT_TYPE_DESC = {
  "동결건조": "수분을 줄여 바삭한 식감을 주는 간식 예시",
  "쿠키류": "오븐 또는 건조기로 만드는 베이크 간식 예시",
  "육포류": "고기와 채소를 말려 만드는 단백질 간식 예시",
  "초간식": "짧은 조리로 빠르게 만드는 간식 예시",
  "찜간식": "찌거나 삶아 부드럽게 만드는 간식 예시",
}

function matchesSnackTypeFilter(recipeSnackType, filter) {
  if (filter === "전체") return true
  if (filter === "육포류") return MEAT_JERKY_SNACK_TYPES.includes(recipeSnackType)
  return recipeSnackType === filter
}

const RECIPES = [
  {
    id: "demo-r1",
    name: "연어 고구마 스틱",
    type: "육포류",
    ingredients: [
      { name: "연어", amount: "80g" },
      { name: "고구마", amount: "100g" },
    ],
    safety: "safe",
    tags: ["#데모", "#단백질", "#입문용"],
    color: "#E8B57D",
    steps: [
      "고구마를 찐 뒤 으깨줍니다.",
      "연어를 잘게 다집니다.",
      "두 재료를 섞어 길쭉한 스틱 형태로 만듭니다.",
      "오븐이나 건조기로 충분히 익혀줍니다.",
    ],
  },
  {
    id: "demo-r2",
    name: "당근 블루베리 퓌레",
    type: "초간식",
    ingredients: [
      { name: "당근", amount: "60g" },
      { name: "블루베리", amount: "20g" },
    ],
    safety: "safe",
    tags: ["#데모", "#채소", "#과일"],
    color: "#C77E68",
    steps: [
      "당근을 익힌 뒤 부드럽게 갈아줍니다.",
      "블루베리를 소량 섞어 마무리합니다.",
    ],
  },
  {
    id: "demo-r3",
    name: "닭안심 단호박 볼",
    type: "찜간식",
    ingredients: [
      { name: "닭안심", amount: "100g" },
      { name: "단호박", amount: "80g" },
    ],
    safety: "safe",
    tags: ["#데모", "#부드러운식감"],
    color: "#D6A87B",
    steps: [
      "단호박을 찐 뒤 으깨줍니다.",
      "닭안심을 익혀 잘게 찢습니다.",
      "섞어서 한입 크기 볼로 만든 뒤 살짝 더 익혀줍니다.",
    ],
  },
]

const SUGGESTED_QUESTIONS = [
  "어느 정도 양까지 줄 수 있나요?",
  "대체 재료로 무엇이 좋을까요?",
  "다이어트 중에도 괜찮을까요?",
  "처음 먹이는 재료는 어떻게 테스트하나요?",
]

const GUIDE_RESPONSES = {
  "어느 정도 양까지 줄 수 있나요?": (profile) =>
    profile
      ? `${profile.name}(${profile.weight}kg) 기준으로 간식은 하루 총 식사량의 10% 이내를 권장하는 식의 UX 데모 응답입니다.`
      : "프로필 정보가 있으면 체중 기준 데모 응답을 더 구체적으로 보여줄 수 있습니다.",
  "대체 재료로 무엇이 좋을까요?": () =>
    "단백질은 닭안심과 연어, 채소는 당근과 단호박처럼 카테고리별 대체가 가능하다는 데모 응답입니다.",
  "다이어트 중에도 괜찮을까요?": () =>
    "다이어트 중에는 저지방 단백질과 채소 비중을 높이는 방향의 데모 응답을 보여줍니다.",
  "처음 먹이는 재료는 어떻게 테스트하나요?": () =>
    "소량부터 시작하고 반응을 기록하는 흐름을 안내하는 데모 응답입니다.",
}

const HEALTH_CONDITIONS = ["체중관리", "민감한 위장", "신장/요로", "심장", "피부"]
const TREAT_TAGS = ["#데모", "#단백질", "#채소", "#과일", "#입문용", "#부드러운식감"]

const RELATED_INGREDIENTS = {
  "닭안심": [
    { name: "닭가슴살", level: "safe", reason: "비슷한 저지방 단백질 예시입니다." },
    { name: "닭다리살", level: "caution", reason: "지방 함량 차이를 보여주기 위한 예시입니다." },
  ],
  "연어": [
    { name: "구운 연어", level: "safe", reason: "조리 상태 예시입니다." },
    { name: "훈제 연어", level: "danger", reason: "염분이 높을 수 있는 가공식품 예시입니다." },
  ],
  "고구마": [
    { name: "찐 고구마", level: "safe", reason: "조리형 변형 예시입니다." },
    { name: "말린 고구마", level: "safe", reason: "간식 형태 변형 예시입니다." },
  ],
  "당근": [
    { name: "찐 당근", level: "safe", reason: "소화가 쉬운 형태 예시입니다." },
    { name: "당근 퓌레", level: "safe", reason: "부드러운 식감 예시입니다." },
  ],
  "사과": [
    { name: "사과 과육", level: "safe", reason: "씨 제거 후 과육만 사용하는 예시입니다." },
    { name: "사과 씨", level: "danger", reason: "위험 요소를 설명하는 예시입니다." },
  ],
  "양파": [
    { name: "양파 분말", level: "danger", reason: "가공 형태도 주의가 필요하다는 예시입니다." },
  ],
}

const NONGSARO_SAFE_INGREDIENTS = {
  "파프리카": {
    level: "safe",
    note: "공개 저장소에서는 실제 데이터셋 대신 일반화된 예시 메모만 제공합니다.",
  },
  "감자": {
    level: "safe",
    note: "충분히 익혀서 사용하는 조리 예시 메모입니다.",
  },
  "크랜베리": {
    level: "caution",
    note: "가공품의 당 함량을 확인해야 한다는 주의 예시 메모입니다.",
  },
}

export {
  INGREDIENTS,
  INGREDIENT_TREE,
  MAJOR_TONES,
  TREAT_TYPES,
  TREAT_TYPE_DESC,
  MEAT_JERKY_SNACK_TYPES,
  matchesSnackTypeFilter,
  RECIPES,
  SUGGESTED_QUESTIONS,
  GUIDE_RESPONSES,
  HEALTH_CONDITIONS,
  TREAT_TAGS,
  RELATED_INGREDIENTS,
  NONGSARO_SAFE_INGREDIENTS,
}
