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
