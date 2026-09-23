/* グリッチ・クリッカー 本体
   状態(S) → tick（仲間の攻撃・チェック）→ 描画。裏技の検出は各所の hook から discover() を呼ぶ。 */
'use strict';

const SAVE_KEY = 'glitch-clicker-save';
const DEBUG = location.search.includes('debug');
const DEV = location.search.includes('dev') || DEBUG; // 開発用（?dev）: 設定タブに早送りが出る
let devFast = false;
const $ = (id) => document.getElementById(id);

// ================= 状態 =================
function newState() {
  return {
    v: 1, gold: 0, frags: 0, area: 1, kills: 0, sword: 0, allies: {},
    bugs: {}, cheats: {}, cheatOn: {}, ach: {}, cool: {}, wallAreas: {},
    loop: 1, loopStart: Date.now(), cheated: false, name: '', mute: false, palette: 0,
    debugUnlocked: false, lastSave: Date.now(), bgm: true,
    mile: {}, buff: 1, skillCd: {}, skillUntil: {}, luck: 0, zoneSeen: {}, rewardQueue: 0,
    stats: { kills: 0, taps: 0, goldTotal: 0, bestArea: 1, endingsClean: 0, endingsCheat: 0, fastestClear: 0, area1Kills: 0, bugsFound: 0, playSec: 0, killsById: {}, killsByZone: {}, rareKills: {}, critKills: 0, milesBought: 0, rewards: {}, jumped: {}, injects: 0, toggles: 0, maouKills: 0, skillUses: 0, skillUsesLoop: 0, nameChanges: 0, bugsLoop: 0, saves: 0 },
    hints: {}, titles: {},
  };
}
let S = load();
(function migrateCheats() {
  if (S.v >= 3) return;
  if (S.v >= 2) { // v2 → v3: てきHP=1 は最終チートに移動。持っていたら「てきHP 1/10」に置き換え
    if (S.cheats.hp1) { delete S.cheats.hp1; delete S.cheatOn.hp1; S.cheats.hp10 = 1; setTimeout(() => modal('チートの ちょうせい', '「てきHP=1」は つよすぎたので、さいごの チート（裏技300・5周目）に うつしました。<br>かわりに「てきHP 1/10」を おわたしします。'), 800); }
    S.v = 3; return;
  }
  S.v = 3;
  const refunded = [];
  for (const c of CHEATS) {
    if (!S.cheats[c.id]) continue;
    const ok = (!c.needBugs || Object.keys(S.bugs).length >= c.needBugs) && (!c.needLoop || S.loop >= c.needLoop);
    if (ok) continue;
    delete S.cheats[c.id]; delete S.cheatOn[c.id];
    S.frags += CHEATS_OLD_COST[c.id] || 0; refunded.push(c.name);
  }
  if (refunded.length) setTimeout(() => modal('デバッグメニューの ちょうせい', 'かいはつしゃメニューが やすすぎたので、ねだんと じょうけんを あげました。<br>じょうけんを みたしていない つぎの きのうは いったん ロックして、メモリ片を へんきんしました。<br><br>' + refunded.join('・') + '<br><br><small>もういちど かうには 裏技を あつめてください。</small>'), 800);
})();
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
  if (n < 1e20) return trim(n / 1e16) + '京';
  if (n < 1e24) return trim(n / 1e20) + '垓';
  return n.toExponential(2);
}
function trim(x) { return x >= 100 ? Math.floor(x) : x.toFixed(1).replace(/\.0$/, ''); }
function loopMul() { return Math.pow(LOOP_MUL, S.loop - 1); }
function speedMul() { let m = 1; for (const c of CHEATS) if (c.speed && S.cheatOn[c.id]) m = Math.max(m, c.speed); return m; }
let PERK = { dps: 0, tap: 0, gold: 0, crit: 0, cd: 0, offline: 0, rare: 0 };
function recalcPerks() { PERK = { dps: 0, tap: 0, gold: 0, crit: 0, cd: 0, offline: 0, rare: 0 }; for (const id in S.bugs) { const b = BUGS[BUG_INDEX[id]]; if (b && b.perk) PERK[b.perk[0]] += b.perk[1]; } PERK.cd = Math.min(0.5, PERK.cd); }
function perkSummary() { const p = []; if (PERK.dps) p.push('DPS +' + Math.round(PERK.dps * 100) + '%'); if (PERK.tap) p.push('タップ +' + Math.round(PERK.tap * 100) + '%'); if (PERK.gold) p.push('ゴールド +' + Math.round(PERK.gold * 100) + '%'); if (PERK.crit) p.push('かいしん +' + Math.round(PERK.crit * 100) + '%'); if (PERK.cd) p.push('CT -' + Math.round(PERK.cd * 100) + '%'); if (PERK.offline) p.push('ほうち +' + PERK.offline + 'h'); if (PERK.rare) p.push('レア +' + Math.round(PERK.rare * 100) + '%'); return p.join(' / '); }
function allyDps(a) { return a.dps * Math.pow(2, S.mile[a.id] || 0) * loopMul() * S.buff * (1 + PERK.dps); }
function baseDps() { let d = 0; for (const a of ALLIES) d += (S.allies[a.id] || 0) * allyDps(a); return d; }
function dps() { return baseDps() * speedMul(); }
function tapDmg() { return ((1 + S.sword * SWORD.dmgPerLv) * loopMul() + baseDps() * TAP_DPS_RATE) * (1 + PERK.tap) * (skillActive('crit') ? 10 : 1); }
function skillActive(id) { return (S.skillUntil[id] || 0) > Date.now(); }
function mileCost(a) { return Math.floor(a.cost * Math.pow(COST_GROWTH, S.allies[a.id] || 0)) * MILE_COST_MUL; }
function mileNext(a) { return MILESTONES[S.mile[a.id] || 0]; }
function allyCost(a, n = 1) { const have = S.allies[a.id] || 0; let c = 0; for (let i = 0; i < n; i++) c += Math.floor(a.cost * Math.pow(COST_GROWTH, have + i)); return c; }
function maxAffordable(a) { let n = 0, have = S.allies[a.id] || 0, g = S.gold; while (n < 1000) { const c = Math.floor(a.cost * Math.pow(COST_GROWTH, have + n)); if (c > g) break; g -= c; n++; } return n; }
function swordCost() { return Math.floor(SWORD.cost * Math.pow(SWORD.growth, S.sword)); }
function isBossArea(a = S.area) { return a % AREAS_PER_ZONE === 0; }
function zoneOf(a = S.area) { return ZONES[Math.min(ZONES.length - 1, Math.floor((a - 1) / AREAS_PER_ZONE))]; }
function curHp(boss) { if (S.cheatOn.hp1) return 1; const h = enemyHp(S.area, boss); return S.cheatOn.hp10 ? Math.max(1, Math.floor(h / 10)) : h; }
function goldPerSec() { const hp = enemyHp(S.area, false); return dps() > 0 ? dps() / hp * enemyGold(S.area, false) : 0; }
function bugCount() { return Object.keys(S.bugs).length; }

// ================= 敵 =================
let E = null; // { id, hp, max, boss }
function spawn() {
  const z = zoneOf();
  const boss = isBossArea();
  let id = boss ? z.boss : z.enemies[S.kills % z.enemies.length];
  let rare = null;
  if (!boss && !ffRunning) { const r = Math.random(); let acc = 0; for (const x of RARES) { acc += x.chance * (1 + PERK.rare); if (r < acc) { rare = x; break; } } }
  const hp = Math.max(1, Math.floor(curHp(boss) * (rare ? rare.hpMul : 1)));
  E = { id: rare ? rare.id : id, boss, rare, max: hp, hp };
  if (ffRunning) return;
  const img = $('enemy');
  img.classList.remove('dead');
  img.className = boss ? 'boss' : (rare ? 'rare-' + rare.id : '');
  const src = 'assets/enemy/' + E.id + '.png';
  if (img.src.indexOf(src) < 0) { const pre = PRELOADED[src]; if (!pre || !pre.complete) { img.style.visibility = 'hidden'; img.onload = () => { img.style.visibility = ''; img.onload = null; }; } }
  img.src = src;
  $('enemy-name').textContent = rare ? rare.name : ENEMIES[id].name + (boss ? ' (BOSS)' : '');
  $('bg').style.backgroundImage = 'url(assets/bg/' + z.id + '.jpg)';
  renderHud(); updateMusic();
}
function damage(d, crit, tap) {
  if (!E || E.hp <= 0 || screenOff || titleShown) return;
  E.hp -= d; B.lastDmg = d;
  if (!tap) B.tapOnlyFight = false;
  if (tap && !ffRunning) { const img = $('enemy'); img.classList.add('hit'); setTimeout(() => img.classList.remove('hit'), 80); }
  if (E.hp <= 0) kill();
  else if (!ffRunning && (E.hp === 1 || E.hp === 7 || Math.floor(S.gold) === E.hp)) bugEvent('damage', { hp: E.hp });
  if (!ffRunning) renderHp();
}
function kill() {
  let g = enemyGold(S.area, E.boss);
  if (E.rare) g *= E.rare.goldMul;
  if (skillActive('rush')) g *= 3;
  if (S.luck > 0) { S.luck--; g *= 2; }
  g = Math.floor(g * (1 + PERK.gold));
  addGold(g);
  if (E.rare && E.rare.frag && !ffRunning) { S.frags += E.rare.frag; showNotice('バグった てきを たおした！<br><span class="frag">メモリ片 +' + E.rare.frag + '</span>'); glitchFx(); }
  S.stats.kills++;
  const st = S.stats, z = zoneOf();
  st.killsById[E.id] = (st.killsById[E.id] || 0) + 1; st.killsByZone[z.id] = (st.killsByZone[z.id] || 0) + 1;
  if (E.rare) st.rareKills[E.rare.id] = (st.rareKills[E.rare.id] || 0) + 1;
  if (E.boss && E.id === 'maou') st.maouKills++;
  if (B.lastCrit && B.lastDmg > 0) st.critKills++;
  if (!ffRunning) {
    const now = Date.now();
    B.rareStreak = E.rare ? B.rareStreak + 1 : 0;
    B.sameStreak = (E.id === B.lastKillId) ? B.sameStreak + 1 : 1; B.lastKillId = E.id;
    B.tapStreak = B.tapOnlyFight ? B.tapStreak + 1 : 0;
    B.killTimes.push(now); B.killTimes = B.killTimes.filter(t => now - t < 60000);
    const fightSec = (now - B.fightStart) / 1000;
    const ctx = { id: E.id, rare: E.rare ? E.rare.id : null, area: S.area, tapOnly: B.tapOnlyFight && allyCount(S) === 0, fightSec, inMinute: B.killTimes.length, overkill: E.max > 0 ? B.lastDmg / E.max : 0, rareStreak: B.rareStreak, tapStreak: B.tapStreak, sameStreak: B.sameStreak, rushActive: skillActive('rush'), critActive: skillActive('crit'), alloutKill: B.pendingAllout, skillsUsed: Object.keys(B.skillsFight).length > 0, skillsUsedCount: Object.keys(B.skillsFight).length, sec0: new Date().getSeconds() === 0 };
    bugEvent('kill', ctx);
    if (E.boss) bugEvent('boss', ctx);
  }
  B.pendingAllout = false; B.tapOnlyFight = true; B.fightStart = Date.now(); B.skillsFight = {};
  if (S.area === 1 && S.loop >= 2) { S.stats.area1Kills++; if (S.stats.area1Kills >= 100) discover('back100'); }
  if (!ffRunning) { floatText('+' + fmt(g) + 'G', 'gold'); $('enemy').classList.add('dead'); sfx(E.boss ? 'boss' : 'kill'); }
  const wasBoss = E.boss;
  if (wasBoss) {
    if (S.area === LAST_AREA) { ending(); }
    else { S.area++; S.kills = 0; S.stats.bestArea = Math.max(S.stats.bestArea, S.area); S.rewardQueue = (S.rewardQueue || 0) + 1; if (!ffRunning) { renderSkills(); showNotice('🎁 ごほうびを もらった！<br><small>したの「ごほうび」ボタンで うけとる</small>'); } areaChanged(); }
  } else {
    S.kills++;
    if (S.kills >= KILLS_PER_AREA) { S.area++; S.kills = 0; S.stats.bestArea = Math.max(S.stats.bestArea, S.area); areaChanged(); }
  }
  E.hp = 0;
  if (ffRunning) spawn(); else setTimeout(spawn, wasBoss ? 400 : 180);
  if (!ffRunning) zoneIntro();
}
function areaChanged() {
  B.areaSince = Date.now();
  if (ffRunning) return;
  bugEvent('area', { area: S.area, loopSec: (Date.now() - S.loopStart) / 1000 });
  if ((S.area - 1) % AREAS_PER_ZONE === 0) bugEvent('zone', { zone: zoneOf().id, area: S.area });
}
function zoneIntro() {
  const z = zoneOf();
  if (S.zoneSeen[z.id]) return;
  S.zoneSeen[z.id] = 1;
  bugEvent('zone', { zone: z.id, area: S.area });
  setTimeout(() => showNotice('<b>' + z.name + '</b><br>' + ZONE_INTRO[z.id]), 700);
}
// ボス撃破のごほうび（3択）
function bossReward() {
  if (!(S.rewardQueue > 0)) return;
  const pool = BOSS_REWARDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  let html = '<div class="note">ボスの ごほうび（のこり ' + S.rewardQueue + '）。ひとつ えらぶ</div>';
  pool.forEach(r => { html += '<button class="reward" onclick="takeReward(\'' + r.id + '\')"><b>' + r.name + '</b><br><small>' + r.desc + '</small></button>'; });
  modal('ごほうび', html, []);
  sfx('ach');
}
function takeReward(id) {
  closeModal();
  if (!(S.rewardQueue > 0)) return;
  S.rewardQueue--;
  if (id === 'gold') { const g = Math.max(50, Math.floor(goldPerSec() * 600)); addGold(g); toast('+' + fmt(g) + 'G'); }
  if (id === 'sword') { S.sword += 5; toast('けん +5'); }
  if (id === 'frag') { S.frags += 3; toast('<span class="frag">メモリ片 +3</span>'); }
  if (id === 'buff') { S.buff = Math.round((S.buff + 0.2) * 100) / 100; toast('仲間の DPS +20%（いま ×' + S.buff.toFixed(1) + '）'); }
  if (id === 'cdreset') { S.skillCd = {}; toast('スキルの クールタイムが もどった'); }
  if (id === 'luck') { S.luck += 30; toast('つぎの 30たい ゴールド ×2'); }
  S.stats.rewards[id] = (S.stats.rewards[id] || 0) + 1;
  B.rewardStreak = (id === B.lastReward) ? B.rewardStreak + 1 : 1; B.lastReward = id;
  bugEvent('reward', { id, streak: B.rewardStreak });
  renderAll(); save();
  if (S.rewardQueue > 0) setTimeout(bossReward, 250);
}
// スキル
function skillUnlocked(sk) { return S.stats.bestArea >= sk.unlockArea; }
function useSkill(id) {
  const sk = SKILLS.find(s => s.id === id); const now = Date.now();
  if (!skillUnlocked(sk) || titleShown || screenOff) return;
  if ((S.skillCd[id] || 0) > now) { B.cdPresses++; bugEvent('skillcd', { presses: B.cdPresses }); return; }
  S.skillCd[id] = now + sk.cd * 1000 * (1 - PERK.cd);
  S.stats.skillUses++; S.stats.skillUsesLoop++; B.skillsFight[id] = 1;
  B.skillTimes.push(now); B.skillTimes = B.skillTimes.filter(t => now - t < 5000);
  bugEvent('skill', { id, uses: S.stats.skillUses, within5: B.skillTimes.length });
  if (sk.dur) S.skillUntil[id] = now + sk.dur * 1000;
  if (id === 'allout') { const d = Math.floor(dps() * 60); if (d > 0) { B.pendingAllout = !!(E && E.boss && d >= E.hp && E.hp === E.max); damage(d, true, false); floatText(fmt(d), 'crit'); } else toast('仲間が いない'); }
  if (id === 'crit') showNotice('💥 かいしんの いちげき！<br>15びょう タップ ×10');
  if (id === 'rush') showNotice('💰 ゴールドラッシュ！<br>30びょう ゴールド ×3');
  sfx('ach'); renderSkills(); save();
}
function renderSkills() {
  const bar = $('skills'); const now = Date.now();
  const html = SKILLS.map(sk => {
    const un = skillUnlocked(sk); const cd = Math.max(0, ((S.skillCd[sk.id] || 0) - now) / 1000); const act = skillActive(sk.id);
    const label = !un ? 'エリア' + sk.unlockArea : cd > 0 ? Math.ceil(cd) + 's' : 'OK';
    return '<button class="skill' + (un ? '' : ' locked') + (act ? ' active' : '') + (cd > 0 ? ' cd' : '') + '" onclick="useSkill(\'' + sk.id + '\')" title="' + sk.desc + '">' + sk.icon + ' ' + sk.short + '<small>' + label + '</small></button>';
  }).join('') + (S.rewardQueue > 0 ? '<button class="skill gift" onclick="bossReward()">🎁 ごほうび<small>×' + S.rewardQueue + '</small></button>' : '');
  if (bar.innerHTML !== html) bar.innerHTML = html;
}
let ffRunning = false;
function addGold(g) {
  const before = S.gold;
  S.gold += g; S.stats.goldTotal += g;
  if (!ffRunning) bugEvent('gold', { before, after: S.gold });
}

// ================= タップ・入力 =================
let screenOff = false, titleShown = true;
// 裏技の検出に使う一時的な記録（セーブしない）
const B = {
  tapTimes: [], critStreak: 0, corner: 0, edgeTaps: 0, centerTaps: 0, slowTaps: 0, lastTap: 0,
  titleTaps: 0, titleSince: Date.now(), titleKeys: 0, titleStarts: 0, partyTaps: 0,
  keyBuf: [], powerTimes: [], offSince: 0, blindTaps: 0, selectHeld: false,
  maxStreak: 0, tapStreak: 0, tapOnlyFight: true, fightStart: Date.now(), skillsFight: {}, pendingAllout: false,
  rareStreak: 0, sameStreak: 0, lastKillId: '', killTimes: [], lastDmg: 0, lastCrit: false,
  rewardStreak: 0, lastReward: '', palettePresses: 0, paletteCycles: 0, cdPresses: 0,
  sessionStart: Date.now(), lastDay: new Date().getDate(), areaSince: Date.now(), landTaps: 0, rotations: 0,
  tabHist: [], tabSwitches: 0, settingsOpens: 0, visCount: 0, expandCount: 0, dpadTab: 0, skillTimes: [], bgmSec: 0, wallTaps: 0, wallSide: '',
};
const KONAMI = 'up,up,down,down,left,right,left,right,b,a';

function attack(x, y) {
  if (screenOff) { B.blindTaps++; bugEvent('blind', { taps: B.blindTaps }); return; }
  if (titleShown) { startGame(); return; }
  S.stats.taps++;
  const crit = Math.random() < 0.05 + PERK.crit;
  B.critStreak = crit ? B.critStreak + 1 : 0;
  const d = Math.floor(tapDmg() * (crit ? 3 : 1));
  B.lastCrit = crit;
  damage(d, crit, true);
  if (!ffRunning) floatText(fmt(d), crit ? 'crit' : '', x, y);
  const now = performance.now();
  B.tapTimes.push(now); B.tapTimes = B.tapTimes.filter(t => now - t < 2000);
  if (!ffRunning) {
    if (B.lastTap && now - B.lastTap >= 10000) B.slowTaps++; else if (B.lastTap && now - B.lastTap < 10000) B.slowTaps = 0;
    B.lastTap = now;
    const dt = new Date();
    if (window.innerWidth > window.innerHeight) B.landTaps++;
    bugEvent('tap', { combo: B.tapTimes.length, m: dt.getMinutes(), s: dt.getSeconds(), slowTaps: B.slowTaps, landscape: window.innerWidth > window.innerHeight, landTaps: B.landTaps, edgeTaps: B.edgeTaps, centerTaps: B.centerTaps, corners: false });
    if (crit) bugEvent('crit', { streak: B.critStreak });
  }
}
$('screen').addEventListener('pointerdown', (ev) => {
  const r = $('screen').getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  if (ev.target.closest('#party img')) { B.partyTaps++; bugEvent('party', { taps: B.partyTaps }); ev.target.classList.add('attack'); setTimeout(() => ev.target.classList.remove('attack'), 200); return; }
  if (titleShown) {
    if (ev.target.id === 'title-logo') { B.titleTaps++; $('title-logo').style.transform = 'scale(' + Math.min(1.6, 1 + B.titleTaps * 0.02) + ')'; bugEvent('title', { taps: B.titleTaps, waitSec: 0 }); return; }
    startGame(); return;
  }
  // 位置の記録（よすみ・ふち・まんなか）
  const fx = x / r.width, fy = y / r.height;
  const edge = fx < 0.1 || fx > 0.9 || fy < 0.1 || fy > 0.9;
  B.edgeTaps = edge ? B.edgeTaps + 1 : 0;
  B.centerTaps = (Math.abs(fx - 0.5) < 0.1 && Math.abs(fy - 0.5) < 0.1) ? B.centerTaps + 1 : 0;
  const cornerSeq = [[0, 0], [1, 0], [1, 1], [0, 1]]; const cq = cornerSeq[B.corner];
  const inCorner = (cx, cy) => Math.abs(fx - cx) < 0.15 && Math.abs(fy - cy) < 0.15;
  let corners = false;
  if (inCorner(cq[0], cq[1])) { B.corner++; if (B.corner >= 4) { B.corner = 0; corners = true; } } else if (cornerSeq.some(c => inCorner(c[0], c[1]))) B.corner = inCorner(0, 0) ? 1 : 0;
  attack(x, y);
  if (corners) bugEvent('tap', { corners: true, combo: 0 });
  // かべ（左右上下のはし）
  const side = fx < 0.1 ? 'left' : fx > 0.9 ? 'right' : fy < 0.12 ? 'top' : fy > 0.88 ? 'bottom' : '';
  if (side) { if (side === B.wallSide) B.wallTaps++; else { B.wallSide = side; B.wallTaps = 1; } if (B.wallTaps >= 3) { B.wallTaps = 0; wallBonus(side); } } else { B.wallTaps = 0; B.wallSide = ''; }
  // はなさない
  clearTimeout(holdTimer); holdStart = Date.now();
  holdTimer = setTimeout(holdTick, 5000);
});
let holdTimer = null, holdStart = 0;
function holdTick() { const sec = (Date.now() - holdStart) / 1000; bugEvent('hold', { sec }); if (sec < 60) holdTimer = setTimeout(holdTick, 5000); }
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('screen').addEventListener(t, () => clearTimeout(holdTimer)));

function startGame() {
  if (titleShown) bugEvent('title', { taps: B.titleTaps, waitSec: (Date.now() - B.titleSince) / 1000 });
  titleShown = false; $('title').hidden = true; B.titleTaps = 0; $('title-logo').style.transform = ''; audioInit(); zoneIntro(); renderSkills();
}
function showTitle() { titleShown = true; $('title').hidden = false; B.titleSince = Date.now(); renderRumor(); updateMusic(); }

// ゲーム機のボタン
document.querySelectorAll('[data-k]').forEach(btn => {
  const k = btn.dataset.k;
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (titleShown) { if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { B.titleKeys++; bugEvent('titlekey', { count: B.titleKeys, startCount: B.titleStarts }); } if (k === 'start') { B.titleStarts++; bugEvent('titlekey', { count: B.titleKeys, startCount: B.titleStarts }); } }
    if (k === 'select') { B.selectHeld = true; }
    if (k === 'a') { if (B.selectHeld) bugEvent('selectA', {}); if (titleShown) startGame(); else attack(); }
    if (k === 'b') { if (B.selectHeld) bugEvent('selectB', {}); }
    if (k === 'start') { if (titleShown) startGame(); else showTab('settings'); }
    if (!titleShown && (k === 'left' || k === 'right')) { const tabs = [...document.querySelectorAll('#tabs button')]; let i = tabs.findIndex(b => b.classList.contains('on')); i = (i + (k === 'left' ? -1 : 1) + tabs.length) % tabs.length; showTab(tabs[i].dataset.tab); B.dpadTab++; bugEvent('dpadtab', { count: B.dpadTab }); }
    if (k === 'up' || k === 'down') { $('panel').scrollBy({ top: k === 'up' ? -120 : 120, behavior: 'smooth' }); }
    B.keyBuf.push(k); if (B.keyBuf.length > 12) B.keyBuf.shift();
    bugEvent('key', { buf: B.keyBuf.join(',') });
  });
  btn.addEventListener('pointerup', () => { if (k === 'select') B.selectHeld = false; });
  btn.addEventListener('pointerleave', () => { if (k === 'select') B.selectHeld = false; });
});
$('power').addEventListener('click', () => {
  screenOff = !screenOff;
  $('off').hidden = !screenOff; $('led').classList.toggle('off', screenOff); updateMusic();
  const now = performance.now(); B.powerTimes.push(now); B.powerTimes = B.powerTimes.filter(t => now - t < 5000);
  if (screenOff) { B.offSince = Date.now(); B.blindTaps = 0; bugEvent('poweroff', { boss: !!(E && E.boss && E.hp > 0) }); }
  else { bugEvent('poweron', { offSec: (Date.now() - B.offSince) / 1000 }); }
  if (B.powerTimes.length >= 5) { B.powerTimes = []; powerBonus(); }
});

// ================= 裏技（バグ）エンジン =================
const BUGS_BY_EVENT = {}; BUGS.forEach(b => { (BUGS_BY_EVENT[b.on] = BUGS_BY_EVENT[b.on] || []).push(b); });
function bugEvent(type, payload) {
  const list = BUGS_BY_EVENT[type]; if (!list) return;
  const c = Object.assign({ S, E, type }, payload || {});
  for (const b of list) {
    if (S.bugs[b.id]) continue;
    if (b.minLoop && S.loop < b.minLoop) continue;
    let ok = false; try { ok = b.check(c); } catch (e) { ok = false; }
    if (ok) discover(b.id);
  }
}
function bugDef(id) { return BUGS[BUG_INDEX[id]]; }
function catDone(cat) { return BUGS_BY_CAT[cat].every(b => S.bugs[b.id]); }
function discover(id) {
  const b = bugDef(id);
  if (!b || S.bugs[id]) return;
  if (b.minLoop && S.loop < b.minLoop) return;
  S.bugs[id] = Date.now(); S.stats.bugsFound++; S.stats.bugsLoop = (S.stats.bugsLoop || 0) + 1;
  S.frags += b.frag; recalcPerks();
  if (ffRunning) return;
  glitchFx();
  showNotice('<b>バグ #' + String(BUG_INDEX[id] + 1).padStart(3, '0') + ' はっけん！</b> ' + '★'.repeat(b.star) + '<br>「' + b.name + '」<br><span class="frag">メモリ片 +' + b.frag + '</span>' + (b.perk ? '<br><span class="plus">✦ ' + perkText(b.perk) + '</span>' : ''));
  sfx('bug');
  markTab('bugs');
  if (catDone(b.cat)) { const cat = BUG_CATS.find(x => x.id === b.cat); S.frags += 15; S.titles = S.titles || {}; S.titles[b.cat] = 1; setTimeout(() => { modal('しょう コンプリート！', '「' + cat.name + '」の しょうを ぜんぶ うめた！<br><br>しょうごう <b>「' + cat.name + 'の たつじん」</b> を かくとく<br><span class="frag">メモリ片 +15</span>'); }, 1500); }
  bugEvent('discover', { foundThisLoop: S.stats.bugsLoop });
  renderPanel(); renderHud(); save();
}
function glitchFx() { const s = $('screen'); s.classList.remove('glitch'); void s.offsetWidth; s.classList.add('glitch'); }
function wallBonus(side) {
  const z = zoneOf();
  bugEvent('wall', { zone: z.id, side });
  const id = (side === 'left' ? 'wallL_' : side === 'right' ? 'wallR_' : side === 'top' ? 'ceiling_' : 'floor_') + z.id;
  if (!S.bugs[id]) return;
  if (side === 'top' || side === 'bottom') return;
  const key = side[0] + S.area;
  if (S.wallAreas[key]) { showNotice('かべの むこうは もう からっぽ'); return; }
  S.wallAreas[key] = 1;
  const g = enemyGold(S.area, false) * 30;
  addGold(g); glitchFx();
  showNotice('かべを すりぬけた！<br>かくし部屋で <span class="plus">+' + fmt(g) + 'G</span>');
}
function powerBonus() {
  bugEvent('power', { count5s: 5 });
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
window.addEventListener('resize', () => { const l = window.innerWidth > window.innerHeight; if (l !== wasLandscape) { B.rotations++; if (!titleShown) bugEvent('resize', { landscape: l, rotations: B.rotations }); } wasLandscape = l; });
function secondChecks() {
  const d = new Date();
  const crossed = d.getDate() !== B.lastDay; B.lastDay = d.getDate();
  if (S.cheatOn.bgm) B.bgmSec++;
  if (!titleShown && !screenOff) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    bugEvent('second', { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), day: d.getDay(), date: d.getDate(), month: d.getMonth() + 1, lastDay: d.getDate() === next, sessionSec: (Date.now() - B.sessionStart) / 1000, crossedMidnight: crossed, areaSec: (Date.now() - B.areaSince) / 1000, bgmSec: B.bgmSec });
  }
  checkAchievements();
}
// きょうの うわさ（毎日1つ、未発見の裏技のヒント）
function rumorBug() {
  const d = new Date(); const seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const cand = BUGS.filter(b => !S.bugs[b.id] && (!b.minLoop || S.loop >= b.minLoop));
  if (!cand.length) return null;
  return cand[seed % cand.length];
}
function renderRumor() {
  const b = rumorBug(); const el = $('rumor');
  el.textContent = b ? 'きょうの うわさ: ' + b.hint : 'うわさは もう ない';
}

// ================= チート =================
function cheatDef(id) { return CHEATS.find(c => c.id === id); }
function cheatAvailable(c) { return (S.debugUnlocked || HARMLESS_CHEATS.includes(c.id)) && (!c.needBugs || bugCount() >= c.needBugs) && (!c.needLoop || S.loop >= c.needLoop); }
function buyCheat(id) {
  const c = cheatDef(id);
  if (S.cheats[id] || !cheatAvailable(c) || S.frags < c.cost) return;
  S.frags -= c.cost; S.cheats[id] = 1; toast('「' + c.name + '」を かいはつしゃメニューに ついか！'); sfx('buy'); bugEvent('cheat', { action: 'buy', id }); renderPanel(); renderHud(); save();
}
function markCheated() { if (!S.cheated) { S.cheated = true; toast('この周は「改造」あつかいになります'); } }
function toggleCheat(id) {
  const c = cheatDef(id); if (!S.cheats[id]) return;
  S.cheatOn[id] = !S.cheatOn[id];
  S.stats.toggles++; bugEvent('cheat', { action: 'toggle', id, on: S.cheatOn[id] });
  if (S.cheatOn[id] && !HARMLESS_CHEATS.includes(id)) markCheated();
  if (id === 'bgm') { MUSIC.setGlitch(S.cheatOn.bgm); }
  if ((id === 'hp1' || id === 'hp10') && E) { E.max = curHp(E.boss); E.hp = Math.min(E.hp, E.max); renderHp(); }
  renderPanel(); save();
}
function useCheat(id) {
  const c = cheatDef(id); if (!S.cheats[id]) return;
  if (id === 'palette') { S.palette = (S.palette + 1) % c.opts.length; B.palettePresses++; if (S.palette === 0) B.paletteCycles++; bugEvent('cheat', { action: 'palette', presses: B.palettePresses, cycles: B.paletteCycles }); applyPalette(); renderPanel(); return; }
  markCheated();
  if (id === 'gold') {
    const now = Date.now();
    if (S.cool.gold && now - S.cool.gold < c.cooldown * 1000) { toast('クールタイム中 (' + Math.ceil((c.cooldown * 1000 - (now - S.cool.gold)) / 60000) + 'ふん)'); return; }
    const g = Math.max(100, Math.floor(goldPerSec() * 600)); S.cool.gold = now; addGold(g); glitchFx(); toast('+' + fmt(g) + 'G を ちゅうにゅう'); S.stats.injects++; bugEvent('cheat', { action: 'gold' }); renderHud(); renderPanel();
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
function jumpTo(a) { S.area = a; S.kills = 0; closeModal(); spawn(); toast('エリア ' + a + ' へ'); S.stats.jumped[zoneOf().id] = 1; bugEvent('cheat', { action: 'jump' }); areaChanged(); save(); }
function saveEdit() {
  modal('セーブ改造', '<div class="note">すうじを かきかえる（やりすぎ ちゅうい）</div>ゴールド<input type="text" id="ed-gold" value="' + Math.floor(S.gold) + '"><br><br>メモリ片<input type="text" id="ed-frag" value="' + S.frags + '">',
    [{ label: 'かきこむ', cls: 'ok', fn: () => { const g = Number($('ed-gold').value), f = Number($('ed-frag').value); if (isFinite(g)) S.gold = Math.max(0, g); if (isFinite(f)) S.frags = Math.max(0, Math.floor(f)); glitchFx(); bugEvent('cheat', { action: 'edit', gold: S.gold, frags: S.frags }); renderHud(); renderPanel(); save(); } }]);
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
  bugEvent('ending', { sec, cheated: S.cheated, skillUsesThisLoop: S.stats.skillUsesLoop });
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
  bugEvent('prestige', { gold: S.gold, loop: S.loop });
  S.loop++; S.stats.skillUsesLoop = 0; S.stats.bugsLoop = 0; S.gold = 0; S.allies = {}; S.sword = 0; S.area = 1; S.kills = 0; S.wallAreas = {}; S.cheated = false; S.loopStart = Date.now(); S.stats.area1Kills = 0;
  S.mile = {}; S.buff = 1; S.skillCd = {}; S.skillUntil = {}; S.luck = 0; S.zoneSeen = {};
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
  if (devFast && !titleShown && !screenOff) { ffRunning = true; for (let i = 0; i < 100; i++) tick(1); ffRunning = false; S.stats.playSec += 100; spawn(); renderAll(); return; }
  tick(dt);
}, 100);
setInterval(() => { secondChecks(); renderHud(); renderSkills(); }, 1000);
setInterval(save, 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); MUSIC.pause(); } else { last = performance.now(); if (AC) { AC.resume(); updateMusic(); } B.visCount++; bugEvent('visibility', { count: B.visCount }); } });
window.addEventListener('pagehide', save);
// どこを触っても音を有効化（iOS/Chrome は操作がないと音が出ない）
document.addEventListener('pointerdown', () => { if (!AC) audioInit(); else if (AC.state === 'suspended') { AC.resume(); updateMusic(); } }, { passive: true });

// オフライン進行
function offline() {
  const elapsed = (Date.now() - S.lastSave) / 1000;
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  setTimeout(() => { bugEvent('load', { offlineSec: elapsed, standalone }); if (S.name) bugEvent('name', { name: S.name, changes: S.stats.nameChanges }); }, 1500);
  if (elapsed < 60 || goldPerSec() <= 0) return;
  const t = Math.min(elapsed, (8 + PERK.offline) * 3600);
  const g = Math.floor(goldPerSec() * t);
  if (g <= 0) return;
  addGold(g);
  modal('おかえり', 'はなれていた ' + fmtTime(Math.floor(elapsed)) + ' のあいだに、なかまが たたかっていた。<br><br><b class="plus">+' + fmt(g) + ' G</b>' + (elapsed > (8 + PERK.offline) * 3600 ? '<br><small>（' + (8 + PERK.offline) + 'じかんぶん まで）</small>' : ''));
}

// ================= 描画 =================
function renderHud() {
  $('gold').textContent = fmt(S.gold) + ' G';
  $('hud-dps').textContent = 'DPS ' + fmt(dps()); $('hud-tap').textContent = 'タップ ' + fmt(tapDmg());
  if (expanded) { $('mh-area').textContent = 'エリア ' + S.area; $('mh-gold').textContent = fmt(S.gold) + ' G'; $('mh-dps').textContent = '⚔ ' + fmt(dps()); $('mh-tap').textContent = '👆 ' + fmt(tapDmg()); }
  $('area-name').textContent = zoneOf().name + (S.loop > 1 ? ' ' + S.loop + '周' : '');
  $('area-no').textContent = 'エリア ' + S.area;
  $('progfill').style.width = (isBossArea() ? (E ? (1 - E.hp / E.max) * 100 : 0) : S.kills / KILLS_PER_AREA * 100) + '%';
  renderHp();
  const p = $('panel-gold'); if (p) p.innerHTML = '<span class="chip g">' + fmt(S.gold) + ' G</span><span class="chip f">◆ ' + S.frags + '</span><span class="chip">⚔ ' + fmt(dps()) + '</span><span class="chip">👆 ' + fmt(tapDmg()) + '</span>' + (S.buff > 1 ? '<span class="chip">🚩 ×' + S.buff.toFixed(1) + '</span>' : '') + (S.luck ? '<span class="chip">👓 ' + S.luck + '</span>' : '');
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

let curTab = 'party', buyN = 1, openChap = 'input';
function toggleChap(id) { openChap = openChap === id ? '' : id; renderPanel(); }
function buyHint(id) { if (S.frags < 1 || S.hints[id]) return; S.frags--; S.hints[id] = 1; sfx('buy'); renderPanel(); save(); }
let expanded = false;
function setExpanded(on) {
  expanded = on; document.body.classList.toggle('expanded', on);
  $('handle').textContent = on ? '▼ ゲームがめんに もどる' : '▲ したの欄を ひろげる';
  try { localStorage.setItem('glitch-expanded', on ? '1' : ''); } catch (e) {}
  B.expandCount++; bugEvent('expand', { count: B.expandCount });
  renderHud();
}
$('handle').addEventListener('click', () => setExpanded(!expanded));
try { if (localStorage.getItem('glitch-expanded')) setExpanded(true); } catch (e) {}
function showTab(tab) {
  if (tab !== curTab) { B.tabSwitches++; B.tabHist.push(tab); if (B.tabHist.length > 6) B.tabHist.shift(); if (tab === 'settings') B.settingsOpens++; bugEvent('tab', { tab, switches: B.tabSwitches, settingsOpens: B.settingsOpens, inOrder: B.tabHist.join() === 'party,upgrade,bugs,debug,records,settings' }); }
  curTab = tab; document.querySelectorAll('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); if (b.dataset.tab === tab) { const d = b.querySelector('.dot'); if (d) d.remove(); } }); renderPanel(); $('panel').scrollTop = 0; }
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

function renderPanel() {
  const p = $('panel');
  let h = '<div id="panel-gold"></div>';
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
    h += '<h4>なかまの きわめ</h4><div class="note">人数が ふしめ（' + MILESTONES.join('・') + '）に とどくと、その仲間の DPS を 2倍にできる。</div>';
    let anyMile = false;
    for (const a of ALLIES) {
      const have = S.allies[a.id] || 0, lv = S.mile[a.id] || 0, need = mileNext(a);
      if (!have) continue; anyMile = true;
      if (!need) { h += '<div class="row found"><img src="assets/ally/' + a.id + '.png" alt=""><div class="info"><div class="name">' + a.name + ' <span class="badge">×' + Math.pow(2, lv) + '</span></div><div class="sub">きわめ きった</div></div></div>'; continue; }
      const ok = have >= need, c = mileCost(a);
      h += '<div class="row' + (ok ? '' : ' locked') + '"><img src="assets/ally/' + a.id + '.png" alt=""><div class="info"><div class="name">' + a.name + ' <span class="badge">×' + Math.pow(2, lv) + '</span></div><div class="sub">' + (ok ? 'DPS を 2倍に' : have + ' / ' + need + '人で 解放') + '</div></div>' + (ok ? '<button class="buy" data-cost="' + c + '" onclick="buyMile(\'' + a.id + '\')">×2<br>' + fmt(c) + 'G</button>' : '') + '</div>';
    }
    if (!anyMile) h += '<div class="note">まず 仲間を やとおう</div>';
    h += '<h4>スキル</h4>';
    for (const sk of SKILLS) h += '<div class="row' + (skillUnlocked(sk) ? '' : ' locked') + '"><div class="ico">' + sk.icon + '</div><div class="info"><div class="name">' + sk.name + '</div><div class="sub">' + sk.desc + '（クールタイム ' + Math.round(sk.cd / 60) + '分）' + (skillUnlocked(sk) ? '' : '<br>エリア ' + sk.unlockArea + ' で 解放') + '</div></div></div>';
    h += '<h4>しゅうかい</h4><div class="note">いま ' + S.loop + '周目（全ダメージ ×' + loopMul().toFixed(1) + '）。魔王を たおすと「カセットを さしなおす」が できる。' + (S.debugUnlocked ? '' : 'クリアすると デバッグメニューが ひらく。') + '</div>';
    if (S.debugUnlocked && S.area >= LAST_AREA) h += '<button class="ok" style="width:100%" onclick="confirmPrestige()">カセットを さしなおす（' + (S.loop + 1) + '周目・ダメージ ×' + Math.pow(LOOP_MUL, S.loop) + '）</button>';
    h += '<h4>てきの つよさ</h4><div class="stat"><span>いまのエリアの てきHP</span><span>' + fmt(enemyHp(S.area, false)) + '</span></div><div class="stat"><span>おとす ゴールド</span><span>' + fmt(enemyGold(S.area, false)) + '</span></div><div class="stat"><span>1びょうの かせぎ（めやす）</span><span>' + fmt(goldPerSec()) + ' G</span></div>';
  } else if (curTab === 'bugs') {
    const found = bugCount();
    h += '<div class="note">このゲーム、なんか おかしい。へんな操作で「バグ」がおきる。見つけると <span class="frag">◆メモリ片</span>。ヒントは しょうごとに 3つずつ ひらく。◆1 で ヒントを かえる。<br><b>' + found + ' / ' + BUGS.length + '</b></div>';
    const ps = perkSummary(); if (ps) h += '<div class="note"><span class="plus">✦ うらわざの ちから:</span> ' + ps + '</div>';
    const rb = rumorBug(); if (rb) h += '<div class="rumorbox">📰 きょうの うわさ: ' + rb.hint + '</div>';
    for (const cat of BUG_CATS) {
      const list = BUGS_BY_CAT[cat.id]; const n = list.filter(b => S.bugs[b.id]).length;
      const locked = cat.minLoop && S.loop < cat.minLoop;
      const open = openChap === cat.id;
      h += '<div class="chap' + (open ? ' open' : '') + (n === list.length ? ' done' : '') + '" onclick="toggleChap(\'' + cat.id + '\')"><div class="cname">' + (n === list.length ? '👑 ' : open ? '▼ ' : '▶ ') + cat.name + '<div class="cdesc">' + (locked ? cat.minLoop + '周目から' : cat.desc) + '</div></div><div class="ccount">' + n + ' / ' + list.length + '</div></div>';
      if (!open || locked) continue;
      let revealed = 0;
      list.forEach(b => {
        const no = '#' + String(BUG_INDEX[b.id] + 1).padStart(3, '0'); const stars = '<span class="star">' + '★'.repeat(b.star) + '</span>';
        if (S.bugs[b.id]) { h += '<div class="row found"><span class="bugno">' + no + '</span><div class="info"><div class="name">' + b.name + ' ' + stars + '</div><div class="sub">' + b.hint + (b.reuse ? '<br>♻ ' + b.reuse : '') + (b.perk ? '<br><span class="plus">✦ ' + perkText(b.perk) + '</span>' : '') + '</div></div><span class="frag">◆' + b.frag + '</span></div>'; return; }
        const show = revealed < 3 || S.hints[b.id]; if (revealed < 3) revealed++;
        if (show) h += '<div class="row"><span class="bugno">' + no + '</span><div class="info"><div class="name">？？？ ' + stars + (b.perk ? ' <span class="plus">✦</span>' : '') + '</div><div class="sub">' + b.hint + '</div></div><span class="frag">◆' + b.frag + '</span></div>';
        else h += '<div class="row hidden"><span class="bugno">' + no + '</span><div class="info"><div class="name">？？？ ' + stars + '</div><div class="sub">ヒント なし</div></div><button class="hint" ' + (S.frags >= 1 ? '' : 'disabled') + ' onclick="buyHint(\'' + b.id + '\')">ヒント<br>◆1</button></div>';
      });
    }
  } else if (curTab === 'debug') {
    if (!S.debugUnlocked) h += '<div class="note">🔒 こわれかけの デバッグメニュー。いちど 魔王を たおすと ぜんぶ ひらく。いまは 一部だけ <span class="frag">◆メモリ片</span>で かえる。</div>';
    else h += '<div class="note">かいはつしゃの ためした きのう。<span class="frag">◆メモリ片</span>で かう。カラーパレットと BGM 以外を ONにすると、その周は「改造」きろくになる。</div>';
    {
      for (const c of CHEATS) {
        if (!S.debugUnlocked && !HARMLESS_CHEATS.includes(c.id) && !S.cheats[c.id]) { h += '<div class="row locked"><div class="ico">🔒</div><div class="info"><div class="name">' + c.name + '</div><div class="sub">魔王を たおすと</div></div></div>'; continue; }
        const has = S.cheats[c.id], avail = cheatAvailable(c);
        let btn;
        if (!has) btn = '<button class="buy" ' + (avail && S.frags >= c.cost ? '' : 'disabled') + ' onclick="buyCheat(\'' + c.id + '\')">かう<br>◆' + c.cost + '</button>';
        else if (c.type === 'toggle') btn = '<button onclick="toggleCheat(\'' + c.id + '\')">' + (S.cheatOn[c.id] ? 'ON' : 'OFF') + '</button>';
        else if (c.type === 'cycle') btn = '<button onclick="useCheat(\'' + c.id + '\')">' + c.opts[S.palette] + '</button>';
        else btn = '<button onclick="useCheat(\'' + c.id + '\')">つかう</button>';
        h += '<div class="row ' + (S.cheatOn[c.id] ? 'on' : '') + (avail || has ? '' : ' locked') + '"><div class="ico">' + (has ? '🧪' : '🔒') + '</div><div class="info"><div class="name">' + c.name + '</div><div class="sub">' + c.desc + (!has && c.needBugs && bugCount() < c.needBugs ? '<br>裏技を ' + c.needBugs + 'こ みつけると（いま ' + bugCount() + '）' : '') + (!has && c.needLoop && S.loop < c.needLoop ? '<br>' + c.needLoop + '周目から' : '') + '</div></div>' + btn + '</div>';
      }
    }
  } else if (curTab === 'records') {
    const st = S.stats;
    h += '<h4>きろく</h4>';
    [['たおした てき', fmt(st.kills)], ['タップ', fmt(st.taps)], ['かせいだ ゴールド', fmt(st.goldTotal)], ['さいこう エリア', st.bestArea], ['しゅうかい', S.loop + '周目'], ['正規クリア', st.endingsClean + '回'], ['改造クリア', st.endingsCheat + '回'], ['さいそく クリア', st.fastestClear ? fmtTime(st.fastestClear) : '-'], ['あそんだ じかん', fmtTime(Math.floor(st.playSec))], ['この周', (S.cheated ? '改造' : '正規') + ' / ' + fmtTime(Math.floor((Date.now() - S.loopStart) / 1000))]].forEach(([k, v]) => h += '<div class="stat"><span>' + k + '</span><span>' + v + '</span></div>');
    const tl = Object.keys(S.titles || {}); if (tl.length) h += '<h4>しょうごう</h4><div class="note">' + tl.map(t => '👑 ' + BUG_CATS.find(c => c.id === t).name + 'の たつじん').join('　') + '</div>';
    h += '<h4>じっせき ' + Object.keys(S.ach).length + ' / ' + ACHIEVEMENTS.length + '</h4>';
    for (const a of ACHIEVEMENTS) h += '<div class="row ' + (S.ach[a.id] ? 'found' : 'locked') + '"><div class="ico">' + (S.ach[a.id] ? '🏆' : '·') + '</div><div class="info"><div class="name">' + a.name + '</div><div class="sub">' + a.desc + '</div></div><span class="frag">◆' + a.frag + '</span></div>';
  } else if (curTab === 'settings') {
    h += '<h4>プレイヤー</h4><div class="note">なまえ（8もじまで）</div><input type="text" id="name" maxlength="8" value="' + esc(S.name) + '" placeholder="ゆうしゃ"><button class="mini" style="margin-top:6px" onclick="setName()">きめる</button>';
    h += '<h4>おと</h4><button class="mini" onclick="toggleBgm()">BGM: ' + (S.bgm ? 'ON' : 'OFF') + '</button> <button class="mini" onclick="toggleMute()">こうかおん: ' + (S.mute ? 'OFF' : 'ON') + '</button><div class="note">BGM は 8bit風。ゾーン・ボス・タイトルで かわる。「かくしBGM」チートで バグった版に</div>';
    h += '<h4>データ</h4><button class="mini" onclick="manualSave()">いま セーブ</button> <button class="mini danger" onclick="confirmReset()">ぜんぶ けす</button>';
    if (DEV) {
      h += '<h4>🛠 かいはつよう</h4><div class="note">テスト用。URL に ?dev を つけたときだけ 出る。記録は「改造」あつかい。</div>';
      h += '<button class="mini ' + (devFast ? 'ok' : '') + '" onclick="toggleDevFast()">⏩ はやおくり ×1000: ' + (devFast ? 'ON' : 'OFF') + '</button> ';
      h += '<button class="mini" onclick="devFF(3600)">1じかん すすめる</button> <button class="mini" onclick="devFF(8*3600)">8じかん すすめる</button>';
    }
    h += '<h4>これは なに</h4><div class="note">ひろった ふるいゲーム機「GLITCH BOY」に はいっていた RPG。なんだか バグが おおい。タップで てきを たおし、なかまを やとって ほうち。おかしな操作で「裏技」を みつけ、クリアすると「デバッグメニュー」が ひらく。<br>v0.1 (2026-09-23)</div>';
  }
  p.innerHTML = h; renderHud();
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setBuyN(n) { buyN = n === 'max' ? 'max' : Number(n); renderPanel(); }
function buyAlly(id, n) {
  const a = ALLIES.find(x => x.id === id); const cost = allyCost(a, n);
  if (n <= 0 || S.gold < cost) return;
  const exact = Math.floor(S.gold) === cost;
  S.gold -= cost; S.allies[id] = (S.allies[id] || 0) + n; sfx('buy');
  B.maxStreak = (buyN === 'max') ? B.maxStreak + 1 : 0;
  if (!ffRunning) bugEvent('buy', { what: 'ally', id, n, allyCount: allyCount(S), gold: Math.floor(S.gold), exact, maxStreak: B.maxStreak });
  renderParty(); renderPanel(); save();
}
function buyMile(id) { const a = ALLIES.find(x => x.id === id); const c = mileCost(a); if ((S.allies[id] || 0) < mileNext(a) || S.gold < c) return; S.gold -= c; S.mile[id] = (S.mile[id] || 0) + 1; S.stats.milesBought++; sfx('buy'); toast(a.name + ' の DPS が 2倍に！'); bugEvent('buy', { what: 'mile', id, n: 1, allyCount: allyCount(S), gold: Math.floor(S.gold), exact: false, maxStreak: 0 }); renderPanel(); save(); }
function buySword() { const c = swordCost(); if (S.gold < c) return; S.gold -= c; S.sword++; sfx('buy'); if (!ffRunning) bugEvent('buy', { what: 'sword', id: 'sword', n: 1, allyCount: allyCount(S), gold: Math.floor(S.gold), exact: false, maxStreak: 0 }); renderPanel(); save(); }
function setName() { S.name = $('name').value.trim().slice(0, 8); S.stats.nameChanges++; toast('なまえ: ' + (S.name || 'ゆうしゃ')); bugEvent('name', { name: S.name, changes: S.stats.nameChanges }); save(); }
function toggleDevFast() { devFast = !devFast; if (devFast) markCheated(); toast(devFast ? '⏩ ×1000 ON' : '⏩ OFF'); renderPanel(); }
function devFF(sec) { markCheated(); ffRunning = true; for (let i = 0; i < sec; i++) tick(1); ffRunning = false; S.stats.playSec += sec; spawn(); renderAll(); toast(fmtTime(sec) + ' すすめた'); save(); }
function toggleMute() { S.mute = !S.mute; renderPanel(); save(); }
function toggleBgm() { S.bgm = !S.bgm; audioInit(); MUSIC.setEnabled(S.bgm); if (S.bgm) updateMusic(); renderPanel(); save(); }
function confirmPrestige() { modal('カセットを さしなおす', 'ゴールド・なかま・けん・エリアが 最初にもどる。<br>裏技・メモリ片・チート・じっせきは のこる。<br>' + (S.loop + 1) + '周目は 全ダメージ ×' + Math.pow(LOOP_MUL, S.loop), [{ label: 'やめる' }, { label: 'さしなおす', cls: 'ok', fn: prestige }]); }
function manualSave() { save(); S.stats.saves++; toast('セーブした'); bugEvent('save', { count: S.stats.saves }); }
function confirmReset() { modal('ぜんぶ けす', 'セーブデータを 完全にけす。裏技帳も メモリ片も きえる。', [{ label: 'やめる', fn: () => bugEvent('resetcancel', {}) }, { label: 'けす', cls: 'danger', fn: () => { localStorage.removeItem(SAVE_KEY); location.reload(); } }]); }

// ================= 音（WebAudio の かんたんビープ） =================
let AC = null, bgmTimer = null;
function audioInit() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); MUSIC.ensure(AC); MUSIC.setEnabled(S.bgm); MUSIC.setGlitch(!!S.cheatOn.bgm); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); updateMusic(); }
function updateMusic() { if (!AC) return; if (screenOff) { MUSIC.pause(); return; } MUSIC.play(MUSIC.songFor(zoneOf().id, !!(E && E.boss), titleShown)); }
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

// 画像のプリロード（読み込み前は前の絵が残って、名前とずれるため）
const PRELOADED = {};
function preload(src) { if (PRELOADED[src]) return; const im = new Image(); im.src = src; PRELOADED[src] = im; }
function preloadZone(z) { [...z.enemies, z.boss].forEach(id => preload('assets/enemy/' + id + '.png')); preload('assets/bg/' + z.id + '.jpg'); }
function preloadAll() { ZONES.forEach(preloadZone); RARES.forEach(r => preload('assets/enemy/' + r.id + '.png')); ALLIES.forEach(a => preload('assets/ally/' + a.id + '.png')); }
setTimeout(preloadAll, 1500);

// ================= 開始 =================
function renderAll() { renderParty(); renderPanel(); renderHud(); applyPalette(); renderSkills(); }
recalcPerks();
spawn();
renderAll();
renderRumor();
offline();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// デバッグ: ?debug で ff(秒) が使える（仲間の攻撃を早送り）
if (DEBUG) {
  window.S = S; window.E = () => E;
  window.ff = (sec) => { if (titleShown) startGame(); ffRunning = true; for (let i = 0; i < sec * 10; i++) tick(0.1); ffRunning = false; renderAll(); return { area: S.area, kills: S.kills, gold: Math.floor(S.gold), dps: dps() }; };
  window.tapN = (n) => { if (titleShown) startGame(); ffRunning = true; for (let i = 0; i < n; i++) attack(); ffRunning = false; renderAll(); return Math.floor(S.gold); };
  window.spawnNow = spawn;
  console.log('[glitch] debug mode: ff(sec), S, E()');
}
