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
const GOLD_DECAY = 0.95; // 奥に行くほど HP に対するゴールドの割合が下がる（1周目のクリアが 20時間前後になる調整）
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
const TAP_DPS_RATE = 0.01; // タップにDPSの1%を上乗せ

// ---- 周回 ----
const LOOP_MUL = 4; // 差し直すたびに全ダメージ ×4（2周目 ×4、3周目 ×16 …）

// ---- 裏技（バグ）。hint は断片ヒント。minLoop は何周目から起きるか ----
const BUGS = [
  { id: 'title10',   name: 'かくれタイトル',    hint: 'なまえを 10かい よぶと',           frag: 3 },
  { id: 'hold5',     name: 'はなさないバグ',    hint: 'てきを 5びょう はなさないで',      frag: 3 },
  { id: 'combo',     name: 'ゆびが みえない',   hint: '2びょうで 20かい',                 frag: 3 },
  { id: 'zero',      name: 'すっからかん',      hint: 'おかねを ぴったり 0に',            frag: 3 },
  { id: 'thirteen',  name: 'ふきつな かず',     hint: 'なかまを ちょうど 13にんに',       frag: 4 },
  { id: 'overflow',  name: '16ビットの かべ',   hint: '65535を こえた しゅんかん',        frag: 4 },
  { id: 'angry',     name: 'なかまを つつくな', hint: 'なかまの えを 30かい',             frag: 3 },
  { id: 'wall',      name: 'かべぬけ',          hint: 'ほらあなの ひだりの かべを 3かい', frag: 5, reuse: 'エリアごとに1回、かくし部屋のゴールド' },
  { id: 'power',     name: 'でんげん ちらちら', hint: 'でんげんを 5びょうで 3かい',       frag: 4, reuse: '1時間に1回、ランダムなゴールド' },
  { id: 'konami',    name: 'うえうえ したした', hint: 'ゲームきの ボタンで あのコマンド', frag: 6 },
  { id: 'select',    name: 'セレクトおし',      hint: 'セレクトを おしながら A',          frag: 4 },
  { id: 'landscape', name: 'よこむき',          hint: 'ふるいのに ゆれるのか',            frag: 3 },
  { id: 'clock444',  name: 'よんが みっつ',     hint: 'とけいが 4:44 のとき',             frag: 5 },
  { id: 'midnight',  name: 'よふかし',          hint: 'まよなか 0じ〜4じ',                frag: 3 },
  { id: 'nameDebug', name: 'なまえは しょうたい', hint: 'なまえに「デバッグ」',           frag: 5 },
  { id: 'sleep',     name: 'おやすみ',          hint: '8じかん いじょう はなれて もどる', frag: 4 },
  { id: 'back100',   name: 'はじまりに かえる', hint: '2しゅうめ、エリア1で 100たい',     frag: 8, minLoop: 2 },
  { id: 'loop3',     name: 'さしなおし さんかい', hint: 'カセットを 3かい さしなおす',    frag: 8, minLoop: 2 },
];

// ---- 公式チート（デバッグメニュー）。エンディング後に解放、メモリ片で購入 ----
const CHEATS = [
  { id: 'palette', name: 'カラーパレット',   cost: 3,  desc: 'がめんの色を切り替える', type: 'cycle', opts: ['ふつう', 'みどり', 'しろくろ', 'あか'] },
  { id: 'bgm',     name: 'かくしBGM',       cost: 5,  desc: 'バグったチップチューンを鳴らす', type: 'toggle' },
  { id: 'speed2',  name: 'そくど ×2',       cost: 5,  desc: '仲間の攻撃が2倍速', type: 'toggle', speed: 2 },
  { id: 'stage',   name: 'ステージセレクト', cost: 8,  desc: '行ったことのあるエリアへ飛ぶ', type: 'button' },
  { id: 'gold',    name: 'ゴールド注入',     cost: 10, desc: '10分ぶんの稼ぎをもらう（10分に1回）', type: 'button', cooldown: 600 },
  { id: 'auto',    name: 'オートタップ',     cost: 12, desc: '勝手に 秒5回 タップする', type: 'toggle' },
  { id: 'speed5',  name: 'そくど ×5',       cost: 15, desc: '仲間の攻撃が5倍速', type: 'toggle', speed: 5, needBugs: 3 },
  { id: 'hp1',     name: 'てきHP=1',        cost: 30, desc: 'どんな敵も1発', type: 'toggle', needBugs: 5 },
  { id: 'speed10', name: 'そくど ×10',      cost: 40, desc: '仲間の攻撃が10倍速', type: 'toggle', speed: 10, needBugs: 8 },
  { id: 'edit',    name: 'セーブ改造',       cost: 50, desc: 'ゴールドとメモリ片を直接いじる', type: 'button', needBugs: 10 },
];
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
  { id: 'bugs5',    name: 'バグハンター',         desc: '裏技を5つ見つける', frag: 5, cond: s => Object.keys(s.bugs).length >= 5 },
  { id: 'bugs10',   name: 'デバッガー',           desc: '裏技を10こ見つける', frag: 10, cond: s => Object.keys(s.bugs).length >= 10 },
  { id: 'bugsAll',  name: 'すべてを しる もの',   desc: '裏技を全部見つける', frag: 30, cond: s => Object.keys(s.bugs).length >= BUGS.length },
  { id: 'cheatsAll', name: 'かいはつしゃ',        desc: 'デバッグメニューを全部買う', frag: 30, cond: s => Object.keys(s.cheats).length >= CHEATS.length },
  { id: 'loop1',    name: 'カセット さしなおし',  desc: '1回 周回する', frag: 10, cond: s => s.loop >= 2 },
  { id: 'loop5',    name: 'ループ',               desc: '5周目に入る', frag: 30, cond: s => s.loop >= 5 },
];

function allyCount(s) { let n = 0; for (const k in s.allies) n += s.allies[k]; return n; }
