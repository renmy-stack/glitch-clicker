/* チップチューン BGM（WebAudio だけで鳴らす。音源ファイルなし）
   MUSIC.play('field') / MUSIC.stop() / MUSIC.setGlitch(true)
   曲は 16分音符のステップ列。lead=矩形波、bass=三角波、drum=ノイズ+キック。
   音程は MIDI ノート番号（60 = ド）。0 は休符。 */
const MUSIC = (() => {
  const SONGS = {
    // タイトル: ゆったりアルペジオ
    title: { bpm: 96, lead: [60, 0, 64, 0, 67, 0, 72, 0, 71, 0, 67, 0, 64, 0, 62, 0, 60, 0, 65, 0, 69, 0, 72, 0, 71, 0, 69, 0, 65, 0, 67, 0], bass: [48, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 53, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0], drum: '................................' },
    // 草原・森: あかるい
    field: { bpm: 150,
      lead: [67, 67, 69, 71, 72, 0, 71, 69, 67, 0, 64, 65, 67, 0, 0, 0, 65, 65, 67, 69, 71, 0, 69, 67, 65, 0, 62, 64, 65, 0, 0, 0, 67, 67, 69, 71, 72, 0, 74, 72, 71, 0, 69, 67, 69, 0, 0, 0, 72, 0, 71, 69, 67, 0, 65, 64, 62, 0, 64, 0, 60, 0, 0, 0],
      bass: [48, 0, 48, 0, 55, 0, 48, 0, 48, 0, 48, 0, 55, 0, 48, 0, 53, 0, 53, 0, 60, 0, 53, 0, 53, 0, 53, 0, 60, 0, 53, 0, 48, 0, 48, 0, 55, 0, 48, 0, 48, 0, 48, 0, 55, 0, 48, 0, 55, 0, 55, 0, 50, 0, 55, 0, 43, 0, 43, 0, 47, 0, 43, 0],
      drum: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.hhk.h.s.h.k.h.s.h.k.h.s.h.k.h.s.ss' },
    // 洞窟・山: くらい
    dungeon: { bpm: 118,
      lead: [57, 0, 60, 0, 64, 0, 60, 0, 59, 0, 60, 0, 62, 0, 59, 0, 57, 0, 60, 0, 64, 0, 67, 0, 65, 0, 64, 0, 62, 0, 0, 0, 55, 0, 59, 0, 62, 0, 59, 0, 57, 0, 59, 0, 60, 0, 57, 0, 56, 0, 59, 0, 62, 0, 64, 0, 56, 0, 0, 0, 0, 0, 0, 0],
      bass: [45, 0, 0, 0, 45, 0, 0, 0, 45, 0, 0, 0, 45, 0, 45, 0, 41, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 43, 0, 43, 0, 43, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 43, 0, 43, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40, 0, 40, 0],
      drum: 'k...h...k...h...k...h...k..kh...k...h...k...h...k...h...k..ks.s.' },
    // 城・魔王城: きんちょう
    castle: { bpm: 140,
      lead: [62, 0, 65, 0, 69, 0, 74, 0, 72, 0, 69, 0, 65, 0, 62, 0, 60, 0, 64, 0, 67, 0, 72, 0, 70, 0, 67, 0, 64, 0, 60, 0, 58, 0, 62, 0, 65, 0, 70, 0, 69, 0, 65, 0, 62, 0, 58, 0, 57, 0, 60, 0, 64, 0, 69, 0, 68, 0, 64, 0, 60, 0, 57, 0],
      bass: [50, 0, 50, 0, 50, 0, 50, 0, 50, 0, 50, 0, 57, 0, 50, 0, 48, 0, 48, 0, 48, 0, 48, 0, 48, 0, 48, 0, 55, 0, 48, 0, 46, 0, 46, 0, 46, 0, 46, 0, 46, 0, 46, 0, 53, 0, 46, 0, 45, 0, 45, 0, 45, 0, 45, 0, 45, 0, 45, 0, 52, 0, 45, 0],
      drum: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.hhk.h.s.h.k.h.s.h.k.h.s.h.k.k.s.ss' },
    // ボス: はやい
    boss: { bpm: 172,
      lead: [52, 55, 59, 64, 63, 59, 55, 52, 52, 55, 59, 64, 67, 64, 59, 55, 50, 53, 57, 62, 60, 57, 53, 50, 50, 53, 57, 62, 65, 62, 57, 53, 52, 55, 59, 64, 63, 59, 55, 52, 52, 55, 59, 64, 67, 64, 59, 55, 55, 59, 62, 67, 66, 62, 59, 55, 54, 57, 60, 66, 63, 60, 57, 54],
      bass: [40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 38, 0, 38, 0, 38, 0, 38, 0, 38, 0, 38, 0, 38, 0, 38, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 40, 0, 43, 0, 43, 0, 43, 0, 43, 0, 42, 0, 42, 0, 42, 0, 42, 0],
      drum: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.kksss.ss' },
  };
  const ZONE_SONG = { plain: 'field', forest: 'field', cave: 'dungeon', mountain: 'dungeon', castle: 'castle', demon: 'castle' };

  let ac = null, master = null, noiseBuf = null, timer = null;
  let cur = null, step = 0, nextTime = 0, glitch = false, volume = 0.12, enabled = true;
  const freq = n => 440 * Math.pow(2, (n - 69) / 12);

  function ensure(ctx) {
    if (ac) return;
    ac = ctx; master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination);
    const len = ac.sampleRate * 0.3; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(type, n, t, dur, vol, detune) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq(n); if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function drum(ch, t) {
    if (ch === 'k') { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16); }
    else { const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = ch === 's' ? 1800 : 6000; const d = ch === 's' ? 0.12 : 0.04; g.gain.setValueAtTime(ch === 's' ? 0.5 : 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.01); }
  }
  function schedule() {
    if (!cur || !ac) return;
    const song = SONGS[cur], spb = 60 / song.bpm / 4, n = song.lead.length;
    while (nextTime < ac.currentTime + 0.2) {
      const i = step % n;
      let l = song.lead[i], b = song.bass[i % song.bass.length], dr = song.drum[i % song.drum.length];
      if (glitch) { if (l && Math.random() < 0.12) l += [-12, 12, 1, -1, 7][Math.floor(Math.random() * 5)]; if (Math.random() < 0.03) dr = 's'; }
      if (l) tone('square', l, nextTime, spb * (song.lead[(i + 1) % n] ? 0.9 : 1.8), 0.35, glitch && Math.random() < 0.2 ? (Math.random() - 0.5) * 80 : 0);
      if (b) tone('triangle', b, nextTime, spb * 1.6, 0.8, 0);
      if (dr && dr !== '.') drum(dr, nextTime);
      nextTime += spb; step++;
    }
  }
  function play(id) {
    if (!enabled || !ac) { cur = enabled ? id : null; return; }
    if (cur === id && timer) return;
    cur = id; step = 0; nextTime = ac.currentTime + 0.05;
    if (!timer) timer = setInterval(schedule, 80);
  }
  function stop() { clearInterval(timer); timer = null; cur = null; }
  function resume() { if (cur && !timer && ac) { nextTime = ac.currentTime + 0.05; timer = setInterval(schedule, 80); } }
  function pause() { clearInterval(timer); timer = null; }
  return {
    ensure, play, stop, pause, resume,
    setGlitch: (on) => { glitch = on; },
    setEnabled: (on) => { enabled = on; if (!on) pause(); else resume(); },
    setVolume: (v) => { volume = v; if (master) master.gain.value = v; },
    songFor: (zoneId, boss, title) => title ? 'title' : boss ? 'boss' : (ZONE_SONG[zoneId] || 'field'),
    get current() { return cur; }, get playing() { return !!timer; },
  };
})();
