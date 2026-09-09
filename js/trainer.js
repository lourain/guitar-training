/* ============================================================
 * trainer.js — 今日训练 + 21 天课程 + 打卡
 * ============================================================ */
"use strict";

GT.Trainer = (function () {
  var currentDay = 1;
  var store = GT.store;

  function initData() {
    if (store.get("checkins") === undefined) store.set("checkins", {}); /* { "2026-09-09": day } */
  }

  function getCheckins() { return store.get("checkins", {}); }

  function isDone(day) {
    var c = getCheckins();
    for (var k in c) if (c[k] === day) return true;
    return false;
  }

  function todayDoneDay() { return getCheckins()[GT.todayKey()] || 0; }

  /* 连续打卡天数（以打卡记录日期连续计） */
  function streak() {
    var c = getCheckins();
    var days = Object.keys(c).map(function (s) { return new Date(s + "T00:00:00"); }).sort(function (a, b) { return b - a; });
    if (!days.length) return 0;
    var streak = 0;
    var cur = new Date(); cur.setHours(0, 0, 0, 0);
    /* 今天没打卡也允许从昨天起算连续 */
    if (days[0].getTime() !== cur.getTime()) cur.setDate(cur.getDate() - 1);
    var map = c;
    for (var i = 0; i < 400; i++) {
      var key = cur.getFullYear() + "-" + String(cur.getMonth() + 1).padStart(2, "0") + "-" + String(cur.getDate()).padStart(2, "0");
      if (map[key] !== undefined) { streak++; cur.setDate(cur.getDate() - 1); } else break;
    }
    return streak;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    renderStats();
    renderDay();
    renderCalendar();
  }

  function renderStats() {
    var doneCount = Object.keys(getCheckins()).length;
    var row = document.getElementById("statsRow");
    row.innerHTML =
      '<div class="stat-box"><div class="stat-num">' + doneCount + '<span style="font-size:14px">/21</span></div><div class="stat-label">已完成天数</div>' +
      '<div class="progress-wrap"><div class="progress-bar" style="width:' + Math.round(doneCount / 21 * 100) + '%"></div></div></div>' +
      '<div class="stat-box"><div class="stat-num">🔥 ' + streak() + '</div><div class="stat-label">连续打卡</div></div>' +
      '<div class="stat-box"><div class="stat-num">' + phaseName(currentDay) + '</div><div class="stat-label">当前阶段</div></div>';
  }

  function phaseName(d) {
    if (d <= 7) return "套路植入";
    if (d <= 14) return "移调迁移";
    return "实战脱谱";
  }

  function renderDay() {
    var day = GT.COURSE[currentDay - 1];
    var titleEl = document.getElementById("dayTitle");
    var phaseEl = document.getElementById("dayPhase");
    var tasksEl = document.getElementById("tasks") || document.getElementById("dayTasks");
    var btn = document.getElementById("btnCheckin");

    var totalMin = 0;
    day.tasks.forEach(function (t) { totalMin += t.min; });

    titleEl.textContent = "Day " + day.day + " · " + day.title;
    phaseEl.textContent = "阶段" + day.phase + "：" + phaseName(day.day) + " · 约 " + totalMin + " 分钟";

    tasksEl.innerHTML = "";
    day.tasks.forEach(function (t, i) {
      var div = document.createElement("div");
      div.className = "task-item";
      div.innerHTML = '<span class="task-min">' + t.min + ' 分钟</span><span>' + (i + 1) + ". " + t.text + "</span>";
      tasksEl.appendChild(div);
    });

    /* 该日关联的套路试听入口 */
    if (day.progId && day.key) {
      var p = GT.getProgression(day.progId);
      var div = document.createElement("div");
      div.className = "task-item";
      div.style.cursor = "pointer";
      div.innerHTML = '<span class="task-min">🎵 试听</span><span>今日套路 <b style="color:var(--amber)">' + p.formula +
        '</b> @' + day.key + " 调（" + degreesToChords(p.degrees, day.key).join(" → ") + "）— 点此播放</span>";
      div.onclick = function () {
        GT.Audio.playProgression(day.key, p.degrees, { loop: true });
      };
      tasksEl.appendChild(div);
    }

    if (isDone(day.day)) {
      btn.textContent = "✅ Day " + day.day + " 已打卡";
      btn.classList.add("done");
    } else {
      btn.textContent = "✅ 完成今日打卡";
      btn.classList.remove("done");
    }
  }

  function degreesToChords(degrees, key) {
    return degrees.map(function (d) { return GT.chordName(key, d); });
  }

  function renderCalendar() {
    var cal = document.getElementById("calendar");
    cal.innerHTML = "";
    var checkins = getCheckins();
    var today = GT.todayKey();
    for (var d = 1; d <= 21; d++) {
      var cell = document.createElement("div");
      var dateStr = dateOfDayN(d); /* 第 d 天对应哪个日期不一定，日历按完成顺序展示 */
      var doneBy = Object.keys(checkins).find(function (k) { return checkins[k] === d; });
      cell.className = "cal-cell" + (doneBy ? " done" : "") + (d === currentDay ? " today" : "");
      cell.innerHTML = "<span>Day " + d + "</span>" + (doneBy ? '<span class="cal-phase">' + doneBy.slice(5) + "</span>" : '<span class="cal-phase">' + phaseName(d).slice(0, 2) + "</span>");
      cell.onclick = function () {
        var dd = parseInt(this.querySelector("span").textContent.replace("Day ", ""), 10);
        currentDay = dd; render();
      };
      cal.appendChild(cell);
    }
  }

  function dateOfDayN() { return ""; }

  /* ---------- 事件 ---------- */
  function init() {
    initData();
    /* 恢复上次进度：默认今天 = 未打卡的最小天数 */
    var resume = store.get("lastDay", 0);
    currentDay = resume >= 1 && resume <= 21 ? resume : nextTodoDay();

    document.getElementById("btnCheckin").onclick = function () {
      if (isDone(currentDay)) return;
      var c = getCheckins();
      c[GT.todayKey()] = currentDay;
      store.set("checkins", c);
      var next = currentDay < 21 ? currentDay + 1 : 21;
      store.set("lastDay", next);
      render();
    };
    document.getElementById("btnPrevDay").onclick = function () { if (currentDay > 1) { currentDay--; store.set("lastDay", currentDay); render(); } };
    document.getElementById("btnNextDay").onclick = function () { if (currentDay < 21) { currentDay++; store.set("lastDay", currentDay); render(); } };

    render();
  }

  function nextTodoDay() {
    for (var d = 1; d <= 21; d++) if (!isDone(d)) return d;
    return 21;
  }

  return { init: init, render: render };
})();
