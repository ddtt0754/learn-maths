/**
 * 豆豆智学· 数学闯关 · 局域网多人服务端（零依赖，Node 原生实现）
 * 功能：静态托管 index.html + 原生 WebSocket 广播通关榜
 * 启动：node server.js  然后局域网设备访问 http://<本机IP>:3311
 */
"use strict";
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

const PORT = 3311;
/* 首页文件：优先 index.html；兼容旧命名（文件改名后不断链） */
const INDEX_CANDIDATES = ["index.html", "豆豆数学闯关_四上通关大作战.html"];
const INDEX_FILE = INDEX_CANDIDATES.map((f) => path.join(__dirname, f))
  .find((p) => fs.existsSync(p)) || path.join(__dirname, INDEX_CANDIDATES[0]);
const OFFLINE_MS = 15000; // 15 秒无心跳视为离线

/* ---------------- WebSocket 客户端管理 ---------------- */
const clients = new Set();   // ws socket 集合
const players = new Map();   // id -> {id,name,level,score,kdaSum,best:{lvlId:kda},last}

function wsAccept(key) {
  return crypto.createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
}

function wsSend(socket, str) {
  const payload = Buffer.from(str, "utf8");
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x81; head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x81; head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([head, payload])); } catch (e) { /* 忽略写失败 */ }
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  clients.forEach((s) => wsSend(s, msg));
}

/* 解析客户端帧（支持分片与多帧粘包） */
function handleData(socket, bufRef) {
  const buf = bufRef.buffer;
  while (bufRef.pos + 2 <= buf.length) {
    const b0 = buf[bufRef.pos], b1 = buf[bufRef.pos + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = bufRef.pos + 2;
    if (len === 126) {
      if (off + 2 > buf.length) return;
      len = buf.readUInt16BE(off); off += 2;
    } else if (len === 127) {
      if (off + 8 > buf.length) return;
      const big = buf.readBigUInt64BE(off);
      if (big > 1048576n) { socket.destroy(); return; } // 1MB 上限防滥用
      len = Number(big); off += 8;
    }
    let maskKey = null;
    if (masked) {
      if (off + 4 > buf.length) return;
      maskKey = buf.subarray(off, off + 4); off += 4;
    }
    if (off + len > buf.length) return;
    let payload = buf.subarray(off, off + len);
    if (maskKey) {
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
    }
    bufRef.pos = off + len;

    if (opcode === 0x8) { // close
      try { socket.end(Buffer.from([0x88, 0x00])); } catch (e) {}
      return;
    } else if (opcode === 0x9) { // ping → pong
      try { socket.write(Buffer.from([0x8a, 0x00])); } catch (e) {}
      return;
    } else if (opcode === 0x1) {
      onMessage(socket, payload.toString("utf8"));
    }
  }
  bufRef.buffer = buf.subarray(bufRef.pos); // 丢弃已消费字节
  bufRef.pos = 0;
}

function onMessage(socket, text) {
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return; }
  if (msg.t === "ping") return; // 心跳即活跃

  if (msg.t === "join" && msg.id && msg.name) {
    if (!players.has(msg.id)) {
      players.set(msg.id, { id: msg.id, name: String(msg.name).slice(0, 8),
        level: "-", score: 0, kdaSum: 0, best: {}, done: 0, last: Date.now() });
    } else {
      players.get(msg.id).last = Date.now();
    }
  } else if (msg.t === "p" && msg.id && players.has(msg.id)) {
    const p = players.get(msg.id);
    p.last = Date.now();
    p.name = String(msg.name || p.name).slice(0, 8);
    p.level = msg.level || p.level;
    p.score = Number(msg.score) || 0;
    if (msg.best && typeof msg.best === "object") {
      p.best = msg.best;
      let sum = 0, done = 0;
      for (const k in p.best) { sum += p.best[k]; done++; }
      p.kdaSum = Math.round(sum * 10) / 10;
      p.done = done;
    }
  }
  broadcastState();
}

function broadcastState() {
  const arr = Array.from(players.values()).map((p) => ({
    id: p.id, name: p.name, level: p.level, score: p.score,
    kdaSum: p.kdaSum, done: p.done, best: p.best
  }));
  arr.sort((a, b) => b.kdaSum - a.kdaSum || b.score - a.score);
  broadcast({ t: "state", players: arr });
}

/* ---------------- HTTP 服务 ---------------- */
let indexCache = null;
function getIndex() {
  if (!indexCache) {
    indexCache = fs.readFileSync(INDEX_FILE);
  }
  return indexCache;
}

const server = http.createServer((req, res) => {
  try {
    if (req.url === "/" || req.url.startsWith("/index")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getIndex());
    } else if (req.url === "/healthz") {
      res.writeHead(200); res.end("ok");
    } else if (req.url === "/kda-rule.js" || req.url.startsWith("/qb/")) {
      /* 静态 JS（kda-rule.js 规则文件 + qb/ 题库，方案B）：basename 防目录穿越；不存在返回 404 */
      const base = req.url.startsWith("/qb/")
        ? path.join(__dirname, "qb", path.basename(decodeURIComponent(req.url.split("?")[0])))
        : path.join(__dirname, "kda-rule.js");
      fs.readFile(base, (err, buf) => {
        if (err) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        res.end(buf);
      });
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getIndex()); // 单页应用：任意路径都回首页
    }
  } catch (e) {
    /* 首页缺失等异常：返回 500 提示，绝不崩掉整个进程 */
    console.error("[warn] 页面读取失败:", e.message);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>页面文件缺失</h1><p>请检查 server.js 同目录下的 index.html 是否存在。</p>");
  }
});

/* 端口占用等启动错误：给出可读提示而非抛栈闪退 */
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error("[错误] 端口 " + PORT + " 已被占用：可能上一次服务还没关。");
    console.error("       请关闭旧的启动窗口（或任务管理器结束 node.exe）后重试。");
  } else {
    console.error("[错误] 服务器启动失败:", e.message);
  }
  process.exit(1);
});

server.on("upgrade", (req, socket) => {
  if (req.url !== "/ws") { socket.destroy(); return; }
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: " + wsAccept(key) + "\r\n\r\n"
  );
  socket.setNoDelay(true);
  clients.add(socket);
  const bufRef = { buffer: Buffer.alloc(0), pos: 0 };
  socket.on("data", (chunk) => {
    bufRef.buffer = Buffer.concat([bufRef.buffer, chunk]);
    try { handleData(socket, bufRef); } catch (e) { /* 单帧异常不中断 */ }
  });
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

/* 定时清理离线玩家并广播 */
setInterval(() => {
  const now = Date.now();
  let changed = false;
  players.forEach((p, id) => {
    if (now - p.last > OFFLINE_MS) { players.delete(id); changed = true; }
  });
  if (changed) broadcastState();
}, 5000);

server.listen(PORT, () => {
  console.log("==============================================");
  console.log("  豆豆智学· 数学闯关 · 通关大作战（局域网版）");
  console.log("==============================================");
  console.log("  本机调试:  http://localhost:" + PORT);
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((net) => {
      if (net.family === "IPv4" && !net.internal) {
        console.log("  局域网入口: http://" + net.address + ":" + PORT +
          "   (" + name + ")");
      }
    });
  });
  console.log("----------------------------------------------");
  console.log("  手机/平板连同一 WiFi，浏览器打开上面的局域网入口即可");
  console.log("  首次启动如弹出防火墙提示，请勾选允许（专用网络）");
  console.log("  关闭本窗口即停止服务。Ctrl+C 可提前退出。");
  console.log("==============================================");
});
