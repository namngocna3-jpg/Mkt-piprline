// Provider C: MODSetter/SurfSense (on dinh nhat, lam CHOT fallback).
// 2 che do:
//   - SURFSENSE_MODE=make  : app POST sang Make webhook, Make lo upload+sinh+giao Drive. (mac dinh, dung y anh)
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
  // Make thuong tra 200 "Accepted" roi xu ly nen + giao Drive bat dong bo.
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
