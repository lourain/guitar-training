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

    /* 今日套歌：只下发「走向匹配 + 调性匹配」都通过的曲目 */
    tasksEl.appendChild(buildSongBlock(day));

    /* 该日关联的套路试听入口 */
    if (day.progId && day.key) {
      var p = GT.getProgression(day.progId);
      var div = document.createElement("div");
      div.className = "task-item";
      div.style.cursor = "pointer";
      div.innerHTML = '<span class="task-min">🎵 试听</span><span>今日主练套路 <b style="color:var(--amber)">' + p.formula +
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

  /* ---------- 今日套歌区块 ---------- */
  function buildSongBlock(day) {
    var wrap = document.createElement("div");
    wrap.className = "song-block";

    var prog = day.progId ? GT.getProgression(day.progId) : null;
    var songs = (day.songs || []).map(function (id) { return GT.getSong(id); }).filter(Boolean);

    var head = '<div class="song-block-head"><span>🎧 今日套歌 · 走向已核对</span>' +
      (day.key
        ? '<span class="song-key-chip">练习调 ' + day.key + " 调</span>"
        : '<span class="song-key-chip">调性自选</span>') +
      "</div>";
    var html = head;

    if (!songs.length) {
      html += '<div class="song-empty">今天没有已核对的整曲用例，直接练套路本身即可（别去乱翻没核对过的歌）。</div>';
      wrap.innerHTML = html;
      return wrap;
    }

    html += '<div class="song-note" style="margin-top:6px">' +
      (day.key
        ? "下面这些曲目都是「<b>" + day.key + " 调</b>弹得了 + 走向写清楚了哪一段」的；原调不是 " + day.key + " 调的已经标出来。"
        : "下面这些曲目走向已核对，调性自选，弹之前先自己定调。") +
      "</div>";

    songs.forEach(function (s) {
      /* 硬校验：调性对不上就不下发 */
      if (day.key && s.playKeys.indexOf(day.key) < 0) {
        window.console && console.warn("【调性不符已拦截】《" + s.title + "》不支持 " + day.key +
          " 调，已核对的调为：" + s.playKeys.join(" / "));
        return;
      }

      var kind = prog ? GT.songMatchKind(s, prog) : null;
      var tag;
      if (!prog) {
        tag = '<span class="song-tag neutral">原调 ' + s.originalKey + " 调</span>";
      } else if (kind) {
        tag = '<span class="song-tag ok">✓ ' + GT.MATCH_LABEL[kind] + "</span>";
      } else {
        tag = '<span class="song-tag neutral">另一条套路 · ' + GT.degText(s.degrees) + "</span>";
      }

      var displayKey = day.key || s.playKeys[0] || s.originalKey;
      var chords = degreesToChords(s.degrees, displayKey).join(" → ");

      var keyLine = "原调 " + s.originalKey + " 调";
      if (s.originalKey === displayKey) keyLine += "（＝本练习调，直接弹，不用变调夹）";
      else if (s.capo) keyLine += " · 用 C 调指法夹 " + s.capo + " 品＝原调";
      else keyLine += " · 本练习按 " + displayKey + " 调移调弹";

      html +=
        '<div class="song-row">' +
          '<div class="song-rowtop">' +
            '<span class="song-title">《' + s.title + "》</span>" +
            '<span class="song-sec">' + s.section + "</span>" +
            '<span class="song-deg">' + GT.degText(s.degrees) + "</span>" +
            tag +
          "</div>" +
          '<div class="song-lyric">「' + s.lyric + "」</div>" +
          '<div class="song-chords">' + displayKey + " 调：" + chords + "</div>" +
          '<div class="song-meta">' + keyLine + "</div>" +
          (s.note ? '<div class="song-note">⚠️ ' + s.note + "</div>" : "") +
        "</div>";
    });

    wrap.innerHTML = html;
    return wrap;
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
