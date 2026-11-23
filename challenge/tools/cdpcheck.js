/* challenge 站真机验证 v3：解锁后测各册开局 + 关卡锁定态 */
const http = require("http");
const CDP = "http://127.0.0.1:9223";
const PAGE = "http://127.0.0.1:8848/index.html?cb=" + Date.now();

const get = (p) => new Promise((res, rej) => { http.get(p, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); }).on("error", rej); });

(async () => {
  const list = JSON.parse(await get(CDP + "/json/list"));
  const tgt = list.find((t) => t.type === "page");
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (m, p) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: PAGE });
  await new Promise((r) => setTimeout(r, 2600));

  async function ev(expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.result && r.result.exceptionDetails) return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 240) };
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  await ev(`(()=>{document.getElementById('inp-name').value='验证';joinGame();return 1;})()`);

  // 关卡列表锁定态（未解锁时）
  console.log("=== 关卡列表锁定态 ===", await ev(`(async()=>{
    const r={};
    for(const mid of ['2a','3a','5a','6a','7a','8a','9a']){
      pickMap(mid);
      const t0=Date.now(); while(!QBANK[mid+"-1"]&&Date.now()-t0<3000){await new Promise(z=>setTimeout(z,50));}
      const items=[].slice.call(document.querySelectorAll('#level-list .level-item'));
      r[mid]={总数:items.length, 锁定:items.filter(x=>x.classList.contains('locked')).length,
              可点:items.filter(x=>!x.classList.contains('locked')).length,
              首关名:(items[0]||{}).textContent};
    }
    pickMap('2b'); await new Promise(z=>setTimeout(z,400));
    r['2b_空提示']=(document.querySelector('#level-list .empty-tip')||{}).textContent||'无';
    return r;
  })()`));

  // 解锁 9a 前 5 关后进入 9a-5
  console.log("\n=== 9a-5（解锁后）开局 ===", await ev(`(async()=>{
    for(let i=1;i<=5;i++){ best['9a-'+i]={kda:60,stars:3,score:10}; }
    localStorage.setItem('ddmath_best_v3',JSON.stringify(best));
    pickMap('9a');
    const t0=Date.now(); while(!QBANK['9a-5']&&Date.now()-t0<3000){await new Promise(z=>setTimeout(z,50));}
    startRun('9a-5');
    await new Promise(z=>setTimeout(z,250));
    return {屏:document.querySelector('.screen.active').id,
            题干:document.getElementById('quiz-text').textContent.slice(0,80),
            标签:document.getElementById('quiz-tags').textContent,
            玩家:document.getElementById('quiz-player').textContent,
            计数:document.getElementById('quiz-count').textContent};
  })()`));

  // 各册首关真实开局（题干 + 星级）
  console.log("\n=== 各册首关开局 ===", await ev(`(async()=>{
    const r={};
    for(const mid of ['2a','3a','5a','6a','7a','8a','9a']){
      pickMap(mid);
      const t0=Date.now(); while(!QBANK[mid+"-1"]&&Date.now()-t0<3000){await new Promise(z=>setTimeout(z,50));}
      startRun(mid+'-1');
      await new Promise(z=>setTimeout(z,180));
      r[mid]={题:document.getElementById('quiz-text').textContent.slice(0,56),
              星:document.getElementById('quiz-tags').textContent.slice(0,10),
              在跑:!!run && run.lvlId===mid+'-1'};
    }
    return r;
  })()`));

  // BOSS 位实测：nextBand 在 idx=28（下一题即第 30 题）必须返回 5，且 bossPool 有 3 道
  console.log("\n=== BOSS 位实测 ===", await ev(`(async()=>{
    pickMap('5a');
    const t0=Date.now(); while(!QBANK['5a-1']&&Date.now()-t0<3000){await new Promise(z=>setTimeout(z,50));}
    startRun('5a-1');
    await new Promise(z=>setTimeout(z,150));
    const d5=QBANK['5a-1'].filter(q=>q.boss);
    run.idx=28;
    const nb=nextBand();
    run.idx=5;
    const nb2=nextBand();
    return {bossPool:run.bossPool.length, D5题库:d5.length, D5都带boss:d5.every(q=>q.boss),
            idx28_nextBand:nb, idx5_nextBand:nb2, BOSS样题:d5[0].q.slice(0,64), BOSS答案:d5[0].a.join('/')};
  })()`));

  ws.close(); process.exit(0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
