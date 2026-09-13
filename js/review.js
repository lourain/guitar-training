/* ============================================================
 * review.js — 间隔复习排期引擎 + 两个新区块
 *   1) 「今日待复习」卡片（课程结束后的长期维护）
 *   2) 「今日乱斗单」（Day 22-28 乱斗周用）
 * 复习单位 = 套路 × 调；间隔 1 → 3 → 7 → 14 → 30 天
 * ============================================================ */
"use strict";

GT.Review = (function () {
  var store = GT.store;
  var R = GT.REVIEW;

  function queue() { return store.get("review", {}); }
  function save(q) { store.set("review", q); }
  function inStudyKeys(k) { return GT.STUDY_KEYS.indexOf(k) >= 0; }

  /* ---------- 写入侧 ---------- */

  /* 打卡时调用 */
  function seed(progId, key) {
    if (!progId || !inStudyKeys(key)) return;
    var q = queue();
    R.seedItem(q, progId, key, GT.todayKey());
    save(q);
  }

  function seedCells(cells) {
    (cells || []).forEach(function (c) { seed(c.progId, c.key); });
  }

  /* 听力答题 / 点「练完了」都走这里。一天只推进一级 */
  function grade(progId, key, correct) {
    if (!progId || !inStudyKeys(key)) return;
    var q = queue();
    R.grade(q, progId, key, correct, GT.todayKey());
    save(q);
    render();
  }

  /* ---------- 读取侧 ---------- */
  function todayDue() {
    var q = queue();
    return R.dueIds(q, GT.todayKey()).map(function (id) {
      var p = R.split(id);
      return { id: id, progId: p.progId, key: p.key, item: q[id] };
    });
  }

  function stats() {
    var q = queue(), today = GT.todayKey();
    var ids = Object.keys(q), due = 0, graduated = 0, nextDue = null;
    ids.forEach(function (id) {
      if (q[id].due <= today) due++;
      else if (!nextDue || q[id].due < nextDue) nextDue = q[id].due;
      if (q[id].lv >= R.MAX_LV) graduated++;
    });
    return { total: ids.length, due: due, graduated: graduated, nextDue: nextDue };
  }

  /* ---------- 渲染：今日待复习 ---------- */
  function dots(lv) {
    var s = "";
    for (var i = 1; i <= R.MAX_LV; i++) s += (i <= lv ? "●" : "○");
    return s;
  }

  function render() {
    var card = document.getElementById("reviewCard");
    var list = document.getElementById("reviewList");
    if (!card || !list) return;

    var st = stats();
    card.style.display = st.total ? "block" : "none";

    var badge = document.getElementById("reviewBadge");
    if (badge) {
      badge.textContent = "队列 " + st.total + " 项 · 今日到期 " + st.due +
        (st.graduated ? " · 已巩固 " + st.graduated : "");
    }

    var due = todayDue();
    var foot = document.getElementById("reviewFoot");

    if (!due.length) {
      list.innerHTML = '<div class="review-empty">今天没有到期的复习项，该记的都还挂着。' +
        (st.nextDue ? "最近一项 <b>" + st.nextDue + "</b> 到期。" : "先去「今日训练」打卡，练过的套路会自动进排期。") +
        "</div>";
      if (foot) foot.textContent = "";
      return;
    }

    list.innerHTML = due.map(function (d) {
      var p = GT.getProgression(d.progId);
      if (!p) return "";
      var chords = GT.degreesToChords(p.degrees, d.key).join(" → ");
      var warn = (d.item.ng || 0) ? '<span class="review-tag warn">错 ' + d.item.ng + " 次</span>" : "";
      return '<div class="review-row" data-id="' + d.id + '">' +
          '<div class="review-rowtop">' +
            '<span class="review-deg">' + p.formula + "</span>" +
            '<span class="review-name">' + p.name + "</span>" +
            '<span class="review-key">' + d.key + " 调</span>" + warn +
            '<span class="review-dots" title="记忆强度">' + dots(d.item.lv) + "</span>" +
          "</div>" +
          '<div class="review-chords">' + d.key + " 调：" + chords + "</div>" +
          '<div class="review-actions">' +
            '<button class="btn btn-ghost btn-sm" data-act="play">▶ 试听</button>' +
            '<button class="btn btn-primary btn-sm" data-act="pass">✅ 练完了</button>' +
          "</div>" +
        "</div>";
    }).join("");

    list.querySelectorAll(".review-row").forEach(function (row) {
      var parts = R.split(row.dataset.id);
      var p = GT.getProgression(parts.progId);
      row.querySelector('[data-act="play"]').onclick = function (e) {
        e.stopPropagation();
        GT.Audio.ensure();
        GT.Audio.playProgression(parts.key, p.degrees, { loop: true, tail: 1.2 });
      };
      row.querySelector('[data-act="pass"]').onclick = function (e) {
        e.stopPropagation();
        grade(parts.progId, parts.key, true);
      };
    });

    if (foot) {
      foot.textContent = due.length < st.due
        ? "今天到期 " + st.due + " 项，先推最该回炉的 " + due.length + " 项，剩下的明天继续。"
        : "今天到期的 " + st.due + " 项都在上面了。练完点「练完了」，间隔会自动拉长。";
    }
  }

  /* ---------- 渲染：今日乱斗单（Day 22-28） ---------- */
  function mixBlock(day) {
    var wrap = document.createElement("div");
    wrap.className = "song-block";
    var cells = day.mix || [];
    var html = '<div class="song-block-head"><span>🎲 今日乱斗单 · 4 调全开</span>' +
      '<span class="song-key-chip">' + cells.length + " 组</span></div>" +
      '<div class="song-note" style="margin-top:6px">每组弹 2 分钟，<b>开弹前先哼一遍低音唱名</b>。' +
      "同一个套路在不同调之间来回切，唱名必须保持不变 —— 这周的唯一目标就是这个。</div>";

    cells.forEach(function (c) {
      var p = GT.getProgression(c.progId);
      if (!p) return;
      html += '<div class="song-row">' +
          '<div class="song-rowtop">' +
            '<span class="song-title">' + p.name + "</span>" +
            '<span class="song-deg">' + p.formula + "</span>" +
            '<span class="song-sec">' + c.key + " 调</span>" +
          "</div>" +
          '<div class="song-chords">' + c.key + " 调：" + GT.degreesToChords(p.degrees, c.key).join(" → ") + "</div>" +
          '<div class="review-actions"><button class="btn btn-ghost btn-sm" data-play="' + c.progId + "|" + c.key + '">▶ 试听</button></div>' +
        "</div>";
    });

    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-play]").forEach(function (btn) {
      btn.onclick = function () {
        var parts = R.split(btn.dataset.play);
        var p = GT.getProgression(parts.progId);
        GT.Audio.ensure();
        GT.Audio.playProgression(parts.key, p.degrees, { loop: true, tail: 1.2 });
      };
    });
    return wrap;
  }

  function init() { render(); }

  return {
    init: init, render: render, seed: seed, seedCells: seedCells,
    grade: grade, todayDue: todayDue, stats: stats, mixBlock: mixBlock
  };
})();
