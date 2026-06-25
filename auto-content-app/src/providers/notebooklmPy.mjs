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
