/**
 * 成分規則庫
 *
 * 每條規則會拿去比對「單一成分項目」（已經拆開、正規化過的字串），
 * 而不是整段成分表 —— 這樣才能避免「玉米」誤判成「米」這種事。
 * exclude 用來擋掉包含關係造成的誤判。
 *
 * 這是自己用的參考標記，不是獸醫建議。有疑慮還是問醫生。
 */

export type Severity = 'good' | 'info' | 'caution' | 'warn';

export interface IngredientRule {
  id: string;
  label: string;
  category: string;
  severity: Severity;
  /** 正規化後用 includes 比對 */
  patterns: string[];
  /** 命中這些字就不算（處理「玉米」vs「米」這類包含關係） */
  exclude?: string[];
  note: string;
}

export const INGREDIENT_RULES: IngredientRule[] = [
  /* ── 爭議膠類 ───────────────────────────────────────── */
  {
    id: 'carrageenan',
    label: '卡拉膠',
    category: '膠類',
    severity: 'warn',
    patterns: ['卡拉膠', '鹿角菜膠', '角叉菜', 'carrageenan', 'カラギーナン', '卡拉胶'],
    note: '爭議最大的增稠劑，部分研究指出可能刺激腸道，長期餵食建議避開。',
  },
  {
    id: 'guar-gum',
    label: '關華豆膠',
    category: '膠類',
    severity: 'caution',
    patterns: ['關華豆膠', '瓜爾豆膠', '瓜爾膠', 'guargum', 'guar gum', 'グアーガム'],
    note: '常見的天然增稠劑，爭議比卡拉膠小，但腸胃敏感的貓可能會軟便。',
  },
  {
    id: 'xanthan',
    label: '三仙膠',
    category: '膠類',
    severity: 'caution',
    patterns: ['三仙膠', '黃原膠', '玉米糖膠', 'xanthan', 'キサンタンガム'],
    note: '發酵來源的增稠劑，一般認為溫和，但同樣屬於質地添加物。',
  },
  {
    id: 'locust-bean',
    label: '刺槐豆膠',
    category: '膠類',
    severity: 'caution',
    patterns: ['刺槐豆膠', '槐豆膠', 'locustbean', 'locust bean', 'カロブビーンガム'],
    note: '豆科來源增稠劑，常與卡拉膠一起用來做凍狀質地。',
  },
  {
    id: 'agar',
    label: '洋菜膠',
    category: '膠類',
    severity: 'info',
    patterns: ['洋菜', '寒天', 'agar', '石花菜'],
    note: '海藻來源，爭議較小，通常是用來做果凍狀質地。',
  },
  {
    id: 'modified-starch',
    label: '修飾澱粉',
    category: '膠類',
    severity: 'caution',
    patterns: ['修飾澱粉', '化製澱粉', 'modifiedstarch', 'modified starch'],
    note: '加工過的澱粉，用途是勾芡與定型，營養價值低。',
  },

  /* ── 來源不明的蛋白/油脂 ────────────────────────────── */
  {
    id: 'by-product',
    label: '副產品',
    category: '來源不明',
    severity: 'warn',
    patterns: ['副產品', '副產物', 'byproduct', 'by-product', 'by product', '副产品'],
    note: '沒有指明是哪個部位、哪種動物，品質浮動大。',
  },
  {
    id: 'meat-meal',
    label: '肉粉／肉骨粉',
    category: '來源不明',
    severity: 'caution',
    patterns: ['肉粉', '肉骨粉', 'meatmeal', 'meat meal', 'bonemeal', 'meatandbonemeal'],
    note: '高溫熬煮再乾燥的原料，蛋白含量高但來源與新鮮度不透明。',
  },
  {
    id: 'vague-meat',
    label: '未指明肉類',
    category: '來源不明',
    severity: 'caution',
    patterns: ['肉類', '家禽', '動物性蛋白', 'meat', 'poultry', 'animalprotein'],
    exclude: ['副產品', '肉粉', '肉骨粉', 'byproduct', 'meal'],
    note: '只寫「肉類／家禽」沒寫是什麼動物，過敏源追查會很困難。',
  },
  {
    id: 'animal-fat',
    label: '動物性油脂',
    category: '來源不明',
    severity: 'caution',
    patterns: ['動物性油脂', '動物油脂', 'animalfat', 'animal fat'],
    note: '未指明來源的油脂，通常是提升適口性用。',
  },

  /* ── 澱粉／碳水填充 ─────────────────────────────────── */
  {
    id: 'corn',
    label: '玉米',
    category: '穀物澱粉',
    severity: 'caution',
    patterns: ['玉米', 'corn', 'maize', 'コーン', '粟米'],
    exclude: ['玉米糖膠'],
    note: '常見的低成本碳水填充，貓對穀物澱粉的利用率不高。',
  },
  {
    id: 'wheat',
    label: '小麥／麩質',
    category: '穀物澱粉',
    severity: 'caution',
    patterns: ['小麥', '麩質', '麵粉', 'wheat', 'gluten', '小麦'],
    note: '碳水填充，也是常見過敏原之一。',
  },
  {
    id: 'rice',
    label: '米',
    category: '穀物澱粉',
    severity: 'info',
    patterns: ['米', 'rice', 'ライス'],
    exclude: ['玉米', '米糠油'],
    note: '相對溫和的碳水來源，但對貓仍屬非必要的填充。',
  },
  {
    id: 'potato',
    label: '馬鈴薯／樹薯',
    category: '穀物澱粉',
    severity: 'caution',
    patterns: ['馬鈴薯', '樹薯', '木薯', '地瓜', '番薯', 'potato', 'tapioca', 'cassava'],
    note: '無穀配方常見的替代澱粉，碳水比例一樣可能偏高。',
  },
  {
    id: 'legume',
    label: '豆類',
    category: '穀物澱粉',
    severity: 'caution',
    patterns: ['豌豆', '大豆', '黃豆', '鷹嘴豆', '扁豆', 'pea', 'soy', 'lentil', 'chickpea'],
    exclude: ['刺槐豆膠', '關華豆膠', '瓜爾豆膠', '槐豆膠'],
    note: '植物性蛋白會拉高帳面蛋白數字，但貓的吸收效率不如動物性蛋白。',
  },

  /* ── 誘食劑／調味 ──────────────────────────────────── */
  {
    id: 'sugar',
    label: '糖',
    category: '調味',
    severity: 'warn',
    patterns: ['糖', 'sugar', 'syrup', '糖蜜'],
    exclude: ['寡糖', '低聚糖', '葡萄糖胺', '氨基葡萄糖', '半乳糖', '甘露寡糖', '玉米糖膠'],
    note: '貓吃不出甜味，加糖多半是為了色澤或成本，沒有營養必要。',
  },
  {
    id: 'caramel',
    label: '焦糖色素',
    category: '調味',
    severity: 'warn',
    patterns: ['焦糖色素', '焦糖', 'caramelcolor', 'caramel'],
    note: '純粹是給人看的顏色添加物，對貓沒有意義。',
  },
  {
    id: 'artificial-color',
    label: '人工色素',
    category: '調味',
    severity: 'warn',
    patterns: ['人工色素', '食用色素', '紅色', '藍色', '黃色', 'red40', 'blue2', 'yellow5'],
    note: '著色劑，只影響外觀，建議避免。',
  },
  {
    id: 'yeast-extract',
    label: '酵母萃取',
    category: '調味',
    severity: 'info',
    patterns: ['酵母萃取', '酵母抽出', 'yeastextract', 'yeast extract'],
    note: '天然誘食劑，本身無害，但代表配方需要額外提味。',
  },
  {
    id: 'msg',
    label: '味精類',
    category: '調味',
    severity: 'warn',
    patterns: ['麩胺酸鈉', '谷氨酸钠', 'msg', 'monosodiumglutamate'],
    note: '增味劑，長期餵食沒有必要。',
  },
  {
    id: 'nitrite',
    label: '亞硝酸鹽',
    category: '調味',
    severity: 'warn',
    patterns: ['亞硝酸', 'nitrite'],
    note: '保色劑，人食品也有爭議，貓食建議避開。',
  },

  /* ── 化學防腐劑 ────────────────────────────────────── */
  {
    id: 'chem-preservative',
    label: '化學防腐劑',
    category: '防腐劑',
    severity: 'warn',
    patterns: ['bha', 'bht', '乙氧基喹', 'ethoxyquin', '沒食子酸丙酯', 'propylgallate'],
    note: 'BHA／BHT／乙氧基喹因等合成抗氧化劑，長期爭議大。',
  },

  /* ── 加分項 ────────────────────────────────────────── */
  {
    id: 'taurine',
    label: '牛磺酸',
    category: '加分',
    severity: 'good',
    patterns: ['牛磺酸', 'taurine', 'タウリン'],
    note: '貓的必需胺基酸，缺乏會影響心臟與視力。主食罐一定要有。',
  },
  {
    id: 'vitamins',
    label: '維生素／礦物質',
    category: '加分',
    severity: 'good',
    patterns: [
      '維生素',
      '维生素',
      'vitamin',
      '礦物質',
      '矿物质',
      'mineral',
      '氯化膽鹼',
      'choline',
      'ビタミン',
    ],
    note: '有補足維礦通常代表這是設計成主食的配方。',
  },
  {
    id: 'fish-oil',
    label: '魚油／Omega-3',
    category: '加分',
    severity: 'good',
    patterns: ['魚油', 'fishoil', 'fish oil', 'dha', 'epa', 'omega'],
    note: '對皮毛與關節有幫助的好油脂。',
  },
  {
    id: 'organ',
    label: '內臟',
    category: '加分',
    severity: 'good',
    patterns: ['肝', '心臟', '雞胗', '腎', 'liver', 'heart', 'gizzard', 'kidney'],
    note: '明確標示的內臟是天然的維生素與牛磺酸來源。',
  },
];

export interface MeatGroup {
  id: string;
  /** 顯示用的名字，統計時同一群的中英別名都算成這個 */
  label: string;
  patterns: string[];
  /** 明明不是肉、卻含有上面關鍵字的詞（「牛磺酸」不是牛肉、「馬鈴薯」不是馬肉） */
  exclude?: string[];
}

/**
 * 明確的肉／魚來源，依「群」收攏中英別名（chicken 和「雞」是同一種肉）。
 * 用途有二：判斷第一成分好不好，以及統計「這罐主要是什麼肉」。
 *
 * 順序就是比對順序，**包含關係的要放前面**：
 * 「火雞」normalize 後含有「雞」，排在雞後面就會被當成雞肉。
 */
export const MEAT_GROUPS: MeatGroup[] = [
  { id: 'turkey', label: '火雞', patterns: ['火雞', 'turkey'] },
  { id: 'chicken', label: '雞肉', patterns: ['雞', 'chicken'], exclude: ['雞蛋'] },
  { id: 'duck', label: '鴨肉', patterns: ['鴨', 'duck'] },
  { id: 'goose', label: '鵝肉', patterns: ['鵝'] },
  {
    id: 'beef',
    label: '牛肉',
    patterns: ['牛', 'beef'],
    // 牛磺酸幾乎每罐都有，不排掉的話沒有肉的罐頭會被判成牛肉
    exclude: ['牛磺酸', 'taurine', '牛奶', '牛乳', '牛油'],
  },
  { id: 'pork', label: '豬肉', patterns: ['豬', 'pork'] },
  { id: 'lamb', label: '羊肉', patterns: ['羊', 'lamb', 'mutton'], exclude: ['羊奶', '羊乳'] },
  { id: 'rabbit', label: '兔肉', patterns: ['兔', 'rabbit'] },
  { id: 'venison', label: '鹿肉', patterns: ['鹿', 'venison'] },
  { id: 'horse', label: '馬肉', patterns: ['馬'], exclude: ['馬鈴薯'] },
  { id: 'tuna', label: '鮪魚', patterns: ['鮪魚', 'tuna'] },
  { id: 'bonito', label: '鰹魚', patterns: ['鰹魚', 'bonito'] },
  { id: 'katsuobushi', label: '柴魚', patterns: ['柴魚'] },
  { id: 'salmon', label: '鮭魚', patterns: ['鮭魚', 'salmon'] },
  { id: 'mackerel', label: '鯖魚', patterns: ['鯖魚', 'mackerel'] },
  { id: 'sardine', label: '沙丁魚', patterns: ['沙丁', 'sardine'] },
  { id: 'cod', label: '鱈魚', patterns: ['鱈魚', 'cod'] },
  { id: 'tilapia', label: '吳郭魚', patterns: ['吳郭魚'] },
  { id: 'whitefish', label: '白身魚', patterns: ['白身魚', 'whitefish'] },
  { id: 'yellowtail', label: '鰤魚', patterns: ['鰤魚'] },
  { id: 'smallfish', label: '小魚', patterns: ['小魚'] },
  { id: 'shrimp', label: '蝦', patterns: ['蝦', 'shrimp', 'prawn'], exclude: ['蝦紅素'] },
  { id: 'crab', label: '蟹', patterns: ['蟹', 'crab'] },
  { id: 'scallop', label: '干貝', patterns: ['干貝', 'scallop'] },
];


export const SEVERITY_ORDER: Record<Severity, number> = {
  warn: 0,
  caution: 1,
  info: 2,
  good: 3,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  warn: '留意',
  caution: '注意',
  info: '中性',
  good: '加分',
};
