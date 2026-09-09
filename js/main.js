/* ============================================================
 * main.js — 应用入口：Tab 切换 / 套路库渲染 / 移调表
 * ============================================================ */
"use strict";

(function () {
  /* ---------- Tab 切换 ---------- */
  function initTabs() {
    var tabs = document.querySelectorAll("#tabs .tab");
    tabs.forEach(function (tab) {
      tab.onclick = function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
        document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
        window.scrollTo(0, 0);
      };
    });
  }

  /* ---------- 套路库 ---------- */
  function libKey() {
    return document.getElementById("libKey").value || "C";
  }

  function renderLibrary() {
    var key = libKey();
    var list = document.getElementById("progList");
    list.innerHTML = "";
    GT.PROGRESSIONS.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "prog-card";
      var chordsHtml = p.degrees.map(function (d) {
        return '<span class="prog-chord">' + GT.chordName(key, d) + "</span>";
      }).join("");
      card.innerHTML =
        '<div class="prog-top"><span class="prog-name">' + p.name + '</span><span class="prog-formula">' + p.formula + "</span></div>" +
        '<div class="prog-desc">' + p.desc + "</div>" +
        '<div class="prog-chords">' + chordsHtml + "</div>" +
        '<div class="prog-songs">🎧 代表歌：' + p.songs.join(" · ") + "</div>" +
        '<div class="prog-tip">💡 ' + p.tip + "</div>";
      card.title = "点击试听该进行（" + key + " 调）";
      card.onclick = function () {
        GT.Audio.ensure();
        document.querySelectorAll(".prog-card").forEach(function (c) { c.classList.remove("playing"); });
        card.classList.add("playing");
        var i = 0;
        var chords = card.querySelectorAll(".prog-chord");
        GT.Audio.playProgression(key, p.degrees, {
          loop: true,
          onChord: function (idx) {
            chords.forEach(function (c) { c.classList.remove("on"); });
            if (chords[idx]) chords[idx].classList.add("on");
          },
          onEnd: function () {
            chords.forEach(function (c) { c.classList.remove("on"); });
            card.classList.remove("playing");
          }
        });
      };
      list.appendChild(card);
    });
  }

  function initLibKey() {
    var sel = document.getElementById("libKey");
    GT.KEYS.forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k; opt.textContent = k;
      sel.appendChild(opt);
    });
    sel.value = "C";
    sel.onchange = renderLibrary;
  }

  /* ---------- 移调表 ---------- */
  function renderTransposeTable() {
    var table = document.getElementById("transposeTable");
    var head = "<tr><th>级数</th>";
    ["1", "2m", "3m", "4", "5", "6m", "7dim"].forEach(function (s) { head += "<th>" + s + "</th>"; });
    head += "</tr>";

    var rows = "";
    GT.KEYS.forEach(function (k) {
      var emphasized = (k === "C" || k === "G" || k === "D") ? ' style="background:rgba(255,180,84,.06)"' : "";
      rows += "<tr" + emphasized + '><td class="key-col">' + k + " 调</td>";
      for (var d = 1; d <= 7; d++) {
        var name = GT.chordName(k, d);
        if (name.indexOf("m") > 0 || name.indexOf("dim") > 0) {
          /* 小类和弦高亮后缀 */
          var base = name.replace(/m$|dim$/, "");
          var suf = name.slice(base.length);
          rows += "<td>" + base + '<span class="m">' + suf + "</span></td>";
        } else {
          rows += "<td>" + name + "</td>";
        }
      }
      rows += "</tr>";
    });
    table.innerHTML = head + rows;
  }

  /* ---------- 启动 ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    initLibKey();
    renderLibrary();
    renderTransposeTable();
    GT.Trainer.init();
    GT.Ear.init();
    GT.Challenge.init();
    GT.Tools.init();
  });
})();
