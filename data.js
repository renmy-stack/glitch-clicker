/* グリッチ・クリッカー: 定義データ（数値の調整はここ） */

// ---- ゾーン（10エリアごと。10の倍数のエリアはボス） ----
const AREAS_PER_ZONE = 10;
const ZONES = [
  { id: 'plain',    name: 'はじまりの草原', enemies: ['slime', 'rat'],        boss: 'kingslime' },
  { id: 'forest',   name: 'まよいの森',     enemies: ['mushroom', 'goblin'],  boss: 'trent' },
  { id: 'cave',     name: 'ひかりなき洞窟', enemies: ['bat', 'skeleton'],     boss: 'minotaur' },
  { id: 'mountain', name: 'りゅうの山',     enemies: ['wolf', 'golem'],       boss: 'cyclops' },
  { id: 'castle',   name: 'すてられた城',   enemies: ['armor', 'gargoyle'],   boss: 'deathknight' },
  { id: 'demon',    name: '魔王城',         enemies: ['imp', 'dragon'],       boss: 'maou' },
];
const LAST_AREA = ZONES.length * AREAS_PER_ZONE; // 60 = 魔王
const KILLS_PER_AREA = 10;

const ENEMIES = {
  slime:      { name: 'スライム' },
  rat:        { name: 'おおねずみ' },
  mushroom:   { name: 'どくキノコ' },
  goblin:     { name: 'ゴブリン' },
  bat:        { name: 'こうもり' },
  skeleton:   { name: 'がいこつ' },
  wolf:       { name: 'オオカミ' },
  golem:      { name: 'ゴーレム' },
  armor:      { name: 'いきたよろい' },
  gargoyle:   { name: 'ガーゴイル' },
  imp:        { name: 'こあくま' },
  dragon:     { name: 'ドラゴン' },
  kingslime:  { name: 'キングスライム', boss: true },
  trent:      { name: 'トレント', boss: true },
  minotaur:   { name: 'ミノタウロス', boss: true },
  cyclops:    { name: 'サイクロプス', boss: true },
  deathknight:{ name: 'デスナイト', boss: true },
  maou:       { name: '魔王', boss: true },
};

// 敵HP・ゴールド（エリア番号 a = 1..60）
const HP_GROWTH = 1.35;
function enemyHp(a, boss) { return Math.floor(10 * Math.pow(HP_GROWTH, a - 1)) * (boss ? 10 : 1); }
const GOLD_DECAY = 0.98; // 奥に行くほど HP に対するゴールドの割合が下がる（放置で1周目クリアが 5〜6時間になる調整）
function enemyGold(a, boss) { return Math.max(2, Math.ceil(enemyHp(a, false) / 4 * Math.pow(GOLD_DECAY, a - 1))) * (boss ? 15 : 1); }

// ---- 仲間（自動で戦う。costGrowth 乗算） ----
const ALLIES = [
  { id: 'warrior', name: 'せんし',      cost: 15,      dps: 1 },
  { id: 'priest',  name: 'そうりょ',    cost: 100,     dps: 5 },
  { id: 'mage',    name: 'まほうつかい', cost: 600,    dps: 25 },
  { id: 'thief',   name: 'とうぞく',    cost: 3500,    dps: 120 },
  { id: 'archer',  name: 'ゆみつかい',  cost: 20000,   dps: 600 },
  { id: 'dragoon', name: 'りゅうきし',  cost: 120000,  dps: 3200 },
  { id: 'sage',    name: 'けんじゃ',    cost: 800000,  dps: 18000 },
  { id: 'hero',    name: 'ゆうしゃ',    cost: 6000000, dps: 120000 },
];
const COST_GROWTH = 1.15;
// 剣の強化（タップ1回のダメージ）
const SWORD = { cost: 10, growth: 1.35, dmgPerLv: 1 };
// 仲間の節目強化: 人数が MILESTONES に達するごとに、その仲間の DPS を2倍にする強化を買える（値段 = 今の1人分 × MILE_COST_MUL）
const MILESTONES = [10, 25, 50, 100, 200];
const MILE_COST_MUL = 10;

// ---- スキル（エリア到達で解放。クールタイムあり） ----
const SKILLS = [
  { id: 'crit',   name: 'かいしん', short: 'かいしん', icon: '💥', desc: '15秒間 タップのダメージ ×10', unlockArea: 3,  cd: 180, dur: 15 },
  { id: 'rush',   name: 'ゴールドラッシュ', short: 'ラッシュ', icon: '💰', desc: '30秒間 ゴールド ×3',         unlockArea: 8,  cd: 600, dur: 30 },
  { id: 'allout', name: 'いっせいこうげき', short: 'いっせい', icon: '⚔️', desc: '仲間の1分ぶんの攻撃を いますぐ', unlockArea: 15, cd: 300 },
];

// ---- レア敵（通常エリアでたまに出る） ----
const RARES = [
  { id: 'mimic',  name: 'ミミック',  chance: 0.03, hpMul: 0.6, goldMul: 20, note: 'たからばこ だとおもった？' },
  { id: 'glitch', name: '？？？',    chance: 0.02, hpMul: 3,   goldMul: 8,  frag: 1, note: 'バグった てき。たおすと メモリ片' },
];

// ---- ボス撃破のごほうび（3つから1つ選ぶ。魔王以外） ----
const BOSS_REWARDS = [
  { id: 'gold',   name: 'きんか の ふくろ',  desc: '10分ぶんの かせぎ' },
  { id: 'sword',  name: 'でんせつの といし', desc: 'けん +5 レベル' },
  { id: 'frag',   name: 'メモリ片 ×3',      desc: 'デバッグに つかえる' },
  { id: 'buff',   name: 'ゆうきの はた',    desc: 'この周、仲間の DPS +20%' },
  { id: 'cdreset', name: 'いのちの みず',   desc: 'スキルの クールタイムを ぜんぶ もどす' },
  { id: 'luck',   name: 'ぬすっとの めがね', desc: 'つぎの 30たいの ゴールド ×2' },
];

// ---- ゾーンに入ったときの ひとこと ----
const ZONE_INTRO = {
  plain: 'ゆうしゃは たびに でた。……なんか がめんが ちらつく。',
  forest: '木が うごいた きがする。',
  cave: 'かべが うすい ところが あるらしい。',
  mountain: 'ほねが ころがっている。りゅうは どこだ。',
  castle: 'だれかが デバッグしていた あとが ある。',
  demon: 'ここが さいごの エリアだ。',
};
const TAP_DPS_RATE = 0.01; // タップにDPSの1%を上乗せ

// ---- 周回 ----
const LOOP_MUL = 4; // 差し直すたびに全ダメージ ×4（2周目 ×4、3周目 ×16 …）

// ---- 裏技（バグ）は bugs.js に分離 ----

// ---- 公式チート（デバッグメニュー）。エンディング後に解放、メモリ片で購入 ----
const CHEATS = [
  { id: 'palette', name: 'カラーパレット',   cost: 5,   desc: 'がめんの色を切り替える', type: 'cycle', opts: ['ふつう', 'みどり', 'しろくろ', 'あか'] },
  { id: 'bgm',     name: 'かくしBGM',       cost: 10,  desc: 'BGM が バグった版になる（音がずれる）', type: 'toggle' },
  { id: 'speed2',  name: 'そくど ×2',       cost: 30,  desc: '仲間の攻撃が2倍速', type: 'toggle', speed: 2 },
  { id: 'stage',   name: 'ステージセレクト', cost: 40,  desc: '行ったことのあるエリアへ飛ぶ', type: 'button', needBugs: 20 },
  { id: 'gold',    name: 'ゴールド注入',     cost: 60,  desc: '10分ぶんの稼ぎをもらう（10分に1回）', type: 'button', cooldown: 600, needBugs: 30 },
  { id: 'auto',    name: 'オートタップ',     cost: 80,  desc: '勝手に 秒5回 タップする', type: 'toggle', needBugs: 40 },
  { id: 'speed5',  name: 'そくど ×5',       cost: 120, desc: '仲間の攻撃が5倍速', type: 'toggle', speed: 5, needBugs: 60 },
  { id: 'hp10',    name: 'てきHP 1/10',     cost: 200, desc: '敵の HP が 10分の1 になる', type: 'toggle', needBugs: 100 },
  { id: 'speed10', name: 'そくど ×10',      cost: 300, desc: '仲間の攻撃が10倍速', type: 'toggle', speed: 10, needBugs: 150 },
  { id: 'edit',    name: 'セーブ改造',       cost: 500, desc: 'ゴールドとメモリ片を直接いじる', type: 'button', needBugs: 250, needLoop: 3 },
  { id: 'hp1',     name: 'てきHP=1',        cost: 800, desc: 'どんな敵も1発。さいごの チート', type: 'toggle', needBugs: 300, needLoop: 5 },
];
// 旧バージョン（v0.3 まで）の値段。セーブ移行の返金に使う
const CHEATS_OLD_COST = { palette: 3, bgm: 5, speed2: 5, stage: 8, gold: 10, auto: 12, speed5: 15, hp1: 30, hp10: 200, speed10: 40, edit: 50 };
// 記録を汚さないチート（ONでも「正規」扱い）
const HARMLESS_CHEATS = ['palette', 'bgm'];

// ---- 実績 ----
const ACHIEVEMENTS = [
  { id: 'kill1',    name: 'はじめての戦い',       desc: '敵を1匹倒す', frag: 1, cond: s => s.stats.kills >= 1 },
  { id: 'kill100',  name: 'かけだし',             desc: '敵を100匹倒す', frag: 2, cond: s => s.stats.kills >= 100 },
  { id: 'kill1000', name: 'モンスターハンター',   desc: '敵を1000匹倒す', frag: 5, cond: s => s.stats.kills >= 1000 },
  { id: 'tap1000',  name: 'れんだの たつじん',    desc: '1000回タップ', frag: 3, cond: s => s.stats.taps >= 1000 },
  { id: 'ally10',   name: 'パーティ',             desc: '仲間を10人', frag: 2, cond: s => allyCount(s) >= 10 },
  { id: 'ally50',   name: 'ぐんたい',             desc: '仲間を50人', frag: 5, cond: s => allyCount(s) >= 50 },
  { id: 'area10',   name: 'はじめてのボス',       desc: 'エリア10のボスを倒す', frag: 3, cond: s => s.stats.bestArea >= 11 },
  { id: 'area30',   name: 'ちてい たんけん',      desc: 'エリア30のボスを倒す', frag: 5, cond: s => s.stats.bestArea >= 31 },
  { id: 'gold1m',   name: 'おおがねもち',         desc: '合計 100万G かせぐ', frag: 10, cond: s => s.stats.goldTotal >= 1e6 },
  { id: 'ending',   name: 'ゆうしゃの しょうめい', desc: 'チートなしで魔王を倒す', frag: 20, cond: s => s.stats.endingsClean >= 1 },
  { id: 'endingC',  name: 'かいぞうしゃ',         desc: 'チートありで魔王を倒す', frag: 5, cond: s => s.stats.endingsCheat >= 1 },
  { id: 'fast',     name: 'TAS',                  desc: '1周を10分以内でクリア（チートOK）', frag: 10, cond: s => s.stats.fastestClear > 0 && s.stats.fastestClear <= 600 },
  { id: 'bugs10',   name: 'バグハンター',         desc: '裏技を10こ見つける', frag: 5, cond: s => Object.keys(s.bugs).length >= 10 },
  { id: 'bugs50',   name: 'デバッガー',           desc: '裏技を50こ見つける', frag: 10, cond: s => Object.keys(s.bugs).length >= 50 },
  { id: 'bugs100',  name: 'バグの ぬし',          desc: '裏技を100こ見つける', frag: 20, cond: s => Object.keys(s.bugs).length >= 100 },
  { id: 'bugs200',  name: 'かいはつしゃ より くわしい', desc: '裏技を200こ見つける', frag: 40, cond: s => Object.keys(s.bugs).length >= 200 },
  { id: 'bugsAll',  name: 'すべてを しる もの',   desc: '裏技を全部見つける', frag: 100, cond: s => Object.keys(s.bugs).length >= BUGS.length },
  { id: 'cheatsAll', name: 'かいはつしゃ',        desc: 'デバッグメニューを全部買う', frag: 30, cond: s => Object.keys(s.cheats).length >= CHEATS.length },
  { id: 'loop1',    name: 'カセット さしなおし',  desc: '1回 周回する', frag: 10, cond: s => s.loop >= 2 },
  { id: 'loop5',    name: 'ループ',               desc: '5周目に入る', frag: 30, cond: s => s.loop >= 5 },
];

function allyCount(s) { let n = 0; for (const k in s.allies) n += s.allies[k]; return n; }
