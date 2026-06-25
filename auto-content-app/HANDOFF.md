# HANDOFF — App tự động sinh học liệu (video/mindmap/slide) với fallback 3 provider

> File này gói TẤT CẢ: bối cảnh, quyết định, kiến trúc, cách kết nối từng tool, và full code mọi file.
> Mang sang chat/repo khác là chạy tiếp được ngay. Không cần đọc lại lịch sử chat cũ.

---

## 0. Mục tiêu

Từ **học liệu (1 file lý thuyết: PDF/Docx/Google Doc)** → tự sinh ra **video + mindmap (+ slide/podcast)**,
chạy tự động hàng loạt. Yêu cầu cốt lõi: **1 app orchestrator có FALLBACK** — thử provider 1, lỗi thì
nhảy provider 2, lỗi nữa thì provider 3. Trigger từ **file mới trong Google Drive**, kết quả **lưu về Google Drive**.

## 1. Ba provider & cách KẾT NỐI (phần hay kẹt)

| # | Tool | Sinh được | Cách app gọi | Auth | Ghi chú |
|---|---|---|---|---|---|
| A | **teng-lin/notebooklm-py** | video, audio, mindmap(JSON), slide(PPTX) | **CLI subprocess** (`notebooklm ...`). Có cả Python API + REST server thử nghiệm | Cookie Google (NotebookLM) | Chất lượng cao, nhưng API ngầm → dễ gãy, cần browser |
| B | **jacob-bd/notebooklm-mcp-cli** | audio, video, slide, mindmap | **CLI subprocess** (`nlm ...`). **KHÔNG có REST**, chỉ CLI + MCP | Cookie Google | ~50 query/ngày (free), cookie hết hạn 2–4 tuần |
| C | **MODSetter/SurfSense** | podcast, video, slide, report | **REST** (`/api/v1/...`) **hoặc** qua **Make webhook** | JWT (AUTH_TYPE=LOCAL) | Tự host, **ổn định nhất** → để làm CHỐT fallback |

**Điểm mấu chốt:** A và B **bắt buộc gọi qua CLI** (vì B không có REST, A thì REST còn thử nghiệm).
Cả A và B cần **cookie Google + trình duyệt thật** → app phải chạy trên **host có browser**
(VPS cài Chrome + `xvfb-run`, hoặc máy cá nhân), **không** chạy serverless/Make cloud được.
SurfSense thì gọi REST thẳng, hoặc đẩy qua Make (theo ý ban đầu).

### Sự thật quan trọng về SurfSense (đã đọc source)
- Upload tài liệu: REST sạch → `POST /api/v1/documents/fileupload` (multipart: `files`, `search_space_id`, `processing_mode`).
- Lấy/tải video: REST sạch → `GET /api/v1/video-presentations/{id}` → poll `status` tới `ready`; audio từng slide `GET .../slides/{n}/audio`.
- **Kích sinh video/podcast KHÔNG phải 1 REST "generate"** — nó là **task Celery chạy nền, kích qua agent/chat** (`POST .../messages`). → phải gửi lệnh cho agent rồi poll. Lấy path chính xác từ `http://<host>:8000/docs` của chính instance.
- Chạy rẻ ~$0: `AUTH_TYPE=LOCAL`, `TTS_SERVICE=local/kokoro`, `STT_SERVICE=local/base`, `ETL_SERVICE=DOCLING`, LLM dùng Ollama local.

## 2. Kiến trúc (khuyến nghị)

```
[Google Drive: file mới]                         (Make watch Drive — đã có sẵn connection)
        │  Make tải file + POST /generate
        ▼
┌─────────────────────────────────────────────────────────┐
│  auto-content-app  (Node, chạy trên VPS có browser)       │
│                                                           │
│  orchestrator.fallback():                                 │
│    1) notebooklm-py  (CLI)  ── lỗi/auth hỏng ─┐           │
│    2) notebooklm-mcp-cli (CLI) ── lỗi ────────┤           │
│    3) surfsense (REST trực tiếp, HOẶC đẩy Make)│          │
└─────────────────────────────────────────────────────────┘
        │  trả file video/mindmap
        ▼
[Make: lưu Google Drive + báo Telegram/Gmail]
```

**Ghi chú thiết kế:** SurfSense có REST nên app gọi thẳng cũng được (đỡ 1 vòng). Nếu vẫn muốn
"SurfSense đi qua Make" như ý ban đầu thì để `SURFSENSE_MODE=make` (provider C sẽ POST sang Make webhook).
Mặc định file code để `make`.

Thứ tự fallback đổi được qua `PROVIDER_ORDER`. Mặc định: NotebookLM (chất lượng) trước, SurfSense (ổn định) chốt.

---

## 3. CẤU TRÚC THƯ MỤC

```
auto-content-app/
├── package.json
├── .env.example
└── src/
    ├── util.mjs
    ├── orchestrator.mjs
    ├── cli.mjs                 # chạy tay: node src/cli.mjs <file>
    ├── server.mjs              # HTTP: POST /generate (cho Make gọi vào)
    └── providers/
        ├── notebooklmPy.mjs
        ├── nlmCli.mjs
        └── surfsense.mjs
```

Yêu cầu: **Node >= 18** (dùng `fetch`, `FormData`, `Blob`, `child_process` native — KHÔNG cần npm install gì).

---

## 4. FULL CODE (copy nguyên xi)

### `package.json`
```json
{
  "name": "auto-content-app",
  "version": "0.1.0",
  "type": "module",
  "description": "Orchestrator sinh hoc lieu (video/mindmap/slide) voi fallback qua notebooklm-py -> notebooklm-mcp-cli -> SurfSense",
  "scripts": {
    "start": "node src/server.mjs",
    "generate": "node src/cli.mjs"
  },
  "engines": { "node": ">=18" }
}
```

### `.env.example`
```bash
# ===== Thu tu fallback =====
PROVIDER_ORDER=notebooklm-py,notebooklm-mcp-cli,surfsense
# Bat/tat tung provider
ENABLE_NOTEBOOKLM_PY=true
ENABLE_NLM=true
ENABLE_SURFSENSE=true

# ===== Server / app =====
PORT=8787
APP_TOKEN=doi-chuoi-bi-mat-nay        # Make gui kem header Authorization: Bearer <APP_TOKEN>
OUT_DIR=./out

# ===== Timeout (ms) =====
HEALTH_TIMEOUT_MS=30000
GEN_TIMEOUT_MS=2400000

# ===== Provider A: notebooklm-py =====
NOTEBOOKLM_PY_BIN=notebooklm           # binary CLI (mac dinh 'notebooklm')

# ===== Provider B: notebooklm-mcp-cli =====
NLM_BIN=nlm

# ===== Provider C: SurfSense =====
SURFSENSE_MODE=make                    # 'make' (đẩy qua Make webhook) hoặc 'rest' (gọi thẳng)
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/xxxxxxxx   # khi SURFSENSE_MODE=make
# --- khi SURFSENSE_MODE=rest ---
SURFSENSE_URL=https://surfsense.your-domain.com
SS_EMAIL=you@example.com
SS_PASSWORD=yourpass
SEARCH_SPACE_ID=1
SS_PROCESSING_MODE=basic
SS_GENERATE_PATH=                      # path kich sinh, LAY TU /docs (vd: /chats/123/messages)
SS_GENERATE_BODY=                      # JSON body cho buoc kich sinh (tuy chon)
```

### `src/util.mjs`
```js
// Tien ich dung chung: chay tien trinh con (CLI), timeout, log.
import { spawn } from "node:child_process";

export const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

/** Chay 1 lenh CLI, tra ve {stdout, stderr}. Reject neu exit code != 0 hoac timeout. */
export function run(cmd, args, { cwd, env, timeoutMs = 0, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    let timer;
    if (timeoutMs) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Timeout ${timeoutMs}ms: ${cmd} ${args.join(" ")}`));
      }, timeoutMs);
    }
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`Khong chay duoc '${cmd}': ${e.message} (da cai chua? co trong PATH chua?)`));
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${cmd} thoat code ${code}: ${(stderr || stdout).slice(0, 500)}`));
    });
    if (input) child.stdin.end(input);
  });
}

/** Boc 1 promise voi timeout. */
export function withTimeout(promise, ms, label = "op") {
  if (!ms) return promise;
  let timer;
  const t = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), t]);
}

/** Tim 1 id (uuid hoac chuoi dai) trong output CLI. Best-effort, chinh lai theo version neu can. */
export function parseId(text) {
  const uuid = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  const labeled = text.match(/(?:notebook|artifact|id)[^\w]{0,3}([\w-]{8,})/i);
  return labeled ? labeled[1] : null;
}
```

### `src/providers/notebooklmPy.mjs`
```js
// Provider A: teng-lin/notebooklm-py  (goi qua CLI `notebooklm`)
// Yeu cau: pip install notebooklm-py + da `notebooklm login` (cookie Google) tren host co browser.
import path from "node:path";
import { run, parseId, log } from "../util.mjs";

const BIN = process.env.NOTEBOOKLM_PY_BIN || "notebooklm";
const GEN_TIMEOUT = Number(process.env.NLPY_GEN_TIMEOUT_MS || 1_800_000); // 30 phut/loai

export default {
  name: "notebooklm-py",
  get enabled() {
    return process.env.ENABLE_NOTEBOOKLM_PY !== "false";
  },

  async healthCheck() {
    try {
      const { stdout, stderr } = await run(BIN, ["auth", "check", "--test"], { timeoutMs: 30_000 });
      return /ok|valid|success|authenticated|logged/i.test(stdout + stderr);
    } catch (e) {
      log(`  notebooklm-py health fail: ${e.message}`);
      return false;
    }
  },

  // kinds: cac loai noi dung can sinh. CLI token: "video", "audio", "mind-map", "slide-deck"...
  async generate({ filePath, title, outDir, kinds = ["video", "mind-map"] }) {
    const createOut = (await run(BIN, ["create", title], { timeoutMs: 60_000 })).stdout;
    const nbId = parseId(createOut);
    if (!nbId) throw new Error("Khong parse duoc notebook id: " + createOut.slice(0, 200));
    await run(BIN, ["use", nbId], { timeoutMs: 30_000 });

    // them tai lieu lam nguon (cho index xong)
    await run(BIN, ["source", "add", filePath], { timeoutMs: 300_000 });

    const outputs = {};
    for (const kind of kinds) {
      await run(BIN, ["generate", kind, "--wait"], { timeoutMs: GEN_TIMEOUT });
      const ext = kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "json";
      const out = path.join(outDir, `${kind}.${ext}`);
      await run(BIN, ["download", kind, out], { timeoutMs: 600_000 });
      outputs[kind] = out;
    }
    return { ok: true, outputs };
  },
};
```

### `src/providers/nlmCli.mjs`
```js
// Provider B: jacob-bd/notebooklm-mcp-cli  (goi qua CLI `nlm` — KHONG co REST)
// Yeu cau: cai nlm + da `nlm login` (cookie Google) tren host co browser.
import path from "node:path";
import { run, parseId, log } from "../util.mjs";

const BIN = process.env.NLM_BIN || "nlm";
const GEN_TIMEOUT = Number(process.env.NLM_GEN_TIMEOUT_MS || 1_800_000);

export default {
  name: "notebooklm-mcp-cli",
  get enabled() {
    return process.env.ENABLE_NLM !== "false";
  },

  async healthCheck() {
    try {
      const { stdout, stderr } = await run(BIN, ["login", "--check"], { timeoutMs: 30_000 });
      return /ok|valid|logged in|authenticated/i.test(stdout + stderr);
    } catch (e) {
      log(`  nlm health fail: ${e.message}`);
      return false;
    }
  },

  // CLI token: "audio", "video", "mindmap"
  async generate({ filePath, title, outDir, kinds = ["video", "mindmap"] }) {
    const nbOut = (await run(BIN, ["notebook", "create", title], { timeoutMs: 60_000 })).stdout;
    const nb = parseId(nbOut) || title; // nlm cho dung ten notebook lam tham chieu
    await run(BIN, ["source", "add", nb, "--file", filePath], { timeoutMs: 300_000 });

    const outputs = {};
    for (const kind of kinds) {
      const studioOut = (await run(BIN, ["studio", "create", nb, "--type", kind], { timeoutMs: GEN_TIMEOUT })).stdout;
      const artifactId = parseId(studioOut);
      if (kind === "video" || kind === "audio") {
        const ext = kind === "video" ? "mp4" : "mp3";
        const out = path.join(outDir, `${kind}.${ext}`);
        await run(BIN, ["download", kind, nb, artifactId, out], { timeoutMs: 600_000 });
        outputs[kind] = out;
      } else {
        // mindmap/slide: nlm chua chac co lenh download truc tiep -> giu artifact id de lay sau
        outputs[kind] = `artifact:${artifactId}`;
      }
    }
    return { ok: true, outputs };
  },
};
```

### `src/providers/surfsense.mjs`
```js
// Provider C: MODSetter/SurfSense (on dinh nhat, lam CHOT fallback).
// 2 che do:
//   - SURFSENSE_MODE=make  : app POST sang Make webhook, Make lo upload+sinh+giao Drive. (mac dinh)
//   - SURFSENSE_MODE=rest  : app goi thang REST SurfSense (upload -> trigger -> poll -> download).
import path from "node:path";
import { readFile } from "node:fs/promises";
import { log } from "../util.mjs";

const MODE = process.env.SURFSENSE_MODE || "make";

export default {
  name: "surfsense",
  get enabled() {
    return process.env.ENABLE_SURFSENSE !== "false";
  },

  async healthCheck() {
    if (MODE === "make") return !!process.env.MAKE_WEBHOOK_URL;
    try {
      const r = await fetch(`${(process.env.SURFSENSE_URL || "").replace(/\/$/, "")}/openapi.json`);
      return r.ok;
    } catch (e) {
      log(`  surfsense health fail: ${e.message}`);
      return false;
    }
  },

  async generate(input) {
    return MODE === "make" ? viaMake(input) : viaRest(input);
  },
};

// --- Che do Make: chuyen toan bo viec sinh + giao file cho 1 Make scenario ---
async function viaMake({ driveFileId, fileUrl, title }) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) throw new Error("Thieu MAKE_WEBHOOK_URL");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driveFileId, fileUrl, title, source: "auto-content-app" }),
  });
  if (!res.ok) throw new Error(`Make webhook loi HTTP ${res.status}: ${await res.text()}`);
  return { ok: true, outputs: { handoff: "make" }, note: "Da ban sang Make; Make se sinh + luu Drive." };
}

// --- Che do REST: goi thang SurfSense ---
async function viaRest({ filePath, title, outDir }) {
  const BASE = (process.env.SURFSENSE_URL || "").replace(/\/$/, "");
  const API = `${BASE}/api/v1`;
  if (!BASE) throw new Error("Thieu SURFSENSE_URL");

  // 1) login lay JWT (fastapi-users, AUTH_TYPE=LOCAL)
  const lr = await fetch(`${API}/auth/jwt/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: process.env.SS_EMAIL, password: process.env.SS_PASSWORD }),
  });
  if (!lr.ok) throw new Error(`SurfSense login loi ${lr.status}`);
  const token = (await lr.json()).access_token;

  // 2) upload tai lieu
  const form = new FormData();
  form.append("files", new Blob([await readFile(filePath)]), path.basename(filePath));
  form.append("search_space_id", String(process.env.SEARCH_SPACE_ID || "1"));
  form.append("processing_mode", process.env.SS_PROCESSING_MODE || "basic");
  const up = await fetch(`${API}/documents/fileupload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!up.ok) throw new Error(`SurfSense upload loi ${up.status}`);

  // 3) KICH SINH: SurfSense sinh video/podcast qua agent/Celery, khong phai 1 REST co dinh.
  //    Dien path that anh lay tu /docs cua instance vao SS_GENERATE_PATH (vd: /chats/.../messages).
  const genPath = process.env.SS_GENERATE_PATH;
  if (!genPath) throw new Error("Che do rest can SS_GENERATE_PATH (lay tu /docs). Hoac dung SURFSENSE_MODE=make.");
  const gen = await fetch(`${API}${genPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: process.env.SS_GENERATE_BODY || JSON.stringify({ message: `Generate a video presentation from: ${title}` }),
  });
  if (!gen.ok) throw new Error(`SurfSense trigger loi ${gen.status}`);

  // 4) poll video-presentations toi khi ready
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${API}/video-presentations?search_space_id=${process.env.SEARCH_SPACE_ID || 1}&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const list = await r.json();
      const latest = (Array.isArray(list) ? list : list.items || [])[0];
      if (latest && /ready|completed/i.test(latest.status || "")) {
        return { ok: true, outputs: { videoPresentationId: latest.id, raw: latest } };
      }
    }
    await new Promise((res) => setTimeout(res, 10_000));
  }
  throw new Error("SurfSense: het luot poll, video chua ready");
}
```

### `src/orchestrator.mjs`
```js
// Bo nao fallback: thu lan luot cac provider, cai nao loi -> nhay sang cai ke tiep.
import { withTimeout, log } from "./util.mjs";
import notebooklmPy from "./providers/notebooklmPy.mjs";
import nlmCli from "./providers/nlmCli.mjs";
import surfsense from "./providers/surfsense.mjs";

const ALL = {
  "notebooklm-py": notebooklmPy,
  "notebooklm-mcp-cli": nlmCli,
  surfsense,
};

// Thu tu mac dinh: 2 ban NotebookLM (chat luong cao, de gay) truoc, SurfSense (on dinh) chot.
const ORDER = (process.env.PROVIDER_ORDER || "notebooklm-py,notebooklm-mcp-cli,surfsense")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const HEALTH_TIMEOUT = Number(process.env.HEALTH_TIMEOUT_MS || 30_000);
const GEN_TIMEOUT = Number(process.env.GEN_TIMEOUT_MS || 2_400_000); // 40 phut tong/provider

export async function generateWithFallback(input) {
  const errors = [];
  for (const name of ORDER) {
    const p = ALL[name];
    if (!p) {
      log(`⚠ khong co provider ten '${name}' — bo qua`);
      continue;
    }
    if (!p.enabled) {
      log(`• bo qua ${name} (ENABLE_* = false)`);
      continue;
    }
    log(`→ Thu provider: ${name}`);
    try {
      const healthy = await withTimeout(p.healthCheck(), HEALTH_TIMEOUT, `${name} health`);
      if (!healthy) {
        log(`  ✗ ${name} khong khoe (auth/host loi) → fallback`);
        errors.push(`${name}: unhealthy`);
        continue;
      }
      const res = await withTimeout(p.generate(input), GEN_TIMEOUT, `${name} generate`);
      if (res?.ok) {
        log(`  ✓ ${name} THANH CONG`);
        return { provider: name, ...res };
      }
      errors.push(`${name}: tra ve not-ok`);
    } catch (e) {
      log(`  ✗ ${name} loi: ${e.message} → fallback`);
      errors.push(`${name}: ${e.message}`);
    }
  }
  const err = new Error("Tat ca provider deu that bai:\n - " + errors.join("\n - "));
  err.details = errors;
  throw err;
}
```

### `src/cli.mjs`
```js
// Chay tay: node src/cli.mjs <duong-dan-file> [title]
import path from "node:path";
import fs from "node:fs";
import { generateWithFallback } from "./orchestrator.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Dung: node src/cli.mjs <duong-dan-file> [title]");
  process.exit(1);
}
const title = process.argv[3] || path.basename(file).replace(/\.[^.]+$/, "");
const outDir = process.env.OUT_DIR || "./out";
fs.mkdirSync(outDir, { recursive: true });

try {
  const res = await generateWithFallback({ filePath: path.resolve(file), title, outDir });
  console.log("\n=== KET QUA ===");
  console.log(JSON.stringify(res, null, 2));
} catch (e) {
  console.error("\n❌ " + e.message);
  process.exit(1);
}
```

### `src/server.mjs`
```js
// HTTP server: POST /generate (cho Make/Drive goi vao), GET /health
import http from "node:http";
import fs from "node:fs";
import { generateWithFallback } from "./orchestrator.mjs";
import { log } from "./util.mjs";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.APP_TOKEN;

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });

  if (req.method === "POST" && req.url === "/generate") {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
      return json(res, 401, { error: "unauthorized" });
    }
    let body = "";
    for await (const c of req) body += c;
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "body khong phai JSON hop le" });
    }
    if (!data.filePath && !data.fileUrl && !data.driveFileId) {
      return json(res, 400, { error: "can filePath | fileUrl | driveFileId" });
    }
    const outDir = process.env.OUT_DIR || "./out";
    fs.mkdirSync(outDir, { recursive: true });
    try {
      const result = await generateWithFallback({
        filePath: data.filePath,
        fileUrl: data.fileUrl,
        driveFileId: data.driveFileId,
        title: data.title || "content",
        outDir,
      });
      return json(res, 200, result);
    } catch (e) {
      return json(res, 500, { error: e.message, details: e.details });
    }
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => log(`auto-content-app nghe o :${PORT}`));
```

---

## 5. CÁCH DỰNG & CHẠY (trên VPS có browser)

```bash
# 1. Cai 2 tool NotebookLM (can Python + Node + Chrome)
pip install notebooklm-py           # provider A -> binary: notebooklm
npm i -g notebooklm-mcp-cli         # provider B -> binary: nlm   (kiem tra ten goi tren npm)
notebooklm login                    # dang nhap Google cho A (mo browser)
nlm login                           # dang nhap Google cho B

# 2. (Tuy chon) Dung SurfSense neu lam provider C che do rest
#    git clone https://github.com/MODSetter/SurfSense && docker compose up -d
#    Dat sau Cloudflare Tunnel/domain de Make/app goi vao duoc.

# 3. Cai & chay app
cd auto-content-app
cp .env.example .env                # sua .env theo moi truong cua ban
node src/cli.mjs ./bai-ly-thuyet-1.pdf "Ly thuyet 1"   # test tay 1 file
node src/server.mjs                 # chay server cho Make goi /generate
```

> Host headless: chay app duoi `xvfb-run -a node src/server.mjs` de A/B co "man hinh" cho browser.

## 6. NỐI VỚI MAKE

**Scenario Make** (dùng connection Google Drive đã có):
```
[Watch Files in Drive folder]                 (folder anh tha hoc lieu vao)
   → [Google Drive: Download file]            (hoac lay shareable link/fileId)
   → [HTTP > Make a request]  POST https://<app-public>/generate
        Headers: Authorization: Bearer <APP_TOKEN>
        Body (JSON): { "fileUrl": "<link>", "title": "{{ten file}}", "driveFileId": "{{id}}" }
   → [Router] theo ket qua:
        - provider != surfsense  → [Google Drive: Upload] video tra ve
        - provider == surfsense + SURFSENSE_MODE=make → SurfSense da tu giao (xem scenario SurfSense rieng)
   → [Telegram/Gmail] bao xong
```
- App phải có **URL public** (đặt VPS sau domain/Cloudflare Tunnel) thì Make cloud (eu1.make.com) mới gọi `/generate` được.
- Tài khoản Make hiện có: Org "My Organization" (id 6869768), Team "My Team" (id 1212779), gói Core 10k ops/tháng, đã có connection Google Drive/Gmail.

## 7. VIỆC CÒN PHẢI XÁC NHẬN (TODO khi chạy thật)

1. **Tên gói npm của provider B** (`notebooklm-mcp-cli`) và binary `nlm` — verify lại lệnh cài.
2. **Parse output CLI**: hàm `parseId()` là best-effort. Chạy thử `notebooklm create`/`nlm notebook create` xem stdout thật rồi chỉnh regex (hoặc dùng cờ `--json` nếu CLI hỗ trợ).
3. **Provider B download mindmap/slide**: `nlm download` có thể chỉ hỗ trợ audio/video — kiểm tra `nlm download --help`.
4. **SurfSense kích sinh (mode rest)**: mở `http://<host>:8000/docs`, tìm endpoint POST kích sinh video (nhóm chat/agent), điền vào `SS_GENERATE_PATH` + `SS_GENERATE_BODY`.
5. **Cookie Google** của A & B hết hạn 2–4 tuần → cần cron `notebooklm auth refresh` / `nlm login` lại; healthCheck đã tự loại provider hỏng auth.

---

## 8. TÓM TẮT 1 DÒNG ĐỂ MỞ CHAT MỚI

> "Tôi có app Node orchestrator (`auto-content-app`) sinh video/mindmap từ file học liệu, fallback qua
> notebooklm-py (CLI) → notebooklm-mcp-cli (CLI) → SurfSense (REST/Make). Toàn bộ code + cấu hình trong
> file HANDOFF.md này. Giúp tôi [hoàn thiện / sửa / deploy] phần ___."
