/* ============================================================
 * tools.js — 工具箱：节拍器 / 和弦指法卡（SVG）/ 我的歌单套路表
 * ============================================================ */
"use strict";

GT.Tools = (function () {
  var store = GT.store;

  /* ---------- 节拍器 ---------- */
  var bpm = 80;

  function renderMetroDots(activeBeat) {
    var beats = parseInt(document.getElementById("metroBeatsSel").value, 10);
    var box = document.getElementById("metroBeats");
    if (box.childElementCount !== beats) {
      box.innerHTML = "";
      for (var i = 0; i < beats; i++) {
        var d = document.createElement("div");
        d.className = "metro-dot" + (i === 0 ? " accent" : "");
        box.appendChild(d);
      }
    }
    Array.prototype.forEach.call(box.children, function (dot, i) {
      dot.classList.toggle("on", i === activeBeat);
    });
  }

  function setBpm(v) {
    bpm = Math.max(40, Math.min(200, v));
    document.getElementById("bpmNum").textContent = bpm;
    document.getElementById("bpmSlider").value = bpm;
    if (GT.Audio.isMetronomeRunning()) startMetro(true);
  }

  function startMetro(keepUi) {
    var beats = parseInt(document.getElementById("metroBeatsSel").value, 10);
    GT.Audio.startMetronome(bpm, beats, function (beat) {
      renderMetroDots(beat);
    });
    renderMetroDots(0);
    document.getElementById("btnMetro").textContent = "⏹ 停止节拍器";
  }

  function stopMetro() {
    GT.Audio.stopMetronome();
    renderMetroDots(-1);
    document.getElementById("btnMetro").textContent = "▶ 启动节拍器";
  }

  function initMetro() {
    renderMetroDots(-1);
    document.getElementById("bpmDown").onclick = function () { setBpm(bpm - 2); };
    document.getElementById("bpmUp").onclick = function () { setBpm(bpm + 2); };
    document.getElementById("bpmSlider").oninput = function () { setBpm(parseInt(this.value, 10)); };
    document.getElementById("metroBeatsSel").onchange = function () {
      renderMetroDots(-1);
      if (GT.Audio.isMetronomeRunning()) startMetro(true);
    };
    document.getElementById("btnMetro").onclick = function () {
      GT.Audio.isMetronomeRunning() ? stopMetro() : startMetro();
    };
  }

  /* ---------- 和弦指法 SVG ---------- */
  /* 生成一个和弦指法图的 SVG 字符串 */
  function chordSvg(chord) {
    var frets = chord.frets;
    var fretted = frets.filter(function (f) { return f > 0; });
    var minFret = fretted.length ? Math.min.apply(null, fretted) : 1;
    var maxFret = fretted.length ? Math.max.apply(null, fretted) : 4;
    var baseFret = maxFret > 4 ? minFret : 1;

    var W = 84, H = 100;
    var left = 14, top = 18, gridW = 56, gridH = 66;
    var nFrets = 5;
    var cw = gridW / 5;   /* 弦间距 */
    var ch = gridH / nFrets; /* 品间距 */

    function sx(i) { return left + i * cw; }          /* 第 i 根弦（0=6弦） */
    function fy(f) { return top + (f - baseFret + 1) * ch - ch / 2; } /* 品 f 中心 */

    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">';
    /* 弦（竖线） */
    for (var s = 0; s < 6; s++) {
      svg += '<line x1="' + sx(s) + '" y1="' + top + '" x2="' + sx(s) + '" y2="' + (top + gridH) + '" stroke="#93a0b8" stroke-width="1"/>';
    }
    /* 品（横线） */
    for (var f = 0; f <= nFrets; f++) {
      var y = top + f * ch;
      svg += '<line x1="' + left + '" y1="' + y + '" x2="' + (left + gridW) + '" y2="' + y + '" stroke="#93a0b8" stroke-width="' + (f === 0 ? 2 : 1) + '"/>';
    }
    /* 品位标记 */
    if (baseFret > 1) {
      svg += '<text x="4" y="' + (top + ch / 2 + 4) + '" fill="#93a0b8" font-size="9">' + baseFret + '</text>';
    }
    /* 按弦点 / 空弦 / 闷音 */
    frets.forEach(function (f, i) {
      if (f < 0) {
        svg += '<text x="' + sx(i) + '" y="' + (top - 6) + '" fill="#ff6b6b" font-size="10" text-anchor="middle">×</text>';
      } else if (f === 0) {
        svg += '<circle cx="' + sx(i) + '" cy="' + (top - 9) + '" r="3.5" fill="none" stroke="#93a0b8" stroke-width="1.4"/>';
      } else {
        var yy = fy(f);
        if (yy < top) yy = top + ch / 2; /* 防御 */
        svg += '<circle cx="' + sx(i) + '" cy="' + yy + '" r="5.5" fill="#ffb454"/>';
      }
    });
    svg += "</svg>";
    return svg;
  }

  function initChordGrid() {
    var grid = document.getElementById("chordGrid");
    grid.innerHTML = "";
    var hot = new Set(); /* 今日训练进行里的和弦，加 🎵 标记 */
    var day = GT.COURSE[(GT.store.get("lastDay", 1) || 1) - 1];
    if (day && day.progId && day.key) {
      GT.getProgression(day.progId).degrees.forEach(function (d) { hot.add(GT.chordName(day.key, d)); });
    }

    GT.CHORDS.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "chord-card";
      card.innerHTML = '<div class="chord-name">' + c.name + "</div>" + chordSvg(c) +
        (hot.has(c.name) ? '<span class="chord-mark">🎵</span>' : "");
      card.onclick = function () {
        GT.Audio.playChordByName(c.name);
        card.classList.add("active");
        setTimeout(function () { card.classList.remove("active"); }, 700);
      };
      grid.appendChild(card);
    });
  }

  /* ---------- 我的歌单套路表 ---------- */
  function renderSongs() {
    var songs = store.get("songs", []);
    var ul = document.getElementById("songList");
    ul.innerHTML = "";
    if (!songs.length) {
      ul.innerHTML = '<li class="tip-text" style="list-style:none">还没有记录，脱谱第一首就从此开始 🎸</li>';
      return;
    }
    songs.forEach(function (s, i) {
      var li = document.createElement("li");
      li.className = "song-item";
      li.innerHTML = "<span>" + s.name + '</span><span class="formula">' + s.formula + "</span>";
      var del = document.createElement("button");
      del.className = "song-del";
      del.textContent = "✕";
      del.onclick = function () {
        songs.splice(i, 1);
        store.set("songs", songs);
        renderSongs();
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function initSongs() {
    renderSongs();
    document.getElementById("btnAddSong").onclick = function () {
      var name = document.getElementById("songName").value.trim();
      var formula = document.getElementById("songFormula").value.trim();
      if (!name || !formula) return;
      var songs = store.get("songs", []);
      songs.unshift({ name: name, formula: formula, date: GT.todayKey() });
      store.set("songs", songs);
      document.getElementById("songName").value = "";
      document.getElementById("songFormula").value = "";
      renderSongs();
    };
  }

  function init() {
    initMetro();
    initChordGrid();
    initSongs();
  }

  return { init: init, initChordGrid: initChordGrid };
})();
