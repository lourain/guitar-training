/* ============================================================
 * audio.js — Web Audio 音频引擎
 * 节拍器 / 拨弦音色合成 / 和弦进行播放（12 调自动转调）
 * ============================================================ */
"use strict";

GT.Audio = (function () {
  var ctx = null;
  var master = null;
  var reverb = null;      /* 混响总线（ConvolverNode） */
  var reverbSend = null;  /* 湿声送出量 = 空间感大小 */
  var SPACE_DEFAULT = 0.3;

  /* 正在进行的播放会话（用于停止）：{ voices: [{osc, osc2, gain}], onEnd } */
  var activeSession = null;

  /* 用噪声生成一段脉冲响应做混响尾音 —— 不依赖任何外部音频文件 */
  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      /* 混响总线：干声直接进 master；湿声 一路进 convolver 再汇入 master */
      reverb = ctx.createConvolver();
      reverb.buffer = makeImpulse(2.4, 2.4);
      reverbSend = ctx.createGain();
      reverbSend.gain.value = GT.store ? GT.store.get("space", SPACE_DEFAULT) : SPACE_DEFAULT;
      reverbSend.connect(reverb);
      reverb.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ---------- 空间感（混响延音）调节 ---------- */
  function setSpace(v) {
    ensure();
    v = Math.max(0, Math.min(1, v));
    reverbSend.gain.value = v;
    if (GT.store) GT.store.set("space", v);
    return v;
  }

  function getSpace() {
    if (reverbSend) return reverbSend.gain.value;
    return GT.store ? GT.store.get("space", SPACE_DEFAULT) : SPACE_DEFAULT;
  }

  /* ---------- 基础音色：模拟吉他拨弦（三角波 + 慢衰减包络 + 轻微泛音） ----------
   * 包络 = 快起音 → 长衰减 → 一小段释放到 0（不硬切，所以听感是「余音」而不是「戛然而止」）
   * 同时送一份信号进混响总线，产生房间尾音。
   */
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

    gain.connect(master);          /* 干声 */
    if (reverb) gain.connect(reverb); /* 湿声 → 延音尾 */

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    gain.gain.linearRampToValueAtTime(0, when + dur + 0.08); /* 释放段 */

    osc.start(when); osc2.start(when);
    osc.stop(when + dur + 0.12); osc2.stop(when + dur + 0.12);
    if (activeSession) activeSession.voices.push({ osc: osc, osc2: osc2, gain: gain });
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
  /* opts: { loop, chordDur, tail, onChord, onEnd }
   *   chordDur 每个和弦占多长（秒，默认 0.9）
   *   tail     最后一个和弦额外延长多少（秒）—— 让它自然飘走，而不是被切掉
   */
  function playProgression(key, degrees, opts) {
    ensure();
    stopPlayback();
    opts = opts || {};
    var dur = opts.chordDur || 0.9;
    var tail = opts.tail || 0;
    var t0 = ctx.currentTime + 0.08;
    var session = { voices: [], timer: null, onEnd: opts.onEnd };
    activeSession = session;

    var rounds = opts.loop ? 2 : 1;
    for (var r = 0; r < rounds; r++) {
      for (var i = 0; i < degrees.length; i++) {
        var d = degrees[i];
        var deg = ((d - 1) % 7) + 1; /* 支持 8 级以上回卷 */
        var rootMidi = GT.chordRootMidi(key, deg);
        var q = GT.DEGREE_QUALITY[deg - 1];
        var when = t0 + (r * degrees.length + i) * dur;
        var isLast = (r === rounds - 1 && i === degrees.length - 1);
        strumChord(rootMidi, q, when, dur * 1.15 + (isLast ? tail : 0), 0.32);
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

  /* 停止播放：先做一小段淡出再停振荡器，避免"啪"的硬切；混响尾音自然衰减 */
  function stopPlayback(fadeSec) {
    if (!activeSession) return;
    var voices = activeSession.voices || [];
    var session = activeSession;
    activeSession = null;
    var f = fadeSec === undefined ? 0.12 : fadeSec;
    if (ctx) {
      var t = ctx.currentTime;
      voices.forEach(function (v) {
        try {
          if (v.gain.gain.cancelAndHoldAtTime) v.gain.gain.cancelAndHoldAtTime(t);
          else v.gain.gain.cancelScheduledValues(t);
          v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), t);
          v.gain.gain.linearRampToValueAtTime(0, t + f);
        } catch (e) {}
        try { v.osc.stop(t + f + 0.03); } catch (e) {}
        try { v.osc2.stop(t + f + 0.03); } catch (e) {}
      });
    }
    session.voices = [];
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
    var session = { voices: [] };
    activeSession = session;
    var t0 = ctx.currentTime + 0.05;
    c.frets.forEach(function (f, i) {
      if (f < 0) return;
      var midi = openStringMidi(i) + f;
      pluck(midi, t0 + i * 0.03, 2.2, 0.25);
    });
    setTimeout(function () { if (activeSession === session) activeSession = null; }, 2400);
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

  /* ---------- 听力训练：播放指定 MIDI 和弦（大/小） ----------
   * ring：这个和弦响多久（秒）。听辨用途给长一点，让它有余音可回味
   */
  function playMidiChord(rootMidi, quality, ring) {
    ensure();
    stopPlayback();
    var dur = ring || 2.4;
    var session = { voices: [] };
    activeSession = session;
    var t0 = ctx.currentTime + 0.05;
    chordNotes(rootMidi, quality).forEach(function (n, i) {
      pluck(n, t0 + i * 0.03, dur, 0.3);
    });
    setTimeout(function () { if (activeSession === session) activeSession = null; }, (dur + 1) * 1000);
  }

  return {
    ensure: ensure,
    playProgression: playProgression,
    stopPlayback: stopPlayback,
    playChordByName: playChordByName,
    playMidiChord: playMidiChord,
    setSpace: setSpace,
    getSpace: getSpace,
    startMetronome: startMetronome,
    stopMetronome: stopMetronome,
    isMetronomeRunning: isMetronomeRunning
  };
})();
