/* ============================================================
 * audio.js — Web Audio 音频引擎
 * 节拍器 / 拨弦音色合成 / 和弦进行播放（12 调自动转调）
 * ============================================================ */
"use strict";

GT.Audio = (function () {
  var ctx = null;
  var master = null;

  /* 正在进行的播放会话（用于停止） */
  var activeSession = null;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ---------- 基础音色：模拟吉他拨弦（三角波 + 快衰减包络 + 轻微泛音） ---------- */
  function pluck(midi, when, dur, vol) {
    var freq = 440 * Math.pow(2, (midi - 69) / 12);
    var osc = ctx.createOscillator();
    var osc2 = ctx.createOscillator(); /* 八度泛音，增加亮度 */
    var gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = freq;
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;

    var g2 = ctx.createGain();
    g2.gain.value = 0.25;
    osc2.connect(g2); g2.connect(gain);
    osc.connect(gain);

    gain.connect(master);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.start(when); osc2.start(when);
    osc.stop(when + dur + 0.05); osc2.stop(when + dur + 0.05);
    if (activeSession) activeSession.nodes.push(osc, osc2);
  }

  /* ---------- 和弦：根音 MIDI + 性质 → 一组音符扫弦 ---------- */
  function chordNotes(rootMidi, quality) {
    var third = quality === "min" ? 3 : 4;
    if (quality === "dim") return [rootMidi, rootMidi + 3, rootMidi + 6];
    return [rootMidi, rootMidi + third, rootMidi + 7, rootMidi + 12]; /* 加八度更饱满 */
  }

  function strumChord(rootMidi, quality, when, dur, vol) {
    var notes = chordNotes(rootMidi, quality);
    notes.forEach(function (n, i) {
      pluck(n, when + i * 0.035, dur, vol * (i === 0 ? 1 : 0.8));
    });
  }

  /* ---------- 播放一段和弦进行 ---------- */
  /* opts: { loop: false, chordDur: 0.9, onChord: cb(index), onEnd: cb } */
  function playProgression(key, degrees, opts) {
    ensure();
    stopPlayback();
    opts = opts || {};
    var dur = opts.chordDur || 0.9;
    var t0 = ctx.currentTime + 0.08;
    var total = degrees.length * dur * (opts.loop ? 2 : 1);
    var session = { nodes: [], timer: null, onEnd: opts.onEnd };
    activeSession = session;

    var rounds = opts.loop ? 2 : 1;
    for (var r = 0; r < rounds; r++) {
      for (var i = 0; i < degrees.length; i++) {
        var d = degrees[i];
        var deg = ((d - 1) % 7) + 1; /* 支持 8 级以上回卷 */
        var rootMidi = GT.chordRootMidi(key, deg);
        var q = GT.DEGREE_QUALITY[deg - 1];
        var when = t0 + (r * degrees.length + i) * dur;
        strumChord(rootMidi, q, when, dur * 1.15, 0.32);
      }
    }

    /* 视觉回调：用定时器近似对齐 */
    if (opts.onChord || opts.onEnd) {
      var stepMs = dur * 1000;
      var n = degrees.length * rounds;
      for (var k = 0; k < n; k++) {
        (function (idx) {
          setTimeout(function () {
            if (activeSession === session && opts.onChord) opts.onChord(idx % degrees.length);
          }, 80 + k * stepMs);
        })(k);
      }
      if (opts.onEnd) {
        setTimeout(function () {
          if (activeSession === session) { activeSession = null; opts.onEnd(); }
        }, 80 + n * stepMs);
      }
    }
    return session;
  }

  function stopPlayback() {
    if (activeSession) {
      activeSession.nodes.forEach(function (n) {
        try { n.stop(); } catch (e) {}
      });
      activeSession = null;
    }
  }

  /* ---------- 单和弦试听（按指法表真实发声：六根弦空弦 E2=40 A2=45 D3=50 G3=55 B3=59 E4=64） ---------- */
  function openStringMidi(stringIdx) {
    return [40, 45, 50, 55, 59, 64][stringIdx];
  }

  function playChordByName(name) {
    ensure();
    stopPlayback();
    var c = GT.getChord(name);
    if (!c) return;
    var session = { nodes: [] };
    activeSession = session;
    var t0 = ctx.currentTime + 0.05;
    c.frets.forEach(function (f, i) {
      if (f < 0) return;
      var midi = openStringMidi(i) + f;
      pluck(midi, t0 + i * 0.03, 1.6, 0.25);
    });
    setTimeout(function () { if (activeSession === session) activeSession = null; }, 1800);
  }

  /* ---------- 节拍器 ---------- */
  var metro = { running: false, bpm: 80, beats: 4, nextTime: 0, beatIdx: 0, timer: null, onBeat: null };

  function scheduleClick(when, beatIdx) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    var accent = beatIdx === 0;
    osc.type = "square";
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(accent ? 0.5 : 0.3, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + 0.06);
    /* 视觉对齐队列 */
    metro.queue.push({ time: when, beat: beatIdx });
  }

  function metroTick() {
    var ahead = ctx.currentTime + 0.12;
    while (metro.nextTime < ahead) {
      scheduleClick(metro.nextTime, metro.beatIdx);
      var secPerBeat = 60 / metro.bpm;
      metro.nextTime += secPerBeat;
      metro.beatIdx = (metro.beatIdx + 1) % metro.beats;
    }
    /* 处理视觉闪烁 */
    var now = ctx.currentTime;
    while (metro.queue.length && metro.queue[0].time <= now) {
      var item = metro.queue.shift();
      if (metro.onBeat) metro.onBeat(item.beat);
    }
  }

  function startMetronome(bpm, beats, onBeat) {
    ensure();
    stopMetronome();
    metro.running = true;
    metro.bpm = bpm;
    metro.beats = beats || 4;
    metro.beatIdx = 0;
    metro.queue = [];
    metro.onBeat = onBeat || null;
    metro.nextTime = ctx.currentTime + 0.1;
    metro.timer = setInterval(metroTick, 25);
  }

  function stopMetronome() {
    metro.running = false;
    if (metro.timer) { clearInterval(metro.timer); metro.timer = null; }
    metro.queue = [];
  }

  function isMetronomeRunning() { return metro.running; }

  /* ---------- 听力训练：播放指定 MIDI 和弦（大/小） ---------- */
  function playMidiChord(rootMidi, quality) {
    ensure();
    stopPlayback();
    var session = { nodes: [] };
    activeSession = session;
    var t0 = ctx.currentTime + 0.05;
    chordNotes(rootMidi, quality).forEach(function (n, i) {
      pluck(n, t0 + i * 0.03, 1.4, 0.3);
    });
    setTimeout(function () { if (activeSession === session) activeSession = null; }, 1600);
  }

  return {
    ensure: ensure,
    playProgression: playProgression,
    stopPlayback: stopPlayback,
    playChordByName: playChordByName,
    playMidiChord: playMidiChord,
    startMetronome: startMetronome,
    stopMetronome: stopMetronome,
    isMetronomeRunning: isMetronomeRunning
  };
})();
