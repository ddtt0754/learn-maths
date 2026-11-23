# -*- coding: utf-8 -*-
"""地图与题库对齐检查：MAPS 的册 id / 关卡数 vs qb 文件实际关卡"""
import io, os, re, json

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
html = io.open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

m = re.search(r"var MAPS=\[[\s\S]*?\n\];", html)
block = m.group(0)
ids = re.findall(r'id:"([0-9][ab])"', block)
print("MAPS 册数:", len(ids), ids)

# 每册关卡数：数每个 id 之后到下一个 id 之间的 name:" 个数
parts = re.split(r'id:"([0-9][ab])"', block)
counts = {}
for i in range(1, len(parts), 2):
    mid = parts[i]
    seg = parts[i + 1]
    counts[mid] = len(re.findall(r'name:"', seg)) - 1  # 减去册本身的 name
print("每册关卡数:", counts)
print("合计关卡:", sum(counts.values()))

# 题库文件
qdir = os.path.join(ROOT, "qb")
files = sorted(os.listdir(qdir))
print("\nqb 目录:", files)

total_q = 0
lv_total = 0
for f in files:
    if not f.endswith(".js"):
        continue
    txt = io.open(os.path.join(qdir, f), encoding="utf-8").read()
    keys = re.findall(r'QBANK\["([0-9][ab]-\d+)"\]=\[', txt)
    per = {}
    for k in keys:
        # 粗略数题：统计 {st: 出现次数
        seg = txt.split('QBANK["%s"]=[' % k)[1]
        seg = seg.split("];")[0]
        per[k] = seg.count("{st:")
    lv_total += len(keys)
    total_q += sum(per.values())
    mid = f[3:-3]
    exp = counts.get(mid, 0)
    flag = "OK" if len(keys) == exp else "!! 关卡数不符(index期望%d)" % exp
    print("  %-10s 关卡 %d 题量 %d  %s" % (f, len(keys), sum(per.values()), flag))
    bad = [k for k, v in per.items() if v != 101]
    if bad:
        print("     题量异常:", bad)

print("\n题库合计：关卡 %d / 题 %d" % (lv_total, total_q))

# 每册每关是否都有
missing = []
for mid, n in counts.items():
    if mid == "4a":
        pass
    for i in range(1, n + 1):
        key = "%s-%d" % (mid, i)
        found = any(
            key in io.open(os.path.join(qdir, f), encoding="utf-8").read()
            for f in files if f == "qb-%s.js" % mid
        )
        if not found:
            missing.append(key)
print("缺关:", missing if missing else "无")
