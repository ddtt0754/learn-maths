/* ============================================================
 * generators.js —— 题库引擎 + 一至五阶生成器
 * 设计原则：干扰项必须是"学生真会犯的错"，而不是随机数
 * ============================================================ */
(function (root) {
  'use strict';
  const MK = root.MathKit || (typeof require !== 'undefined' ? require('./math.js') : null);
  const { rnd, rndEx, pick, shuffle, gcd, F, Frac, fmtFrac, fmtFracP, minus, paren, decStr, makeChoices } = MK;

  const STAGES = [
    { id: 1, name: '20以内加减法', grade: '一年级', icon: '1阶', color: '#22c55e', band: 'a',
      desc: '凑十法 · 破十法 · 进退位', detail: '20以内进位加、退位减与连加连减，训练口算的速度与稳定性。' },
    { id: 2, name: '两位数乘一位数', grade: '二 / 三年级', icon: '2阶', color: '#14b8a6', band: 'a',
      desc: '拆分 · 进位 · 口算', detail: '把两位数拆成整十数与一位数分别相乘，重点在进位不能丢。' },
    { id: 3, name: '四位数乘四位数', grade: '四年级+', icon: '3阶', color: '#0ea5e9', band: 'a',
      desc: '竖式 · 部分积 · 对位', detail: '大数笔算，考验部分积的对位与累加，建议动笔演算。' },
    { id: 4, name: '多位数除以两位数', grade: '四年级', icon: '4阶', color: '#6366f1', band: 'b',
      desc: '试商 · 调商 · 余数', detail: '三到五位数除以两位数，含商中间有 0 与带余数的情形。' },
    { id: 5, name: '小数乘除法', grade: '五年级', icon: '5阶', color: '#f59e0b', band: 'b',
      desc: '小数点定位 · 转化', detail: '小数乘法看因数位数点小数点，小数除法先把除数转化成整数。' },
    { id: 6, name: '分数小数百分数混合', grade: '六年级', icon: '6阶', color: '#f97316', band: 'b',
      desc: '互化 · 运算顺序', detail: '三种数互化后的四则混合运算，先算乘除、有括号先算括号。' },
    { id: 7, name: '有理数混合运算', grade: '七年级', icon: '7阶', color: '#ec4899', band: 'c',
      desc: '符号 · 乘方 · 绝对值', detail: '加减乘除、乘方、绝对值混合，重点辨析 −a² 与 (−a)²。' },
    { id: 8, name: '解一元二次方程', grade: '九年级', icon: '8阶', color: '#a855f7', band: 'c',
      desc: '因式分解 · 公式法', detail: '因式分解法、配方法、公式法，含无实数根与无理根的判断。' },
    { id: 9, name: '中考混合计算', grade: '中考', icon: '9阶', color: '#ef4444', band: 'c',
      desc: '实数 · 根式 · 三角函数', detail: '零指数、负整数指数幂、绝对值、二次根式与特殊角三角函数综合。' }
  ];

  const GEN = {};
  function register(level, fn) { GEN[level] = fn; }

  /* 统一出题入口：带去重的成套生成 */
  function generate(level) {
    const fn = GEN[level];
    if (!fn) throw new Error('未注册的阶段: ' + level);
    const q = fn();
    q.level = level;
    return q;
  }
  function makeSet(level, count) {
    const out = [], seen = {};
    let guard = 0;
    while (out.length < count && guard < count * 60) {
      guard++;
      let q;
      try { q = generate(level); } catch (e) { continue; }
      const k = q.stem.replace(/<[^>]+>/g, '');
      if (seen[k]) continue;
      seen[k] = true;
      out.push(q);
    }
    return out;
  }

  /* 解析里的小工具 */
  function step(s) { return '<div class="ex-line">' + s + '</div>'; }
  function tip(s) { return '<div class="ex-tip">' + s + '</div>'; }

  /* ============================================================
   * 一阶：20 以内加减法
   * ============================================================ */
  register(1, function () {
    const type = pick(['addCarry', 'addCarry', 'subBorrow', 'subBorrow', 'plain', 'chain', 'missing']);
    let stem, correct, wrongs, explain, tag;

    if (type === 'addCarry') {
      const a = rnd(5, 9), b = rnd(11 - a, 9);
      correct = a + b;
      stem = a + ' + ' + b + ' = ?';
      wrongs = [correct - 1, correct + 1, correct - 10, a + b - 2, correct + 2, a * 1 + b + 10];
      const need = 10 - a, rest = b - need;
      explain = step('凑十法：把 <b>' + b + '</b> 拆成 <b>' + need + '</b> 和 <b>' + rest + '</b>')
        + step(a + ' + ' + need + ' = 10，10 + ' + rest + ' = <b>' + correct + '</b>')
        + tip('先把小的一边凑成 10，剩下几就是十几。');
      tag = '进位加法';
    } else if (type === 'subBorrow') {
      const a = rnd(11, 18), b = rnd(a - 9, 9);
      correct = a - b;
      stem = a + ' − ' + b + ' = ?';
      wrongs = [correct + 1, correct - 1, b - (a - 10), correct + 10, a + b - 10, correct + 2];
      explain = step('破十法：' + a + ' 拆成 10 和 ' + (a - 10))
        + step('10 − ' + b + ' = ' + (10 - b) + '，' + (10 - b) + ' + ' + (a - 10) + ' = <b>' + correct + '</b>')
        + tip('也可以想加算减：' + b + ' + ( ) = ' + a + '。');
      tag = '退位减法';
    } else if (type === 'plain') {
      if (Math.random() < 0.5) {
        const a = rnd(11, 18), b = rnd(1, 19 - a);
        correct = a + b; stem = a + ' + ' + b + ' = ?';
        explain = step('个位相加不满十：' + (a % 10) + ' + ' + b + ' = ' + (a % 10 + b))
          + step('十位不变，结果是 <b>' + correct + '</b>');
        tag = '不进位加法';
      } else {
        const a = rnd(12, 19), b = rnd(1, a % 10);
        correct = a - b; stem = a + ' − ' + b + ' = ?';
        explain = step('个位够减：' + (a % 10) + ' − ' + b + ' = ' + (a % 10 - b))
          + step('十位保留，结果是 <b>' + correct + '</b>');
        tag = '不退位减法';
      }
      wrongs = [correct + 1, correct - 1, correct + 10, correct - 10, correct + 2, correct - 2];
    } else if (type === 'chain') {
      const a = rnd(5, 9), b = rnd(11 - a, 9), c = rnd(2, 9);
      const mid = a + b;
      correct = mid - c;
      stem = a + ' + ' + b + ' − ' + c + ' = ?';
      wrongs = [a + b + c, mid - c + 1, mid - c - 1, a + (b - c), correct + 10, correct - 2];
      explain = step('从左往右算：' + a + ' + ' + b + ' = ' + mid)
        + step(mid + ' − ' + c + ' = <b>' + correct + '</b>')
        + tip('同级运算按从左到右的顺序，不能跳着算。');
      tag = '连加连减';
    } else {
      const a = rnd(4, 9), correctSum = rnd(a + 3, 20);
      correct = correctSum - a;
      stem = a + ' + <span class="blank">?</span> = ' + correctSum;
      wrongs = [correctSum + a, correct + 1, correct - 1, correct + 10, correct - 2, a];
      explain = step('求加数用减法：' + correctSum + ' − ' + a + ' = <b>' + correct + '</b>')
        + step('验算：' + a + ' + ' + correct + ' = ' + correctSum + ' ✓');
      tag = '求未知加数';
    }

    const c = makeChoices(correct, wrongs, function (v) { return String(v); },
      { valid: function (v) { return v >= 0 && v <= 40; } });
    return { tag: tag, stem: stem, choices: c.choices, answer: c.answer, explain: explain, check: [correct, correct] };
  });

  /* ============================================================
   * 二阶：两位数 × 一位数
   * ============================================================ */
  register(2, function () {
    const type = pick(['carry', 'carry', 'carry', 'ten', 'both']);
    let a, b;
    if (type === 'ten') { a = rnd(2, 9) * 10; b = rnd(3, 9); }
    else if (type === 'both') { a = rnd(11, 49); b = rnd(2, 9); }
    else { a = rnd(13, 98); b = rnd(3, 9); if (a % 10 === 0) a += rnd(1, 9); }

    const correct = a * b;
    const tens = Math.floor(a / 10), units = a % 10;
    const pTens = tens * b * 10, pUnits = units * b;
    /* 典型错误 1：个位积的进位忘了加到十位 */
    const noCarry = pTens + (pUnits % 10);
    /* 典型错误 2：进位加在了错误的位置（先加进位再乘） */
    const wrongCarry = (tens * b + Math.floor(pUnits / 10)) * 10 + (pUnits % 10) + (Math.floor(pUnits / 10) ? 0 : 0);
    const wrongs = [
      noCarry,
      pTens + pUnits + 10,
      pTens + pUnits - 10,
      a * (b - 1) + 0,
      a * (b + 1),
      tens * b * 10 + units,
      correct + b, correct - b
    ];
    const stem = a + ' × ' + b + ' = ?';
    const explain = step('拆分：' + a + ' = ' + (tens * 10) + ' + ' + units)
      + step((tens * 10) + ' × ' + b + ' = <b>' + pTens + '</b>　　' + units + ' × ' + b + ' = <b>' + pUnits + '</b>')
      + step(pTens + ' + ' + pUnits + ' = <b>' + correct + '</b>')
      + tip(pUnits >= 10 ? '个位相乘满 ' + pUnits + '，进位的 ' + Math.floor(pUnits / 10) + ' 一定要加到十位上。'
        : '个位不进位，直接相加即可。');
    const c = makeChoices(correct, wrongs, function (v) { return String(v); },
      { valid: function (v) { return v > 0 && v < 1200; } });
    return { tag: '两位数×一位数', stem: stem, choices: c.choices, answer: c.answer, explain: explain, check: [a * b, correct] };
  });

  /* ============================================================
   * 三阶：四位数 × 四位数
   * ============================================================ */
  register(3, function () {
    function four() {
      const style = pick(['plain', 'plain', 'round', 'nine']);
      if (style === 'round') return rnd(11, 98) * 100 + (Math.random() < 0.5 ? 0 : rnd(1, 9));
      if (style === 'nine') return rnd(1, 9) * 1000 + rnd(0, 9) * 100 + rnd(0, 9) * 10 + pick([1, 2, 5, 8, 9]);
      return rnd(1002, 9998);
    }
    const a = four();
    let b = four();
    if (b === a) b = four();
    const correct = a * b;

    /* 错误 1：某一位的部分积少移了一位（竖式对位错） */
    function shiftErr() {
      const ds = String(b).split('').reverse().map(Number);
      const k = pick([1, 2, 3]);
      if (!ds[k]) return null;
      let s = 0;
      for (let i = 0; i < ds.length; i++) s += a * ds[i] * Math.pow(10, i === k ? i - 1 : i);
      return s;
    }
    /* 错误 2：累加时某一位漏进位 */
    function carryErr() { return correct - pick([100, 1000, 10000]) * rnd(1, 9); }

    const wrongs = [
      shiftErr(), shiftErr(),
      correct + 100 * rnd(1, 9),
      correct - 100 * rnd(1, 9),
      carryErr(),
      a * (b + 1), a * (b - 1),
      correct + 1000 * rnd(1, 9)
    ];
    const ds = String(b).split('').reverse().map(Number);
    let parts = '';
    for (let i = ds.length - 1; i >= 0; i--) {
      if (!ds[i]) continue;
      parts += step(a + ' × ' + (ds[i] * Math.pow(10, i)) + ' = <b>' + (a * ds[i] * Math.pow(10, i)) + '</b>');
    }
    const explain = step('把 ' + b + ' 按数位拆开，逐项相乘再相加：') + parts
      + step('合计 = <b>' + correct + '</b>')
      + tip('竖式的关键是对位：乘十位的积末位要写在十位上，乘百位的积末位写在百位上。');
    const c = makeChoices(correct, wrongs, function (v) { return String(v); },
      { valid: function (v) { return v > 0 && String(v).length === String(correct).length; } });
    return { tag: '四位数×四位数', stem: a + ' × ' + b + ' = ?', choices: c.choices, answer: c.answer, explain: explain, check: [a * b, correct] };
  });

  /* ============================================================
   * 四阶：多位数 ÷ 两位数
   * ============================================================ */
  register(4, function () {
    const withZero = Math.random() < 0.35;
    const hasRem = Math.random() < 0.5;
    const d = rnd(12, 89);
    let q;
    if (withZero) {
      /* 刻意制造"商中间有 0" */
      const head = rnd(1, 9), tail = rnd(1, 9);
      q = Math.random() < 0.5 ? head * 100 + tail : head * 1000 + rnd(0, 9) * 10 + tail;
      if (String(q).indexOf('0') < 0) q = head * 100 + tail;
    } else {
      q = rnd(12, 940);
    }
    const r = hasRem ? rnd(1, d - 1) : 0;
    const dividend = q * d + r;

    const zeroDrop = String(q).indexOf('0') >= 0 ? parseInt(String(q).replace('0', ''), 10) : null;
    const wrongs = [
      { q: q, r: r === 0 ? 1 : (r + d > d ? d - r : r + 1) },
      { q: q + 1, r: r },
      { q: q - 1, r: r },
      zeroDrop ? { q: zeroDrop, r: r } : null,
      { q: q, r: r === 0 ? d - 1 : d - r },
      { q: q * 10, r: r },
      { q: q + 10, r: r },
      r > 0 ? { q: q, r: r + 1 } : { q: q, r: 2 }
    ];
    const fmt = function (v) { return v.r === 0 ? String(v.q) : v.q + '<span class="rem">&nbsp;余&nbsp;</span>' + v.r; };
    const key = function (v) { return v.q + '|' + v.r; };
    const c = makeChoices({ q: q, r: r }, wrongs, fmt, {
      key: key,
      valid: function (v) { return v && v.q > 0 && v.r >= 0 && v.r < d; }
    });
    const explain = step('试商：把除数 ' + d + ' 看作 ' + (Math.round(d / 10) * 10) + ' 来估商')
      + step('验算：' + q + ' × ' + d + (r ? ' + ' + r : '') + ' = <b>' + dividend + '</b> ✓')
      + tip(String(q).indexOf('0') >= 0
        ? '注意商中间的 0：某一位不够除时必须在商的这一位上写 0，不能跳过。'
        : (r ? '余数一定要比除数 ' + d + ' 小。' : '本题正好整除，没有余数。'));
    return {
      tag: r ? '有余数除法' : '整除', stem: dividend + ' ÷ ' + d + ' = ?',
      choices: c.choices, answer: c.answer, explain: explain, check: [q, r, dividend, d]
    };
  });

  /* ============================================================
   * 五阶：小数乘除法
   * ============================================================ */
  register(5, function () {
    const isMul = Math.random() < 0.5;

    if (isMul) {
      function dec() {
        return pick([
          rnd(11, 99) / 10, rnd(11, 99) / 10,
          rnd(101, 999) / 100,
          rnd(2, 9) / 10, rnd(11, 95) / 100,
          rnd(2, 9) * 10 / 10 + rnd(1, 9) / 10
        ]);
      }
      let a = dec(), b = Math.random() < 0.3 ? rnd(2, 9) : dec();
      const fa = F(Math.round(a * 1000), 1000), fb = F(Math.round(b * 1000), 1000);
      const prod = fa.mul(fb);
      const correct = prod.decStr();
      /* 数字化的整数积（忽略小数点） */
      const sa = decStr(a), sb = decStr(b);
      const pa = (sa.split('.')[1] || '').length, pb = (sb.split('.')[1] || '').length;
      const rawInt = Math.round(a * Math.pow(10, pa)) * Math.round(b * Math.pow(10, pb));
      const wrongs = [
        prod.mul(10).decStr(),      // 小数点少点一位
        prod.div(10).decStr(),      // 小数点多点一位
        String(rawInt),             // 完全忘记点小数点
        prod.mul(100).decStr(),
        prod.add(F(1, 10)).decStr(),
        prod.sub(F(1, 10)).decStr()
      ];
      const explain = step('先按整数相乘：' + sa.replace('.', '') + ' × ' + sb.replace('.', '') + ' = <b>' + rawInt + '</b>')
        + step('两个因数一共有 <b>' + (pa + pb) + '</b> 位小数，就从积的右边数出 ' + (pa + pb) + ' 位点上小数点')
        + step('结果 = <b>' + correct + '</b>')
        + tip('小数乘法与小数点对齐无关，只看因数的小数位数总和。');
      const c = makeChoices(correct, wrongs, function (v) { return minus(String(v)); },
        { valid: function (v) { return v !== null && v !== undefined; } });
      return {
        tag: '小数乘法', stem: sa + ' × ' + sb + ' = ?',
        choices: c.choices, answer: c.answer, explain: explain, check: [a * b, parseFloat(correct)]
      };
    }

    /* 除法：先定商与除数，倒推被除数，保证结果是有限小数 */
    let qv, dv, dividend, tries = 0;
    do {
      tries++;
      qv = pick([rnd(11, 99) / 10, rnd(2, 48) / 4, rnd(11, 99) / 10, rnd(101, 480) / 100, rnd(2, 30)]);
      dv = pick([rnd(2, 9) / 10, rnd(11, 95) / 100, rnd(11, 49) / 10, rnd(2, 9), rnd(12, 25) / 10]);
      dividend = Math.round(qv * dv * 100000) / 100000;
    } while ((tries < 60) && ((decStr(dividend).split('.')[1] || '').length > 3 || dividend > 999 || dividend < 0.05));

    const sq = decStr(qv), sd = decStr(dv), sdd = decStr(dividend);
    const pd = (sd.split('.')[1] || '').length;
    const fq = F(Math.round(qv * 100000), 100000);
    const wrongs = [
      fq.mul(10).decStr(), fq.div(10).decStr(),
      decStr(Math.round(dividend / (dv * Math.pow(10, pd)) * 100000) / 100000),
      fq.mul(100).decStr(),
      decStr(Math.round(dv / dividend * 1000) / 1000),
      fq.add(F(1, 10)).decStr()
    ];
    const explain = step('除数是小数，先把它变成整数：被除数和除数同时扩大 <b>' + Math.pow(10, pd) + '</b> 倍')
      + step(sdd + ' ÷ ' + sd + ' = ' + decStr(Math.round(dividend * Math.pow(10, pd) * 1000) / 1000) + ' ÷ ' + Math.round(dv * Math.pow(10, pd)))
      + step('商 = <b>' + sq + '</b>　验算：' + sq + ' × ' + sd + ' = ' + sdd + ' ✓')
      + tip('商的小数点要与"变化后的被除数"的小数点对齐，除数扩大几倍被除数就扩大几倍。');
    const c = makeChoices(sq, wrongs, function (v) { return minus(String(v)); });
    return {
      tag: '小数除法', stem: sdd + ' ÷ ' + sd + ' = ?',
      choices: c.choices, answer: c.answer, explain: explain, check: [dividend / dv, parseFloat(sq)]
    };
  });

  const api = { STAGES: STAGES, register: register, generate: generate, makeSet: makeSet, GEN: GEN, step: step, tip: tip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QBank = api;
})(typeof window !== 'undefined' ? window : globalThis);
