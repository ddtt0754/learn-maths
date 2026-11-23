/* ============================================================
 * KDA 战力值计算规则 · 唯一事实源（统一调用入口）
 * 依据文档：03 运营技术库/豆豆智学系统设计方案V3.0/KDA计算公式.md
 * 版本：v2.2（挑战站调整：2026-10-28 起五级难度 D1-D5 对应菁优 1-5 星，
 *                 豆豆币 1/2/4/6/8、标准用时 0.5/1/1.5/3/5 分钟；BOSS=D5）
 *       2026-10-29 星评口径调整：由「正确率每 20% 一星」改为「按答对题数分档」
 *
 * 难度五级对照（菁优网星级 → 站内难度档，一一对应）：
 *   菁优 1 星 → D1（普通题）· 1 枚豆豆币 · 标准用时 0.5 分钟
 *   菁优 2 星 → D2（普通题）· 2 枚豆豆币 · 标准用时 1   分钟
 *   菁优 3 星 → D3（普通题）· 4 枚豆豆币 · 标准用时 1.5 分钟
 *   菁优 4 星 → D4（普通题）· 6 枚豆豆币 · 标准用时 3   分钟
 *   菁优 5 星 → D5（BOSS 压轴题，仅出现在每关最后一题）· 8 枚豆豆币 · 标准用时 5 分钟
 *
 * 公式：
 *   Z  卷面总分   = Σ(单题分值)            —— 按本局实际抽到的题目逐题累加（动态）
 *   VT 标准用时   = Σ(每题标准用时)         —— D1=0.5 / D2=1 / D3=1.5 / D4=3 / D5=5 分钟（动态）
 *   AT 实际用时   = 本次答题总时长（毫秒→分钟）
 *   W  权重系数   = Z ÷ 5（恒定）
 *   K  K分        = AT ÷ VT × W
 *   DA 答对分     = 答对题的难度分之和（只计答对，逐题按实际难度取值）
 *   KDA 战力值    = DA ÷ K（保留一位小数，≤10 封顶，满分 10）
 *
 * 通关判定与星级（按【答对题数】，以每关 30 题为基准）：
 *   答对 0-2 题    → 0 星
 *   答对 3-9 题    → 1 星
 *   答对 10-16 题  → 2 星
 *   答对 17-23 题  → 3 星
 *   答对 24-28 题  → 4 星 · 判定通关（解锁下一关）
 *   答对 29-30 题  → 5 星 · 判定完美通关
 *   （正确率 A 仍按 答对题数 ÷ 总题数 计算，仅用于「力量 = A×100」展示，不再决定星级）
 * ============================================================ */
(function (g) {
  "use strict";
  var RULE = {
    VERSION: "2.2",
    /* 单题分值（豆豆币）：题面星级 st 1-5 即难度 D1-D5 → 1 / 2 / 4 / 6 / 8 枚（D5=BOSS） */
    SCORE: { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8 },
    /* 标准用时（分钟/题）：D1 0.5 · D2 1 · D3 1.5 · D4 3 · D5(BOSS) 5 */
    VT_COEF: { 1: 0.5, 2: 1, 3: 1.5, 4: 3, 5: 5 },
    W_DIV: 5,          /* 权重系数 W = Z ÷ 5（恒定） */
    KDA_CAP: 10,       /* KDA ≤ 10 封顶 */
    /* 星评基准题数：站内每关固定 30 题；若某局题数不同，按比例折算到该基准再判星 */
    STAR_BASE_TOTAL: 30,
    /* 星级起点（答对题数下界），下标 = 星数：0星 0 · 1星 3 · 2星 10 · 3星 17 · 4星 24 · 5星 29 */
    STAR_MIN_CORRECT: [0, 3, 10, 17, 24, 29],
    PASS_STARS: 4      /* 达到该星级即通关（答对 24 题起） */
  };

  /* 答对题数 → 星级（0-5 星）。total 用于把非 30 题的一局折算到 30 题基准。 */
  function starsByCorrect(correct, total) {
    var base = RULE.STAR_BASE_TOTAL;
    var t = (total > 0) ? total : base;
    var c = Math.round((correct || 0) / t * base);   /* 折算到 30 题基准，四舍五入取整 */
    if (c >= base) return RULE.STAR_MIN_CORRECT.length - 1;
    for (var i = RULE.STAR_MIN_CORRECT.length - 1; i >= 0; i--) {
      if (c >= RULE.STAR_MIN_CORRECT[i]) return i;
    }
    return 0;
  }

  /* 兼容旧入口：只给正确率（0-1）时按 30 题基准折算答对题数再判星。 */
  function accStars(acc) {
    if (!(acc > 0)) return 0;
    return starsByCorrect(acc * RULE.STAR_BASE_TOTAL, RULE.STAR_BASE_TOTAL);
  }

  /* KDA 结算统一入口。
   * input = { qs:[{st:题面星级}...], correct:答对题数, gained:豆豆币(DA), atMs:实际用时毫秒 }
   * 返回 = { Z, W, VT, AT, K, DA, kda, acc, pass, perfect, stars } */
  function calcKDA(inp) {
    var Z = 0, VT = 0;
    (inp.qs || []).forEach(function (q) {
      Z += RULE.SCORE[q.st] || 0;
      VT += RULE.VT_COEF[q.st] || 0;
    });
    var AT = (inp.atMs || 0) / 60000;               /* 毫秒 → 分钟 */
    var W = Z / RULE.W_DIV;
    var K = VT > 0 ? (AT / VT) * W : 0;
    var DA = inp.gained || 0;
    var kda = K > 0 ? DA / K : 0;
    kda = Math.min(RULE.KDA_CAP, Math.round(kda * 10) / 10);
    var total = inp.qs ? inp.qs.length : 0;
    var correct = inp.correct || 0;
    var acc = total > 0 ? correct / total : 0;
    var stars = starsByCorrect(correct, total);     /* 星级按答对题数分档（30 题基准） */
    return {
      Z: Z, W: W, VT: VT, AT: AT, K: K, DA: DA,
      kda: kda,
      acc: acc,
      stars: stars,
      pass: stars >= RULE.PASS_STARS,               /* 4 星起通关（答对 24 题） */
      perfect: stars >= RULE.STAR_MIN_CORRECT.length - 1   /* 5 星 = 完美通关（答对 29 题） */
    };
  }

  g.KDA_RULE = RULE;
  g.accStars = accStars;
  g.starsByCorrect = starsByCorrect;
  g.calcKDA = calcKDA;
})(window);
