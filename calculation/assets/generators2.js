/* ============================================================
 * generators2.js —— 六至九阶生成器
 * 依赖 math.js + generators.js 的 register / makeChoices / step / tip
 * ============================================================ */
(function (root) {
  'use strict';
  const MK = root.MathKit;
  var QBank = root.QBank;
  var register, step, tip;
  /* 在浏览器端，QBank 已就绪；Node 端 require */
  if (typeof require !== 'undefined' && !QBank) {
    QBank = require('./generators.js');
    MK.pick = QBank.pick; /* 补回引用 */
  }
  register = QBank.register;
  step = QBank.step;
  tip = QBank.tip;

  const { rnd, rndEx, pick, shuffle, gcd, lcm, isSquare, sqrtSimplify, F, Frac,
    fmtFrac, fmtFracP, fracHTML, sqrtHTML, surdHTML, supHTML, minus, num, paren, decStr, h, makeChoices } = MK;

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function br() { return '<br>'; }

  /* ---------- 根式数 a + b√m（a,b 为 Frac 或 int） ---------- */
  function surd(a, b, m) {
    a = Frac.from(a); b = Frac.from(b);
    return { a: a, b: b, m: m };
  }
  function surdFmt(s) {
    let out = '';
    const absA = s.a.abs();
    if (!s.a.eq(0) || s.b.eq(0)) {
      out += fmtFrac(s.a);
    }
    if (!s.b.eq(0)) {
      const bs = s.b;
      const babs = bs.abs();
      const isOne = babs.eq(1);
      const signChar = bs.isNeg() ? '\u2212' : (out ? ' + ' : '');
      if (out && signChar === '\u2212') out = out + ' \u2212 ';
      else if (out) out += ' + ';
      if (!isOne) out += fmtFrac(babs) + '\u00D7';
      out += sqrtHTML(s.m);
    }
    if (!out) out = '0';
    return out;
  }
  function surdText(s) {
    let out = '';
    if (!s.a.eq(0) || s.b.eq(0)) out += s.a.text();
    if (!s.b.eq(0)) {
      const babs = s.b.abs();
      if (out && s.b.isNeg()) out += '-';
      else if (out) out += '+';
      if (!babs.eq(1)) out += babs.text() + '*';
      out += 'sqrt(' + s.m + ')';
    }
    return out || '0';
  }

  /* ============================================================
   * 六阶：分数小数百分数四则混合
   * ============================================================ */
  register(6, function () {
    const T = pick([1, 2, 3, 4, 5]);
    let stem, correct, wrongs, explain;

    if (T === 1) {
      /* 分数加减 × 百分数 */
      const nums = [2, 3, 4, 5, 6, 8, 10];
      const da = pick(nums), db = pick(nums.filter(function (x) { return x !== da; }));
      const na = rndEx(1, da - 1, [0]), nb = rndEx(1, db - 1, [0]);
      const sign = pick(['+', '\u2212']);
      const pct = pick([10, 20, 25, 40, 50, 60, 75, 150]);
      const fa = F(na, da), fb = F(nb, db);
      const sum = sign === '+' ? fa.add(fb) : fa.sub(fb);
      const fpct = F(pct, 100);
      correct = sum.mul(fpct);
      stem = '(' + fmtFracP(fa) + ' ' + sign + ' ' + fmtFracP(fb) + ') × ' + pct + '%';
      /* error1: 从左到右 fa + fb×pct% */
      const e1 = fa.add(fb.mul(fpct));
      /* error2: 忘把%化成/100 */
      const e2 = sign === '+' ? fa.add(fb) : fa.sub(fb);
      /* error3: 变成除法 */
      const e3 = sum.div(fpct);
      /* error4: 先乘再加 fa + pct% × fb */
      const e4 = fa.add(fpct.mul(fb));
      wrongs = [e1, e2, e3, e4, sum.sub(fpct), sum.add(fpct)];
      explain = step('先算括号里的分数 ' + sign + ' 法，再乘以 ' + pct + '%（即 ' + fmtFrac(fa) + ' ' + sign + ' ' + fmtFrac(fb) +
        ' = <b>' + fmtFrac(sum) + '</b>）')
        + step(fmtFrac(sum) + ' × ' + pct + '% = ' + fmtFrac(sum) + ' × ' + fmtFrac(fpct) + ' = <b>' + fmtFrac(correct) + '</b>');
    } else if (T === 2) {
      /* 小数 ÷ 分数 + 百分数 */
      const decs = [0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 1.2, 1.5, 2.5];
      const a = pick(decs);
      const den = pick([2, 3, 4, 5, 8]);
      const num = rndEx(1, den - 1, [0]);
      const fd = F(Math.round(a * 100), 100), fb = F(num, den);
      const quot = fd.div(fb);
      const pct = pick([20, 25, 40, 50, 60, 75]);
      correct = quot.add(F(pct, 100));
      stem = a + ' ÷ ' + fmtFracP(fb) + ' + ' + pct + '%';
      /* error1: 忘记取倒数 */
      const e1 = fd.mul(fb).add(F(pct, 100));
      /* error2: 先加再除 */
      const e2 = fd.div(fb.add(F(pct, 100)));
      /* error3: 顺序错 */
      const e3 = quot.sub(F(pct, 100));
      /* error4: % 当成整数 */
      const e4 = quot.add(pct);
      wrongs = [e1, e2, e3, e4, quot.add(F(1, 10)), quot.sub(F(1, 10))];
      explain = step('除以分数等于乘它的倒数：' + a + ' ÷ ' + fmtFrac(fb) + ' = ' + a + ' × ' + fmtFrac(fb.inv()) +
        ' = <b>' + fmtFrac(quot) + '</b>')
        + step(fmtFrac(quot) + ' + ' + pct + '% = <b>' + fmtFrac(correct) + '</b>');
    } else if (T === 3) {
      /* 百分数连乘除以分数 */
      const pcts = [pick([40, 50, 60, 80]), pick([10, 20, 25, 30])];
      const fp1 = F(pcts[0], 100), fp2 = F(pcts[1], 100);
      const dn = pick([4, 5, 8]);
      const nm = rndEx(1, dn - 1, [0]);
      correct = fp1.mul(fp2).div(F(nm, dn));
      stem = pcts[0] + '% × ' + pcts[1] + '% ÷ ' + fmtFracP(F(nm, dn));
      const e1 = fp1.mul(fp2.div(F(nm, dn))); // 除法变乘
      const e2 = fp1.mul(fp2).mul(F(nm, dn)); // 忘倒数
      const e3 = F(pcts[0] + pcts[1], 100).div(F(nm, dn));
      const e4 = correct.mul(F(10, 1));
      wrongs = [e1, e2, e3, e4, correct.add(F(1, 10)), correct.div(F(2, 1))];
      explain = step('百分数先化成分数：' + pcts[0] + '% = ' + fmtFrac(fp1) + '，' + pcts[1] + '% = ' + fmtFrac(fp2))
        + step(fmtFrac(fp1) + ' × ' + fmtFrac(fp2) + ' ÷ ' + fmtFrac(F(nm, dn)) + ' = ' + fmtFrac(fp1) + ' × ' + fmtFrac(fp2) + ' × ' + fmtFrac(F(dn, nm)) + ' = <b>' + fmtFrac(correct) + '</b>');
    } else if (T === 4) {
      /* 分数 × (小数 + 百分数) */
      const dv = pick([0.2, 0.25, 0.3, 0.5, 0.6, 0.75, 0.8]);
      const pv = pick([20, 25, 30, 50, 75]);
      const fd = F(Math.round(dv * 100), 100), fp = F(pv, 100);
      const sum = fd.add(fp);
      const num = rndEx(1, sum.d - 1, [0]);
      const den = sum.d;
      const frac = Math.random() < 0.5 ? F(num, den) : F(1, pick([2, 3, 4, 5]));
      correct = frac.mul(sum);
      stem = fmtFrac(frac) + ' × (' + dv + ' + ' + pv + '%)';
      const e1 = frac.mul(fd).add(fp);
      const e2 = frac.mul(dv + pv);
      const e3 = frac.add(fd).mul(fp);
      wrongs = [e1, e2, e3, correct.mul(F(2, 1)), correct.div(F(2, 1)), correct.add(F(1, 4))];
      explain = step('先算括号：' + dv + ' + ' + pv + '% = ' + kv(dv) + ' + ' + kv(fp) + ' = <b>' + kv(sum) + '</b>')
        + step(fmtFrac(frac) + ' × ' + kv(sum) + ' = <b>' + fmtFrac(correct) + '</b>')
        + tip('有括号先算括号，百分数要先化成小数或分数。');
    } else {
      /* 混合：小数 ÷ 百分数 − 分数 */
      const dv = pick([0.3, 0.5, 0.6, 0.75, 1.2, 1.5, 2]);
      const pv = pick([5, 10, 20, 25, 50]);
      const fd = F(Math.round(dv * 100), 100), fp = F(pv, 100);
      const quot = fd.div(fp);
      const dn = pick([3, 4, 5, 8]);
      const nm = rndEx(1, dn - 1, [0]);
      const fb = F(nm, dn);
      correct = quot.sub(fb);
      stem = dv + ' ÷ ' + pv + '% − ' + fmtFracP(fb);
      const e1 = fd.div(fp.sub(fb));
      const e2 = fd.div(fp).add(fb);
      const e3 = fd.div(pv).sub(fb);
      wrongs = [e1, e2, e3, quot.add(fb), correct.mul(F(2, 1)), correct.div(F(2, 1))];
      explain = step(pv + '% = ' + fmtFrac(fp) + '，' + dv + ' ÷ ' + fmtFrac(fp) + ' = ' + dv + ' × ' + fmtFrac(fp.inv()) + ' = <b>' + kv(quot) + '</b>')
        + step(kv(quot) + ' − ' + fmtFrac(fb) + ' = <b>' + fmtFrac(correct) + '</b>');
    }

    function kv(f) { f = Frac.from(f); return f.d === 1 ? String(f.n) : fmtFrac(f); }

    /* 直接用 Frac 值作为选项，避免字符串索引的困惑 */
    const allWrongs = wrongs.filter(function (w) { return w !== null && w !== undefined; });
    const c = makeChoices(correct, allWrongs, function (v) {
      return Frac.from(v).d === 1 ? String(Frac.from(v).n) : fmtFrac(Frac.from(v));
    }, { valid: function () { return true; }, key: function (v) { return Frac.from(v).text(); } });
    return { tag: '混合运算', stem: stem, choices: c.choices, answer: c.answer,
      explain: explain,
      check: [correct.text(), correct.text()] };
  });

  /* ============================================================
   * 七阶：有理数加减乘除乘方绝对值混合
   * ============================================================ */
  register(7, function () {
    const T = pick([1, 2, 3, 4, 5]);
    let stem, correct, wrongs, explain;

    if (T === 1) {
      /* −a² − |−b| + (−c)³ vs (−a)² */
      const a = pick([2, 3, 4]), b = pick([3, 5, 7]), c = pick([2, 3]);
      correct = F(-a * a).sub(b).add(F(Math.pow(-c, 3)));
      stem = minus('\u2212' + a + supHTML('2') + ' − |\u2212' + b + '| + (\u2212' + c + ')' + supHTML(3));
      /* err1: 把 −a² 当成 (−a)² */
      const e1 = F(a * a).sub(b).add(F(Math.pow(-c, 3)));
      /* err2: ｜−b｜去掉负号但绝对值里没算对 */
      const e2 = F(-a * a).sub(b * (-1)).add(F(Math.pow(-c, 3)));
      /* err3: (−c)³ = −c³ 但写成 c³ */
      const e3 = F(-a * a).sub(b).add(F(c * c * c));
      /* err4: 全搞反符号 */
      const e4 = F(a * a).add(b).add(F(c * c * c));
      wrongs = [e1, e2, e3, e4];
      explain = step(supHTML('\u2212a\u00B2') + ' 是先算 ' + a + supHTML(2) + ' = ' + (a * a) + '，再加负号 = \u2212' + (a * a) +
        '（不是 (\u2212' + a + ')' + supHTML(2) + '！）')
        + step('|\u2212' + b + '| = ' + b + '，(\u2212' + c + ')' + supHTML(3) + ' = \u2212' + (c * c * c))
        + step('合计：\u2212' + (a * a) + ' − ' + b + ' − ' + (c * c * c) + ' = <b>' + fmtFrac(correct) + '</b>');
    } else if (T === 2) {
      /* (−a + b) ÷ (−c) − (−d)×e */
      const a = rnd(2, 5), b = rnd(1, 4), c = rnd(2, 6), d = rnd(3, 6), e = rnd(2, 4);
      const sum = (-a + b);
      const divRes = F(sum, -c);
      const mul = (-d) * e;
      correct = divRes.sub(mul);
      stem = '(\u2212' + a + ' + ' + b + ') ÷ (\u2212' + c + ') − (\u2212' + d + ') × ' + e;
      const e1 = divRes.add(mul);
      const e2 = F(sum, c).sub(mul);
      const e3 = F(sum, -c).add(F(d * e));
      wrongs = [e1, e2, e3, correct.mul(F(2, 1)), correct.neg()];
      explain = step('先乘除后加减：(\u2212' + a + ' + ' + b + ') = <b>' + sum + '</b>')
        + step(sum + ' ÷ (\u2212' + c + ') = <b>' + fmtFrac(divRes) + '</b>　　(\u2212' + d + ') × ' + e + ' = <b>' + mul + '</b>')
        + step(fmtFrac(divRes) + ' − (' + mul + ') = <b>' + fmtFrac(correct) + '</b>');
    } else if (T === 3) {
      /* (−a)×(1/b)² − |c−d| ÷ (−e) */
      const a = rnd(2, 6), b = rnd(2, 4), c = rnd(3, 7), d = rnd(c + 2, c + 6), e = rnd(2, 5);
      const sq = F(1, b * b);
      const prod = F(-a).mul(sq);
      const absDiff = Math.abs(c - d);
      const divRes = F(absDiff, -e);
      correct = prod.sub(divRes);
      stem = '(\u2212' + a + ') × (' + fracHTML(1, b) + ')' + supHTML(2) + ' − |' + c + ' − ' + d + '| ÷ (\u2212' + e + ')';
      const e1 = prod.add(divRes);
      const e2 = F(a).mul(sq).sub(divRes);
      const e3 = prod.sub(F(absDiff, e));
      wrongs = [e1, e2, e3, correct.mul(F(2, 1))];
      explain = step('(' + fracHTML(1, b) + ')' + supHTML(2) + ' = ' + fracHTML(1, b * b))
        + step('(\u2212' + a + ') × ' + fracHTML(1, b * b) + ' = <b>' + fmtFrac(prod) + '</b>')
        + step('|' + c + ' − ' + d + '| = <b>' + absDiff + '</b>，' + absDiff + ' ÷ (\u2212' + e + ') = <b>' + fmtFrac(divRes) + '</b>')
        + step(fmtFrac(prod) + ' − ' + paren(divRes) + ' = <b>' + fmtFrac(correct) + '</b>')
        + tip('负负得正：减去一个负数 = 加上它的相反数。');
    } else if (T === 4) {
      /* |a−b| ÷ c − (−d)² + (−e) */
      const a = rnd(1, 5), b = rnd(a + 4, a + 9), c = rnd(2, 4), d = rnd(2, 5), e = rnd(3, 8);
      const absDiff = Math.abs(a - b);
      const divRes = divAsFrac(absDiff, c);
      const sq = d * d;
      correct = divRes.sub(sq).add(F(-e));
      stem = '|' + a + ' − ' + b + '| ÷ ' + c + ' − (\u2212' + d + ')' + supHTML(2) + ' + (\u2212' + e + ')';
      const e1 = divRes.add(sq).add(F(-e));
      const e2 = divRes.sub(sq).sub(F(-e));
      const e3 = divRes.sub(F(-d * d)).add(F(e));
      wrongs = [e1, e2, e3];
      explain = step('|' + a + ' − ' + b + '| = |\u2212' + absDiff + '| = <b>' + absDiff + '</b>')
        + step(absDiff + ' ÷ ' + c + ' = <b>' + fmtFrac(divRes) + '</b>')
        + step('(\u2212' + d + ')' + supHTML(2) + ' = <b>' + sq + '</b>（注意括号！负数的平方是正数）')
        + step(fmtFrac(divRes) + ' − ' + sq + ' + (\u2212' + e + ') = <b>' + fmtFrac(correct) + '</b>');
    } else {
      /* −a²÷(−b) + |c−d|² − (−e)³ */
      const a = rnd(2, 4), b = rnd(2, 3), c = rnd(5, 8), d = rnd(c + 2, c + 4), e = rnd(2, 3);
      const sq = a * a;
      const divRes = F(-sq, -b);
      const absSq = Math.pow(Math.abs(c - d), 2);
      const cube = Math.pow(-e, 3);
      correct = divRes.add(absSq).sub(F(cube));
      stem = '\u2212' + a + supHTML(2) + ' ÷ (\u2212' + b + ') + |' + c + ' − ' + d + '|' + supHTML(2) +
        ' − (\u2212' + e + ')' + supHTML(3);
      const e1 = F(a * a).div(-b).add(absSq).sub(cube);
      const e2 = divRes.sub(absSq).sub(cube);
      const e3 = divRes.add(absSq).add(F(e * e * e));
      wrongs = [e1, e2, e3];
      explain = step('\u2212' + a + supHTML(2) + ' = \u2212' + sq + '（先平方再取负）')
        + step('\u2212' + sq + ' ÷ (\u2212' + b + ') = <b>' + fmtFrac(divRes) + '</b>')
        + step('|' + c + ' − ' + d + '|' + supHTML(2) + ' = <b>' + absSq + '</b>')
        + step('(\u2212' + e + ')' + supHTML(3) + ' = <b>' + cube + '</b>')
        + step(fmtFrac(divRes) + ' + ' + absSq + ' − (' + cube + ') = <b>' + fmtFrac(correct) + '</b>');
    }

    function divAsFrac(n, d) { const g = gcd(n, d); return F(n / g, d / g); }

    const allWrongs = wrongs.filter(function (w) { return w !== null && w !== undefined; });
    const c = makeChoices(correct, allWrongs, function (v) {
      return Frac.from(v).d === 1 ? String(Frac.from(v).n) : fmtFrac(Frac.from(v));
    }, { valid: function () { return true; }, key: function (v) { return Frac.from(v).text(); } });
    return { tag: '有理数混合', stem: stem, choices: c.choices, answer: c.answer,
      explain: explain, check: [correct.text(), correct.text()] };
  });

  /* ============================================================
   * 八阶：解一元二次方程 ax² + bx + c = 0
   * ============================================================ */
  register(8, function () {
    const T = pick([1, 2, 3, 4]);

    /* 返回值：{ tag, stem, choices, answer, explain, check } */
    if (T === 1) {
      /* 因式分解型 (x−p)(x−q)=0 */
      let p = rnd(-6, 6), q = rnd(-6, 6);
      if (p === q) q = q + pick([1, -1]);
      if (p === 0) p = 1; if (q === 0) q = -1;
      const b = -(p + q), c = p * q;
      const stem = 'x' + supHTML(2) + (b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)) + 'x' +
        (c >= 0 ? ' + ' + c : ' − ' + Math.abs(c)) + ' = 0';
      const tag = '因式分解法';
      const ans = { roots: [Math.min(p, q), Math.max(p, q)], count: 2 };
      return makeQuadQ(tag, stem, ans, p, q, b, c);
    } else if (T === 2) {
      /* 完全平方 (x+n)² = k */
      const n = pick([1, 2, 3, -1, -2, -3, 4, 5, -4]);
      const k = pick([1, 4, 9, 16, 25]);
      const b = 2 * n, c = n * n - k;
      const stem = 'x' + supHTML(2) + (b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)) + 'x' +
        (c >= 0 ? ' + ' + c : ' − ' + Math.abs(c)) + ' = 0';
      const tag = '配方法';
      const roots = [n - Math.sqrt(k), n + Math.sqrt(k)];
      const ans = { roots: roots, count: 2 };
      return makeQuadQ(tag, stem, ans, n, k, b, c, 'square');
    } else if (T === 3) {
      /* 公式法（有理根，判别式为完全平方） */
      const a = pick([1, 1, 2, 3]), p = rnd(-5, 5), q = pick([1, 4]);
      const b = -2 * p * a, c = a * (p * p - q);
      const stem = (a === 1 ? '' : a) + 'x' + supHTML(2) + (b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)) +
        'x' + (c >= 0 ? ' + ' + c : ' − ' + Math.abs(c)) + ' = 0';
      const tag = '公式法';
      const roots = [F(p, 1).sub(F(Math.sqrt(q), a)), F(p, 1).add(F(Math.sqrt(q), a))];
      return makeQuadGenQ(tag, stem, roots, a, b, c, p, q);
    } else {
      /* 无实数根 */
      const a = pick([1, 2]), p = rnd(-3, 3);
      const m = pick([1, 2, 3, 5]);
      const b = -2 * p * a, c = a * (p * p + m);
      const stem = (a === 1 ? '' : a) + 'x' + supHTML(2) + (b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)) +
        'x' + (c >= 0 ? ' + ' + c : ' − ' + Math.abs(c)) + ' = 0';
      const tag = '无实数根';
      const discriminant = b * b - 4 * a * c;
      const ans = { roots: null, count: 0 };
      explain = step('\u0394 = ' + b + supHTML(2) + ' − 4 × ' + a + ' × ' + c + ' = ' + discriminant + ' < 0')
        + step('因为 \u0394 < 0，所以方程<b>无实数根</b>。')
        + tip('判别式小于 0 时二次函数图像在 x 轴上方（或下方）不与 x 轴相交。');
      const wrongs = [
        'x\u2081 = 1，x\u2082 = 2',
        'x = ' + (-b / (2 * a)),
        'x\u2081 = ' + (-b + Math.sqrt(-discriminant)) / (2 * a) + '，x\u2082 = ' + (-b - Math.sqrt(-discriminant)) / (2 * a),
        'x = ' + (b / (2 * a)),
        '无数个实数根'
      ];
      const c2 = makeChoices('\u65E0\u5B9E\u6570\u6839', wrongs,
        function (v) { return v; });
      return { tag: tag, stem: stem, choices: c2.choices, answer: c2.answer,
        explain: explain, check: ['noRealRoot', 'noRealRoot'] };
    }
  });

  /* 因式分解 / 配方法 的有理根题 */
  function makeQuadQ(tag, stem, ans, p, q, b, c, mode) {
    const isSquare = mode === 'square';
    const roots = ans.roots;
    let correct;
    if (isSquare) {
      correct = 'x\u2081 = ' + minus(roots[0]) + '，x\u2082 = ' + minus(roots[1]);
    } else {
      correct = 'x\u2081 = ' + minus(Math.min(p, q)) + '，x\u2082 = ' + minus(Math.max(p, q));
    }
    const wrongs = [
      'x\u2081 = ' + minus(Math.abs(roots[0])) + '，x\u2082 = ' + minus(-Math.abs(roots[0])),
      'x\u2081 = ' + minus(roots[0]) + '，x\u2082 = ' + minus(-roots[1]),
      'x = ' + minus(Math.round(roots[0] + roots[1])),
      'x\u2081 = ' + minus(-p) + '，x\u2082 = ' + minus(-q),
      'x\u2081 = ' + minus(Math.min(p, q)) + '，x\u2082 = ' + minus(Math.min(p, q)),
      'x\u2081 = ' + minus(Math.min(p, q) - 1) + '，x\u2082 = ' + minus(Math.min(p, q) + 1)
    ];
    const choicesObj = makeChoices(correct, wrongs, function (v) { return v; });
    let explain;
    if (isSquare) {
      const n2 = b / 2;
      explain = step('配方：x' + supHTML(2) + ' + ' + b + 'x + ' + (n2 * n2) + ' = ' + (n2 * n2 - c))
        + step('(x + ' + n2 + ')' + supHTML(2) + ' = ' + (n2 * n2 - c) + '，开平方得两根。')
        + step('x = <b>' + minus(roots[0]) + '</b> 或 x = <b>' + minus(roots[1]) + '</b>');
    } else {
      explain = step('因式分解：(x ' + (p >= 0 ? '\u2212 ' + p : '+ ' + Math.abs(p)) + ')(x ' +
        (q >= 0 ? '\u2212 ' + q : '+ ' + Math.abs(q)) + ') = 0')
        + step('由零因子定理：x = <b>' + minus(Math.min(p, q)) + '</b> 或 x = <b>' + minus(Math.max(p, q)) + '</b>');
    }
    return { tag: tag, stem: stem, choices: choicesObj.choices, answer: choicesObj.answer,
      explain: explain, check: [correct, correct] };
  }

  /* 公式法（无理根）题 */
  function makeQuadGenQ(tag, stem, roots, a, b, c, p, q) {
    const [s1, s2] = simplifySqrt(Frac.from(roots[0]).val());
    const [s2a, s2b] = simplifySqrt(Frac.from(roots[1]).val());
    let correct;
    /* 格式化 x = p ± √q/a */
    if (a === 1) {
      correct = 'x = ' + minus(p) + ' ± ' + sqrtHTML(q);
    } else {
      const [ks, ms] = sqrtSimplify(q);
      if (ks === 1) {
        correct = 'x = ' + minus(p) + ' ± ' + fracHTML(sqrtHTML(q), a);
      } else {
        correct = 'x = ' + minus(p) + ' ± ' + fracHTML(surdHTML(ks, ms), a);
      }
    }
    const wrongs = [
      'x = ' + minus(p) + ' ± ' + (a === 1 ? sqrtHTML(q) : fracHTML(sqrtHTML(q), a)) + '（√内不变）',
      'x = ' + minus(-p) + ' ± ' + (a === 1 ? sqrtHTML(q) : fracHTML(sqrtHTML(q), a)),
      'x = ' + minus(p) + ' ± ' + sqrtHTML(q) + '/' + a,
      'x = ' + minus(Math.round(p + Math.sqrt(q))) + '，x = ' + minus(Math.round(p - Math.sqrt(q))),
      'x = ' + minus(p) + ' ± ' + q
    ].map(cleanRootStr);
    function cleanRootStr(s) { return s.replace(/√\(/g, '\u221A('); }
    const choicesObj2 = makeChoices(correct, wrongs, function (v) { return v; });
    const disc = b * b - 4 * a * c;
    const [kDisc, mDisc] = sqrtSimplify(disc);
    const explain = step('\u0394 = ' + b + supHTML(2) + ' − 4 × ' + a + ' × ' + c + ' = ' + disc +
      (mDisc > 1 ? ' = ' + surdHTML(kDisc, mDisc) : ''))
      + step('x = ' + fracHTML('\u2212' + b + ' ± ' + (mDisc > 1 ? surdHTML(kDisc, mDisc) : sqrtHTML(disc)), 2 * a))
      + step('化简得 x = <b>' + correct + '</b>')
      + tip('公式法步骤：先算 \u0394，再代入公式，最后化简根号。');
    return { tag: tag, stem: stem, choices: choicesObj2.choices, answer: choicesObj2.answer,
      explain: explain, check: [roots[0].text() + '|' + roots[1].text(), b + '|' + a + '|' + c] };
  }

  function simplifySqrt(v) {
    /* 把 v（数字）拆成 p ± k√m 的形式，返回 [p, k, m] */
    return [v]; /* 简化，实际用分数表示的根已经在 roots 里 */
  }

  /* ============================================================
   * 九阶：中考混合计算题
   * ============================================================ */
  register(9, function () {
    const T = pick([1, 2, 3, 4, 5, 6]);
    let stem, correct, wrongs, explain, tag;

    if (T === 1) {
      /* |−a| + (π − 3)⁰ − (b/c)⁻¹ */
      const a = pick([2, 3, 4, 5]), b = pick([2, 3]), c = pick([3, 4, 5]);
      if (b === c) { b = b === 2 ? 3 : 2; }
      const cb = F(c, b);
      correct = F(a, 1).add(F(1, 1)).sub(cb);
      stem = '|\u2212' + a + '| + (\u03C0 − 3)' + supHTML(0) + ' − (' + fracHTML(b, c) + ')' + supHTML('\u22121');
      const e1 = F(a, 1).add(F(1, 1)).add(cb);
      const e2 = F(a, 1).add(F(0, 1)).sub(cb);
      const e3 = F(a, 1).add(F(1, 1)).sub(F(b, c));
      const e4 = F(-a, 1).add(F(1, 1)).sub(F(b, c));
      wrongs = [e1, e2, e3, e4];
      explain = step('|\u2212' + a + '| = <b>' + a + '</b>　（绝对值一定是非负数）')
        + step('(\u03C0 − 3)' + supHTML(0) + ' = <b>1</b>　（任何非零数的零次幂 = 1）')
        + step('(' + fracHTML(b, c) + ')' + supHTML('\u22121') + ' = ' + fmtFrac(cb) +
          '　（负指数 = 取倒数）')
        + step(a + ' + 1 − ' + fmtFrac(cb) + ' = <b>' + fmtFrac(correct) + '</b>');
      tag = '实数运算';
    } else if (T === 2) {
      /* (−1)^n × |√a − b| + (b)⁻² */
      const n = pick([5, 7, 9]);
      const a = pick([4, 9, 16, 25, 36, 49]);
      const b = pick([3, 4, 5]);
      const sA = Math.sqrt(a);
      const absv = Math.abs(sA - b);
      correct = F(-1 * absv).add(F(1, b * b));
      stem = '(\u22121)' + supHTML(n) + ' × |' + sqrtHTML(a) + ' − ' + b + '| + ' + b + supHTML('\u22122');
      const e1 = F(absv).add(F(1, b * b)); // (-1)^n 忘了负号
      const e2 = F(-absv).sub(F(1, b * b)); // 负指数忘了取倒数
      const e3 = F(-(sA - b)).add(F(1, b * b)); // 绝对值忘了
      const e4 = F(-absv).add(F(-2)); // b⁻² 算错
      wrongs = [e1, e2, e3, e4, correct.neg()];
      explain = step('(\u22121)' + supHTML(n) + ' = <b>−1</b>　（奇数次幂还是 −1）')
        + step('|' + sqrtHTML(a) + ' − ' + b + '| = |' + decStr(sA) + ' − ' + b + '| = <b>' + decStr(absv) + '</b>')
        + step(b + supHTML('\u22122') + ' = ' + fracHTML(1, b * b))
        + step('\u2212' + decStr(absv) + ' + ' + fracHTML(1, b * b) + ' = <b>' + fmtFrac(correct) + '</b>');
      tag = '实数运算';
    } else if (T === 3) {
      /* 特殊角三角函数 */
      const angles = [
        { expr: 'sin 30°', val: F(1, 2) }, { expr: 'cos 60°', val: F(1, 2) },
        { expr: 'sin 45°', val: surd(0, F(1, 2), 2) }, { expr: 'cos 45°', val: surd(0, F(1, 2), 2) },
        { expr: 'tan 45°', val: 1 }, { expr: 'tan 60°', val: surd(0, 1, 3) },
        { expr: 'sin 60°', val: surd(0, F(1, 2), 3) }, { expr: 'cos 30°', val: surd(0, F(1, 2), 3) }
      ];
      const a1 = pick(angles), a2 = pick(angles.filter(function (x) { return x.expr !== a1.expr; }));
      const op = pick(['+', '\u2212']);
      const k1 = rnd(2, 4), k2 = rnd(2, 4);
      stem = k1 + a1.expr + ' ' + op + ' ' + k2 + a2.expr;
      const isS1 = typeof a1.val === 'object' && a1.val.m !== undefined;
      const isS2 = typeof a2.val === 'object' && a2.val.m !== undefined;
      if (!isS1 && !isS2) {
        /* 两个都是有理数，直接用分数算 */
        const v1 = Frac.from(a1.val), v2 = Frac.from(a2.val);
        const res = op === '+' ? F(k1).mul(v1).add(F(k2).mul(v2)) : F(k1).mul(v1).sub(F(k2).mul(v2));
        correct = res;
        wrongs = [res.add(F(1, 2)), res.sub(F(1, 2)), res.neg(),
          F(k1).mul(v1).sub(F(k2).mul(v2)).neg()];
        explain = step(a1.expr + ' = ' + fmtFrac(v1) + '，' + a2.expr + ' = ' + fmtFrac(v2))
          + step(k1 + ' × ' + fmtFrac(v1) + ' ' + op + ' ' + k2 + ' × ' + fmtFrac(v2) + ' = <b>' + fmtFrac(res) + '</b>');
      } else if (isS1 && isS2 && a1.val.m === a2.val.m) {
        /* 同类根式 */
        const v1 = a1.val, v2 = a2.val;
        const b1r = F(k1).mul(v1.b), b2r = F(k2).mul(v2.b);
        const bs = Frac.from(op === '+' ? b1r.add(b2r) : b1r.sub(b2r));
        correct = surd(0, bs, v1.m);
        wrongs = [
          surd(0, bs.add(F(1, 2)), v1.m),
          surd(0, bs.neg(), v1.m),
          surd(F(1, 1), bs, v1.m),
          surd(0, F(k1).add(F(k2)), v1.m)
        ];
        explain = step(a1.expr + ' = ' + surdFmt(v1) + '，' + a2.expr + ' = ' + surdFmt(v2))
          + step(k1 + ' × ' + surdFmt(v1) + ' ' + op + ' ' + k2 + ' × ' + surdFmt(v2) + ' = <b>' + surdFmt(correct) + '</b>');
      } else {
        /* 混搭：有理数 ± 无理数，不作为根式模板，回退为数值答案 */
        const v1 = typeof a1.val === 'number' ? a1.val : a1.val.b.val() * Math.sqrt(a1.val.m);
        const v2 = typeof a2.val === 'number' ? a2.val : a2.val.b.val() * Math.sqrt(a2.val.m);
        const raw = op === '+' ? k1 * v1 + k2 * v2 : k1 * v1 - k2 * v2;
        correct = raw;
        wrongs = [raw + 0.5, raw - 0.5, raw + 1, -raw, k1 * v1 * k2 * v2];
        explain = step(a1.expr + ' = ' + decStr(v1) + '，' + a2.expr + ' = ' + decStr(v2))
          + step(k1 + ' × ' + decStr(v1) + ' ' + op + ' ' + k2 + ' × ' + decStr(v2) + ' ≈ <b>' + decStr(raw) + '</b>');
      }
      tag = '三角函数';
    } else if (T === 4) {
      /* √(a²m) − |a − b| + a⁰ */
      const a = rnd(2, 4), m = pick([1, 4, 9]), b = rnd(a + 1, a + 5);
      const sa = Math.sqrt(a * a * m);
      correct = F(sa - Math.abs(a - b) + 1);
      stem = sqrtHTML(a + supHTML(2) + '\u00D7' + m) + ' − |' + a + ' − ' + b + '| + ' + a + supHTML(0);
      /* 干扰：√(a²m) 忘了化简 / 绝对值符号错误 */
      const e1 = F(a * m - Math.abs(a - b) + 1); // √(a²m) 写成 a×m
      const e2 = F(sa + (a - b) + 1); // 绝对值没起作用
      const e3 = F(a * Math.sqrt(m) + Math.abs(a - b) + 1); // 符号
      wrongs = [e1, e2, e3, correct.add(F(1, 1)), correct.sub(F(1, 1))];
      const [ks, ms] = sqrtSimplify(a * a * m);
      explain = step(sqrtHTML(a + supHTML(2) + '\u00D7' + m) + ' = ' + a + sqrtHTML(m) +
        ' = <b>' + surdHTML(ks, ms) + '</b>')
        + step('|' + a + ' − ' + b + '| = <b>' + Math.abs(a - b) + '</b>')
        + step(a + supHTML(0) + ' = <b>1</b>')
        + step(surdHTML(ks, ms) + ' − ' + Math.abs(a - b) + ' + 1 = <b>' + fmtFrac(correct) + '</b>');
      tag = '二次根式';
    } else if (T === 5) {
      /* (√a + √b)(√a − √b) + (−c)⁻²  → 平方差 */
      const squares = [4, 9, 16, 25, 36, 49];
      const a = pick(squares), b = pick(squares.filter(function (x) { return x !== a; }));
      if (!b) b = a === 4 ? 9 : 4;
      const c = pick([2, 3, 4, 5]);
      correct = F(a - b).add(F(1, c * c));
      stem = '(' + sqrtHTML(a) + ' + ' + sqrtHTML(b) + ')(' + sqrtHTML(a) + ' − ' + sqrtHTML(b) + ') + (\u2212' + c + ')' + supHTML('\u22122');
      const e1 = F(a + b).add(F(1, c * c)); // 平方和
      const e2 = F(a - b).sub(F(1, c * c)); // 负指数
      const e3 = F(Math.pow(a - b, 2)).add(F(1, c * c));
      wrongs = [e1, e2, e3, correct.add(F(1, 2)), correct.neg()];
      explain = step('平方差公式：(√a + √b)(√a − √b) = a − b = <b>' + (a - b) + '</b>')
        + step('(\u2212' + c + ')' + supHTML('\u22122') + ' = ' + fracHTML(1, c + supHTML(2)) + ' = ' + fracHTML(1, c * c))
        + step((a - b) + ' + ' + fracHTML(1, c * c) + ' = <b>' + fmtFrac(correct) + '</b>');
      tag = '平方差公式';
    } else {
      /* (√a)² − |−b³| ÷ (−c) + (d)⁻¹ */
      const a = pick([4, 9, 16, 25, 36, 49, 64, 81]), b = rnd(2, 3), c = rnd(2, 3), d = pick([2, 3, 4, 5]);
      const cubic = Math.pow(b, 3);
      correct = F(a).sub(F(cubic, -c)).add(F(1, d));
      stem = '(' + sqrtHTML(a) + ')' + supHTML(2) + ' − |\u2212' + cubic + '| ÷ (\u2212' + c + ') + ' + d + supHTML('\u22121');
      const e1 = F(a).sub(F(cubic, c)).add(F(1, d));
      const e2 = F(a * a).sub(F(cubic, -c)).add(F(1, d));
      const e3 = F(a).sub(F(cubic, -c)).add(F(-d));
      wrongs = [e1, e2, e3, correct.add(F(1, 1)), correct.neg()];
      explain = step('(' + sqrtHTML(a) + ')' + supHTML(2) + ' = <b>' + a + '</b>')
        + step('|\u2212' + b + supHTML(3) + '| = |\u2212' + cubic + '| = <b>' + cubic + '</b>')
        + step(cubic + ' ÷ (\u2212' + c + ') = <b>' + fmtFrac(F(cubic, -c)) + '</b>')
        + step(d + supHTML('\u22121') + ' = ' + fracHTML(1, d))
        + step(a + ' − ' + fmtFrac(F(cubic, -c)) + ' + ' + fracHTML(1, d) + ' = <b>' + fmtFrac(correct) + '</b>');
      tag = '综合运算';
    }

    /* 统一输出 */
    if (T === 3 && typeof correct !== 'object') {
      /* 三角函数模板可能返回数字 */
      correct = F(Math.round(correct * 1000), 1000);
    }
    return fmtOut(tag, stem, correct, wrongs, explain);
  });

  /* 九阶输出辅助 */
  function fmtOut(tag, stem, correct, wrongs, explain) {
    const format = function (v) {
      if (typeof v === 'number') {
        const f = F(Math.round(v * 10000), 10000);
        if (f.d <= 1000) return f.d === 1 ? String(f.n) : fmtFrac(f);
        /* 分数太丑，退化到 4 位小数 */
        const ds = Number(v).toFixed(4);
        return minus(ds.replace(/0+$/).replace(/\.$/));
      }
      if (v instanceof Frac) return fmtFrac(v);
      if (v && v.m !== undefined) return surdFmt(v);
      return String(v);
    };
    const c = makeChoices(correct, wrongs, format,
      { valid: function () { return true; },
        key: function (v) {
          if (v instanceof Frac) return v.text();
          if (v && v.m !== undefined) return surdText(v);
          return String(v);
        } });
    const checkVal = typeof correct === 'number' ? Number(correct).toFixed(4) :
      (correct instanceof Frac ? correct.text() :
        (correct && correct.m !== undefined ? surdText(correct) : String(correct)));
    return { tag: tag, stem: stem, choices: c.choices, answer: c.answer,
      explain: explain, check: [checkVal, checkVal] };
  }

})(typeof window !== 'undefined' ? window : globalThis);
