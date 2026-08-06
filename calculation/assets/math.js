/* ============================================================
 * math.js —— 精确数值内核 + 数学排版
 * 分数用整数对精确表示，杜绝 0.1+0.2 之类的浮点脏值
 * ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 随机 ---------- */
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function sign() { return Math.random() < 0.5 ? -1 : 1; }
  /* 从区间取值但排除若干数 */
  function rndEx(a, b, ex) {
    let v, guard = 0;
    do { v = rnd(a, b); guard++; } while (ex.indexOf(v) >= 0 && guard < 200);
    return v;
  }

  /* ---------- 整数工具 ---------- */
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }
  function lcm(a, b) { return Math.abs(a * b) / (gcd(a, b) || 1); }
  function isSquare(n) { if (n < 0) return false; const r = Math.round(Math.sqrt(n)); return r * r === n; }

  /* √n = k√m 的化简，返回 [k, m] */
  function sqrtSimplify(n) {
    let k = 1, m = n;
    for (let i = 2; i * i <= m; i++) {
      while (m % (i * i) === 0) { m /= i * i; k *= i; }
    }
    return [k, m];
  }

  /* ---------- 分数 ---------- */
  class Frac {
    constructor(n, d) {
      if (d === undefined) d = 1;
      if (d === 0) throw new Error('分母为零');
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d) || 1;
      this.n = n / g;
      this.d = d / g;
    }
    static from(x) {
      if (x instanceof Frac) return x;
      if (typeof x === 'number') {
        if (Number.isInteger(x)) return new Frac(x, 1);
        const s = x.toString();
        const dot = s.indexOf('.');
        const p = s.length - dot - 1;
        return new Frac(Math.round(x * Math.pow(10, p)), Math.pow(10, p));
      }
      throw new Error('无法转换为分数: ' + x);
    }
    add(o) { o = Frac.from(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.from(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.from(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) {
      o = Frac.from(o);
      if (o.n === 0) throw new Error('除数为零');
      return new Frac(this.n * o.d, this.d * o.n);
    }
    neg() { return new Frac(-this.n, this.d); }
    abs() { return new Frac(Math.abs(this.n), this.d); }
    inv() { return new Frac(this.d, this.n); }
    pow(k) {
      if (k === 0) return new Frac(1, 1);
      if (k < 0) return this.inv().pow(-k);
      return new Frac(Math.pow(this.n, k), Math.pow(this.d, k));
    }
    eq(o) { o = Frac.from(o); return this.n === o.n && this.d === o.d; }
    isInt() { return this.d === 1; }
    isNeg() { return this.n < 0; }
    val() { return this.n / this.d; }
    /* 纯文本，供去重/调试 */
    text() { return this.d === 1 ? String(this.n) : this.n + '/' + this.d; }
    /* 能否写成有限小数 */
    isTerminating() {
      let d = this.d;
      while (d % 2 === 0) d /= 2;
      while (d % 5 === 0) d /= 5;
      return d === 1;
    }
    decStr() {
      if (!this.isTerminating()) return null;
      const neg = this.n < 0;
      let n = Math.abs(this.n), d = this.d;
      let intPart = Math.floor(n / d), rem = n % d, out = '';
      let guard = 0;
      while (rem !== 0 && guard < 20) { rem *= 10; out += Math.floor(rem / d); rem = rem % d; guard++; }
      return (neg ? '-' : '') + intPart + (out ? '.' + out : '');
    }
  }
  function F(n, d) { return new Frac(n, d === undefined ? 1 : d); }

  /* ---------- HTML 排版 ---------- */
  function h(tag, cls, inner) {
    return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + inner + '</' + tag + '>';
  }
  /* 竖式分数 —— 使用 math-frac 体系，完整换行对齐 */
  function fracHTML(n, d) {
    return '<span class="math-frac"><span class="math-frac-top">' + n +
      '</span><span class="math-frac-bot">' + d + '</span></span>';
  }
  /* 分数对象 -> HTML（负号提到分数前面） */
  function fmtFrac(f, opt) {
    opt = opt || {};
    f = Frac.from(f);
    if (f.d === 1) return minus(String(f.n));
    const neg = f.n < 0;
    const body = fracHTML(minus(String(Math.abs(f.n))), String(f.d));
    return (neg ? '<span class="math-neg">\u2212</span>' : '') + body;
  }
  /* 带括号的分数（用于表达式中的负分数） */
  function fmtFracP(f) {
    f = Frac.from(f);
    if (f.n < 0) return '<span class="math-paren">(</span>' + fmtFrac(f) + '<span class="math-paren">)</span>';
    return fmtFrac(f);
  }
  /* 根号 —— √ 与上划线严密衔接 */
  function sqrtHTML(inner) {
    return '<span class="math-sqrt"><span class="math-sqrt-sym">\u221A</span>' +
      '<span class="math-sqrt-bar"><span class="math-sqrt-inner">' + inner + '</span></span></span>';
  }
  /* k√m 形式 */
  function surdHTML(k, m) {
    if (m === 1) return minus(String(k));
    if (k === 1) return sqrtHTML(m);
    if (k === -1) return '<span class="math-neg">\u2212</span>' + sqrtHTML(m);
    return minus(String(k)) + '<span class="math-dot">\u00D7</span>' + sqrtHTML(m);
  }
  /* 指数 —— 专用 math-sup：supHTML(exp) 渲染 <sup>exp</sup> */
  function supHTML(exp) {
    return '<sup class="math-sup">' + exp + '</sup>';
  }
  /* 负号统一用真减号，视觉更像课本 */
  function minus(s) { return String(s).replace(/-/g, '\u2212'); }
  function num(x) { return minus(String(x)); }
  /* 括号包住负数 */
  function paren(x) { return x < 0 ? '<span class="math-paren">(</span>' + minus(Math.abs(x)) + '<span class="math-paren">)</span>' : minus(String(x)); }

  /* 小数字符串（去掉多余的 0） */
  function decStr(x) {
    if (typeof x === 'number') {
      let s = x.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
      return s;
    }
    return Frac.from(x).decStr();
  }

  /* ---------- 选项装配 ----------
   * correct: 正确答案的原始值
   * wrongs : 候选错误值数组（按教学价值排序，前面的优先）
   * fmt    : 值 -> HTML
   * key    : 值 -> 去重用字符串（默认取 fmt 结果）
   * valid  : 值 -> 是否可用
   */
  function makeChoices(correct, wrongs, fmt, opt) {
    opt = opt || {};
    const key = opt.key || function (v) { return fmt(v); };
    const valid = opt.valid || function () { return true; };
    const seen = {};
    const list = [{ v: correct, html: fmt(correct), ok: true }];
    seen[key(correct)] = true;
    const pool = opt.keepOrder ? wrongs : shuffle(wrongs);
    for (let i = 0; i < pool.length && list.length < 4; i++) {
      const w = pool[i];
      if (w === null || w === undefined) continue;
      if (!valid(w)) continue;
      const k = key(w);
      if (seen[k]) continue;
      seen[k] = true;
      list.push({ v: w, html: fmt(w), ok: false });
    }
    /* 兜底：数值型答案做小幅扰动 */
    let guard = 0;
    while (list.length < 4 && guard < 200) {
      guard++;
      let cand = null;
      if (typeof correct === 'number') {
        const delta = pick([1, 2, 3, 5, 10, 100]) * (Math.random() < 0.5 ? -1 : 1);
        cand = correct + delta;
      } else if (correct instanceof Frac) {
        cand = correct.add(F(pick([1, -1, 2, -2]), pick([1, 2, 3, 4])));
      } else break;
      if (!valid(cand)) continue;
      const k = key(cand);
      if (seen[k]) continue;
      seen[k] = true;
      list.push({ v: cand, html: fmt(cand), ok: false });
    }
    const mixed = shuffle(list);
    let ansIdx = 0;
    for (let i = 0; i < mixed.length; i++) if (mixed[i].ok) ansIdx = i;
    return { choices: mixed.map(function (o) { return o.html; }), answer: ansIdx, raw: mixed };
  }

  const api = {
    rnd: rnd, rndEx: rndEx, pick: pick, shuffle: shuffle, sign: sign,
    gcd: gcd, lcm: lcm, isSquare: isSquare, sqrtSimplify: sqrtSimplify,
    Frac: Frac, F: F,
    fracHTML: fracHTML, fmtFrac: fmtFrac, fmtFracP: fmtFracP,
    sqrtHTML: sqrtHTML, surdHTML: surdHTML, supHTML: supHTML,
    minus: minus, num: num, paren: paren, decStr: decStr, h: h,
    makeChoices: makeChoices
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MathKit = api;
})(typeof window !== 'undefined' ? window : globalThis);
