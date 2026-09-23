/* グリッチ・クリッカー 本体
   状態(S) → tick（仲間の攻撃・チェック）→ 描画。裏技の検出は各所の hook から discover() を呼ぶ。 */
'use strict';

const SAVE_KEY = 'glitch-clicker-save';
const DEBUG = location.search.includes('debug');
const $ = (id) => document.getElementById(id);

// ================= 状態 =================
function newState() {
  return {
    v: 1, gold: 0, frags: 0, area: 1, kills: 0, sword: 0, allies: {},
    bugs: {}, cheats: {}, cheatOn: {}, ach: {}, cool: {}, wallAreas: {},
    loop: 1, loopStart: Date.now(), cheated: false, name: '', mute: false, palette: 0,
    debugUnlocked: false, lastSave: Date.now(),
    stats: { kills: 0, taps: 0, goldTotal: 0, bestArea: 1, endingsClean: 0, endingsCheat: 0, fastestClear: 0, area1Kills: 0, bugsFound: 0, playSec: 0 },
  };
}
let S = load();
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const s = JSON.parse(raw); return Object.assign(newState(), s, { stats: Object.assign(newState().stats, s.stats || {}) }); } } catch (e) {}
  return newState();
}
function save() { S.lastSave = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

// ================= 計算 =================
function fmt(n) {
  n = Math.floor(n);
  if (n < 1e4) return String(n);
  if (n < 1e8) return trim(n / 1e4) + '万';
  if (n < 1e12) return trim(n / 1e8) + '億';
  if (n < 1e16) return trim(n / 1e12) + '兆';
  return n.toExponential(2);
}
function trim(x) { return x >= 100 ? Math.floor(x) : x.toFixed(1).replace(/\.0$/, ''); }
function loopMul() { return Math.pow(LOOP_MUL, S.loop - 1); }
function speedMul() { let m = 1; for (const c of CHEATS) if (c.speed && S.cheatOn[c.id]) m = Math.max(m, c.speed); return m; }
function baseDps() { let d = 0; for (const a of ALLIES) d += (S.allies[a.id] || 0) * a.dps; return d * loopMul(); }
function dps() { return baseDps() * speedMul(); }
function tapDmg() { return (1 + S.sword * SWORD.dmgPerLv) * loopMul() + baseDps() * TAP_DPS_RATE; }
function allyCost(a, n = 1) { const have = S.allies[a.id] || 0; let c = 0; for (let i = 0; i < n; i++) c += Math.floor(a.cost * Math.pow(COST_GROWTH, have + i)); return c; }
function maxAffordable(a) { let n = 0, have = S.allies[a.id] || 0, g = S.gold; while (n < 1000) { const c = Math.floor(a.cost * Math.pow(COST_GROWTH, have + n)); if (c > g) break; g -= c; n++; } return n; }
function swordCost() { return Math.floor(SWORD.cost * Math.pow(SWORD.growth, S.sword)); }
function isBossArea(a = S.area) { return a % AREAS_PER_ZONE === 0; }
function zoneOf(a = S.area) { return ZONES[Math.min(ZONES.length - 1, Math.floor((a - 1) / AREAS_PER_ZONE))]; }
function curHp(boss) { return S.cheatOn.hp1 ? 1 : enemyHp(S.area, boss); }
function goldPerSec() { const hp = enemyHp(S.area, false); return dps() > 0 ? dps() / hp * enemyGold(S.area, false) : 0; }
function bugCount() { return Object.keys(S.bugs).length; }

// ================= 敵 =================
let E = null; // { id, hp, max, boss }
function spawn() {
  const z = zoneOf();
  const boss = isBossArea();
  const id = boss ? z.boss : z.enemies[S.kills % z.enemies.length];
  E = { id, boss, max: curHp(boss), hp: curHp(boss) };
  if (ffRunning) return;
  const img = $('enemy');
  img.classList.remove('dead');
  img.className = boss ? 'boss' : '';
  img.src = 'assets/enemy/' + id + '.png';
  $('enemy-name').textContent = ENEMIES[id].name + (boss ? ' (BOSS)' : '');
  $('bg').style.backgroundImage = 'url(assets/bg/' + z.id + '.jpg)';
  renderHud();
}
function damage(d, crit, tap) {
  if (!E || E.hp <= 0 || screenOff || titleShown) return;
  E.hp -= d;
  if (tap && !ffRunning) { const img = $('enemy'); img.classList.add('hit'); setTimeout(() => img.classList.remove('hit'), 80); }
  if (E.hp <= 0) kill();
  if (!ffRunning) renderHp();
}
function kill() {
  const g = enemyGold(S.area, E.boss);
  addGold(g);
  S.stats.kills++;
  if (S.area === 1 && S.loop >= 2) { S.stats.area1Kills++; if (S.stats.area1Kills >= 100) discover('back100'); }
  if (!ffRunning) { floatText('+' + fmt(g) + 'G', 'gold'); $('enemy').classList.add('dead'); sfx(E.boss ? 'boss' : 'kill'); }
  const wasBoss = E.boss;
  if (wasBoss) {
    if (S.area === LAST_AREA) { ending(); }
    else { S.area++; S.kills = 0; S.stats.bestArea = Math.max(S.stats.bestArea, S.area); }
  } else {
    S.kills++;
    if (S.kills >= KILLS_PER_AREA) { S.area++; S.kills = 0; S.stats.bestArea = Math.max(S.stats.bestArea, S.area); }
  }
  E.hp = 0;
  if (ffRunning) spawn(); else setTimeout(spawn, wasBoss ? 400 : 180);
}
let ffRunning = false;
function addGold(g) {
  const before = S.gold;
  S.gold += g; S.stats.goldTotal += g;
  if (before <= 65535 && S.gold > 65535) discover('overflow');
}

// ================= タップ・入力 =================
let screenOff = false, titleShown = true;
let tapTimes = [], holdTimer = null, wallTaps = 0, angryTaps = 0, titleTaps = 0, powerTimes = [], keyBuf = [], selectHeld = false;
const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

function attack(x, y) {
  if (screenOff) return;
  if (titleShown) { startGame(); return; }
  S.stats.taps++;
  const crit = Math.random() < 0.05;
  const d = Math.floor(tapDmg() * (crit ? 3 : 1));
  damage(d, crit, true);
  if (!ffRunning) floatText(fmt(d), crit ? 'crit' : '', x, y);
  const now = performance.now();
  tapTimes.push(now); tapTimes = tapTimes.filter(t => now - t < 2000);
  if (tapTimes.length >= 20) discover('combo');
}
$('screen').addEventListener('pointerdown', (ev) => {
  const r = $('screen').getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  if (ev.target.closest('#party img')) { angryTaps++; if (angryTaps >= 30) discover('angry'); ev.target.classList.add('attack'); setTimeout(() => ev.target.classList.remove('attack'), 200); return; }
  if (titleShown) {
    if (ev.target.id === 'title-logo') { titleTaps++; $('title-logo').style.transform = 'scale(' + (1 + titleTaps * 0.02) + ')'; if (titleTaps >= 10) discover('title10'); return; }
    startGame(); return;
  }
  attack(x, y);
  // かべぬけ: 洞窟で左端
  if (zoneOf().id === 'cave' && x < r.width * 0.1) { wallTaps++; if (wallTaps >= 3) { wallTaps = 0; wallBonus(); } } else wallTaps = 0;
  // はなさない
  clearTimeout(holdTimer); holdTimer = setTimeout(() => discover('hold5'), 5000);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('screen').addEventListener(t, () => clearTimeout(holdTimer)));

function startGame() { titleShown = false; $('title').hidden = true; titleTaps = 0; $('title-logo').style.transform = ''; audioInit(); }
function showTitle() { titleShown = true; $('title').hidden = false; }

// ゲーム機のボタン
document.querySelectorAll('[data-k]').forEach(btn => {
  const k = btn.dataset.k;
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (k === 'select') { selectHeld = true; return; }
    if (k === 'a') { if (selectHeld) discover('select'); if (titleShown) startGame(); else attack(); }
    if (k === 'b') { if (titleShown) return; }
    if (k === 'start') { if (titleShown) startGame(); else showTab('settings'); }
    if (k === 'left' || k === 'right') { const tabs = [...document.querySelectorAll('#tabs button')]; let i = tabs.findIndex(b => b.classList.contains('on')); i = (i + (k === 'left' ? -1 : 1) + tabs.length) % tabs.length; showTab(tabs[i].dataset.tab); }
    if (k === 'up' || k === 'down') { $('panel').scrollBy({ top: k === 'up' ? -120 : 120, behavior: 'smooth' }); }
    keyBuf.push(k); if (keyBuf.length > 10) keyBuf.shift();
    if (keyBuf.join() === KONAMI.join()) discover('konami');
  });
  btn.addEventListener('pointerup', () => { if (k === 'select') selectHeld = false; });
  btn.addEventListener('pointerleave', () => { if (k === 'select') selectHeld = false; });
});
$('power').addEventListener('click', () => {
  screenOff = !screenOff;
  $('off').hidden = !screenOff; $('led').classList.toggle('off', screenOff);
  const now = performance.now(); powerTimes.push(now); powerTimes = powerTimes.filter(t => now - t < 5000);
  if (powerTimes.length >= 5) { powerTimes = []; powerBonus(); }
});

// ================= 裏技（バグ） =================
function bugDef(id) { return BUGS.find(b => b.id === id); }
function discover(id) {
  const b = bugDef(id);
  if (!b || S.bugs[id]) return;
  if (b.minLoop && S.loop < b.minLoop) return;
  S.bugs[id] = Date.now(); S.stats.bugsFound++;
  S.frags += b.frag;
  glitchFx();
  showNotice('<b>バグ #' + String(BUGS.indexOf(b) + 1).padStart(2, '0') + ' はっけん！</b><br>「' + b.name + '」<br><span class="frag">メモリ片 +' + b.frag + '</span>');
  sfx('bug');
  markTab('bugs');
  renderPanel(); renderHud(); save();
}
function glitchFx() { const s = $('screen'); s.classList.remove('glitch'); void s.offsetWidth; s.classList.add('glitch'); }
function wallBonus() {
  discover('wall');
  if (!S.bugs.wall) return;
  if (S.wallAreas[S.area]) { showNotice('かべの むこうは もう からっぽ'); return; }
  S.wallAreas[S.area] = 1;
  const g = enemyGold(S.area, false) * 30;
  addGold(g); glitchFx();
  showNotice('かべを すりぬけた！<br>かくし部屋で <span class="plus">+' + fmt(g) + 'G</span>');
}
function powerBonus() {
  discover('power');
  if (!S.bugs.power) return;
  const now = Date.now();
  if (S.cool.power && now - S.cool.power < 3600e3) { showNotice('でんげんが あつい… (' + Math.ceil((3600e3 - (now - S.cool.power)) / 60000) + 'ふん まて)'); return; }
  S.cool.power = now;
  const g = Math.floor(enemyGold(S.area, false) * (5 + Math.random() * 120));
  addGold(g); glitchFx();
  showNotice('メモリが ばけた！<br><span class="plus">+' + fmt(g) + 'G</span>');
}
// 時計・向き
let wasLandscape = window.innerWidth > window.innerHeight;
window.addEventListener('resize', () => { const l = window.innerWidth > window.innerHeight; if (l && !wasLandscape && !titleShown) discover('landscape'); wasLandscape = l; });
function secondChecks() {
  const d = new Date(), h = d.getHours(), m = d.getMinutes();
  if (!titleShown) {
    if ((h === 4 || h === 16) && m === 44) discover('clock444');
    if (h >= 0 && h < 4) discover('midnight');
  }
  if (/デバッグ|debug/i.test(S.name)) discover('nameDebug');
  if (S.loop >= 4) discover('loop3');
  checkAchievements();
}

// ================= チート =================
function cheatDef(id) { return CHEATS.find(c => c.id === id); }
function cheatAvailable(c) { return S.debugUnlocked && (!c.needBugs || bugCount() >= c.needBugs); }
function buyCheat(id) {
  const c = cheatDef(id);
  if (S.cheats[id] || !cheatAvailable(c) || S.frags < c.cost) return;
  S.frags -= c.cost; S.cheats[id] = 1; toast('「' + c.name + '」を かいはつしゃメニューに ついか！'); sfx('buy'); renderPanel(); renderHud(); save();
}
function markCheated() { if (!S.cheated) { S.cheated = true; toast('この周は「改造」あつかいになります'); } }
function toggleCheat(id) {
  const c = cheatDef(id); if (!S.cheats[id]) return;
  S.cheatOn[id] = !S.cheatOn[id];
  if (S.cheatOn[id] && !HARMLESS_CHEATS.includes(id)) markCheated();
  if (id === 'bgm') bgm(S.cheatOn.bgm);
  if (id === 'hp1' && E) { E.max = curHp(E.boss); E.hp = Math.min(E.hp, E.max); renderHp(); }
  renderPanel(); save();
}
function useCheat(id) {
  const c = cheatDef(id); if (!S.cheats[id]) return;
  if (id === 'palette') { S.palette = (S.palette + 1) % c.opts.length; applyPalette(); renderPanel(); return; }
  markCheated();
  if (id === 'gold') {
    const now = Date.now();
    if (S.cool.gold && now - S.cool.gold < c.cooldown * 1000) { toast('クールタイム中 (' + Math.ceil((c.cooldown * 1000 - (now - S.cool.gold)) / 60000) + 'ふん)'); return; }
    const g = Math.max(100, Math.floor(goldPerSec() * 600)); S.cool.gold = now; addGold(g); glitchFx(); toast('+' + fmt(g) + 'G を ちゅうにゅう'); renderHud(); renderPanel();
  }
  if (id === 'stage') stageSelect();
  if (id === 'edit') saveEdit();
  save();
}
function applyPalette() { const s = $('screen'); s.classList.remove('pal-green', 'pal-mono', 'pal-red'); if (S.palette) s.classList.add(['', 'pal-green', 'pal-mono', 'pal-red'][S.palette]); }
function stageSelect() {
  let html = '<div class="note">行ったことのある ゾーンへ とぶ（さいこう エリア ' + S.stats.bestArea + '）</div>';
  ZONES.forEach((z, i) => { const a = i * AREAS_PER_ZONE + 1; if (a <= S.stats.bestArea) html += '<button class="mini" style="margin:3px" onclick="jumpTo(' + a + ')">' + z.name + ' (' + a + ')</button>'; });
  html += '<button class="mini" style="margin:3px" onclick="jumpTo(' + S.stats.bestArea + ')">さいしん (' + S.stats.bestArea + ')</button>';
  modal('ステージセレクト', html);
}
function jumpTo(a) { S.area = a; S.kills = 0; closeModal(); spawn(); toast('エリア ' + a + ' へ'); save(); }
function saveEdit() {
  modal('セーブ改造', '<div class="note">すうじを かきかえる（やりすぎ ちゅうい）</div>ゴールド<input type="text" id="ed-gold" value="' + Math.floor(S.gold) + '"><br><br>メモリ片<input type="text" id="ed-frag" value="' + S.frags + '">',
    [{ label: 'かきこむ', cls: 'ok', fn: () => { const g = Number($('ed-gold').value), f = Number($('ed-frag').value); if (isFinite(g)) S.gold = Math.max(0, g); if (isFinite(f)) S.frags = Math.max(0, Math.floor(f)); glitchFx(); renderHud(); renderPanel(); save(); } }]);
}

// ================= 実績・エンディング・周回 =================
function checkAchievements() {
  for (const a of ACHIEVEMENTS) if (!S.ach[a.id] && a.cond(S)) { S.ach[a.id] = 1; S.frags += a.frag; toast('🏆 ' + a.name + '  <span class="frag">メモリ片 +' + a.frag + '</span>'); sfx('ach'); markTab('records'); renderHud(); }
}
function ending() {
  const sec = Math.floor((Date.now() - S.loopStart) / 1000);
  if (S.cheated) S.stats.endingsCheat++; else S.stats.endingsClean++;
  if (!S.stats.fastestClear || sec < S.stats.fastestClear) S.stats.fastestClear = sec;
  const first = !S.debugUnlocked;
  S.debugUnlocked = true;
  S.stats.bestArea = Math.max(S.stats.bestArea, LAST_AREA);
  checkAchievements();
  let html = '<div class="ending"><div class="big">魔王を たおした！</div>' + (S.cheated ? '<span class="badge">改造</span>' : '<span class="badge">正規</span>') + ' クリアタイム ' + fmtTime(sec) + '<br><br>';
  html += 'せかいに へいわが もどった…<br>と おもったら、がめんが みだれて<br>' + (first ? '<b class="frag">「デバッグメニュー」が ひらいた！</b><br>（デバッグ タブから メモリ片で きのうを かう）' : 'また はじまりに もどされる。') + '</div>';
  html += '<div class="note">「カセットを さしなおす」と 最初からになるが、全ダメージ ×' + Math.pow(LOOP_MUL, S.loop) + '（' + S.loop + '周目→' + (S.loop + 1) + '周目）。裏技・メモリ片・チートは のこる。</div>';
  modal('エンディング', html, [{ label: 'このまま あそぶ', fn: () => {} }, { label: 'カセットを さしなおす', cls: 'ok', fn: prestige }]);
  markTab('debug');
  save();
}
function prestige() {
  S.loop++; S.gold = 0; S.allies = {}; S.sword = 0; S.area = 1; S.kills = 0; S.wallAreas = {}; S.cheated = false; S.loopStart = Date.now(); S.stats.area1Kills = 0;
  glitchFx(); closeModal(); showTitle(); spawn(); renderAll(); save();
  toast(S.loop + '周目 スタート！ ダメージ ×' + loopMul());
  checkAchievements();
}
function fmtTime(sec) { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + 'じかん' : '') + (m ? m + 'ふん' : '') + s + 'びょう'; }

// ================= tick =================
let last = performance.now(), acc = 0, autoAcc = 0, atkAcc = 0;
function tick(dt) {
  if (screenOff || titleShown) return;
  const d = dps();
  if (d > 0 && E && E.hp > 0) { acc += d * dt; if (acc >= 1) { const dm = Math.floor(acc); acc -= dm; damage(dm, false, false); } }
  if (S.cheatOn.auto) { autoAcc += dt; while (autoAcc >= 0.2) { autoAcc -= 0.2; attack(); } }
  if (d > 0) { atkAcc += dt; if (atkAcc >= 0.5) { atkAcc = 0; const imgs = $('party').querySelectorAll('img'); if (imgs.length) { const im = imgs[Math.floor(Math.random() * imgs.length)]; im.classList.add('attack'); setTimeout(() => im.classList.remove('attack'), 200); } } }
  S.stats.playSec += dt;
}
setInterval(() => {
  const now = performance.now(); const dt = Math.min(1, (now - last) / 1000); last = now;
  tick(dt);
}, 100);
setInterval(() => { secondChecks(); renderHud(); }, 1000);
setInterval(save, 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else last = performance.now(); });
window.addEventListener('pagehide', save);

// オフライン進行
function offline() {
  const elapsed = (Date.now() - S.lastSave) / 1000;
  if (elapsed >= 8 * 3600) setTimeout(() => discover('sleep'), 1500);
  if (elapsed < 60 || goldPerSec() <= 0) return;
  const t = Math.min(elapsed, 8 * 3600);
  const g = Math.floor(goldPerSec() * t);
  if (g <= 0) return;
  addGold(g);
  modal('おかえり', 'はなれていた ' + fmtTime(Math.floor(elapsed)) + ' のあいだに、なかまが たたかっていた。<br><br><b class="plus">+' + fmt(g) + ' G</b>' + (elapsed > 8 * 3600 ? '<br><small>（8じかんぶん まで）</small>' : ''));
}

// ================= 描画 =================
function renderHud() {
  $('gold').textContent = fmt(S.gold) + ' G';
  $('area-name').textContent = zoneOf().name + (S.loop > 1 ? ' ' + S.loop + '周' : '');
  $('area-no').textContent = 'エリア ' + S.area;
  $('progfill').style.width = (isBossArea() ? (E ? (1 - E.hp / E.max) * 100 : 0) : S.kills / KILLS_PER_AREA * 100) + '%';
  renderHp();
  const p = $('panel-gold'); if (p) p.innerHTML = fmt(S.gold) + ' G  <span class="frag">◆' + S.frags + '</span>  <small>DPS ' + fmt(dps()) + ' / タップ ' + fmt(tapDmg()) + '</small>';
  document.querySelectorAll('.row button.buy').forEach(b => { const c = Number(b.dataset.cost); if (!isNaN(c)) b.disabled = S.gold < c; });
}
function renderHp() { if (!E) return; $('hpfill').style.width = Math.max(0, E.hp / E.max * 100) + '%'; $('hptext').textContent = fmt(Math.max(0, E.hp)) + ' / ' + fmt(E.max); }
function renderParty() {
  const p = $('party'); p.innerHTML = '';
  for (const a of ALLIES) if (S.allies[a.id]) { const im = document.createElement('img'); im.src = 'assets/ally/' + a.id + '.png'; im.title = a.name + ' ×' + S.allies[a.id]; p.appendChild(im); }
}
function floatText(txt, cls, x, y) {
  const fx = $('fx'); const r = fx.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'dmg ' + (cls || ''); el.textContent = txt;
  el.style.left = ((x != null ? x : r.width * (0.35 + Math.random() * 0.3)) - 10) + 'px'; el.style.top = ((y != null ? y : r.height * 0.4) - 10) + 'px';
  fx.appendChild(el); setTimeout(() => el.remove(), 700);
  if (fx.children.length > 30) fx.firstChild.remove();
}
let noticeTimer = null;
function showNotice(html) { const n = $('notice'); n.innerHTML = html; n.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => n.hidden = true, 2800); }
let toastTimer = null;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }
function modal(title, html, buttons) {
  $('modal-title').textContent = title; $('modal-body').innerHTML = html;
  const bb = $('modal-buttons'); bb.innerHTML = '';
  (buttons || [{ label: 'OK' }]).forEach(b => { const btn = document.createElement('button'); btn.textContent = b.label; if (b.cls) btn.className = b.cls; btn.onclick = () => { closeModal(); if (b.fn) b.fn(); }; bb.appendChild(btn); });
  $('modal').classList.add('show');
}
function closeModal() { $('modal').classList.remove('show'); }
function markTab(tab) { const b = document.querySelector('#tabs button[data-tab=' + tab + ']'); if (!b.classList.contains('on') && !b.querySelector('.dot')) b.insertAdjacentHTML('beforeend', '<span class="dot"></span>'); }

let curTab = 'party', buyN = 1;
function showTab(tab) { curTab = tab; document.querySelectorAll('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); if (b.dataset.tab === tab) { const d = b.querySelector('.dot'); if (d) d.remove(); } }); renderPanel(); $('panel').scrollTop = 0; }
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

function renderPanel() {
  const p = $('panel');
  let h = '<div id="panel-gold" class="note"></div>';
  if (curTab === 'party') {
    h += '<div class="buybar">' + [1, 10, 100, 'max'].map(n => '<button class="' + (buyN === n ? 'on' : '') + '" onclick="setBuyN(\'' + n + '\')">×' + n + '</button>').join('') + '</div>';
    for (const a of ALLIES) {
      const have = S.allies[a.id] || 0;
      const n = buyN === 'max' ? Math.max(1, maxAffordable(a)) : buyN;
      const cost = allyCost(a, n);
      const unlocked = a === ALLIES[0] || have > 0 || S.gold >= a.cost * 0.5 || S.stats.goldTotal >= a.cost * 0.5;
      if (!unlocked) { h += '<div class="row locked"><div class="ico">?</div><div class="info"><div class="name">？？？</div><div class="sub">もっと かせぐと あらわれる</div></div></div>'; continue; }
      h += '<div class="row"><img src="assets/ally/' + a.id + '.png" alt=""><div class="info"><div class="name">' + a.name + ' <span class="badge">×' + have + '</span></div><div class="sub">DPS ' + fmt(a.dps * loopMul()) + ' / 1人 ・ 合計 ' + fmt(have * a.dps * loopMul() * speedMul()) + '</div></div><button class="buy" data-cost="' + cost + '" onclick="buyAlly(\'' + a.id + '\',' + n + ')">+' + n + '<br>' + fmt(cost) + 'G</button></div>';
    }
  } else if (curTab === 'upgrade') {
    h += '<h4>そうび</h4><div class="row"><div class="ico">🗡️</div><div class="info"><div class="name">けん Lv.' + S.sword + '</div><div class="sub">タップ1回 ' + fmt(tapDmg()) + ' ダメージ（+' + (SWORD.dmgPerLv * loopMul()).toFixed(1) + '）</div></div><button class="buy" data-cost="' + swordCost() + '" onclick="buySword()">きたえる<br>' + fmt(swordCost()) + 'G</button></div>';
    h += '<h4>しゅうかい</h4><div class="note">いま ' + S.loop + '周目（全ダメージ ×' + loopMul().toFixed(1) + '）。魔王を たおすと「カセットを さしなおす」が できる。' + (S.debugUnlocked ? '' : 'クリアすると デバッグメニューが ひらく。') + '</div>';
    if (S.debugUnlocked && S.area >= LAST_AREA) h += '<button class="ok" style="width:100%" onclick="confirmPrestige()">カセットを さしなおす（' + (S.loop + 1) + '周目・ダメージ ×' + Math.pow(LOOP_MUL, S.loop) + '）</button>';
    h += '<h4>てきの つよさ</h4><div class="stat"><span>いまのエリアの てきHP</span><span>' + fmt(enemyHp(S.area, false)) + '</span></div><div class="stat"><span>おとす ゴールド</span><span>' + fmt(enemyGold(S.area, false)) + '</span></div><div class="stat"><span>1びょうの かせぎ（めやす）</span><span>' + fmt(goldPerSec()) + ' G</span></div>';
  } else if (curTab === 'bugs') {
    const vis = BUGS.filter(b => !b.minLoop || S.loop >= b.minLoop);
    h += '<div class="note">このゲーム、なんか おかしい。へんな操作で「バグ」がおきる。見つけると <span class="frag">◆メモリ片</span> がもらえる。 ' + bugCount() + ' / ' + BUGS.length + '</div>';
    BUGS.forEach((b, i) => {
      const no = String(i + 1).padStart(2, '0');
      if (b.minLoop && S.loop < b.minLoop) { h += '<div class="row locked"><span class="bugno">#' + no + '</span><div class="info"><div class="name">？？？</div><div class="sub">' + b.minLoop + '周目から</div></div></div>'; return; }
      if (S.bugs[b.id]) h += '<div class="row found"><span class="bugno">#' + no + '</span><div class="info"><div class="name">' + b.name + '</div><div class="sub">' + b.hint + (b.reuse ? '<br>♻ ' + b.reuse : '') + '</div></div><span class="frag">◆' + b.frag + '</span></div>';
      else h += '<div class="row"><span class="bugno">#' + no + '</span><div class="info"><div class="name">？？？</div><div class="sub">' + b.hint + '</div></div><span class="frag">◆' + b.frag + '</span></div>';
    });
  } else if (curTab === 'debug') {
    if (!S.debugUnlocked) { h += '<div class="note" style="text-align:center;padding:30px 10px">🔒 デバッグメニュー<br><br>いちど 魔王を たおすと ひらく。<br><small>（メモリ片 ◆' + S.frags + ' は そのとき つかえる）</small></div>'; }
    else {
      h += '<div class="note">かいはつしゃの ためした きのう。<span class="frag">◆メモリ片</span>で かう。カラーパレットと BGM 以外を ONにすると、その周は「改造」きろくになる。</div>';
      for (const c of CHEATS) {
        const has = S.cheats[c.id], avail = cheatAvailable(c);
        let btn;
        if (!has) btn = '<button class="buy" ' + (avail && S.frags >= c.cost ? '' : 'disabled') + ' onclick="buyCheat(\'' + c.id + '\')">かう<br>◆' + c.cost + '</button>';
        else if (c.type === 'toggle') btn = '<button onclick="toggleCheat(\'' + c.id + '\')">' + (S.cheatOn[c.id] ? 'ON' : 'OFF') + '</button>';
        else if (c.type === 'cycle') btn = '<button onclick="useCheat(\'' + c.id + '\')">' + c.opts[S.palette] + '</button>';
        else btn = '<button onclick="useCheat(\'' + c.id + '\')">つかう</button>';
        h += '<div class="row ' + (S.cheatOn[c.id] ? 'on' : '') + (avail || has ? '' : ' locked') + '"><div class="ico">' + (has ? '🧪' : '🔒') + '</div><div class="info"><div class="name">' + c.name + '</div><div class="sub">' + c.desc + (!has && c.needBugs && bugCount() < c.needBugs ? '<br>裏技を ' + c.needBugs + 'こ みつけると' : '') + '</div></div>' + btn + '</div>';
      }
    }
  } else if (curTab === 'records') {
    const st = S.stats;
    h += '<h4>きろく</h4>';
    [['たおした てき', fmt(st.kills)], ['タップ', fmt(st.taps)], ['かせいだ ゴールド', fmt(st.goldTotal)], ['さいこう エリア', st.bestArea], ['しゅうかい', S.loop + '周目'], ['正規クリア', st.endingsClean + '回'], ['改造クリア', st.endingsCheat + '回'], ['さいそく クリア', st.fastestClear ? fmtTime(st.fastestClear) : '-'], ['あそんだ じかん', fmtTime(Math.floor(st.playSec))], ['この周', (S.cheated ? '改造' : '正規') + ' / ' + fmtTime(Math.floor((Date.now() - S.loopStart) / 1000))]].forEach(([k, v]) => h += '<div class="stat"><span>' + k + '</span><span>' + v + '</span></div>');
    h += '<h4>じっせき ' + Object.keys(S.ach).length + ' / ' + ACHIEVEMENTS.length + '</h4>';
    for (const a of ACHIEVEMENTS) h += '<div class="row ' + (S.ach[a.id] ? 'found' : 'locked') + '"><div class="ico">' + (S.ach[a.id] ? '🏆' : '·') + '</div><div class="info"><div class="name">' + a.name + '</div><div class="sub">' + a.desc + '</div></div><span class="frag">◆' + a.frag + '</span></div>';
  } else if (curTab === 'settings') {
    h += '<h4>プレイヤー</h4><div class="note">なまえ（8もじまで）</div><input type="text" id="name" maxlength="8" value="' + esc(S.name) + '" placeholder="ゆうしゃ"><button class="mini" style="margin-top:6px" onclick="setName()">きめる</button>';
    h += '<h4>おと</h4><button class="mini" onclick="toggleMute()">こうかおん: ' + (S.mute ? 'OFF' : 'ON') + '</button>';
    h += '<h4>データ</h4><button class="mini" onclick="save();toast(\'セーブした\')">いま セーブ</button> <button class="mini danger" onclick="confirmReset()">ぜんぶ けす</button>';
    h += '<h4>これは なに</h4><div class="note">ひろった ふるいゲーム機「GLITCH BOY」に はいっていた RPG。なんだか バグが おおい。タップで てきを たおし、なかまを やとって ほうち。おかしな操作で「裏技」を みつけ、クリアすると「デバッグメニュー」が ひらく。<br>v0.1 (2026-09-23)</div>';
  }
  p.innerHTML = h; renderHud();
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setBuyN(n) { buyN = n === 'max' ? 'max' : Number(n); renderPanel(); }
function buyAlly(id, n) {
  const a = ALLIES.find(x => x.id === id); const cost = allyCost(a, n);
  if (n <= 0 || S.gold < cost) return;
  S.gold -= cost; S.allies[id] = (S.allies[id] || 0) + n; sfx('buy');
  if (S.gold === 0) discover('zero');
  if (allyCount(S) === 13) discover('thirteen');
  renderParty(); renderPanel(); save();
}
function buySword() { const c = swordCost(); if (S.gold < c) return; S.gold -= c; S.sword++; sfx('buy'); if (S.gold === 0) discover('zero'); renderPanel(); save(); }
function setName() { S.name = $('name').value.trim().slice(0, 8); toast('なまえ: ' + (S.name || 'ゆうしゃ')); secondChecks(); save(); }
function toggleMute() { S.mute = !S.mute; renderPanel(); save(); }
function confirmPrestige() { modal('カセットを さしなおす', 'ゴールド・なかま・けん・エリアが 最初にもどる。<br>裏技・メモリ片・チート・じっせきは のこる。<br>' + (S.loop + 1) + '周目は 全ダメージ ×' + Math.pow(LOOP_MUL, S.loop), [{ label: 'やめる' }, { label: 'さしなおす', cls: 'ok', fn: prestige }]); }
function confirmReset() { modal('ぜんぶ けす', 'セーブデータを 完全にけす。裏技帳も メモリ片も きえる。', [{ label: 'やめる' }, { label: 'けす', cls: 'danger', fn: () => { localStorage.removeItem(SAVE_KEY); location.reload(); } }]); }

// ================= 音（WebAudio の かんたんビープ） =================
let AC = null, bgmTimer = null;
function audioInit() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
function beep(freq, dur, type = 'square', vol = 0.08, when = 0) {
  if (!AC || S.mute) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(AC.destination); const t = AC.currentTime + when; o.start(t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.stop(t + dur);
}
function sfx(k) {
  if (!AC) return;
  if (k === 'kill') beep(660, 0.08);
  if (k === 'boss') { beep(440, 0.1); beep(660, 0.1, 'square', 0.08, 0.1); beep(880, 0.2, 'square', 0.08, 0.2); }
  if (k === 'buy') beep(880, 0.05, 'triangle');
  if (k === 'ach') { beep(784, 0.1); beep(1046, 0.25, 'square', 0.08, 0.1); }
  if (k === 'bug') { for (let i = 0; i < 8; i++) beep(200 + Math.random() * 1200, 0.06, 'sawtooth', 0.06, i * 0.05); }
}
function bgm(on) {
  clearInterval(bgmTimer); bgmTimer = null;
  if (!on || !AC) return;
  const seq = [262, 330, 392, 330, 262, 392, 494, 392, 349, 440, 523, 440, 262, 0, 330, 0];
  let i = 0;
  bgmTimer = setInterval(() => { let f = seq[i++ % seq.length]; if (f && Math.random() < 0.15) f *= [0.5, 2, 1.06, 0.94][Math.floor(Math.random() * 4)]; if (f) beep(f, 0.12, 'square', 0.04); }, 140);
}

// ================= 開始 =================
function renderAll() { renderParty(); renderPanel(); renderHud(); applyPalette(); }
spawn();
renderAll();
offline();
if (S.cheatOn.bgm) S.cheatOn.bgm = false; // 音は 操作してから
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// デバッグ: ?debug で ff(秒) が使える（仲間の攻撃を早送り）
if (DEBUG) {
  window.S = S; window.E = () => E;
  window.ff = (sec) => { if (titleShown) startGame(); ffRunning = true; for (let i = 0; i < sec * 10; i++) tick(0.1); ffRunning = false; renderAll(); return { area: S.area, kills: S.kills, gold: Math.floor(S.gold), dps: dps() }; };
  window.tapN = (n) => { if (titleShown) startGame(); ffRunning = true; for (let i = 0; i < n; i++) attack(); ffRunning = false; renderAll(); return Math.floor(S.gold); };
  window.spawnNow = spawn;
  console.log('[glitch] debug mode: ff(sec), S, E()');
}
