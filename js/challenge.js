/* ============================================================
 * challenge.js — 随机挑战（强制脱谱）
 * 调式 × 套路 × 节奏型 × BPM 随机组合 + 2 分钟倒计时
 * ============================================================ */
"use strict";

GT.Challenge = (function () {
  var store = GT.store;
  var timer = null;
  var remain = 120;

  function selectedKeys() {
    var keys = store.get("challengeKeys", ["C", "G", "D"]);
    return keys.length ? keys : ["C"];
  }

  function renderKeyScope() {
    var box = document.getElementById("keyScope");
    box.innerHTML = "";
    var sel = selectedKeys();
    GT.KEYS.forEach(function (k) {
      var btn = document.createElement("button");
      btn.className = "key-chip" + (sel.indexOf(k) >= 0 ? " on" : "");
      btn.textContent = k;
      btn.onclick = function () {
        var s = store.get("challengeKeys", ["C", "G", "D"]);
        var i = s.indexOf(k);
        if (i >= 0) { if (s.length > 1) s.splice(i, 1); } else s.push(k);
        store.set("challengeKeys", s);
        renderKeyScope();
      };
      box.appendChild(btn);
    });
  }

  function roll() {
    GT.Audio.stopPlayback();
    var keys = selectedKeys();
    var key = keys[Math.floor(Math.random() * keys.length)];
    var basicOnly = document.querySelector('input[name="progScope"]:checked').value === "basic";
    var pool = basicOnly ? ["p1645", "p1564", "p6415", "p2516"] : GT.PROGRESSIONS.map(function (p) { return p.id; });
    var prog = GT.getProgression(pool[Math.floor(Math.random() * pool.length)]);
    var rhythm = GT.RHYTHMS[Math.floor(Math.random() * GT.RHYTHMS.length)];
    var bpm = 60 + Math.floor(Math.random() * 61); /* 60-120 */

    document.getElementById("chKey").textContent = key + " 调";
    document.getElementById("chProg").textContent = prog.formula + " · " + prog.name;
    document.getElementById("chChords").textContent = "和弦：" + prog.degrees.map(function (d) { return GT.chordName(key, d); }).join(" – ");
    document.getElementById("chRhythm").textContent = "节奏型：" + rhythm.name + "（" + rhythm.desc + "）";
    document.getElementById("chBpm").textContent = "BPM：" + bpm + "（可在工具箱开节拍器对齐）";

    /* 播放示范，帮助校准耳朵 */
    GT.Audio.playProgression(key, prog.degrees, { loop: true });

    var count = store.get("challengeCount", 0) + 1;
    store.set("challengeCount", count);
    document.getElementById("challengeCount").textContent = "已完成 " + count + " 轮随机挑战 💪";
  }

  function startTimer() {
    stopTimer(false);
    remain = 120;
    updateTimerDisplay();
    var disp = document.getElementById("timerDisplay");
    disp.classList.add("running");
    timer = setInterval(function () {
      remain--;
      updateTimerDisplay();
      if (remain <= 0) {
        stopTimer(true);
      }
    }, 1000);
  }

  function stopTimer(finished) {
    if (timer) { clearInterval(timer); timer = null; }
    var disp = document.getElementById("timerDisplay");
    disp.classList.remove("running");
    if (finished) {
      disp.textContent = "🎉 完成！";
      /* 自动计入挑战次数 */
      var count = store.get("challengeCount", 0);
      if (!disp.dataset.counted) {
        store.set("challengeCount", count);
        disp.dataset.counted = "";
      }
      GT.Audio.stopPlayback();
      setTimeout(function () { remain = 120; updateTimerDisplay(); }, 1500);
    } else {
      remain = 120;
      updateTimerDisplay();
    }
  }

  function updateTimerDisplay() {
    var m = Math.floor(remain / 60), s = remain % 60;
    document.getElementById("timerDisplay").textContent =
      String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function init() {
    renderKeyScope();
    document.getElementById("btnRoll").onclick = roll;
    document.getElementById("btnStartTimer").onclick = startTimer;
    document.getElementById("btnChStop").onclick = function () { stopTimer(false); GT.Audio.stopPlayback(); };
    updateTimerDisplay();
    var count = store.get("challengeCount", 0);
    if (count) document.getElementById("challengeCount").textContent = "已完成 " + count + " 轮随机挑战 💪";
  }

  return { init: init };
})();
