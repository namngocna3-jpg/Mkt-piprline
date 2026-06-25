#!/usr/bin/env node
/**
 * test-surfsense.mjs — Kit test luồng "1 file tài liệu -> SurfSense -> video/podcast".
 *
 * Mục tiêu (bước 3 trong kế hoạch): xác nhận API SurfSense chạy thật,
 * upload được tài liệu, kích sinh được nội dung, và poll/tải kết quả ra.
 *
 * Script TỰ ĐỌC /openapi.json của instance anh dựng để in ra endpoint thật
 * (vì SurfSense kích sinh video/podcast qua agent/Celery, không phải 1 REST cố định,
 *  và đường dẫn có thể đổi theo version). Nhờ vậy script không bị "đoán sai endpoint".
 *
 * Yêu cầu: Node >= 18 (dùng fetch + FormData/Blob có sẵn, KHÔNG cần cài thêm gì).
 *
 * Chạy:
 *   SURFSENSE_URL=http://localhost:8000 \
 *   SS_EMAIL=you@example.com SS_PASSWORD=yourpass \
 *   SEARCH_SPACE_ID=1 FILE_PATH=./bai-ly-thuyet-1.pdf \
 *   node surfsense-test/test-surfsense.mjs
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const BASE = (process.env.SURFSENSE_URL || "http://localhost:8000").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const EMAIL = process.env.SS_EMAIL;
const PASSWORD = process.env.SS_PASSWORD;
const SEARCH_SPACE_ID = process.env.SEARCH_SPACE_ID || "1";
const FILE_PATH = process.env.FILE_PATH;
const PROCESSING_MODE = process.env.PROCESSING_MODE || "basic";

const log = (...a) => console.log(...a);
const die = (msg) => { console.error("\n❌ " + msg); process.exit(1); };

// ── 1. Khám phá API thật từ OpenAPI spec ────────────────────────────────────
async function discover() {
  log("→ Đọc OpenAPI spec để xem endpoint thật của instance này...");
  const res = await fetch(`${BASE}/openapi.json`);
  if (!res.ok) die(`Không đọc được ${BASE}/openapi.json (HTTP ${res.status}). SurfSense backend đã chạy chưa?`);
  const spec = await res.json();
  const paths = Object.keys(spec.paths || {});
  const pick = (kw) => paths.filter((p) => kw.some((k) => p.toLowerCase().includes(k)));

  log(`\n  Tổng ${paths.length} endpoint. Các nhóm liên quan:`);
  for (const [label, kws] of [
    ["AUTH (login)", ["auth", "login", "jwt"]],
    ["DOCUMENTS (upload)", ["document"]],
    ["VIDEO", ["video"]],
    ["PODCAST", ["podcast"]],
    ["CHAT/AGENT (kích sinh)", ["chat", "thread", "message", "agent"]],
  ]) {
    const hits = pick(kws);
    log(`  • ${label}:`);
    for (const p of hits.slice(0, 12)) {
      const methods = Object.keys(spec.paths[p]).join(",").toUpperCase();
      log(`      [${methods}] ${p}`);
    }
    if (!hits.length) log("      (không thấy — kiểm tra lại version)");
  }
  log("");
  return spec;
}

// ── 2. Đăng nhập lấy JWT (fastapi-users, AUTH_TYPE=LOCAL) ────────────────────
async function login() {
  if (!EMAIL || !PASSWORD) die("Thiếu SS_EMAIL / SS_PASSWORD. (Cần AUTH_TYPE=LOCAL trong SurfSense)");
  log(`→ Đăng nhập ${EMAIL} ...`);
  // fastapi-users mặc định nhận form-urlencoded: username=<email>&password=<pass>
  const body = new URLSearchParams({ username: EMAIL, password: PASSWORD });
  const res = await fetch(`${API}/auth/jwt/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) die(`Login thất bại (HTTP ${res.status}). Xác nhận path login ở phần OpenAPI in phía trên.\n${await res.text()}`);
  const json = await res.json();
  const token = json.access_token;
  if (!token) die("Login OK nhưng không thấy access_token: " + JSON.stringify(json));
  log("  ✓ Có JWT.");
  return token;
}

// ── 3. Upload 1 file tài liệu ────────────────────────────────────────────────
async function uploadFile(token) {
  if (!FILE_PATH) die("Thiếu FILE_PATH (đường dẫn file tài liệu cần test).");
  log(`→ Upload ${FILE_PATH} vào search_space ${SEARCH_SPACE_ID} ...`);
  const buf = await readFile(FILE_PATH);
  const form = new FormData();
  form.append("files", new Blob([buf]), basename(FILE_PATH));
  form.append("search_space_id", String(SEARCH_SPACE_ID));
  form.append("processing_mode", PROCESSING_MODE);
  const res = await fetch(`${API}/documents/fileupload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) die(`Upload thất bại (HTTP ${res.status}).\n${await res.text()}`);
  const json = await res.json().catch(() => ({}));
  log("  ✓ Upload xong:", JSON.stringify(json).slice(0, 300));
  return json;
}

// ── 4. Poll danh sách video-presentations cho tới khi status = ready ─────────
async function pollVideo(token, { tries = 60, intervalMs = 10000 } = {}) {
  log(`→ Poll /video-presentations (tối đa ${tries} lần, mỗi ${intervalMs / 1000}s)...`);
  for (let i = 1; i <= tries; i++) {
    const res = await fetch(`${API}/video-presentations?search_space_id=${SEARCH_SPACE_ID}&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const list = await res.json();
      const items = Array.isArray(list) ? list : list.items || [];
      const latest = items[0];
      const status = latest?.status || "(chưa có)";
      log(`  [${i}/${tries}] mới nhất: status=${status} id=${latest?.id ?? "-"}`);
      if (status === "ready" || status === "READY" || status === "completed") {
        log("  ✓ Video sẵn sàng:", JSON.stringify(latest).slice(0, 400));
        return latest;
      }
    } else {
      log(`  [${i}/${tries}] GET lỗi HTTP ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  log("  ⚠ Hết lượt poll — chưa thấy video ready. (Sinh video tốn vài phút, thử tăng tries)");
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
log("=== SurfSense API test kit ===");
log("BASE:", BASE, "\n");

await discover();

log("─".repeat(70));
log("LƯU Ý: SurfSense kích sinh video/podcast qua luồng AGENT/CHAT (task Celery),");
log("không phải 1 REST 'generate' cố định. Hãy nhìn nhóm CHAT/AGENT ở trên để biết");
log("endpoint gửi lệnh cho agent. Bước upload + poll + tải về thì script làm tự động.");
log("─".repeat(70) + "\n");

const token = await login();
await uploadFile(token);

// Tới đây: vào UI SurfSense bấm "Generate Video" cho tài liệu vừa upload,
// HOẶC gọi endpoint chat/agent (xem nhóm CHAT/AGENT). Rồi script poll kết quả:
await pollVideo(token);

log("\n✅ Xong luồng test. Đọc README.md cùng thư mục để biết bước tiếp theo (ghép Make).");
