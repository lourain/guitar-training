/* ============================================================
 * ear.js — 听力炼耳小游戏
 * L1 单和弦大小听辨 → L2 基础 4 套路 → L3 全部 8 套路 → L4 套路 + 移调
 * ============================================================ */
"use strict";

GT.Ear = (function () {
  var store = GT.store;

  var LEVELS = [
    { id: 1, name: "L1 · 和弦色彩", desc: "听一个和弦，判断它是明亮的大和弦还是柔和的小和弦。这是耳训的地基。" },
    { id: 2, name: "L2 · 基础套路", desc: "在 C 调播放一个进行，从 4 个常见套路中选出你听到的。" },
    { id: 3, name: "L3 · 全套路", desc: "8 个套路任选其一播放，选出正确答案。" },
    { id: 4, name: "L4 · 移调听辨", desc: "随机调性播放进行（播放前会提示参考音），选出演奏的是哪个套路。" }
  ];

  var state = {
    level: store.get("earLevel", 1),
    answer: null,
    playing: false,
    /* 每级成绩：{ right, total, streak } */
    stats: store.get("earStats", {})
  };

  function stat(level) {
    if (!state.stats[level]) state.stats[level] = { right: 0, total: 0, streak: 0 };
    return state.stats[level];
  }

  /* ---------- 出题 ---------- */
  function makeQuestion() {
    var lv = state.level;
    if (lv === 1) {
      var maj = Math.random() < 0.5;
      return {
        type: "color",
        rootMidi: 55 + Math.floor(Math.random() * 8), /* G3 附近 */
        answer: maj ? "大和弦" : "小和弦",
        options: ["大和弦", "小和弦"],
        play: function () { GT.Audio.playMidiChord(this.rootMidi, maj ? "maj" : "min"); }
      };
    }

    var pool = lv === 2
      ? ["p1645", "p1564", "p6415", "p2516"]
      : GT.PROGRESSIONS.map(function (p) { return p.id; });

    var key = lv === 4 ? GT.KEYS[Math.floor(Math.random() * GT.KEYS.length)] : "C";
    var answerId = pool[Math.floor(Math.random() * pool.length)];

    /* 干扰项 */
    var opts = [answerId];
    while (opts.length < Math.min(4, pool.length)) {
      var cand = pool[Math.floor(Math.random() * pool.length)];
      if (opts.indexOf(cand) < 0) opts.push(cand);
    }
    opts.sort(function () { return Math.random() - 0.5; });

    var prog = GT.getProgression(answerId);
    return {
      type: "prog",
      key: key,
      answer: answerId,
      options: opts,
      play: function () { GT.Audio.playProgression(key, prog.degrees, { loop: true }); }
    };
  }

  /* ---------- 渲染 ---------- */
  function render() {
    renderLevels();
    renderQuestion();
    renderStats();
  }

  function renderLevels() {
    var box = document.getElementById("earLevels");
    box.innerHTML = "";
    LEVELS.forEach(function (lv) {
      var unlocked = lv.id === 1 || stat(lv.id - 1).total >= 10 && acc(lv.id - 1) >= 70 || stat(lv.id).total > 0;
      var btn = document.createElement("button");
      btn.className = "level-btn" + (state.level === lv.id ? " active" : "") + (unlocked ? "" : " locked");
      btn.textContent = lv.name + (unlocked ? "" : " 🔒");
      if (unlocked) {
        btn.onclick = function () {
          state.level = lv.id;
          store.set("earLevel", lv.id);
          newQuestion();
        };
      }
      box.appendChild(btn);
    });
    var cur = LEVELS[state.level - 1];
    document.getElementById("earLevelDesc").textContent = cur.desc;
    document.getElementById("earLevelBadge").textContent = cur.name;
  }

  function acc(level) {
    var s = stat(level);
    return s.total ? Math.round(s.right / s.total * 100) : 0;
  }

  function renderQuestion() {
    document.getElementById("earQuestion").textContent =
      state.level === 1 ? "听！这是大和弦还是小和弦？" :
      "听！这是哪个和弦进行？" + (state.level === 4 ? "（本题为 " + (state.q ? state.q.key : "?") + " 调）" : "（C 调）");
    document.getElementById("earFeedback").textContent = "";
    document.getElementById("earFeedback").className = "ear-feedback";

    var box = document.getElementById("earOptions");
    box.innerHTML = "";
    if (!state.q) return;
    state.q.options.forEach(function (optId) {
      var btn = document.createElement("button");
      btn.className = "ear-opt";
      if (state.level === 1) {
        btn.textContent = optId;
      } else {
        var p = GT.getProgression(optId);
        btn.textContent = p.formula + " " + p.name;
      }
      btn.onclick = function () { answer(optId, btn); };
      box.appendChild(btn);
    });
    /* 播放后等一拍再显示选项，防止还没听就乱点？直接显示即可 */
  }

  function renderStats() {
    var s = stat(state.level);
    document.getElementById("earStats").innerHTML =
      "<span>本题库：<b>" + s.right + "</b> / " + s.total + " 正确</span>" +
      "<span>正确率：<b>" + acc(state.level) + "%</b></span>" +
      "<span>连续答对：<b>🔥 " + s.streak + "</b></span>" +
      (s.total >= 10 && acc(state.level) >= 80 && state.level < 4
        ? '<span style="color:var(--green)">成绩优秀，下一关已解锁！</span>' : "");
  }

  /* ---------- 交互 ---------- */
  function newQuestion() {
    state.q = makeQuestion();
    render();
  }

  function play() {
    if (!state.q) newQuestion();
    GT.Audio.ensure();
    state.q.play();
    document.getElementById("btnEarPlay").textContent = "🔁 再播一次";
  }

  function answer(optId, btn) {
    if (!state.q) return;
    var q = state.q;
    var s = stat(state.level);
    s.total++;
    var correct = optId === q.answer;
    if (correct) { s.right++; s.streak++; } else { s.streak = 0; }
    store.set("earStats", state.stats);

    var fb = document.getElementById("earFeedback");
    var buttons = document.querySelectorAll("#earOptions .ear-opt");
    buttons.forEach(function (b) { b.disabled = true; });

    if (correct) {
      btn.classList.add("correct");
      fb.textContent = pick(["✅ 答对了！耳朵很灵！", "✅ 正确！就是这个套路！", "✅ 好耳力！"]) +
        (q.type === "prog" ? " 这是 " + GT.getProgression(q.answer).formula + " " + GT.getProgression(q.answer).name + "。" : "");
      fb.className = "ear-feedback ok";
    } else {
      btn.classList.add("wrong");
      buttons.forEach(function (b) {
        if (q.type === "prog" && GT.getProgression(q.answer) && b.textContent.indexOf(GT.getProgression(q.answer).formula) === 0) b.classList.add("correct");
        else if (q.type === "color" && b.textContent === q.answer) b.classList.add("correct");
      });
      fb.textContent = "❌ 正确答案是 " + (q.type === "prog" ? GT.getProgression(q.answer).formula + " " + GT.getProgression(q.answer).name : q.answer) + "，再听一遍找感觉。";
      fb.className = "ear-feedback no";
    }

    /* 自动重置：3 秒后下一题（保留成绩渲染） */
    setTimeout(function () {
      state.q = makeQuestion();
      render();
    }, 2600);
    renderStats();
    renderLevels();
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function init() {
    state.q = makeQuestion();
    document.getElementById("btnEarPlay").onclick = play;
    render();
  }

  return { init: init };
})();
