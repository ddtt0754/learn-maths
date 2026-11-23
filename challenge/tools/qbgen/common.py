# -*- coding: utf-8 -*-
"""豆豆数学闯关 · 题库生成器公共库

用途：按「单元题型」批量产出符合站点格式的题库（qb/qb-<册id>.js）。
约定（与 qb-4a.js 完全一致）：
  QBANK["<册><级>-<关序>"] = [ {st:难度1-5, q:"题干", a:[可接受答案...], e:"解析"} , ... ]
  每关 101 道：D1 29 / D2 26 / D3 23 / D4 20 / D5(BOSS) 3，同关题干不重复。
答案 a 为「可接受的等价写法」列表（如 15 与 十五），判题时前端会去掉空格/逗号/句号并统一全角。
"""
import json
import random
import re
from decimal import Decimal

QUOTA = {1: 29, 2: 26, 3: 23, 4: 20, 5: 3}
TIER_LABEL = {1: "D1", 2: "D2", 3: "D3", 4: "D4", 5: "D5(BOSS)"}


def _js(s):
    return json.dumps(str(s), ensure_ascii=False)


def _norm_key(s):
    return re.sub(r"[\s　]", "", s)


class Unit(object):
    """一个关卡（一个单元）的题目池。"""

    def __init__(self, key, name):
        self.key = key
        self.name = name
        self.pool = {1: [], 2: [], 3: [], 4: [], 5: []}
        self.seen = set()

    def add(self, st, q, a, e):
        if not isinstance(a, (list, tuple)):
            a = [a]
        a = [str(x) for x in a]
        k = _norm_key(q)
        if k in self.seen:
            return False
        if not a or not str(q).strip():
            raise ValueError("%s 空题或空答案：%r" % (self.key, q))
        self.seen.add(k)
        item = {"st": int(st), "q": str(q), "a": a, "e": str(e)}
        self.pool[int(st)].append(item)
        return True

    def count(self, st=None):
        if st is None:
            return sum(len(v) for v in self.pool.values())
        return len(self.pool[st])

    def build(self, seed=None):
        seed = seed if seed is not None else (hash(self.key) & 0xFFFF)
        rnd = random.Random(seed)
        out = []
        for st in (1, 2, 3, 4, 5):
            items = list(self.pool[st])
            rnd.shuffle(items)
            need = QUOTA[st]
            if len(items) < need:
                raise RuntimeError(
                    "%s（%s）D%d 库存不足：%d / %d" % (self.key, self.name, st, len(items), need)
                )
            out.extend(items[:need])
        return out


def write_bank(path, header_lines, units):
    """把多个 Unit 写成 qb-<册id>.js。units: [(key, Unit), ...]"""
    # 先统一体检，把所有缺口一次报全（否则要反复重跑）
    problems = []
    for key, unit in units:
        for st in (1, 2, 3, 4, 5):
            if len(unit.pool[st]) < QUOTA[st]:
                problems.append("%s（%s）D%d %d/%d" % (key, unit.name, st, len(unit.pool[st]), QUOTA[st]))
    if problems:
        raise RuntimeError("题库库存不足：\n  " + "\n  ".join(problems))
    buf = []
    for line in header_lines:
        buf.append(line)
    buf.append("")
    stat = []
    for key, unit in units:
        items = unit.build()
        stat.append("%s %d" % (key, len(items)))
        buf.append('QBANK["%s"]=[' % key)
        rows = []
        for it in items:
            row = " {st:%d,q:%s,a:[%s]" % (it["st"], _js(it["q"]), ",".join(_js(x) for x in it["a"]))
            if it["st"] == 5:
                row += ",boss:true"
            row += ",e:%s}" % _js(it["e"])
            rows.append(row)
        buf.append(",\n".join(rows))
        buf.append("];  /* 101 题：D1 29 / D2 26 / D3 23 / D4 20 / D5(BOSS) 3 */")
        buf.append("")
    text = "\n".join(buf).rstrip() + "\n"
    with open(path, "wb") as f:
        f.write(text.encode("utf-8"))
    return stat


# ---------------- 常用小工具 ----------------
def cn_num(n):
    """1-99 的中文数字（用于口诀题）。"""
    d = "零一二三四五六七八九"
    if n < 10:
        return d[n]
    if n < 20:
        return "十" + (d[n % 10] if n % 10 else "")
    return d[n // 10] + "十" + (d[n % 10] if n % 10 else "")


def fmt_num(n):
    """整数或一位/两位小数的最简写法。"""
    if isinstance(n, float):
        if abs(n - round(n)) < 1e-9:
            return str(int(round(n)))
        s = ("%.4f" % n).rstrip("0").rstrip(".")
        return s
    return str(n)


def frac(n, d):
    """n/d 化简后的写法；返回 (分子, 分母)。"""
    from math import gcd

    g = gcd(n, d)
    return n // g, d // g


def dstr(x):
    """Decimal / 数字 → 最简小数字符串（去掉末尾 0，不用科学计数法）。"""
    d = Decimal(str(x))
    d = d.normalize()
    if d == d.to_integral_value():
        return str(int(d))
    s = format(d, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def dec(a, b):
    """a×b 的精确小数结果字符串。"""
    return dstr(Decimal(str(a)) * Decimal(str(b)))


# ---------------- 代数式书写规范（防「+-4 / x--3 / 1x²」畸形拼接） ----------------
def co(v):
    """系数前缀：1→''，-1→'-'，2→'2'，-2→'-2'。"""
    v = int(v) if float(v).is_integer() else v
    if v == 1:
        return ""
    if v == -1:
        return "-"
    return fmt_num(v)


def lead(a, var):
    """首项（无前导正号）：'x²' / '-2x²' / '3x'。"""
    return co(a) + var


def mid(sv, var):
    """带符号的中间项：'+2x' / '-2x' / ''（sv=0）。"""
    if sv == 0:
        return ""
    return ("+" if sv > 0 else "-") + co(abs(sv)) + var


def tail(c):
    """带符号的常数项：'+3' / '-3' / ''（c=0）。"""
    if c == 0:
        return ""
    s = fmt_num(c)
    return s if str(s).startswith("-") else "+" + s


def par(h, var="x"):
    """完全平方式：(x-3) / (x+3) / x （h=0 时不加括号）。"""
    if h == 0:
        return var
    if h > 0:
        return "(%s-%s)" % (var, fmt_num(h))
    return "(%s+%s)" % (var, fmt_num(-h))


def quad(a, b, c, var="x"):
    """一般式 ax²+bx+c 的规范字符串，自动省略 1 系数与 0 项。"""
    s = lead(a, var + "²") + mid(b, var) + tail(c)
    if c == 0 and b == 0:
        s = lead(a, var + "²")
    return s


def vform(a, h, k, var="x"):
    """顶点式 y=a(x-h)²+k 的规范字符串。"""
    p = par(h, var)
    s = lead(a, p + "²") + tail(k)
    return s


def pr(v):
    """带符号的整数/小数：+3 / -3（用于坐标串）。"""
    s = fmt_num(v)
    return s if str(s).startswith("-") else "+" + s


def pt(x, y):
    """坐标串：(3,-4) / (-2,5)。"""
    return "(%s,%s)" % (fmt_num(x), fmt_num(y))
