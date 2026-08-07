/* ============================================================
 * app.js —— 填空题版 · 九阶计算训练
 * 核心变更：选择题→填空题 · 20题/阶 · 刷新按钮
 * ============================================================ */
(function () {
  'use strict';
  var MK = window.MathKit, QB = window.QBank;

  /* ---------- 状态 ---------- */
  var state = {
    view: 'home',
    stage: 1,
    queue: [],
    idx: 0,
    answers: [],
    answered: false,
    startTime: 0,
    timerHandle: null,
    timerSec: 0,
    settings: loadSettings(),
    currentQuestion: null
  };

  /* ---------- 持久化 ---------- */
  var LS = { progress: 'ct_progress', wrongs: 'ct_wrongs', settings: 'ct_settings' };

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(LS.progress)) || {}; } catch (e) { return {}; }
  }
  function saveProgress(level, score, total) {
    var p = loadProgress();
    p[level] = p[level] || { total: 0, correct: 0, best: 0 };
    p[level].total += total;
    p[level].correct += score;
    p[level].best = Math.max(p[level].best, Math.round(score / total * 100));
    localStorage.setItem(LS.progress, JSON.stringify(p));
  }
  function bestScore(level) {
    var p = loadProgress();
    return (p[level] && p[level].best) || 0;
  }

  function loadWrongs() {
    try { return JSON.parse(localStorage.getItem(LS.wrongs)) || {}; } catch (e) { return {}; }
  }
  function saveWrong(level, q, userAns) {
    var w = loadWrongs();
    w[level] = w[level] || [];
    var k = q.stem.replace(/<[^>]+>/g, '');
    if (!w[level].some(function (x) { return x.stem.replace(/<[^>]+>/g, '') === k; })) {
      w[level].unshift({ stem: q.stem, correct: q.choices[q.answer], explain: q.explain, tag: q.tag, user: userAns });
      if (w[level].length > 100) w[level].pop();
    }
    localStorage.setItem(LS.wrongs, JSON.stringify(w));
  }
  function clearWrongs(level) {
    var w = loadWrongs();
    if (level) delete w[level]; else for (var k in w) delete w[k];
    localStorage.setItem(LS.wrongs, JSON.stringify(w));
  }

  function loadSettings() {
    var d = { count: 20, showExplain: true, timer: true, sound: true };
    try { var s = JSON.parse(localStorage.getItem(LS.settings)); if (s) Object.assign(d, s); } catch (e) { }
    return d;
  }
  function saveSettings() { localStorage.setItem(LS.settings, JSON.stringify(state.settings)); }

  /* ---------- 音效 ---------- */
  var audioCtx = null;
  function initAudio() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  }
  function playTone(freq, dur, type) {
    if (!state.settings.sound || !audioCtx) return;
    try {
      var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type || 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + dur);
    } catch (e) { }
  }
  function playCorrect() { playTone(880, .15); }
  function playWrong() { playTone(220, .3, 'sawtooth'); }

  /* ---------- 计时 ---------- */
  function startTimer() {
    if (!state.settings.timer) return;
    state.timerSec = 0; state.startTime = Date.now();
    clearInterval(state.timerHandle);
    state.timerHandle = setInterval(function () {
      state.timerSec = Math.floor((Date.now() - state.startTime) / 1000);
      updateTimerUI();
    }, 1000);
  }
  function stopTimer() { clearInterval(state.timerHandle); }
  function updateTimerUI() {
    var el = document.getElementById('timer-display');
    if (!el) return;
    var m = Math.floor(state.timerSec / 60), s = state.timerSec % 60;
    el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ============================================================
   * 答案验证核心——分阶智能匹配
   * ============================================================ */
  function getAnswerHint(level) {
    var hints = {
      1: '输入整数作答，如：15',
      2: '输入整数作答，如：384',
      3: '输入整数作答，如：25000000',
      4: '输入商和余数，整除只写商，如：305 或 305 余 7',
      5: '输入小数作答，如：3.14 或 0.5',
      6: '输入分数或小数，如：3/4 或 0.75',
      7: '输入分数或小数，如：−3/4 或 −0.75',
      8: '输入方程的解，如：x=3 或 x=2, x=−5，无实数根输入"无实数根"',
      9: '输入计算结果'
    };
    return hints[level] || '输入答案';
  }

  function getUserExpectedFormat(level) {
    return getAnswerHint(level);
  }

  function validateAnswer(input, q) {
    var level = q.level || state.stage;
    var raw = input.trim();
    if (!raw) return { correct: false, reason: '请输入答案' };

    var check = q.check;
    if (!check || check.length < 1) return { correct: false, reason: '题目数据异常' };

    switch (level) {
      case 1: case 2: case 3:
        return checkNumber(raw, parseFloat(check[0]));
      case 4:
        return checkDivision(raw, check);
      case 5:
        return checkNumber(raw, parseFloat(check[0]), 0.001);
      case 6: case 7:
        return checkFraction(raw, String(check[0]));
      case 8:
        return checkRoots(raw, check);
      case 9:
        return checkExpression(raw, check);
      default:
        return { correct: false, reason: '未知题型' };
    }
  }

  /* 数值比较 */
  function checkNumber(raw, target, tol) {
    if (tol === undefined) tol = 0.0001;
    var cleaned = raw.replace(/[,，\s]+/g, '').replace(/−/g, '-').replace(/[＋+]/g, '');
    var num = parseFloat(cleaned);
    if (isNaN(num)) return { correct: false, reason: '请输入数字' };
    if (Math.abs(num - target) < tol) return { correct: true };
    return { correct: false, reason: '答案不对，请重算' };
  }

  /* 除法：接受 "q 余 r" 或 "q" 或 "qr" */
  function checkDivision(raw, check) {
    var q = check[0], r = check[1], dividend = check[2], d = check[3];
    var cleaned = raw.replace(/[,，\s]+/g, ' ').replace(/−/g, '-').trim();
    // 尝试解析 "q 余 r" 格式
    var remMatch = cleaned.match(/^(\d+)\s*余\s*(\d+)\s*$/);
    if (remMatch) {
      var uq = parseInt(remMatch[1]), ur = parseInt(remMatch[2]);
      if (uq === q && ur === r) return { correct: true };
      if (uq === q) return { correct: false, reason: '商正确，但余数不对（应余 ' + r + '）' };
      return { correct: false, reason: '不对，请重算（商 ' + q + (r ? ' 余 ' + r : '') + '）' };
    }
    // 尝试纯数字
    var num = parseInt(cleaned);
    if (!isNaN(num)) {
      if (r === 0 && num === q) return { correct: true };
      if (num === q) return { correct: false, reason: '商正确，别忘记余数 ' + r };
    }
    return { correct: false, reason: '不对。请输入"商 余 余数"或"商"（整除时）' };
  }

  /* 分数/小数互认 */
  function checkFraction(raw, targetText) {
    var cleaned = raw.replace(/[,，\s]+/g, '').replace(/−/g, '-').replace(/[＋+]/g, '');
    // 尝试作为分数解析 "a/b"
    var fracMatch = cleaned.match(/^(-?\d+)\/(-?\d+)$/);
    var userVal = null;
    if (fracMatch) {
      userVal = parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
    } else {
      var num = parseFloat(cleaned);
      if (!isNaN(num)) userVal = num;
    }
    if (userVal === null) return { correct: false, reason: '请输入分数（如 3/4）或小数' };
    // 解析 target
    var targetVal = targetText.indexOf('/') >= 0 ?
      (function () { var p = targetText.split('/'); return parseFloat(p[0]) / parseFloat(p[1]); })() :
      parseFloat(targetText);
    if (isNaN(targetVal)) targetVal = parseFloat(targetText);
    if (Math.abs(userVal - targetVal) < 0.0001) return { correct: true };
    if (Math.abs(userVal + targetVal) < 0.0001 && targetVal !== 0)
      return { correct: false, reason: '符号错了，检查正负号' };
    return { correct: false, reason: '答案不对' };
  }

  /* 方程根 */
  function checkRoots(raw, check) {
    var ch0 = String(check[0]);
    if (ch0 === 'noRealRoot') {
      var n = raw.replace(/[,，\s]+/g, '');
      if (n === '无实数根' || n === '无实根' || n === 'wushishugen' || n === 'none') return { correct: true };
      return { correct: false, reason: '此题无实数根' };
    }
    // 从 check[0] 提取两根
    var parts = ch0.split('|');
    var roots = [];
    if (parts.length === 2) {
      // 分数形式 "a/b|c/d" 或数值
      function parseRoot(s) {
        if (s.indexOf('/') >= 0) { var p = s.split('/'); return parseFloat(p[0]) / parseFloat(p[1]); }
        return parseFloat(s);
      }
      // Check if it's fraction roots from makeQuadGenQ
      // Or string roots from makeQuadQ
      roots = parts.map(parseRoot);
    } else {
      // String answer from makeQuadQ: "x₁ = 2，x₂ = 3" format
      var nums = ch0.match(/(-?[\d]+(?:\/\d+)?)/g);
      if (nums) roots = nums.map(function (v) {
        if (v.indexOf('/') >= 0) { var p2 = v.split('/'); return parseFloat(p2[0]) / parseFloat(p2[1]); }
        return parseFloat(v);
      });
    }
    if (roots.length < 2) return { correct: false, reason: '无法解析正确答案' };
    roots.sort(function (a, b) { return a - b; });

    // 解析用户输入
    var cleaned = raw.replace(/[，,;\s]+/g, ',').replace(/[xXＸx]=?/g, '').replace(/[（）()]/g, '').replace(/−/g, '-');
    var userNums = [];
    var userParts = cleaned.split(',');
    for (var i = 0; i < userParts.length; i++) {
      var up = userParts[i].trim();
      if (!up) continue;
      if (up.indexOf('/') >= 0) {
        var pp = up.split('/');
        userNums.push(parseFloat(pp[0]) / parseFloat(pp[1]));
      } else {
        var nv = parseFloat(up);
        if (!isNaN(nv)) userNums.push(nv);
      }
    }
    if (userNums.length < 2) {
      // 可能只输入了一个根
      if (userNums.length === 1 && roots.length === 2 && Math.abs(roots[0] - roots[1]) < 0.0001) {
        // 重根
        if (Math.abs(userNums[0] - roots[0]) < 0.0001) return { correct: true };
      }
      return { correct: false, reason: '一元二次方程有两个解，请用逗号分隔' };
    }
    userNums.sort(function (a, b) { return a - b; });
    if (userNums.length === roots.length) {
      var match = true;
      for (var j = 0; j < roots.length; j++) {
        if (Math.abs(userNums[j] - roots[j]) > 0.001) { match = false; break; }
      }
      if (match) return { correct: true };
    }
    return { correct: false, reason: '解不对，请检查' };
  }

  /* 中考表达式 */
  function checkExpression(raw, check) {
    var ch0 = String(check[0]);
    var cleaned = raw.replace(/[,，\s]+/g, '').replace(/−/g, '-').replace(/[＋+]/g, '');
    // 尝试数值比较
    var targetNum = null;
    if (ch0.indexOf('/') >= 0) {
      var p = ch0.split('/');
      if (p.length === 2) { var tn = parseFloat(p[0]) / parseFloat(p[1]); if (!isNaN(tn)) targetNum = tn; }
    }
    if (targetNum === null) targetNum = parseFloat(ch0);
    if (!isNaN(targetNum)) {
      var userNum = parseFloat(cleaned);
      if (!isNaN(userNum) && Math.abs(userNum - targetNum) < 0.01) return { correct: true };
      // 也试分数
      var fm2 = cleaned.match(/^(-?\d+)\/(-?\d+)$/);
      if (fm2) {
        var uv = parseFloat(fm2[1]) / parseFloat(fm2[2]);
        if (Math.abs(uv - targetNum) < 0.01) return { correct: true };
      }
      return { correct: false, reason: '不对，正确值是 ' + ch0 };
    }
    // 字符串比较
    if (cleaned === ch0) return { correct: true };
    return { correct: false, reason: '不对，正确结果是 ' + ch0 };
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  var app = document.getElementById('app');

  function render(view) {
    state.view = view;
    switch (view) {
      case 'home': renderHome(); break;
      case 'quiz': renderQuiz(); break;
      case 'wrongBook': renderWrongBook(); break;
      case 'settings': renderSettings(); break;
    }
    window.scrollTo(0, 0);
  }

  /* ======== 首页 ======== */
  function renderHome() {
    stopTimer();
    var stages = QB.STAGES;
    var cards = '';
    stages.forEach(function (s) {
      var bs = bestScore(s.id), starsHtml = '';
      if (bs >= 95) starsHtml = '\u2605\u2605\u2605';
      else if (bs >= 80) starsHtml = '\u2605\u2605\u2606';
      else if (bs >= 60) starsHtml = '\u2605\u2606\u2606';
      cards += '<div class="stage-card" style="border-left-color:' + s.color + '" data-stage="' + s.id + '">' +
        '<div class="stage-icon" style="color:' + s.color + '">' + s.icon + '</div>' +
        '<div class="stage-name">' + s.name + '</div>' +
        '<div class="stage-grade">' + s.grade + '</div>' +
        '<div class="stage-desc">' + s.desc + '</div>' +
        '<div class="stage-star">' + (starsHtml || '尚未练习') + '</div></div>';
    });
    app.innerHTML =
      '<div class="hdr">' +
        '<div style="position:absolute;top:12px;right:12px;display:flex;gap:6px;z-index:1">' +
          '<button class="btn-glass btn-sm" id="btnWrongBook">错题本</button>' +
          '<button class="btn-glass btn-sm" id="btnSettings">设置</button>' +
        '</div>' +
        '<h1>🧮 计算专项训练</h1>' +
        '<p class="sub">填空作答 · 每阶20题 · 9阶分阶训练</p>' +
      '</div>' +
      '<div class="stage-grid">' + cards + '</div>';
    document.querySelectorAll('.stage-card').forEach(function (el) {
      el.addEventListener('click', function () { startQuiz(parseInt(this.dataset.stage)); });
    });
    document.getElementById('btnWrongBook').addEventListener('click', function () { render('wrongBook'); });
    document.getElementById('btnSettings').addEventListener('click', function () { render('settings'); });
  }

  /* ======== 开始一轮 ======== */
  function startQuiz(stage) {
    state.stage = stage;
    try {
      state.queue = QB.makeSet(stage, state.settings.count);
    } catch (e) {
      alert('生成题目失败，请重试。' + e.message); return;
    }
    if (state.queue.length === 0) { alert('生成题目失败，请重试。'); return; }
    state.idx = 0;
    state.answers = [];
    state.answered = false;
    state.timerSec = 0;
    initAudio();
    render('quiz');
    startTimer();
  }

  /* 刷新本轮 */
  function refreshQuiz() {
    startQuiz(state.stage);
  }

  /* ======== 填空答题页 ======== */
  function renderQuiz() {
    var q = state.queue[state.idx];
    state.currentQuestion = q;
    state.answered = false;
    var total = state.queue.length;
    var pct = Math.round(state.idx / total * 100);
    var hint = getAnswerHint(state.stage);
    app.innerHTML =
      '<div class="quiz-topbar">' +
      '<div class="meta"><strong>第 ' + state.stage + ' 阶</strong> · ' + (q.tag || '') + '</div>' +
      '<div class="meta">' + (state.idx + 1) + ' / ' + total +
      (state.settings.timer ? ' · ⏱ <span id="timer-display">0:00</span>' : '') +
      '</div></div>' +
      '<div class="progress-bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
      '<div class="q-page" id="qPage">' +
      '<div class="q-tag">' + (q.tag || '') + '</div>' +
      '<div class="q-stem" id="qStem">' + q.stem + '</div>' +
      '<div class="answer-area" id="answerArea">' +
      '<label class="fill-label" for="fillInput">你的答案：<span class="fill-hint">' + hint + '</span></label>' +
      '<div class="fill-row">' +
      '<input type="text" id="fillInput" class="fill-input" placeholder="在此输入答案…" autocomplete="off">' +
      '<button class="btn btn-primary fill-btn" id="btnSubmit">确认</button>' +
      '</div>' +
      '<div class="fill-feedback" id="fillFeedback"></div>' +
      '</div>' +
      '<div class="explain-box" id="explain">' +
      '<div class="ex-title">解析</div>' + q.explain + '</div>' +
      '<div class="next-area" id="nextArea">' +
      '<button class="btn btn-primary" id="btnNext">' +
      (state.idx + 1 >= total ? '查看结果' : '下一题 →') +
      '</button>' +
      '<button class="btn btn-ghost btn-sm" id="btnRefresh" style="margin-left:8px">🔄 刷新题目</button>' +
      '</div>' +
      '</div>';
    bindQuizEvents();
    updateTimerUI();
    setTimeout(function () { var inp = document.getElementById('fillInput'); if (inp) inp.focus(); }, 100);
  }

  function bindQuizEvents() {
    var input = document.getElementById('fillInput');
    var btn = document.getElementById('btnSubmit');
    btn.addEventListener('click', submitAnswer);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
    });
  }

  function submitAnswer() {
    if (state.answered) return;
    var input = document.getElementById('fillInput');
    var userAns = input.value;
    var q = state.queue[state.idx];
    var result = validateAnswer(userAns, q);
    state.answered = true;
    var elapsed = state.timerSec;
    state.answers.push({ idx: state.idx, correct: result.correct, userAns: userAns, time: elapsed });

    if (result.correct) playCorrect(); else playWrong();

    // 显示结果
    var fb = document.getElementById('fillFeedback');
    if (result.correct) {
      fb.className = 'fill-feedback fb-ok';
      fb.innerHTML = '✅ 回答正确！';
    } else {
      fb.className = 'fill-feedback fb-err';
      var correctDisp = q.choices[q.answer];
      fb.innerHTML = '❌ ' + result.reason + '<br><span class="fb-correct">正确答案：<b>' + correctDisp + '</b></span>';
    }

    // 禁用输入
    input.disabled = true;
    document.getElementById('btnSubmit').disabled = true;

    // 显示解析
    if (state.settings.showExplain) {
      document.getElementById('explain').classList.add('show');
    }
    document.getElementById('nextArea').classList.add('show');
    document.getElementById('btnNext').addEventListener('click', nextQuestion);
    document.getElementById('btnRefresh').addEventListener('click', refreshQuiz);

    // 错题入库
    if (!result.correct) saveWrong(state.stage, q, userAns);

    document.addEventListener('keydown', onQuizKey2);
  }

  function nextQuestion() {
    document.removeEventListener('keydown', onQuizKey2);
    state.idx++;
    if (state.idx >= state.queue.length) {
      stopTimer(); showResult();
    } else {
      renderQuiz();
    }
  }

  function onQuizKey2(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextQuestion(); }
  }

  /* ======== 结果页 ======== */
  function showResult() {
    var total = state.answers.length;
    var score = state.answers.filter(function (a) { return a.correct; }).length;
    var pct = Math.round(score / total * 100);
    var stars = pct >= 95 ? 3 : (pct >= 80 ? 2 : (pct >= 60 ? 1 : 0));
    saveProgress(state.stage, score, total);

    var color = pct >= 80 ? '#22c55e' : (pct >= 60 ? '#f59e0b' : '#ef4444');
    var starsHtml = '';
    for (var i = 0; i < 3; i++) starsHtml += i < stars ? '\u2605' : '\u2606';
    var elapsed = state.timerSec, min = Math.floor(elapsed / 60), sec = elapsed % 60;

    var wrongListHtml = '';
    state.answers.forEach(function (a, ai) {
      if (a.correct) return;
      var q = state.queue[a.idx];
      wrongListHtml += '<div class="wrong-item">' +
        '<div class="wi-q"><strong>' + (ai + 1) + '.</strong> ' + q.stem + '</div>' +
        '<div class="wi-a">你的答案：<span class="red">' + esc(a.userAns || '') + '</span>' +
        '　正确答案：<b>' + q.choices[q.answer] + '</b></div>' +
        '<div class="wi-a">' + q.explain + '</div></div>';
    });
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    app.innerHTML =
      '<div class="result-card">' +
      '<div class="score-ring" style="background:' + color + '">' + pct + '%</div>' +
      '<div class="stars">' + starsHtml + '</div>' +
      '<div style="font-size:.9rem;color:var(--text2);margin-bottom:16px">' +
      '第 ' + state.stage + ' 阶 · ' + QB.STAGES[state.stage - 1].name + '</div>' +
      '<div class="stats-row">' +
      '<div class="stat-item"><div class="stat-num">' + total + '</div><div class="stat-label">总题数</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + score + '</div><div class="stat-label">正确</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + (total - score) + '</div><div class="stat-label">错误</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + min + ':' + (sec < 10 ? '0' : '') + sec + '</div><div class="stat-label">用时</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<button class="btn btn-primary" id="btnRetry">再练一次</button>' +
      '<button class="btn btn-outline" id="btnRefresh2">🔄 刷新题目</button>' +
      '<button class="btn btn-outline" id="btnHome">返回首页</button>' +
      '</div></div>' +
      (wrongListHtml ? '<div class="wrong-list"><h2 style="margin:0 0 12px;font-size:1rem">错题回顾</h2>' + wrongListHtml + '</div>' : '');
    document.getElementById('btnRetry').addEventListener('click', function () { startQuiz(state.stage); });
    document.getElementById('btnRefresh2').addEventListener('click', function () { startQuiz(state.stage); });
    document.getElementById('btnHome').addEventListener('click', function () { render('home'); });
  }

  /* ======== 错题本 ======== */
  function renderWrongBook() {
    var w = loadWrongs(), stages = QB.STAGES;
    var html = '<div class="hdr">' +
      '<div style="position:absolute;top:12px;right:12px;z-index:1"><button class="btn-glass btn-sm" onclick="render(&apos;home&apos;)">← 首页</button></div>' +
      '<h1>📒 错题本</h1>' +
      '<p class="sub">每阶最多保存 100 题</p>' +
    '</div>' +
      '<div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" id="btnClearAll">清空全部</button>' +
      '<button class="btn btn-outline btn-sm" id="btnBackHome">返回</button></div></div>';
    var hasAny = false;
    stages.forEach(function (s) {
      var items = w[s.id]; if (!items || !items.length) return;
      hasAny = true;
      html += '<h2 style="margin:16px 0 8px;font-size:1rem;color:' + s.color + '">第 ' + s.id + ' 阶 ' + s.name +
        ' <span style="font-size:.75rem;color:var(--text2);margin-left:8px">' + items.length + ' 题</span>' +
        ' <button class="btn btn-ghost btn-sm clear-level" data-level="' + s.id + '">清空本阶</button></h2>';
      items.forEach(function (item, i) {
        html += '<div class="wrong-item">' +
          '<div class="wi-q"><strong>' + (i + 1) + '.</strong> <span style="font-size:.72rem;color:var(--text2)">[' + (item.tag || '') + ']</span> ' + item.stem + '</div>' +
          (item.user ? '<div class="wi-a">你的答案：<span class="red">' + esc(String(item.user)) + '</span></div>' : '') +
          '<div class="wi-a">正确答案：<b>' + item.correct + '</b></div>' +
          '<div class="wi-a">' + (item.explain || '') + '</div></div>';
      });
    });
    if (!hasAny) html += '<div class="empty-state"><div class="icon">✓</div><p>暂无错题，太棒了！</p></div>';
    app.innerHTML = html;
    document.getElementById('btnBackHome').addEventListener('click', function () { render('home'); });
    var btnCA = document.getElementById('btnClearAll');
    if (btnCA) btnCA.addEventListener('click', function () { if (confirm('确定清空所有错题？')) { clearWrongs(); render('wrongBook'); } });
    document.querySelectorAll('.clear-level').forEach(function (btn) {
      btn.addEventListener('click', function () { clearWrongs(parseInt(this.dataset.level)); render('wrongBook'); });
    });
  }

  /* ======== 设置 ======== */
  function renderSettings() {
    var s = state.settings;
    app.innerHTML =
      '<div class="hdr">' +
        '<div style="position:absolute;top:12px;right:12px;z-index:1"><button class="btn-glass btn-sm" onclick="render(&apos;home&apos;)">← 首页</button></div>' +
        '<h1>⚙️ 设置</h1>' +
        '<p class="sub">个性化你的练习体验</p>' +
      '</div>' +
      '<button class="btn btn-outline btn-sm" id="btnBackHome">返回</button></div>' +
      '<div class="q-page" style="min-height:auto">' +
      '<div class="settings-row"><label class="settings-label">每组题数（默认20题）</label>' +
      '<select id="setCount">' +
      [4, 10, 20, 30, 50, 100].map(function (n) { return '<option value="' + n + '"' + (s.count === n ? ' selected' : '') + '>' + n + ' 题</option>'; }).join('') +
      '</select></div>' +
      '<div class="toggle-row"><label class="settings-label" style="margin-bottom:0;flex:1">答完后自动显示解析</label>' +
      '<label class="toggle"><input type="checkbox" id="setExplain"' + (s.showExplain ? ' checked' : '') + '><span class="track"><span class="knob"></span></span></label></div>' +
      '<div class="toggle-row"><label class="settings-label" style="margin-bottom:0;flex:1">计时模式</label>' +
      '<label class="toggle"><input type="checkbox" id="setTimer"' + (s.timer ? ' checked' : '') + '><span class="track"><span class="knob"></span></span></label></div>' +
      '<div class="toggle-row"><label class="settings-label" style="margin-bottom:0;flex:1">音效</label>' +
      '<label class="toggle"><input type="checkbox" id="setSound"' + (s.sound ? ' checked' : '') + '><span class="track"><span class="knob"></span></span></label></div>' +
      '<button class="btn btn-primary" id="btnSave" style="margin-top:16px">保存</button></div>';
    document.getElementById('btnBackHome').addEventListener('click', function () { render('home'); });
    document.getElementById('btnSave').addEventListener('click', function () {
      state.settings.count = parseInt(document.getElementById('setCount').value);
      state.settings.showExplain = document.getElementById('setExplain').checked;
      state.settings.timer = document.getElementById('setTimer').checked;
      state.settings.sound = document.getElementById('setSound').checked;
      saveSettings(); render('home');
    });
  }

  render('home');
})();
