export type MaterialId = 'steel' | 'silk' | 'seal' | 'ash' | 'jade';

export interface CraftingMaterialDef {
  id: MaterialId;
  name: string;
  shortName: string;
  description: string;
  colorHex: number;
  cssColor: string;
  shape: 'ingot' | 'spool' | 'talisman' | 'crystal' | 'orb';
}

export const MATERIALS_CATALOG: Record<MaterialId, CraftingMaterialDef> = {
  steel: {
    id: 'steel',
    name: 'Пареньская Сталь',
    shortName: 'Сталь',
    description: 'Кованое железо охотских и камчатских кузнецов, закаленное в ледяной рапе.',
    colorHex: 0x38bdf8,
    cssColor: '#38bdf8',
    shape: 'ingot',
  },
  silk: {
    id: 'silk',
    name: 'Заговоренная Береста и Шёлк',
    shortName: 'Шёлк',
    description: 'Переплетение японского шёлка с Карафуто и прочной таёжной бересты.',
    colorHex: 0xf43f5e,
    cssColor: '#f43f5e',
    shape: 'spool',
  },
  seal: {
    id: 'seal',
    name: 'Оберег-Офуда',
    shortName: 'Обереги',
    description: 'Двусторонний талисман: синтоистская вязь с одной стороны и славянские резы с другой.',
    colorHex: 0xf59e0b,
    cssColor: '#f59e0b',
    shape: 'talisman',
  },
  ash: {
    id: 'ash',
    name: 'Янтарь Охотского Тумана',
    shortName: 'Янтарь',
    description: 'Застывшая смола вековых кедров, пропитанная дыханием морской хтони.',
    colorHex: 0xa855f7,
    cssColor: '#a855f7',
    shape: 'orb',
  },
  jade: {
    id: 'jade',
    name: 'Шаманский Нефрит',
    shortName: 'Нефрит',
    description: 'Зеленый саayanский камень душ, пульсирующий в груди древних духов севера.',
    colorHex: 0x10b981,
    cssColor: '#10b981',
    shape: 'crystal',
  },
};

export type WeaponStyle = 'katana' | 'odachi' | 'twin_kodachi' | 'naginata' | 'cleaver' | 'void_tachi';

export interface WeaponDef {
  id: string;
  name: string;
  subtitle: string;
  style: WeaponStyle;
  baseDmg: number;
  critChance: number;
  critMult: number;
  chargeSpeed: number;
  parryWindowBonus: number;
  bleedDmg: number;
  bladeColor: number;
  hiltColor: number;
  glowColor: string;
  description: string;
  recipe: Partial<Record<MaterialId, number>>;
  soulsCost: number;
}

export const WEAPONS_CATALOG: WeaponDef[] = [
  {
    id: 'shibuya_katana',
    name: 'Катана «Амурский Иней»',
    subtitle: 'Пограничный клинок заставы',
    style: 'katana',
    baseDmg: 15,
    critChance: 0.16,
    critMult: 1.65,
    chargeSpeed: 1.15,
    parryWindowBonus: 0.06,
    bleedDmg: 0,
    bladeColor: 0x00ffcc,
    hiltColor: 0x991b1b,
    glowColor: '#00ffcc',
    description: 'Трофейный клинок с рукоятью из мореного дуба и морозной кромкой. Идеально лежит в зубах русской псовой борзой.',
    recipe: {},
    soulsCost: 0,
  },
  {
    id: 'twin_kodachi',
    name: 'Парные Ножи «Пареньские Клыки»',
    subtitle: 'Двойные чукотско-японские клинки',
    style: 'twin_kodachi',
    baseDmg: 24,
    critChance: 0.32,
    critMult: 1.85,
    chargeSpeed: 1.45,
    parryWindowBonus: 0.12,
    bleedDmg: 4,
    bladeColor: 0x38bdf8,
    hiltColor: 0x1e293b,
    glowColor: '#38bdf8',
    description: 'Два скрещенных таёжных кодати в пасти. Позволяют наносить молниеносные серии ударов и легко парировать выпады келе.',
    recipe: { steel: 3, silk: 2 },
    soulsCost: 22,
  },
  {
    id: 'cursed_odachi',
    name: 'Одати «Чернобог-Мурамаса»',
    subtitle: 'Двуручный меч сопок',
    style: 'odachi',
    baseDmg: 36,
    critChance: 0.22,
    critMult: 2.1,
    chargeSpeed: 0.9,
    parryWindowBonus: 0.02,
    bleedDmg: 9,
    bladeColor: 0xff0055,
    hiltColor: 0x31102f,
    glowColor: '#ff0055',
    description: 'Сверхдлинный багровый клинок, выкованный в жерле камчатского вулкана. Оставляет глубокие кровоточащие раны.',
    recipe: { steel: 5, seal: 3, ash: 2 },
    soulsCost: 45,
  },
  {
    id: 'yakuza_cleaver',
    name: 'Косторез «Гарпун Беринга»',
    subtitle: 'Зазубренный тесак китобоев',
    style: 'cleaver',
    baseDmg: 48,
    critChance: 0.20,
    critMult: 2.05,
    chargeSpeed: 0.95,
    parryWindowBonus: 0.05,
    bleedDmg: 14,
    bladeColor: 0xf59e0b,
    hiltColor: 0x27272a,
    glowColor: '#f59e0b',
    description: 'Тяжелый тесак с зубьями из моржового клыка и раскаленной стальной шиной. Сокрушает панцири водяных и кости шатунов.',
    recipe: { steel: 8, ash: 4, silk: 3 },
    soulsCost: 80,
  },
  {
    id: 'kitsune_naginata',
    name: 'Совня-Нагината «Хозяйка Тайги»',
    subtitle: 'Древковое лезвие староверов и мико',
    style: 'naginata',
    baseDmg: 62,
    critChance: 0.28,
    critMult: 2.25,
    chargeSpeed: 1.22,
    parryWindowBonus: 0.10,
    bleedDmg: 8,
    bladeColor: 0x10b981,
    hiltColor: 0xb45309,
    glowColor: '#10b981',
    description: 'Славянская совня, соединенная с техникой японской нагинаты. Широкий радиус поражения и изумрудное свечение духа леса.',
    recipe: { steel: 7, silk: 5, seal: 5, jade: 2 },
    soulsCost: 125,
  },
  {
    id: 'void_tachi',
    name: 'Клинок Зари «Перун-Аматэрасу»',
    subtitle: 'Реликвия грозового солнцестояния',
    style: 'void_tachi',
    baseDmg: 88,
    critChance: 0.36,
    critMult: 2.55,
    chargeSpeed: 1.38,
    parryWindowBonus: 0.16,
    bleedDmg: 16,
    bladeColor: 0xc084fc,
    hiltColor: 0xfbbf24,
    glowColor: '#c084fc',
    description: 'Легендарный тати, в котором соединились громовые перуны и солнечное сияние Аматэрасу. Вокруг клинка вращаются обережные кольца.',
    recipe: { steel: 10, seal: 7, ash: 7, jade: 4 },
    soulsCost: 210,
  },
];

export type ArmorStyle = 'collar' | 'vest' | 'haori' | 'samurai' | 'exo';

export interface ArmorDef {
  id: string;
  name: string;
  subtitle: string;
  style: ArmorStyle;
  maxHpBonus: number;
  defensePct: number;
  moveSpeedBonus: number;
  primaryColor: number;
  accentColor: number;
  cssColor: string;
  description: string;
  recipe: Partial<Record<MaterialId, number>>;
  soulsCost: number;
}

export const ARMORS_CATALOG: ArmorDef[] = [
  {
    id: 'street_collar',
    name: 'Ошейник Пограничной Заставы',
    subtitle: 'Кожаная шлейка с колокольцем',
    style: 'collar',
    maxHpBonus: 0,
    defensePct: 0.06,
    moveSpeedBonus: 0.6,
    primaryColor: 0x1e293b,
    accentColor: 0x00ffcc,
    cssColor: '#00ffcc',
    description: 'Легкая охотничья шлейка с заговоренным жетоном. Не сковывает бег борзой по заснеженным залам.',
    recipe: {},
    soulsCost: 0,
  },
  {
    id: 'tactical_vest',
    name: 'Куяк Зверобоя «Сибирь»',
    subtitle: 'Клепаный бригантинный нагрудник',
    style: 'vest',
    maxHpBonus: 50,
    defensePct: 0.18,
    moveSpeedBonus: 0.3,
    primaryColor: 0x1f2937,
    accentColor: 0x38bdf8,
    cssColor: '#38bdf8',
    description: 'Плотный суконный куяк с подшитыми пластинами пареньской стали. Надежно держит когти таёжной хтони.',
    recipe: { steel: 3, silk: 3 },
    soulsCost: 28,
  },
  {
    id: 'onmyoji_haori',
    name: 'Шаманское Хаори «Камлание»',
    subtitle: 'Ритуальная накидка с оберегами',
    style: 'haori',
    maxHpBonus: 95,
    defensePct: 0.28,
    moveSpeedBonus: 0.85,
    primaryColor: 0xf8fafc,
    accentColor: 0xe11d48,
    cssColor: '#f43f5e',
    description: 'Бело-алая мантия, сочетающая покрой жрецов оммёдо и чукотские шаманские подвески. Вокруг спины парят живые обереги.',
    recipe: { silk: 5, seal: 5, ash: 2 },
    soulsCost: 60,
  },
  {
    id: 'ronin_gusoku',
    name: 'Зерцальный Доспех «Боярин-Ронин»',
    subtitle: 'Кованые русско-самурайские латы',
    style: 'samurai',
    maxHpBonus: 165,
    defensePct: 0.38,
    moveSpeedBonus: 0.1,
    primaryColor: 0x450a0a,
    accentColor: 0xfbbf24,
    cssColor: '#fbbf24',
    description: 'Чеканные зерцала с солярным гребнем и наплечниками содэ. Превращает борзую в несокрушимого витязя рубежа.',
    recipe: { steel: 7, silk: 4, seal: 4, jade: 2 },
    soulsCost: 110,
  },
  {
    id: 'akira_exo',
    name: 'Техно-Ковчег «Владивосток-9»',
    subtitle: 'Экспериментальный паро-неоновый каркас',
    style: 'exo',
    maxHpBonus: 260,
    defensePct: 0.48,
    moveSpeedBonus: 1.25,
    primaryColor: 0x991b1b,
    accentColor: 0x00ffff,
    cssColor: '#00ffff',
    description: 'Титановое шасси секретной лаборатории Дальнего Востока с реактивными ускорителями и янтарным реактором.',
    recipe: { steel: 10, silk: 7, ash: 5, jade: 4 },
    soulsCost: 180,
  },
];

export interface CoatSkinDef {
  id: string;
  name: string;
  coatColor: number;
  muzzleColor: number;
  eyeColor: number;
}

export const COAT_SKINS: CoatSkinDef[] = [
  { id: 'white_aristocrat', name: 'Белый Вьюжный', coatColor: 0xe2e8f0, muzzleColor: 0xcbd5e1, eyeColor: 0x00ffcc },
  { id: 'obsidian_shadow', name: 'Черный Соболь', coatColor: 0x1e2028, muzzleColor: 0x0f1115, eyeColor: 0xff0055 },
  { id: 'crimson_kitsune', name: 'Багряный Лисогон', coatColor: 0xd97706, muzzleColor: 0xfef3c7, eyeColor: 0x38bdf8 },
  { id: 'silver_phantom', name: 'Охотский Иней', coatColor: 0x94a3b8, muzzleColor: 0x475569, eyeColor: 0xc084fc },
];

export type YokaiArchetype =
  | 'kele'
  | 'poludnitsa'
  | 'shatun'
  | 'likho'
  | 'vodyanoy'
  | 'akamanto'
  | 'gashadokuro_boss';

export interface YokaiDef {
  archetype: YokaiArchetype;
  name: string;
  title: string;
  hpMult: number;
  dmgMult: number;
  windupTime: number;
  attackInterval: number;
  bodyColor: number;
  glowColor: number;
  isBoss?: boolean;
}

export const YOKAI_CATALOG: YokaiDef[] = [
  {
    archetype: 'kele',
    name: 'ЧУКОТСКИЙ КЕЛЕ',
    title: 'Костяной дух-людоед вечной мерзлоты',
    hpMult: 1.0,
    dmgMult: 1.05,
    windupTime: 0.78,
    attackInterval: 1.65,
    bodyColor: 0x1e293b,
    glowColor: 0x38bdf8,
  },
  {
    archetype: 'poludnitsa',
    name: 'ПОЛУДНИЦА-КУТИСАКЭ',
    title: 'Призрак сопок с зазубренным серпом',
    hpMult: 0.95,
    dmgMult: 1.15,
    windupTime: 0.72,
    attackInterval: 1.5,
    bodyColor: 0x271a2c,
    glowColor: 0xff0055,
  },
  {
    archetype: 'shatun',
    name: 'ТАЁЖНЫЙ ШАТУН-ОБОРОТЕНЬ',
    title: 'Рогатый хозяин бурелома',
    hpMult: 1.35,
    dmgMult: 1.25,
    windupTime: 0.92,
    attackInterval: 1.95,
    bodyColor: 0x291d12,
    glowColor: 0xf59e0b,
  },
  {
    archetype: 'likho',
    name: 'ЛИХО ОДНОГЛАЗОЕ (РОКУРОКУБИ)',
    title: 'Долговязый фантом заброшенных доков',
    hpMult: 0.95,
    dmgMult: 1.3,
    windupTime: 0.68,
    attackInterval: 1.45,
    bodyColor: 0x18181b,
    glowColor: 0xa855f7,
  },
  {
    archetype: 'vodyanoy',
    name: 'ОХОТСКИЙ ВОДЯНОЙ-КАППА',
    title: 'Панцирный утопленник ржавых шлюзов',
    hpMult: 1.25,
    dmgMult: 1.15,
    windupTime: 0.85,
    attackInterval: 1.75,
    bodyColor: 0x064e3b,
    glowColor: 0x10b981,
  },
  {
    archetype: 'akamanto',
    name: 'АКА-МАНТО / КОЩЕЕВ СТРАЖ',
    title: 'Демон в багровом плаще с оберегами',
    hpMult: 1.3,
    dmgMult: 1.25,
    windupTime: 0.8,
    attackInterval: 1.7,
    bodyColor: 0x450a0a,
    glowColor: 0xfbbf24,
  },
  {
    archetype: 'gashadokuro_boss',
    name: 'КОЩЕЙ-ГАСЯДОКУРО',
    title: 'ЦАРЬ ВЕЧНОЙ МЕРЗЛОТЫ [БОСС ЭТАЖА]',
    hpMult: 2.65,
    dmgMult: 1.65,
    windupTime: 0.95,
    attackInterval: 1.8,
    bodyColor: 0x09090b,
    glowColor: 0xff0044,
    isBoss: true,
  },
];
