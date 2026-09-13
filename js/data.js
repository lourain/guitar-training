/* ============================================================
 * data.js — 内容数据层
 * 套路库 / 已核对曲目库 / 12 调移调表 / 21 天课程 / 听力分级 / 和弦指法 / 节奏型
 *
 * 【曲目数据规则】每条曲目记录必须同时写清两件事：
 *   1) 走向：哪一段（主歌/副歌/前奏）+ 级数（如 1-6-4-5）
 *   2) 调性：原调是什么；本练习用哪些调弹过（playKeys）
 * 今日训练只会下发 playKeys 含当日练习调的曲目，调不上的不下发。
 * ============================================================ */
"use strict";

window.GT = window.GT || {};

/* ---------- 音名与调性 ---------- */
GT.NOTE_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
GT.NOTE_FLAT  = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
GT.KEY_ROOT_PC = { "C": 0, "D♭": 1, "D": 2, "E♭": 3, "E": 4, "F": 5, "F♯": 6, "G": 7, "A♭": 8, "A": 9, "B♭": 10, "B": 11 };
GT.FLAT_KEYS = new Set(["F", "B♭", "E♭", "A♭", "D♭", "G♭"]);
GT.KEYS = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

/* 大调音阶（半音偏移）+ 各级和弦性质 */
GT.SCALE = [0, 2, 4, 5, 7, 9, 11];
GT.DEGREE_QUALITY = ["maj", "min", "min", "maj", "maj", "min", "dim"];
GT.DEGREE_SUFFIX  = ["", "m", "m", "", "", "m", "dim"];

/* 生成某调第 n 级（1~7）的和弦名，如 C 调 6 级 → Am */
GT.chordName = function (key, degree) {
  const rootPc = GT.KEY_ROOT_PC[key];
  const names = GT.FLAT_KEYS.has(key) ? GT.NOTE_FLAT : GT.NOTE_SHARP;
  const pc = (rootPc + GT.SCALE[degree - 1]) % 12;
  return names[pc] + GT.DEGREE_SUFFIX[degree - 1];
};

/* 某调第 n 级和弦的根音 MIDI（C3 = 48） */
GT.chordRootMidi = function (key, degree) {
  return 48 + GT.KEY_ROOT_PC[key] + GT.SCALE[degree - 1];
};

/* 把级数数组转成该调的和弦名数组 */
GT.degreesToChords = function (degrees, key) {
  return degrees.map(function (d) { return GT.chordName(key, d); });
};

/* 把级数数组转成文字，如 [1,6,4,5] → "1-6-4-5" */
GT.degText = function (degrees) {
  return degrees.join("-");
};

/* ============================================================
 * 已核对曲目库
 * ------------------------------------------------------------
 * degrees     ：该段落的级数走向（1 = 调内主和弦）
 * match       ：对应套路库里的哪几条进行（用于套路库归类）
 * originalKey ：原唱调（与练习调区分开，只有原调就是练习调时才不用移调）
 * playKeys    ：已核对可以直接用这些调弹唱的调（含移调弹法）
 * capo        ：用 C 调指法还原原调时的变调夹品位
 * note        ：容易踩的坑（尤其是"不要拿这条走向去套那一段"）
 * ============================================================ */
GT.SONGS = [
  {
    id: "tongnian", title: "童年", artist: "罗大佑",
    section: "主歌", lyric: "池塘边的榕树上，知了在声声叫着夏天",
    degrees: [1, 6, 4, 5], match: ["p1645"],
    originalKey: "A", playKeys: ["C", "G", "A"], capo: null,
    note: "中段有一句变化 3m-6m-2m-5（G 调里是 Bm-Em-A7-D），之后回到 1-4-5-1",
    source: "优璞曲谱（选调 A，全曲和弦统一）：主歌标注 1645"
  },
  {
    id: "chengdu", title: "成都", artist: "赵雷",
    section: "副歌", lyric: "和我在成都的街头走一走",
    degrees: [1, 6, 4, 5], match: ["p1645"],
    originalKey: "D", playKeys: ["C", "D", "G"], capo: 2,
    note: "别拿 1645 去套主歌 —— 主歌是 1-3m-4-5（C 调里 C-Em-F-G）。整曲 6/8 拍",
    source: "琴魂网 D 调级数谱 + 91 吉他谱 C 调版（夹 2 品 = 原调）"
  },
  {
    id: "qingtian_f", title: "晴天", artist: "周杰伦",
    section: "副歌", lyric: "刮风这天，我试过握着你手",
    degrees: [1, 6, 4, 5], match: ["p1645"],
    originalKey: "G", playKeys: ["C", "G"], capo: null,
    note: "第 3 小节常换 B7（G-B7-Em-C-D），是 1-6-4-5 的加花版本",
    source: "优璞曲谱「晴天(原版)」/ 琴魂网：副歌 G-Em-C-D = 1-6-4-5"
  },
  {
    id: "qingtian_v", title: "晴天", artist: "周杰伦",
    section: "主歌", lyric: "故事的小黄花，从出生那年就飘着",
    degrees: [6, 4, 1, 5], match: ["p6415"],
    originalKey: "G", playKeys: ["C", "G"], capo: null,
    note: "主歌是 6-4-1-5（Em-C-G-D），和副歌的 1645 不是同一条线，两段别混着练",
    source: "优璞曲谱「晴天(原版)」：主歌 Em-Cmaj7-G-D/#F"
  },
  {
    id: "yujian_v", title: "遇见", artist: "孙燕姿",
    section: "主歌", lyric: "听见，冬天的离开",
    degrees: [1, 5, 6, 4], match: ["p1564"],
    originalKey: "A♭", playKeys: ["C", "G", "A"], capo: null,
    note: "原调 A♭，通行的 C 调 / G 调弹法都落在这条走向上",
    source: "优璞曲谱：原版和弦 1-5-6m-4；琴魂网 C 调级数谱"
  },
  {
    id: "yujian_c", title: "遇见", artist: "孙燕姿",
    section: "副歌", lyric: "我遇见谁，会有怎样的对白",
    degrees: [4, 5, 1, 6], match: ["p4516"],
    originalKey: "A♭", playKeys: ["C", "G", "A"], capo: null,
    note: "4-5 上行推进到 1 级释放，尾巴落在 6 级再起一轮",
    source: "优璞曲谱 / 琴魂网：副歌 F-G-C-Am → 4-5-1-6"
  },
  {
    id: "pingfan", title: "平凡之路", artist: "朴树",
    section: "主歌+副歌", lyric: "我曾经跨过山和大海",
    degrees: [6, 4, 1, 5], match: ["p6415"],
    originalKey: "A", playKeys: ["C", "G", "A"], capo: null,
    note: "前奏、主歌、副歌是同一条线；副歌最后一个 5 级常挂 sus4",
    source: "优璞曲谱（选调 A）：前奏/主歌/副歌均为 6m-4-1-5"
  },
  {
    id: "yueliang", title: "月亮代表我的心", artist: "邓丽君",
    section: "前奏", lyric: "（只有前 4 小节）",
    degrees: [1, 6, 4, 5], match: ["p1645"],
    originalKey: "C", playKeys: ["C"], capo: null,
    note: "只有前奏是 1645！主歌其实是 1-3m-4-1-6m-4-2m-5，副歌是 1-3m-4-1 / 1-3m-4-2m-5",
    source: "优璞曲谱：标注「前奏 1645，主歌 13416425，副歌 13411345」"
  },
  {
    id: "qilixiang", title: "七里香", artist: "周杰伦",
    section: "主歌+副歌", lyric: "窗外的麻雀，在电线杆上多嘴",
    degrees: [6, 4, 5, 1], match: ["p1645"],
    originalKey: "E♭", playKeys: ["C"], capo: 3,
    note: "和 1645 是同一个循环（1-6-4-5 转一圈 = 6-4-5-1），从 6 级切入所以是小调色彩。它并不是 4536251",
    source: "91 吉他谱 / guitarstreet：全曲 Am-F-G-C 循环"
  },
  {
    id: "shuoshan", title: "说散就散", artist: "JC 陈泳彤",
    section: "主歌", lyric: "抱一抱，就当作从没有在一起",
    degrees: [6, 2, 5, 1], match: ["p2516"],
    originalKey: "C", playKeys: ["C", "G"], capo: null,
    note: "和 2516（2-5-1-6）是同一个循环，只是从 6 级起手；副歌换成 5-4-5-1",
    source: "琴魂网 C 调级数谱：主歌 Am-Dm-G-C"
  },
  {
    id: "anjing", title: "安静", artist: "周杰伦",
    section: "主歌", lyric: "只剩下钢琴陪我弹了一天",
    degrees: [1, 6, 4, 2, 5], match: ["p2516"],
    originalKey: "G", playKeys: ["C", "G"], capo: null,
    note: "整条是 1-6-4-2-5，2-5-1-6 藏在循环里（跨句才接得上）；别把整段当成 2516 从头上手",
    source: "优璞曲谱：主歌 1-6m-4maj7-2m7-5；91 吉他谱 G 调版"
  },
  {
    id: "jianqiang", title: "倔强", artist: "五月天",
    section: "副歌", lyric: "我和我最后的倔强",
    degrees: [1, 5, 6, 3, 4, 1, 2, 5], match: ["pCanon"],
    originalKey: "A", playKeys: ["C", "G", "A"], capo: null,
    note: "卡农家族的近亲：前四拍 1-5-6-3 完全一样，后半是 4-1-2-5（卡农是 4-1-4-5）。它并不是 4516",
    source: "chord4 / ChordRoom：副歌 A-E-F#m-C#m-D-A-Bm-E"
  },
  {
    id: "daoxiang", title: "稻香", artist: "周杰伦",
    section: "主歌+副歌", lyric: "还记得你说家是唯一的城堡",
    degrees: [1, 5, 6, 3, 4, 5, 1], match: ["pCanon"],
    originalKey: "C", playKeys: ["C"], capo: null,
    note: "卡农家族：前五拍 1-5-6-3-4 与卡农一致，后半收在 5-1（卡农是 1-4-5）",
    source: "弹琴吧 / 发歌谱 C 调谱：C-G-Am-Em-F-G-C"
  },
  {
    id: "houlaide", title: "后来", artist: "刘若英",
    section: "副歌", lyric: "后来，我总算学会了如何去爱",
    degrees: [1, 3, 6, 3, 4, 5, 3, 6, 2, 5, 1], match: ["p4536"],
    originalKey: "E♭", playKeys: ["C"], capo: 3,
    note: "从第 2 小节起就是最标准的 4536251（4-5-3-6-2-5-1）。主歌从 1 级起，不是 6545",
    source: "guitarians / 琴魂网：副歌 C-Em-Am-Em-F-G-Em-Am-Dm-G-C"
  },
  {
    id: "kexi_c", title: "可惜没如果", artist: "林俊杰",
    section: "副歌", lyric: "全都怪我，不该沉默时沉默",
    degrees: [1, 5, 6, 3, 4, 5, 3, 6, 2, 5, 1], match: ["p4536"],
    originalKey: "D", playKeys: ["C"], capo: null,
    note: "副歌第 2 小节起是完整的 4536251；它并不是 4516 或 6415",
    source: "guitarians / 琴魂网：C-G/B-Am-Em-F-G-Em-Am-Dm-G-C"
  },
  {
    id: "kexi_v", title: "可惜没如果", artist: "林俊杰",
    section: "主歌", lyric: "假如把犯得起的错，能错的都错过",
    degrees: [6, 5], match: [],
    originalKey: "D", playKeys: ["C"], capo: null,
    note: "主歌是 6m-5（C 调里 Am-G）来回倒，不属于套路库 8 条里的任何一条 —— 先记着，别硬套",
    source: "guitarians / 91 吉他谱：主歌 |Am|G|Am|G|"
  }
];

GT.getSong = function (id) {
  return GT.SONGS.find(function (s) { return s.id === id; });
};

/* ---------- 走向匹配：实测某条曲目的某一段是否真的落在某条套路上 ----------
 * exact   → 开头逐拍一致（后面允许有加花尾巴）
 * rotate  → 同一循环（同一组级数）但换了起点，如 6-4-5-1 之于 1-6-4-5
 * prefix  → 同族近似：开头连续 ≥4 拍一致，后半分岔，如 1-5-6-3-4-5-1 之于卡农
 * contain → 循环里含得下这条进行（要跨句才接得上）
 * 返回 null 表示对不上。
 */
GT.songMatchKind = function (song, prog) {
  var a = song.degrees || [], b = prog.degrees || [];
  if (!a.length || !b.length) return null;

  function isPrefixOf(seq, pat) {
    if (seq.length < pat.length) return false;
    for (var i = 0; i < pat.length; i++) if (seq[i] !== pat[i]) return false;
    return true;
  }
  function inCycle(seq, pat) {
    if (seq.length < pat.length) return false;
    var dbl = seq.concat(seq);
    for (var i = 0; i < seq.length; i++) {
      var ok = true;
      for (var j = 0; j < pat.length; j++) if (dbl[i + j] !== pat[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  if (isPrefixOf(a, b)) return "exact";

  for (var k = 1; k < b.length; k++) {
    if (isPrefixOf(a, b.slice(k).concat(b.slice(0, k)))) return "rotate";
  }

  var pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  if (pre >= 4) return "prefix";

  if (inCycle(a, b)) return "contain";
  return null;
};

GT.MATCH_LABEL = {
  exact: "完全一致",
  rotate: "同一循环·换起点",
  prefix: "同族近似",
  contain: "含该片段"
};

/* 某条曲目相对某条套路的最佳匹配等级 */
GT.songMatchLabel = function (song, progId) {
  var prog = GT.getProgression(progId);
  if (!prog) return "";
  var kind = GT.songMatchKind(song, prog);
  return kind ? GT.MATCH_LABEL[kind] : "";
};

/* 某条套路 + 某个调，可用的已核对曲目（调不上的直接不返回） */
GT.progSongs = function (progId, key) {
  return GT.SONGS.filter(function (s) {
    if (s.match.indexOf(progId) < 0) return false;
    if (!key) return true;
    return s.playKeys.indexOf(key) >= 0;
  });
};

/* 数据自检：声明的归属必须能被 degrees 证出来，防止再出现"标注与走向不符" */
GT.validateSongs = function () {
  var problems = [];
  GT.SONGS.forEach(function (s) {
    if (!s.degrees || !s.degrees.length) { problems.push("《" + s.title + "》缺 degrees"); return; }
    if (!s.playKeys || !s.playKeys.length) { problems.push("《" + s.title + "》缺 playKeys"); return; }
    s.match.forEach(function (pid) {
      var prog = GT.getProgression(pid);
      if (!prog) { problems.push("《" + s.title + "》引用了不存在的套路 " + pid); return; }
      if (!GT.songMatchKind(s, prog)) {
        problems.push("《" + s.title + "》" + s.section + " 声明归属 " + prog.formula +
          "，但实测走向是 " + GT.degText(s.degrees) + "，对不上");
      }
    });
  });
  return problems;
};

/* ---------- 8 个万能进行（套路库） ---------- */
GT.PROGRESSIONS = [
  {
    id: "p1645", degrees: [1, 6, 4, 5],
    name: "万能抒情", formula: "1 – 6 – 4 – 5",
    desc: "华语抒情歌最常见的骨架，副歌一响基本就是它",
    tip: "从主歌一路撑到副歌都成立，先把这个练到肌肉记忆"
  },
  {
    id: "p1564", degrees: [1, 5, 6, 4],
    name: "流行摇滚 Axis", formula: "1 – 5 – 6 – 4",
    desc: "欧美称之为 Axis progression，全球流行歌通用套路",
    tip: "开头就是主和弦，听起来「稳中带燃」，摇滚抒情必备"
  },
  {
    id: "p6415", degrees: [6, 4, 1, 5],
    name: "小调开局", formula: "6 – 4 – 1 – 5",
    desc: "从 6 级切入，一开口就是忧郁感，情歌杀手锏",
    tip: "它是 1-5-6-4 换了起点，练熟一个等于免费送你一个"
  },
  {
    id: "p4536", degrees: [4, 5, 3, 6, 2, 5, 1],
    name: "日系黄金", formula: "4 – 5 – 3 – 6 – 2 – 5 – 1",
    desc: "4536251，日系/王力宏式细腻走向，七级递进极好听",
    tip: "七个和弦有点长，先慢速念谱：4-5-3-6、2-5-1 分两口气记"
  },
  {
    id: "pCanon", degrees: [1, 5, 6, 3, 4, 1, 4, 5],
    name: "卡农进行", formula: "1 – 5 – 6 – 3 – 4 – 1 – 4 – 5",
    desc: "帕赫贝尔《卡农》的和声骨架，庄严又温暖",
    tip: "八字循环的完整形态在流行歌里很少整条出现，多数歌只借它的前半段"
  },
  {
    id: "p2516", degrees: [2, 5, 1, 6],
    name: "温柔循环", formula: "2 – 5 – 1 – 6",
    desc: "爵士里的经典终止式 2-5-1 加个 6 级延伸，温柔流动",
    tip: "2 级和 5 级是「要回家」的信号，耳朵抓住这个感觉"
  },
  {
    id: "p4516", degrees: [4, 5, 1, 6],
    name: "副歌推进", formula: "4 – 5 – 1 – 6",
    desc: "4-5 上行推能量，落在 1 级释放，常见于励志歌副歌",
    tip: "4→5 的上行是能量爬坡，扫弦时明显加重这两拍"
  },
  {
    id: "p6545", degrees: [6, 5, 4, 5],
    name: "下行伤感", formula: "6 – 5 – 4 – 5",
    desc: "低音级进下行的听感，伤感又抓耳",
    tip: "6-5-4 像叹气一样往下走，最后 5 级把情绪悬住。这条暂时没找到核对过的整曲用例，先用套路本身练"
  }
];

GT.getProgression = function (id) {
  return GT.PROGRESSIONS.find(function (p) { return p.id === id; });
};

/* ---------- 节奏型库（随机挑战用） ---------- */
GT.RHYTHMS = [
  { id: "r1", name: "民谣分解 53231323", desc: "最通用的分解节奏，先慢后快" },
  { id: "r2", name: "扫弦 ↓ ↓↑ ↑↓↑", desc: "万能扫弦，重音落在下扫" },
  { id: "r3", name: "切音扫弦 ↓× ↑×↓↑", desc: "用掌根闷音制造颗粒感" },
  { id: "r4", name: "华尔兹 ↓↓↓ (3/4)", desc: "三拍子律动，数 1-2-3" },
  { id: "r5", name: "摇滚 ↓ ↓ ↑ ×", desc: "强力和弦+重音推进" },
  { id: "r6", name: "Funk 十六分 ×↑×↑", desc: "进阶：闷音与重音交替" }
];

/* ---------- 21 天训练课程 ---------- */
/* 每个 day：阶段 / 标题 / 任务列表 / 当日主练套路 / 当日练习调 / 当日套歌（已核对 id） */
function day(d, phase, title, tasks, progId, key, songs) {
  return {
    day: d, phase: phase, title: title, tasks: tasks,
    progId: progId, key: key, songs: songs || []
  };
}
function t(text, min) { return { text: text, min: min }; }

GT.COURSE = [
  /* 阶段一：套路植入 Day 1-7（哼低音唱名，建立级数听感） */
  day(1, 1, "热身 + 认识 1-6-4-5", [
    t("热身：C 调 6 个基础和弦各按 10 次换到位（C G Am F Em Dm）", 3),
    t("左手：C → Am → F → G 循环换和弦，60 BPM 每小节一个；每个和弦弹下去的同时哼出低音唱名：do → la → fa → sol（手嘴同步，慢速为准）", 5),
    t("右手：对这个进行弹分解 53231323，跟节拍器 70 BPM，哼低音不中断", 5),
    t("套歌（只弹写出来的那一段，不要整首）：《童年》主歌「池塘边的榕树上」＝ C Am F G（1645）；《月亮代表我的心》只有前奏那 4 小节是 1645，主歌不是", 5)
  ], "p1645", "C", ["tongnian", "yueliang"]),

  day(2, 1, "1-6-4-5 提速", [
    t("左手：1645 换和弦，70→85 BPM 各 3 遍无断链，哼低音全程不停", 5),
    t("右手：万能扫弦 ↓ ↓↑ ↑↓↑ 配 1645，70 BPM，嘴上继续哼 do-la-fa-sol", 5),
    t("套歌（C 调 1645，副歌段落）：《成都》副歌「和我在成都的街头走一走」＝ C Am F G；《晴天》副歌「刮风这天」原调是 G，今天先用 C 调弹 C Am F G；先纯弹一遍 → 再只哼旋律一遍 → 最后手弹+嘴哼合起来", 5),
    t("盲弹检查：闭眼完成 4 个小节循环不出错（哼唱也不许断）", 3)
  ], "p1645", "C", ["chengdu", "qingtian_f"]),

  day(3, 1, "认识 1-5-6-4", [
    t("左手：C → G → Am → F 循环，65 BPM 每小节一个，同时哼低音 do → sol → la → fa", 5),
    t("对比练习：1645 和 1564 各弹 2 遍，边弹边哼，感受起点不同带来的情绪差异", 4),
    t("右手：分解 53231323 配 1564，跟节拍器，哼低音不中断", 5),
    t("套歌（C 调 1564）：《遇见》主歌「听见冬天的离开」＝ C G Am F —— 这一句正好是 1564 的教科书例子", 4)
  ], "p1564", "C", ["yujian_v"]),

  day(4, 1, "1564 提速 + 小调开局", [
    t("左手：1564 换和弦 75→90 BPM 各 3 遍，哼低音不停", 5),
    t("认识 6-4-1-5：Am → F → C → G，弹 5 遍找忧郁感；哼 la → fa → do → sol，起点变了，情绪立刻不同", 5),
    t("右手：扫弦配 6415，节奏 ↓ ↓↑ ↑↓↑，哼低音同步", 4),
    t("套歌（C 调 6415）：《平凡之路》主歌+副歌都是 Am F C G（原调 A）；《晴天》主歌「故事的小黄花」也是 6415（Em C G D）", 4)
  ], "p6415", "C", ["pingfan", "qingtian_v"]),

  day(5, 1, "温柔循环 2-5-1-6", [
    t("左手：Dm → G → C → Am 循环，60 BPM 慢速换准，哼 re → sol → do → la", 5),
    t("右手：分解 + 扫弦各练一半时间，哼低音不中断", 6),
    t("套歌（C 调 2516）：《说散就散》主歌「抱一抱」＝ Am Dm G C —— 和 2516 是同一个循环、从 6 级起手；《安静》主歌整条是 1-6-4-2-5，2516 藏在跨句的位置（先听出 2-5 再回到 1 的感觉）", 5),
    t("复测：随机抽查 1645 / 1564 / 6415 各弹 2 遍，边弹边哼", 2)
  ], "p2516", "C", ["shuoshan", "anjing"]),

  day(6, 1, "副歌推进与下行", [
    t("左手：4-5-1-6（F G C Am）循环 10 遍，哼 fa → sol → do → la", 5),
    t("左手：6-5-4-5（Am G F G）循环 10 遍，哼 la → sol → fa → sol，体会下行叹气感", 5),
    t("右手：摇滚节奏 ↓ ↓ ↑ × 配 4516，哼低音同步", 4),
    t("套歌（C 调 4516）：《遇见》副歌「我遇见谁」＝ F G C Am；6-5-4-5 这条暂时没找到核对过的整曲用例，先用套路本身弹熟", 4)
  ], "p4516", "C", ["yujian_c"]),

  day(7, 1, "阶段一验收：6 套路大串烧", [
    t("六个套路各连续弹 4 遍无失误，每条都边弹边哼低音唱名（1645/1564/6415/2516/4516/6545）", 8),
    t("听力自测：去「听力炼耳」玩 L2 难度 10 题，正确率 ≥ 70%", 5),
    t("给自己的今天打个卡，明天开始搬调！哼的唱名就是你的「通用语言」", 1)
  ], "p1645", "C", ["tongnian", "yujian_v", "pingfan"]),

  /* 阶段二：移调迁移 Day 8-14（哼名不变 = 级数思维） */
  day(8, 2, "搬去 G 调（套路不变）", [
    t("写出 G 调的 1645（G Em C D），弹响并哼低音——发现了吗？嘴里还是 do → la → fa → sol，唱名没变！这就是级数思维", 4),
    t("左手：G Em C D 换和弦，60 BPM 起步，哼唱名同步", 5),
    t("右手：G 调弹 1645 分解 + 扫弦各半，哼唱名不变", 4),
    t("套歌（G 调 1645）：《晴天》副歌——它的原调就是 G，直接 G Em C D 弹唱；《成都》副歌也是 1645（原调 D，用 G 调弹要接受音区变化）", 5)
  ], "p1645", "G", ["qingtian_f", "chengdu"]),

  day(9, 2, "G 调 1564 / 6415", [
    t("左手：G D Em C（1564）循环 10 遍，嘴里哼 do → sol → la → fa", 5),
    t("左手：Em C G D（6415）循环 10 遍，哼 la → fa → do → sol", 5),
    t("套歌（G 调）：《遇见》主歌 = G D Em C（1564）；《平凡之路》主歌+副歌 = Em C G D（6415）", 5),
    t("移调反应练习：说出级数立刻报出 G 调和弦，6 级一组；报完嘴上哼出对应唱名", 3)
  ], "p1564", "G", ["yujian_v", "pingfan"]),

  day(10, 2, "搬去 D 调", [
    t("写出 D 调 1645（D Bm G A）并慢速换熟，哼的还是 do → la → fa → sol", 5),
    t("D 调弹 1564（D A Bm G）循环 10 遍，哼 do → sol → la → fa", 5),
    t("右手：D 调扫弦万能节奏 80 BPM", 4),
    t("套歌（D 调 1645）：《成都》副歌——它的原调就是 D，直接 D Bm G A 弹唱，连变调夹都不用", 4)
  ], "p1645", "D", ["chengdu"]),

  day(11, 2, "D 调验收 + 认识 A 调", [
    t("D 调随机抽 3 个套路各弹 4 遍，边弹边哼唱名", 5),
    t("写出 A 调 1645（A F♯m D E）慢速换熟，哼名不变", 5),
    t("A 调 1564（A E F♯m D）循环 10 遍，哼 do → sol → la → fa", 5),
    t("套歌（A 调）：《平凡之路》= F♯m D A E（6415，原调就是 A）；《遇见》主歌 = A E F♯m D（1564）", 4)
  ], "p1564", "A", ["pingfan", "yujian_v"]),

  day(12, 2, "卡农进行（C 调）", [
    t("C 调卡农骨架 1-5-6-3-4-1-4-5：先只练前四拍 1-5-6-3，嘴里哼 do → sol → la → mi 帮助记忆", 6),
    t("再练后半 4-1-4-5（哼 fa → do → fa → sol），最后连起来 60 BPM 哼完整条线", 6),
    t("进阶小灶（可选）：慢速弹时改哼 1-3-5 琶音，体会大/小和弦的色彩差", 2),
    t("套歌（C 调，卡农同族——只借前半条）：《稻香》主歌「还记得你说家是唯一的城堡」前五拍与卡农一致，后半收在 4-5-1；《倔强》副歌前四拍 1-5-6-3 一致，后半是 4-1-2-5", 5)
  ], "pCanon", "C", ["daoxiang", "jianqiang"]),

  day(13, 2, "日系黄金 4536251（C 调）", [
    t("F G Em Am（4536）慢速换熟 10 遍，哼 fa → sol → mi → la", 5),
    t("Dm G C（251）接上，完整 4536251 连续 5 遍，用哼唱名把七个和弦串成一条线", 6),
    t("套歌（C 调 4536251）：《后来》副歌「后来我总算学会了如何去爱」——最标准的 4536251（用 C 调指法夹 3 品＝原调 E♭）；《可惜没如果》副歌「全都怪我」= C G Am Em / F G Em Am / Dm G C", 5)
  ], "p4536", "C", ["houlaide", "kexi_c"]),

  day(14, 2, "阶段二验收：多调位大乱斗", [
    t("C / G / D 三个调各随机弹 2 个套路，弹前先哼一遍唱名再上手", 8),
    t("卡农 + 4536251 在 C 调各完整弹 3 遍，哼唱名不断线", 5),
    t("听力：L2 或 L3 难度 10 题，正确率 ≥ 75%", 5)
  ], "pCanon", "C", ["daoxiang", "houlaide"]),

  /* 阶段三：实战脱谱 Day 15-21（哼旋律验证 + 哼低音定位） */
  day(15, 3, "随机挑战初体验", [
    t("去「随机挑战」抽 5 组组合，每组弹满 2 分钟", 10),
    t("每弹完一组，用哼唱名复盘：刚才那条进行的低音走向是什么（例：G 调哼 do-sol-la-fa = 1564）", 3),
    t("听力：L3 难度 8 套路 10 题", 5)
  ], "p1645", "C", ["tongnian", "chengdu"]),

  day(16, 3, "听歌定调第一步", [
    t("读「套路库」里的脱谱方法论三步法", 3),
    t("选一首熟歌，哼出第一个和弦音，在琴上找到它，判断调", 6),
    t("用套路验证：弹你猜的套路同时哼原曲旋律——哼起来「硌」就是猜错了，换个套路再试", 6),
    t("记录：这首歌 = __ 调 + __ 套路（写进「我的歌单套路表」）", 3)
  ], null, null, ["qilixiang", "shuoshan"]),

  day(17, 3, "实战脱谱：不看任何谱", [
    t("随机挑战抽 6 组，范围扩大到 C/G/D/A 四个调；每组开弹前先哼出低音走向再上手", 12),
    t("挑战：每组第一遍就用扫弦跟唱哼旋律，手嘴合一", 5)
  ], null, null, ["kexi_v"]),

  day(18, 3, "听力进阶 + 移调反应", [
    t("听力：L4 难度（含移调）10 题", 6),
    t("移调反应：同一个 1645 在 C→G→D→A 连续切换，每个 2 遍——嘴上唱名始终保持 do-la-fa-sol 不变", 6),
    t("挑一首新歌（本周流行的），只听不查谱：哼旋律定调 → 哼低音找和弦 → 用套路验证", 6)
  ], null, null, []),

  day(19, 3, "完整弹唱一首歌（脱谱）", [
    t("选 Day16-18 分析过的歌，脱谱完成主歌+副歌弹唱", 10),
    t("卡壳的地方哼低音定位：跑偏那一下低音到了哪一级？单独慢练 5 遍", 5),
    t("录音回听一次，找 1 个最想改进的点", 3)
  ], null, null, ["kexi_c"]),

  day(20, 3, "终极随机大乱斗", [
    t("随机挑战：12 调全开抽 6 组，每组 2 分钟，开弹前先哼唱名热手", 12),
    t("听力：任选难度 10 题，正确率 ≥ 80%", 6)
  ], null, null, []),

  day(21, 3, "毕业验收 🎸", [
    t("验收 1：不看谱完整弹唱 1 首歌", 6),
    t("验收 2：现场抽调套路（朋友或随机挑战帮忙抽），先哼出低音唱名再即兴弹 4 小节", 5),
    t("验收 3：听力 L3/L4 共 12 题正确率 ≥ 75%", 6),
    t("毕业！给自己定下一个 21 天（换一批没练熟的套路再来一轮）", 1)
  ], null, null, [])
];

/* ---------- 和弦指法库（6 弦低音 E → 1 弦高音 e，-1=闷音 0=空弦） ---------- */
GT.CHORDS = [
  { name: "C",    frets: [-1, 3, 2, 0, 1, 0] },
  { name: "D",    frets: [-1, -1, 0, 2, 3, 2] },
  { name: "E",    frets: [0, 2, 2, 1, 0, 0] },
  { name: "F",    frets: [1, 3, 3, 2, 1, 1] },
  { name: "G",    frets: [3, 2, 0, 0, 0, 3] },
  { name: "A",    frets: [-1, 0, 2, 2, 2, 0] },
  { name: "B",    frets: [-1, 2, 4, 4, 4, 2] },
  { name: "B♭",   frets: [-1, 1, 3, 3, 3, 1] },
  { name: "Am",   frets: [-1, 0, 2, 2, 1, 0] },
  { name: "Bm",   frets: [-1, 2, 4, 4, 3, 2] },
  { name: "Cm",   frets: [-1, 3, 5, 5, 4, 3] },
  { name: "Dm",   frets: [-1, -1, 0, 2, 3, 1] },
  { name: "Em",   frets: [0, 2, 2, 0, 0, 0] },
  { name: "Fm",   frets: [1, 3, 3, 1, 1, 1] },
  { name: "F♯m",  frets: [2, 4, 4, 2, 2, 2] },
  { name: "Gm",   frets: [3, 5, 5, 3, 3, 3] },
  { name: "A♭m",  frets: [4, 6, 6, 4, 4, 4] },
  { name: "C♯m",  frets: [-1, 4, 6, 6, 5, 4] },
  { name: "A7",   frets: [-1, 0, 2, 0, 2, 0] },
  { name: "D7",   frets: [-1, -1, 0, 2, 1, 2] },
  { name: "E7",   frets: [0, 2, 0, 1, 0, 0] },
  { name: "G7",   frets: [3, 2, 0, 0, 0, 1] },
  { name: "C7",   frets: [-1, 3, 2, 3, 1, 0] },
  { name: "B7",   frets: [-1, 2, 1, 2, 0, 2] },
  { name: "Em7",  frets: [0, 2, 0, 0, 3, 0] },
  { name: "Am7",  frets: [-1, 0, 2, 0, 1, 0] },
  { name: "Fmaj7",frets: [-1, -1, 3, 2, 1, 0] },
  { name: "Dsus4",frets: [-1, -1, 0, 2, 3, 3] },
  { name: "Asus4",frets: [-1, 0, 2, 2, 3, 0] }
];

GT.getChord = function (name) {
  return GT.CHORDS.find(function (c) { return c.name === name; });
};

/* ---------- localStorage 封装 ---------- */
GT.store = {
  get: function (k, dflt) {
    try {
      var v = localStorage.getItem("gt_" + k);
      return v === null ? dflt : JSON.parse(v);
    } catch (e) { return dflt; }
  },
  set: function (k, v) {
    try { localStorage.setItem("gt_" + k, JSON.stringify(v)); } catch (e) {}
  }
};

GT.todayKey = function () {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
