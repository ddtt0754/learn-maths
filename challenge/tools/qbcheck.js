/* 题库体检：结构 / 配额 / 重复 / 题干空数 / DDA 盲跑
 * 用法：node tools/qbcheck.js qb/qb-2a.js [qb/qb-3a.js ...] */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const QUOTA = { 1: 29, 2: 26, 3: 23, 4: 20, 5: 3 };
const QCOUNT = 30;
const DTIER_MAX = 4;

function load(file) {
  const sb = { QBANK: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(file, "utf8"), sb, { filename: file });
  return sb.QBANK;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let errors = 0;
let warns = 0;
const err = (m) => { console.log("  ✗ " + m); errors++; };
const warn = (m) => { console.log("  ! " + m); warns++; };

const files = process.argv.slice(2);
if (!files.length) {
  console.log("用法：node tools/qbcheck.js qb/qb-2a.js ...");
  process.exit(2);
}

for (const f of files) {
  const name = path.basename(f);
  console.log("\n== " + name + " ==");
  let bank;
  try {
    bank = load(f);
  } catch (e) {
    err("JS 语法/执行错误：" + e.message);
    continue;
  }
  const keys = Object.keys(bank);
  console.log("  关卡数：" + keys.length + "  " + keys.join(" "));
  for (const k of keys) {
    const qs = bank[k];
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const seen = new Set();
    let dup = 0, badA = 0, badE = 0, blankCnt = 0, blankZero = 0, bossFlag = 0;
    for (const q of qs) {
      if (!c[q.st] && q.st !== 0) { /* noop */ }
      if (!(q.st in c)) { err(k + " 出现非法难度 st=" + q.st); continue; }
      c[q.st]++;
      if (q.st === 5 && q.boss) bossFlag++;
      if (q.st === 5 && !q.boss) err(k + " D5 题缺 boss:true：" + q.q);
      if (q.st !== 5 && q.boss) err(k + " 非 D5 题带了 boss:true：" + q.q);
      if (seen.has(q.q)) dup++;
      seen.add(q.q);
      if (!Array.isArray(q.a) || !q.a.length || !String(q.a[0]).trim()) badA++;
      if (!q.e || !String(q.e).trim()) badE++;
      const n = (q.q.match(/（　）/g) || []).length;
      if (n > 1) { blankCnt++; warn(k + " 题干出现多个空：" + q.q); }
      if (n === 0) blankZero++;
      if (String(q.a[0]).indexOf("（　）") >= 0) err(k + " 答案里还带空：" + q.q);
      /* ---- 书写规范：防「+-4」「x--3」「1x²」畸形拼接 ---- */
      const fields = [["题干", q.q]].concat(q.a.map((v, j) => ["答案" + (j + 1), v])).concat([["解析", q.e || ""]]);
      for (const [fn, tx] of fields) {
        if (/\+-/.test(tx)) err(k + " " + fn + " 出现「+-」：" + q.q);
        if (/--(?![a-z])/.test(tx)) err(k + " " + fn + " 出现「--」：" + q.q);
        if (/(^|[\s=+\[,])1(?=[a-zA-Z(])/.test(tx)) err(k + " " + fn + " 系数 1 未省略：" + q.q);
        if (/[+\-]0(?![.\d])/.test(tx)) err(k + " " + fn + " 出现「+0/-0」：" + q.q);
        if (/\d\.\d*0(?![1-9])/.test(tx) && !/保留|约|精确|化简|末尾|添上|去掉|添一个|添上 0/.test(q.q))
          err(k + " " + fn + " 小数尾零：" + q.q);
      }
    }
    const total = qs.length;
    const okTier = [1, 2, 3, 4, 5].every((t) => c[t] === QUOTA[t]);
    if (total !== 101) err(k + " 题量 " + total + " ≠ 101");
    if (!okTier) err(k + " 档位配额不符：D1 " + c[1] + "/29 D2 " + c[2] + "/26 D3 " + c[3] + "/23 D4 " + c[4] + "/20 D5 " + c[5] + "/3");
    if (dup) err(k + " 题干重复 " + dup + " 条");
    if (badA) err(k + " 缺答案 " + badA + " 条");
    if (badE) err(k + " 缺解析 " + badE + " 条");
    if (blankZero) warn(k + " 无填空标记（选择/比较类，允许）" + blankZero + " 条");

    /* ---- DDA 盲跑：全对 / 全错 / 随机，各跑 1 次 ---- */
    for (const mode of ["allRight", "allWrong", "random"]) {
      const tiers = { 1: [], 2: [], 3: [], 4: [] };
      const bossPool = [];
      qs.forEach((q) => {
        if (q.boss) bossPool.push(q);
        else tiers[Math.min(DTIER_MAX, Math.max(1, q.st | 0))].push(q);
      });
      Object.keys(tiers).forEach((t) => shuffle(tiers[t]));
      let tier = 1, bias = 0, okStreak = 0, noStreak = 0;
      const used = new Set();
      const seq = [];
      let fail = "";
      for (let i = 0; i < QCOUNT; i++) {
        let q, t;
        if (i >= QCOUNT - 1) {
          q = bossPool[Math.floor(Math.random() * bossPool.length)];
          t = 5;
        } else {
          const band = Math.max(1, Math.min(DTIER_MAX, tier + bias));
          bias = 0;
          t = band;
          q = tiers[band].pop();
          if (!q) { fail = "第 " + (i + 1) + " 题 D" + band + " 题池见底（会触发重洗=同关重复）"; break; }
        }
        if (!q) { fail = "第 " + (i + 1) + " 题抽不到题"; break; }
        if (used.has(q)) { fail = "第 " + (i + 1) + " 题重复：" + q.q; break; }
        used.add(q);
        seq.push(t);
        tier = t;
        const correct = mode === "allRight" ? true : mode === "allWrong" ? false : Math.random() < 0.5;
        if (q.boss) continue;
        if (correct) { okStreak++; noStreak = 0; if (okStreak >= 3) { if (tier < DTIER_MAX) bias = 1; okStreak = 0; } }
        else { noStreak++; okStreak = 0; if (noStreak >= 2) { if (tier > 1) bias = -1; noStreak = 0; } }
      }
      if (fail) err(k + " [" + mode + "] " + fail);
      if (mode === "allRight" && seq.join(",") !== "1,1,1,2,2,2,3,3,3," + "4,".repeat(20) + "5") {
        err(k + " [allRight] 档位序列异常：" + seq.join(","));
      }
      if (mode === "allWrong" && seq.slice(0, 29).some((t) => t !== 1)) {
        err(k + " [allWrong] 应恒 D1，实际：" + seq.join(","));
      }
    }
  }
}

console.log("\n结果：错误 " + errors + " 项，提醒 " + warns + " 项");
process.exit(errors ? 1 : 0);
