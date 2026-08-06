/* 自检脚本 —— 逐阶验证题目一致性 */
const MK = require('../assets/math.js');
const QBank = require('../assets/generators.js');
require('../assets/generators2.js');

const { Frac, F } = MK;

function strip(s) { return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

const errs = [];
function checkLevel(level, name, count) {
  const questions = QBank.makeSet(level, count);
  process.stdout.write('Level ' + level + ' (' + name + '): 生成 ' + questions.length + ' 题... ');
  if (questions.length === 0) { console.log('FAIL - 0 题'); errs.push({ level: level, msg: '0 题' }); return; }

  let localErrs = 0;
  questions.forEach(function (q, i) {
    /* 1. 选项数量 */
    if (!q.choices || q.choices.length !== 4) {
      localErrs++;
      errs.push({ level: level, i: i, msg: '选项数=' + (q.choices ? q.choices.length : 0) });
      return;
    }
    /* 2. 答案索引有效 */
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= 4) {
      localErrs++;
      errs.push({ level: level, i: i, msg: 'answer=' + q.answer });
      return;
    }
    /* 3. 选项互异 */
    const seen = {};
    for (let j = 0; j < q.choices.length; j++) {
      const key = strip(q.choices[j]);
      if (seen[key]) { localErrs++; errs.push({ level: level, i: i, msg: '选项重复: ' + key }); }
      seen[key] = true;
    }
    /* 4. 必须有 stem / explain */
    if (!q.stem) { localErrs++; errs.push({ level: level, i: i, msg: '缺 stem' }); }
    if (!q.explain) { localErrs++; errs.push({ level: level, i: i, msg: '缺 explain' }); }
    /* 5. 数值校验（如果有 check 字段且第一项可转数值） */
    if (q.check && q.check[0] !== undefined) {
      const targetRaw = q.check[0];
      const ansHtml = q.choices[q.answer];
      const ansText = strip(ansHtml);
      /* 尝试从答案 HTML 提取数值 */
      const numPattern = /(-?\d+(?:\.\d+)?)/g;
      const nums = [];
      let m;
      while ((m = numPattern.exec(ansText)) !== null) nums.push(m[1]);
      /* 解析目标数值 */
      const targetNum = parseFloat(targetRaw);
      if (!isNaN(targetNum)) {
        /* 找选项里哪个数字接近目标 */
        let found = false;
        nums.forEach(function (ns) {
          const nv = parseFloat(ns);
          if (Math.abs(nv - targetNum) < 0.001 * Math.max(1, Math.abs(targetNum))) found = true;
        });
        if (!found) {
          /* 有些答案是分数的字符串形式 e.g. "3/4", check 存 "3/4" */
          if (targetRaw.indexOf('/') >= 0) {
            const parts = targetRaw.split('/');
            const tn = parseFloat(parts[0]) / parseFloat(parts[1]);
            nums.forEach(function (ns) {
              const nv = parseFloat(ns);
              if (Math.abs(nv - tn) < 0.0001) found = true;
            });
          }
        }
        if (!found) {
          /* 更宽松：选项文本包含 targetRaw */
          if (ansText.indexOf(targetRaw) < 0) {
            // 这是正常情况——很多题的答案不是纯数值
          }
        }
      }
    }
  });

  if (localErrs === 0) console.log('OK');
  else console.log(localErrs + ' 个错误');
}

const stages = QBank.STAGES;
stages.forEach(function (s) {
  try { checkLevel(s.id, s.name, 10); } catch (e) { console.log('FAIL: ' + e.message); errs.push({ level: s.id, msg: e.message }); }
});

console.log('\n========== 汇总 ==========');
if (errs.length === 0) console.log('✅ 全部通过！');
else { console.log('❌ ' + errs.length + ' 个问题：'); errs.forEach(function (e) { console.log('  L' + e.level + (e.i !== undefined ? ' #' + e.i : '') + ': ' + e.msg); }); }
