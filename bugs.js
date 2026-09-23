/* 裏技（バグ）の定義。約300個。
   それぞれ { id, cat, name, hint, star(1-3), on(イベント名), check(c) } で、
   game.js の bugEvent(type, payload) から c = { S, E, ...payload } を受けて true を返すと発見。
   minLoop がある裏技は その周回から。reuse があるものは見つけたあとも効果がある。 */

const BUG_CATS = [
  { id: 'input',   name: 'そうさ',     desc: 'ゆびの うごきが おかしい' },
  { id: 'console', name: 'ゲームき',   desc: 'ボタンと でんげん' },
  { id: 'number',  name: 'かず',       desc: 'ぴったりの すうじ' },
  { id: 'time',    name: 'とき',       desc: 'とけいと カレンダー' },
  { id: 'party',   name: 'なかま',     desc: 'やとう・きわめる' },
  { id: 'enemy',   name: 'てき',       desc: 'たおしかた' },
  { id: 'world',   name: 'せかい',     desc: 'エリアと かべ' },
  { id: 'skill',   name: 'スキル',     desc: 'スキルと ごほうび' },
  { id: 'debug',   name: 'デバッグ',   desc: 'チートの つかいかた' },
  { id: 'system',  name: 'セーブ',     desc: 'なまえ・むき・タブ' },
  { id: 'loop',    name: 'しゅうかい', desc: '2しゅうめ から', minLoop: 2 },
];

const BUGS = (() => {
  const L = [];
  const add = (cat, id, name, hint, star, on, check, extra) => L.push(Object.assign({ id, cat, name, hint, star, on, check }, extra || {}));
  const jp = { 0: 'にち', 1: 'げつ', 2: 'か', 3: 'すい', 4: 'もく', 5: 'きん', 6: 'ど' };
  const kn = n => String(n);

  // ================= そうさ =================
  [[10, 1], [20, 1], [30, 2], [40, 2], [50, 3]].forEach(([n, s]) => add('input', 'combo' + n, 'ゆびが みえない ' + n, '2びょうで ' + n + 'かい タップ', s, 'tap', c => c.combo >= n));
  [[5, 1], [30, 2], [60, 3]].forEach(([n, s]) => add('input', 'hold' + n, 'はなさない ' + n, 'てきを ' + n + 'びょう はなさないで', s, 'hold', c => c.sec >= n));
  [[2, 1], [3, 2], [5, 3]].forEach(([n, s]) => add('input', 'crit' + n, 'かいしん ' + n + 'れんぞく', n + 'かい つづけて かいしんの いちげき', s, 'crit', c => c.streak >= n));
  [[10, 1], [50, 2], [100, 3]].forEach(([n, s]) => add('input', 'title' + n, 'かくれタイトル ' + n, 'タイトルの ロゴを ' + n + 'かい', s, 'title', c => c.taps >= n));
  [[60, 1], [300, 2]].forEach(([n, s]) => add('input', 'titlewait' + n, 'デモが はじまらない ' + n, 'タイトルで ' + n + 'びょう まつ', s, 'title', c => c.waitSec >= n));
  [[30, 1], [100, 2]].forEach(([n, s]) => add('input', 'angry' + n, 'なかまを つつくな ' + n, 'なかまの えを ' + n + 'かい', s, 'party', c => c.taps >= n));
  [777, 1000, 1234, 4649, 8888, 10000, 65535].forEach(n => add('input', 'taps' + n, 'タップ ' + n, 'タップの かいすうが ぴったり ' + n, n >= 8888 ? 3 : 2, 'tap', c => c.S.stats.taps === n));
  add('input', 'corners', 'よすみ', 'がめんの よすみを ひだりうえ から じゅんばんに', 2, 'tap', c => c.corners);
  add('input', 'edge50', 'ふちどり', 'がめんの ふちだけを 50かい', 2, 'tap', c => c.edgeTaps >= 50);
  add('input', 'center', 'どまんなか', 'がめんの まんなかを 20かい つづけて', 1, 'tap', c => c.centerTaps >= 20);
  add('input', 'slow', 'ゆっくり', '10びょう あけて 5かい タップ', 2, 'tap', c => c.slowTaps >= 5);

  // ================= ゲームき =================
  const seq = (id, name, hint, star, s) => add('console', id, name, hint, star, 'key', c => c.buf.endsWith(s));
  seq('konami', 'うえうえ したした', 'あの コマンド', 3, 'up,up,down,down,left,right,left,right,b,a');
  seq('konamiWrong', 'おしい コマンド', 'あの コマンドの さいごを ぎゃくに', 2, 'up,up,down,down,left,right,left,right,a,b');
  seq('abab', 'エービーエービー', 'A と B を こうごに 4かい', 1, 'a,b,a,b');
  seq('b5', 'ビービービー', 'B を 5かい つづけて', 1, 'b,b,b,b,b');
  seq('a10', 'エーれんだ', 'A を 10かい つづけて', 1, 'a,a,a,a,a,a,a,a,a,a');
  seq('updown', 'じょうげ', 'うえ した うえ した', 1, 'up,down,up,down');
  seq('left8', 'ひだりへ', 'ひだりを 8かい', 1, 'left,left,left,left,left,left,left,left');
  seq('right8', 'みぎへ', 'みぎを 8かい', 1, 'right,right,right,right,right,right,right,right');
  seq('circle', 'ぐるっと', 'うえ みぎ した ひだり', 2, 'up,right,down,left');
  seq('circle2', 'ぎゃくに ぐるっと', 'うえ ひだり した みぎ', 2, 'up,left,down,right');
  seq('lr3', 'さゆう さゆう', 'ひだり みぎ を 3かい', 1, 'left,right,left,right,left,right');
  seq('up4a', 'ジャンプ', 'うえ 4かい のあと A', 2, 'up,up,up,up,a');
  seq('down4b', 'しゃがみ', 'した 4かい のあと B', 2, 'down,down,down,down,b');
  seq('aaabbb', 'エーエーエー ビービービー', 'A 3かい B 3かい', 1, 'a,a,a,b,b,b');
  seq('baba', 'ビーエー ビーエー', 'B A B A B A', 1, 'b,a,b,a,b,a');
  seq('start3', 'スタート れんだ', 'START を 3かい', 1, 'start,start,start');
  seq('select5', 'セレクト れんだ', 'SELECT を 5かい', 1, 'select,select,select,select,select');
  seq('selstart', 'リセット', 'SELECT のあと START', 2, 'select,start');
  seq('startsel', 'ぎゃく リセット', 'START のあと SELECT', 2, 'start,select');
  seq('dpad12', 'ぐるぐる', 'ぐるっと を 3しゅう', 3, 'up,right,down,left,up,right,down,left,up,right,down,left');
  add('console', 'select', 'セレクトおし', 'SELECT を おしながら A', 2, 'selectA', () => true);
  add('console', 'selectB', 'セレクトおし B', 'SELECT を おしながら B', 2, 'selectB', () => true);
  add('console', 'power', 'でんげん ちらちら', 'でんげんを 5びょうで 5かい', 2, 'power', c => c.count5s >= 5, { reuse: '1時間に1回、ランダムなゴールド' });
  add('console', 'off60', 'スリープ', 'でんげんを 1ぷん きって もどす', 1, 'poweron', c => c.offSec >= 60);
  add('console', 'off600', 'ながい スリープ', 'でんげんを 10ぷん きって もどす', 2, 'poweron', c => c.offSec >= 600);
  add('console', 'offboss', 'ボスも まってる', 'ボスせん の とちゅうで でんげんを きる', 2, 'poweroff', c => c.boss);
  add('console', 'blind', 'めかくし', 'でんげんを きったまま がめんを 10かい', 2, 'blind', c => c.taps >= 10);
  add('console', 'titledpad', 'タイトルで じゅうじ', 'タイトルがめんで じゅうじキーを 8かい', 1, 'titlekey', c => c.count >= 8);
  add('console', 'titlestart3', 'はやく はじめたい', 'タイトルで START を…いや A で はじまる', 1, 'titlekey', c => c.startCount >= 3);

  // ================= かず =================
  [7, 13, 42, 64, 77, 99, 100, 111, 123, 200, 255, 256, 300, 365, 404, 500, 512, 777, 999, 1000].forEach(n => add('number', 'ally' + n, 'なかま ' + n, 'なかまを ちょうど ' + n + 'にん に', n >= 500 ? 3 : n >= 100 ? 2 : 1, 'buy', c => c.allyCount === n));
  [0, 1, 7, 13, 42, 100, 777, 1000, 1234, 9999].forEach(n => add('number', 'gold' + n, 'ゴールド ' + n, 'かいものの あとに ちょうど ' + n + ' G', n >= 1000 ? 2 : 1, 'buy', c => c.gold === n));
  [[65535, '16ビットの かべ', 2], [16777215, '24ビットの かべ', 2], [2147483647, '32ビットの かべ', 3], [1e12, '1ちょう', 3]].forEach(([n, name, s]) => add('number', 'cross' + n, name, kn(n) + ' を こえた しゅんかん', s, 'gold', c => c.before <= n && c.after > n));
  [100, 256, 500, 777, 1000, 1234, 4649, 9999, 10000].forEach(n => add('number', 'kills' + n, 'ぎゃくさつ ' + n, 'たおした かずが ぴったり ' + n, n >= 4649 ? 3 : n >= 1000 ? 2 : 1, 'kill', c => c.S.stats.kills === n));
  [7, 13, 42, 64, 99, 100].forEach(n => add('number', 'sword' + n, 'けん Lv.' + n, 'けんを ちょうど Lv.' + n + ' に', n >= 64 ? 2 : 1, 'buy', c => c.S.sword === n));
  add('number', 'one99', 'きゅうじゅうきゅう', 'どれかの なかまが ちょうど 99にん', 2, 'buy', c => Object.values(c.S.allies).includes(99));
  add('number', 'allsame', 'そろいぶみ', '8しゅるい ぜんぶ おなじ にんずう（1にん いじょう）', 3, 'buy', c => { const v = ALLIES.map(a => c.S.allies[a.id] || 0); return v[0] > 0 && v.every(x => x === v[0]); });
  add('number', 'onetype100', 'ひとすじ', '1しゅるい だけで 100にん（ほかは 0）', 2, 'buy', c => { const v = ALLIES.map(a => c.S.allies[a.id] || 0); return v.filter(x => x > 0).length === 1 && Math.max(...v) >= 100; });
  add('number', 'hp1', 'のこり 1', 'てきの HP を のこり ちょうど 1 に', 2, 'damage', c => c.hp === 1);
  add('number', 'hp7', 'のこり 7', 'てきの HP を のこり ちょうど 7 に', 2, 'damage', c => c.hp === 7);
  add('number', 'goldhp', 'ちょうど おなじ', 'しょじきん と てきの のこりHP が おなじ', 3, 'damage', c => c.hp > 10 && Math.floor(c.S.gold) === c.hp);
  add('number', 'exactbuy', 'ぴったり おかいけ', 'しょじきん ぴったりで なかまを かう', 1, 'buy', c => c.exact);
  add('number', 'area7', 'ラッキーセブン', 'エリア 7 で なかま 7にん・けん Lv.7', 3, 'buy', c => c.S.area === 7 && c.allyCount === 7 && c.S.sword === 7);

  // ================= とき =================
  [[1, 11], [2, 22], [3, 33], [4, 44], [5, 55], [11, 11], [12, 34], [0, 0], [23, 59], [12, 0], [10, 10], [9, 9]].forEach(([h, m]) => add('time', 'clock' + h + '_' + m, 'とけい ' + h + ':' + String(m).padStart(2, '0'), 'とけいが ' + h + ':' + String(m).padStart(2, '0') + ' のとき（ごぜん でも ごご でも）', h === 12 && m === 34 ? 2 : 1, 'second', c => (c.h % 12 === h % 12) && c.m === m));
  add('time', 'midnight', 'よふかし', 'まよなか 0じ〜4じ', 1, 'second', c => c.h < 4);
  add('time', 'dawn', 'はやおき', 'あさ 5じ〜6じ', 1, 'second', c => c.h >= 5 && c.h < 7);
  add('time', 'lunch', 'おひる', '12じ〜13じ', 1, 'second', c => c.h === 12);
  for (let d = 0; d < 7; d++) add('time', 'day' + d, jp[d] + 'ようび', jp[d] + 'ようび に あそぶ', 1, 'second', c => c.day === d);
  add('time', 'date1', 'ついたち', 'ついたち に あそぶ', 1, 'second', c => c.date === 1);
  add('time', 'date13', 'じゅうさんにち', '13にち に あそぶ', 1, 'second', c => c.date === 13);
  add('time', 'fri13', '13にちの きんようび', '13にちの きんようび', 3, 'second', c => c.date === 13 && c.day === 5);
  add('time', 'monthend', 'つきの おわり', 'つきの さいごの ひ', 2, 'second', c => c.lastDay);
  [[1, 1, 'がんじつ'], [2, 29, 'うるうび'], [4, 1, 'エイプリルフール'], [7, 7, 'たなばた'], [10, 31, 'ハロウィン'], [12, 24, 'イブ'], [12, 25, 'クリスマス'], [12, 31, 'おおみそか']].forEach(([mo, da, name]) => add('time', 'md' + mo + '_' + da, name, mo + 'がつ ' + da + 'にち に あそぶ', mo === 2 ? 3 : 2, 'second', c => c.month === mo && c.date === da));
  [[3600, 'ひとやすみ', 1], [3 * 3600, 'おひるね', 1], [8 * 3600, 'おやすみ', 2], [24 * 3600, 'いちにち', 2], [72 * 3600, 'みっか', 3], [168 * 3600, 'いっしゅうかん', 3]].forEach(([sec, name, s]) => add('time', 'off' + sec, name, Math.round(sec / 3600) + 'じかん いじょう はなれて もどる', s, 'load', c => c.offlineSec >= sec));
  add('time', 'session1h', 'ねっちゅう', 'ひらいたまま 1じかん', 2, 'second', c => c.sessionSec >= 3600);
  add('time', 'session3h', 'ねっちゅう しすぎ', 'ひらいたまま 3じかん', 3, 'second', c => c.sessionSec >= 3 * 3600);
  add('time', 'play10h', 'ベテラン', 'あそんだ じかん 10じかん', 2, 'second', c => c.S.stats.playSec >= 10 * 3600);
  add('time', 'play24h', 'いちにち ぶん', 'あそんだ じかん 24じかん', 3, 'second', c => c.S.stats.playSec >= 24 * 3600);
  add('time', 'boss00', 'ぴったり', 'びょうが 00 のときに ボスを たおす', 3, 'boss', c => c.sec0);
  add('time', 'minsec', 'ぞろめ', 'ふん と びょう が おなじ ときに タップ', 2, 'tap', c => c.m === c.s);
  add('time', 'newday', 'ひづけ こえ', 'ひらいたまま 0:00 を またぐ', 2, 'second', c => c.crossedMidnight);

  // ================= なかま =================
  ALLIES.forEach((a, i) => add('party', 'hire_' + a.id, a.name + 'の ひみつ', a.name + 'を はじめて やとう', i >= 6 ? 2 : 1, 'buy', c => c.what === 'ally' && c.id === a.id));
  add('party', 'all8', 'フルパーティ', '8しゅるい ぜんぶ やとう', 2, 'buy', c => ALLIES.every(a => c.S.allies[a.id] > 0));
  add('party', 'mile1', 'きわめの はじまり', 'きわめを はじめて かう', 1, 'buy', c => c.what === 'mile');
  add('party', 'mile10', 'きわめ 10', 'きわめを 10かい かう', 2, 'buy', c => c.S.stats.milesBought >= 10);
  add('party', 'mileall', 'きわめ つくし', 'きわめを ぜんぶ かう', 3, 'buy', c => ALLIES.every(a => (c.S.mile[a.id] || 0) >= MILESTONES.length));
  add('party', 'max10', 'まとめがい', '×max で 10かい つづけて かう', 1, 'buy', c => c.maxStreak >= 10);
  add('party', 'buy100', 'ひゃくにん いっき', '×100 で かう', 1, 'buy', c => c.n === 100);
  add('party', 'thief13', 'とうぞく だん', 'とうぞくを ちょうど 13にん', 2, 'buy', c => c.S.allies.thief === 13);
  add('party', 'heroearly', 'はやすぎる ゆうしゃ', 'エリア 30 より まえに ゆうしゃを やとう', 3, 'buy', c => c.id === 'hero' && c.S.area < 30);
  add('party', 'solo10', 'ひとりたび', 'なかまを やとわずに エリア 10', 2, 'area', c => c.area >= 10 && allyCount(c.S) === 0);
  add('party', 'nosword10', 'なまくら', 'けんを きたえずに エリア 10', 2, 'area', c => c.area >= 10 && c.S.sword === 0);
  add('party', 'priestonly', 'いのりの ちから', 'そうりょ だけで エリア 5', 2, 'area', c => c.area >= 5 && c.S.allies.priest > 0 && ALLIES.every(a => a.id === 'priest' || !c.S.allies[a.id]));
  add('party', 'warrior50', 'せんし ぐんだん', 'せんしを 50にん', 1, 'buy', c => c.S.allies.warrior >= 50);
  add('party', 'sage1', 'ちえの ひかり', 'けんじゃを やとうと なかまが ひかる', 1, 'buy', c => c.id === 'sage');
  add('party', 'mage25', 'まほうの あらし', 'まほうつかいを 25にん', 1, 'buy', c => c.S.allies.mage >= 25);
  add('party', 'party200', 'だいぐんぜい', 'なかま 200にん いじょう', 2, 'buy', c => c.allyCount >= 200);
  add('party', 'party1000', 'くに', 'なかま 1000にん いじょう', 3, 'buy', c => c.allyCount >= 1000);
  add('party', 'sword50', 'めいけん', 'けんを Lv.50', 2, 'buy', c => c.S.sword >= 50);
  add('party', 'sword200', 'せいけん', 'けんを Lv.200', 3, 'buy', c => c.S.sword >= 200);
  add('party', 'buyduringboss', 'ボスの まえで かいもの', 'ボスせん の とちゅうで なかまを かう', 1, 'buy', c => c.E && c.E.boss && c.E.hp > 0);

  // ================= てき =================
  Object.keys(ENEMIES).filter(id => !ENEMIES[id].boss).forEach(id => add('enemy', 'k100_' + id, ENEMIES[id].name + ' ×100', ENEMIES[id].name + 'を 100たい', 1, 'kill', c => (c.S.stats.killsById[id] || 0) >= 100));
  ZONES.slice(0, 3).forEach(z => add('enemy', 'taponly_' + z.boss, ENEMIES[z.boss].name + 'に そとう', ENEMIES[z.boss].name + 'を タップだけで たおす（なかま なし）', 3, 'boss', c => c.id === z.boss && c.tapOnly));
  ZONES.forEach(z => add('enemy', 'fast_' + z.boss, ENEMIES[z.boss].name + 'そくさつ', ENEMIES[z.boss].name + 'を 10びょう いないで たおす', 2, 'boss', c => c.id === z.boss && c.fightSec <= 10));
  add('enemy', 'mimic1', 'たからばこ だとおもった？', 'ミミックを はじめて たおす', 1, 'kill', c => c.rare === 'mimic');
  add('enemy', 'mimic10', 'ミミック ハンター', 'ミミックを 10たい', 2, 'kill', c => (c.S.stats.rareKills.mimic || 0) >= 10);
  add('enemy', 'glitch1', 'バグった てき', '？？？ を はじめて たおす', 1, 'kill', c => c.rare === 'glitch');
  add('enemy', 'glitch10', 'バグ かりゅうど', '？？？ を 10たい', 2, 'kill', c => (c.S.stats.rareKills.glitch || 0) >= 10);
  add('enemy', 'rare2', 'つづけて レア', 'レアな てきが 2たい つづけて でる', 3, 'kill', c => c.rareStreak >= 2);
  add('enemy', 'tap5', 'ゆびで 5たい', 'なかまの こうげき なしで 5たい つづけて', 1, 'kill', c => c.tapStreak >= 5);
  add('enemy', 'tap20', 'ゆびで 20たい', 'なかまの こうげき なしで 20たい つづけて', 2, 'kill', c => c.tapStreak >= 20);
  add('enemy', 'min50', 'ひとふで', '1ぷんで 50たい', 2, 'kill', c => c.inMinute >= 50);
  add('enemy', 'min200', 'ぎゃくさつ', '1ぷんで 200たい', 3, 'kill', c => c.inMinute >= 200);
  add('enemy', 'overkill', 'オーバーキル', 'HP の 100ばい いじょうの ダメージで とどめ', 2, 'kill', c => c.overkill >= 100);
  add('enemy', 'lastcrit', 'とどめは かいしん', 'かいしんの いちげきで とどめ を 10かい', 1, 'kill', c => c.S.stats.critKills >= 10);
  add('enemy', 'bossnoskill', 'すなおに', 'スキルを つかわずに ボスを たおす（エリア 30 いこう）', 2, 'boss', c => c.area >= 30 && !c.skillsUsed);
  add('enemy', 'bossallskill', 'ぜんぶのせ', 'スキル 3つを つかって ボスを たおす', 2, 'boss', c => c.skillsUsedCount >= 3);
  add('enemy', 'kill1000', 'せんにん ぎり', '1000たい', 1, 'kill', c => c.S.stats.kills >= 1000);
  add('enemy', 'kill100000', 'じゅうまんにん ぎり', '10まんたい', 3, 'kill', c => c.S.stats.kills >= 100000);
  add('enemy', 'slimeloop', 'スライムの ゆめ', 'スライムだけを 50たい つづけて（エリア1で）', 2, 'kill', c => c.sameStreak >= 50);

  // ================= せかい =================
  ZONES.forEach((z, i) => add('world', 'enter_' + z.id, z.name + 'の いりぐち', z.name + 'に はじめて はいる', i >= 4 ? 2 : 1, 'zone', c => c.zone === z.id));
  ZONES.forEach(z => add('world', 'wallL_' + z.id, z.name + 'の ひだりかべ', z.name + 'で がめんの ひだりはしを 3かい', 2, 'wall', c => c.zone === z.id && c.side === 'left', { reuse: 'エリアごとに1回、かくし部屋のゴールド' }));
  ZONES.forEach(z => add('world', 'wallR_' + z.id, z.name + 'の みぎかべ', z.name + 'で がめんの みぎはしを 3かい', 2, 'wall', c => c.zone === z.id && c.side === 'right', { reuse: 'エリアごとに1回、かくし部屋のゴールド' }));
  add('world', 'ceiling', 'てんじょう', '魔王城で がめんの うえはしを 3かい', 3, 'wall', c => c.zone === 'demon' && c.side === 'top');
  add('world', 'floor', 'ゆか', 'はじまりの草原で がめんの したはしを 3かい', 2, 'wall', c => c.zone === 'plain' && c.side === 'bottom');
  [25, 33, 42, 55].forEach(n => add('world', 'area' + n, 'エリア ' + n, 'エリア ' + n + ' に とうたつ', n >= 42 ? 2 : 1, 'area', c => c.area >= n));
  add('world', 'plain1000', 'そうげんの ぬし', 'はじまりの草原で 1000たい', 2, 'kill', c => (c.S.stats.killsByZone.plain || 0) >= 1000);
  add('world', 'stay1h', 'ここが すき', 'おなじ エリアに 1じかん', 2, 'second', c => c.areaSec >= 3600);
  add('world', 'boss10x', 'なんども', 'エリア 60 の 魔王を 10かい たおす', 3, 'boss', c => c.S.stats.maouKills >= 10);

  // ================= スキル・ごほうび =================
  SKILLS.forEach(sk => add('skill', 'use_' + sk.id, sk.name + 'の ひみつ', sk.name + 'を はじめて つかう', 1, 'skill', c => c.id === sk.id));
  add('skill', 'skill3', 'トリプル', 'スキル 3つを 5びょう いないに つかう', 2, 'skill', c => c.within5 >= 3);
  add('skill', 'skill10', 'スキル 10', 'スキルを 10かい', 1, 'skill', c => c.uses >= 10);
  add('skill', 'skill100', 'スキル 100', 'スキルを 100かい', 2, 'skill', c => c.uses >= 100);
  add('skill', 'critboss', 'かいしん で ボス', 'かいしん ちゅうに ボスを たおす', 2, 'boss', c => c.critActive);
  add('skill', 'rushmimic', 'おおもうけ', 'ゴールドラッシュ ちゅうに ミミックを たおす', 3, 'kill', c => c.rare === 'mimic' && c.rushActive);
  add('skill', 'alloutboss', 'いっせいで いっぱつ', 'いっせいこうげき で ボスを いっぱつ', 3, 'boss', c => c.alloutKill);
  add('skill', 'cdspam', 'せっかち', 'クールタイム ちゅうの スキルを 20かい おす', 1, 'skillcd', c => c.presses >= 20);
  BOSS_REWARDS.forEach(r => add('skill', 'rw_' + r.id, r.name + 'の ひみつ', 'ごほうびで「' + r.name + '」を えらぶ', 1, 'reward', c => c.id === r.id));
  add('skill', 'rw3same', 'こだわり', 'おなじ ごほうびを 3かい つづけて', 2, 'reward', c => c.streak >= 3);
  add('skill', 'rwall', 'ぜんしゅ', 'ごほうびを 6しゅるい ぜんぶ えらぶ', 2, 'reward', c => BOSS_REWARDS.every(r => c.S.stats.rewards[r.id]));
  add('skill', 'buff3', 'はたが みっつ', 'ゆうきの はた を 3かい', 2, 'reward', c => (c.S.stats.rewards.buff || 0) >= 3);

  // ================= デバッグ =================
  CHEATS.forEach(ch => add('debug', 'buy_' + ch.id, ch.name + 'の ひみつ', '「' + ch.name + '」を かう', 1, 'cheat', c => c.action === 'buy' && c.id === ch.id));
  add('debug', 'pal4', 'いろ いっしゅう', 'カラーパレットを いっしゅう させる', 1, 'cheat', c => c.action === 'palette' && c.cycles >= 1);
  add('debug', 'pal20', 'いろ ちかちか', 'カラーパレットを 20かい きりかえる', 2, 'cheat', c => c.action === 'palette' && c.presses >= 20);
  add('debug', 'bgm10', 'BGM ずっと', 'かくしBGM を 10ぷん ならす', 2, 'second', c => c.bgmSec >= 600);
  add('debug', 'allon', 'ぜんぶ ON', 'そくど×10・てきHP 1/10・オートタップ を どうじに ON', 3, 'cheat', c => c.S.cheatOn.speed10 && c.S.cheatOn.hp10 && c.S.cheatOn.auto);
  add('debug', 'stageall', 'ワープ めぐり', 'ステージセレクトで 6ゾーン ぜんぶに とぶ', 2, 'cheat', c => c.action === 'jump' && Object.keys(c.S.stats.jumped).length >= 6);
  add('debug', 'edit0', 'すっからかん かいぞう', 'セーブ改造で ゴールドを 0 に', 1, 'cheat', c => c.action === 'edit' && c.gold === 0);
  add('debug', 'edit65535', 'かいぞう 65535', 'セーブ改造で メモリ片を 65535 に', 3, 'cheat', c => c.action === 'edit' && c.frags === 65535);
  add('debug', 'inject10', 'ちゅうにゅう 10', 'ゴールド注入を 10かい', 2, 'cheat', c => c.action === 'gold' && (c.S.stats.injects || 0) >= 10);
  add('debug', 'tas5', 'ほんものの TAS', 'チートで 1しゅうを 5ふん いない', 3, 'ending', c => c.sec <= 300);
  add('debug', 'cleanfast', 'せいき スピードラン', 'チートなしで 1しゅうを 2じかん いない', 3, 'ending', c => !c.cheated && c.sec <= 7200);
  add('debug', 'offon', 'ちらつき', 'チートを ON→OFF→ON と 10かい', 1, 'cheat', c => c.action === 'toggle' && (c.S.stats.toggles || 0) >= 10);

  // ================= セーブ・そのた =================
  [['デバッグ|debug', 'なまえは しょうたい', 'なまえに「デバッグ」', 2], ['バグ|bug', 'バグ の なまえ', 'なまえに「バグ」', 1], ['ゆうしゃ', 'ほんものの ゆうしゃ', 'なまえに「ゆうしゃ」', 1], ['まおう|魔王', 'まおう の なまえ', 'なまえに「まおう」', 2], ['glitch|グリッチ', 'グリッチ', 'なまえに「GLITCH」', 2], ['ずんだ', 'ずんだもん', 'なまえに「ずんだ」', 2], ['テスト|test', 'テスター', 'なまえに「テスト」', 1], ['チート|cheat', 'チーター', 'なまえに「チート」', 2]].forEach(([re, name, hint, s], i) => add('system', 'name' + i, name, hint, s, 'name', c => new RegExp(re, 'i').test(c.name)));
  add('system', 'name8', 'はちもじ', 'なまえを ちょうど 8もじ に', 1, 'name', c => c.name.length === 8);
  add('system', 'namenum', 'すうじの なまえ', 'なまえを すうじ だけに', 1, 'name', c => /^[0-9０-９]+$/.test(c.name));
  add('system', 'nameempty', 'なまえ なし', 'なまえを からっぽ で きめる', 1, 'name', c => c.name === '' && c.changes > 0);
  add('system', 'namea', 'あ', 'なまえを「あ」だけに', 1, 'name', c => c.name === 'あ');
  add('system', 'name10', 'なまえ まよい', 'なまえを 10かい かえる', 1, 'name', c => c.changes >= 10);
  add('system', 'landscape', 'よこむき', 'ふるいのに ゆれるのか（たてから よこに）', 1, 'resize', c => c.landscape);
  add('system', 'landtap', 'よこで たたく', 'よこむき のまま 10かい タップ', 2, 'tap', c => c.landscape && c.landTaps >= 10);
  add('system', 'rotate5', 'ぐるぐる まわす', 'たて よこ を 5かい くりかえす', 2, 'resize', c => c.rotations >= 5);
  add('system', 'tabsall', 'いっしゅう', 'タブを ひだりから じゅんばんに ぜんぶ ひらく', 1, 'tab', c => c.inOrder);
  add('system', 'tabs100', 'そわそわ', 'タブを 100かい きりかえる', 2, 'tab', c => c.switches >= 100);
  add('system', 'settings20', 'せっていずき', '設定を 20かい ひらく', 1, 'tab', c => c.settingsOpens >= 20);
  add('system', 'save10', 'セーブ しんぱいしょう', '「いま セーブ」を 10かい', 1, 'save', c => c.count >= 10);
  add('system', 'resetno', 'おもいとどまる', '「ぜんぶ けす」を おして やめる', 1, 'resetcancel', () => true);
  add('system', 'standalone', 'ホームがめん', 'ホームがめんに ついかして ひらく', 2, 'load', c => c.standalone);
  add('system', 'hide10', 'かくれんぼ', 'アプリを うらに まわして もどす を 10かい', 1, 'visibility', c => c.count >= 10);
  add('system', 'expand10', 'ひろげたり とじたり', 'したの欄を ひろげる を 10かい', 1, 'expand', c => c.count >= 10);
  add('system', 'dpadtab', 'じゅうじで タブ', 'じゅうじキーの ひだりみぎで タブを 12かい', 1, 'dpadtab', c => c.count >= 12);

  // ================= しゅうかい（2しゅうめから） =================
  const lp = (id, name, hint, star, on, check, extra) => add('loop', id, name, hint, star, on, check, Object.assign({ minLoop: 2 }, extra || {}));
  lp('back100', 'はじまりに かえる', '2しゅうめ いこう、エリア1で 100たい', 2, 'kill', c => c.S.stats.area1Kills >= 100);
  lp('loop3', 'さしなおし さんかい', 'カセットを 3かい さしなおす', 2, 'second', c => c.S.loop >= 4);
  lp('loop5', 'ごしゅうめ', '5しゅうめ に はいる', 2, 'second', c => c.S.loop >= 5);
  lp('loop10', 'じっしゅうめ', '10しゅうめ に はいる', 3, 'second', c => c.S.loop >= 10);
  lp('loop2fast', 'なれたもの', '2しゅうめ いこうを 1じかん いないで クリア', 2, 'ending', c => c.sec <= 3600);
  lp('loop2clean', 'まっさら しゅうかい', '2しゅうめ いこうを チートなしで クリア', 2, 'ending', c => !c.cheated);
  lp('loopnoskill', 'スキル いらず', 'スキルを いちども つかわずに クリア', 3, 'ending', c => c.skillUsesThisLoop === 0);
  lp('prestige0', 'てぶら', 'ゴールド 0 で さしなおす', 1, 'prestige', c => c.gold === 0);
  lp('prestige1e9', 'おおもち のまま', '10おく G いじょう もったまま さしなおす', 2, 'prestige', c => c.gold >= 1e9);
  lp('loopbugs10', 'しゅうかい デバッガー', '2しゅうめ いこうで 10こ みつける', 2, 'discover', c => c.foundThisLoop >= 10);
  lp('loopfast30', 'ダッシュ', 'さしなおして 10ぷん いないに エリア 30', 2, 'area', c => c.area >= 30 && c.loopSec <= 600);
  lp('loopall', 'ループの おわり', 'ぜんぶの ゾーンの ボスを 5しゅう いじょう たおす', 3, 'boss', c => c.S.loop >= 5 && c.id === 'maou');

  return L;
})();

// 見つけると ずっと効く ちから。type: dps / tap / gold / crit / cd / offline(時間) / rare
const BUG_PERKS = {
  combo30: ['tap', .10], combo50: ['tap', .20], hold60: ['dps', .03], crit5: ['crit', .02], title100: ['gold', .05], taps10000: ['tap', .10], taps65535: ['dps', .05], corners: ['crit', .01], slow: ['gold', .03],
  konami: ['dps', .10], dpad12: ['cd', .05], off600: ['offline', 1], blind: ['tap', .05], circle: ['crit', .01], circle2: ['crit', .01], selstart: ['cd', .03], konamiWrong: ['gold', .03],
  ally777: ['dps', .05], ally1000: ['dps', .10], gold9999: ['gold', .05], cross2147483647: ['gold', .10], 'cross1000000000000': ['dps', .10], kills10000: ['dps', .05], sword100: ['tap', .15], allsame: ['dps', .08], goldhp: ['gold', .05], area7: ['crit', .03], hp1: ['crit', .01], cross65535: ['gold', .03],
  fri13: ['rare', .5], md2_29: ['dps', .10], off604800: ['offline', 2], play24h: ['dps', .05], boss00: ['cd', .05], newday: ['gold', .03], session3h: ['dps', .03], off86400: ['offline', 1], clock12_34: ['gold', .03],
  all8: ['dps', .05], mileall: ['dps', .15], heroearly: ['dps', .05], solo10: ['tap', .10], nosword10: ['dps', .03], party1000: ['dps', .10], sword200: ['tap', .20], priestonly: ['gold', .03],
  taponly_kingslime: ['tap', .05], taponly_trent: ['tap', .05], taponly_minotaur: ['tap', .05], fast_maou: ['dps', .10], mimic10: ['gold', .10], glitch10: ['rare', .5], rare2: ['rare', .3], min200: ['dps', .05], overkill: ['crit', .02], kill100000: ['dps', .10], slimeloop: ['gold', .03], bossallskill: ['cd', .03],
  ceiling: ['dps', .05], floor: ['gold', .05], area55: ['dps', .03], boss10x: ['dps', .10], stay1h: ['offline', 1], enter_demon: ['dps', .03],
  skill100: ['cd', .10], alloutboss: ['cd', .05], rwall: ['gold', .05], buff3: ['dps', .05], rushmimic: ['gold', .10], skill3: ['cd', .03],
  allon: ['dps', .05], tas5: ['cd', .10], cleanfast: ['dps', .10], edit65535: ['gold', .05], stageall: ['gold', .03],
  name4: ['rare', .2], rotate5: ['crit', .01], standalone: ['offline', 2], tabs100: ['gold', .03], name3: ['dps', .03],
  loop10: ['dps', .20], loopnoskill: ['cd', .10], loopall: ['dps', .25], loop2clean: ['gold', .10], loop5: ['dps', .05],
};
const PERK_LABEL = { dps: 'なかまの DPS', tap: 'タップの ダメージ', gold: 'ゴールド', crit: 'かいしん りつ', cd: 'スキルの クールタイム', offline: 'ほうちの じょうげん', rare: 'レアな てきの でやすさ' };
function perkText(p) { const [t, v] = p; if (t === 'offline') return PERK_LABEL[t] + ' +' + v + 'じかん'; if (t === 'cd') return PERK_LABEL[t] + ' -' + Math.round(v * 100) + '%'; if (t === 'crit') return PERK_LABEL[t] + ' +' + Math.round(v * 100) + '%'; return PERK_LABEL[t] + ' +' + Math.round(v * 100) + '%'; }
BUGS.forEach(b => { if (BUG_PERKS[b.id]) b.perk = BUG_PERKS[b.id]; });

const BUG_INDEX = {}; BUGS.forEach((b, i) => { BUG_INDEX[b.id] = i; b.frag = [0, 1, 2, 4][b.star]; });
const BUGS_BY_CAT = {}; BUGS.forEach(b => { (BUGS_BY_CAT[b.cat] = BUGS_BY_CAT[b.cat] || []).push(b); });
