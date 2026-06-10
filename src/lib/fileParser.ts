import type { Attachment } from './chatTypes';

const TEXT_EXT = /\.(txt|md|json|js|jsx|ts|tsx|css|scss|html|sql|py|rb|go|java|kt|swift|c|cpp|h|hpp|cs|rs|sh|yaml|yml|xml|csv|toml|ini|log)$/i;
const MAX_FILE = 15 * 1024 * 1024;

export async function parseFile(file: File, onProgress?: (s: string) => void): Promise<Attachment> {
  if (file.size > MAX_FILE) throw new Error(`File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB > 15MB)`);

  const att: Attachment = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };

  const lower = file.name.toLowerCase();
  onProgress?.('Đang đọc...');

  if (TEXT_EXT.test(lower) || file.type.startsWith('text/')) {
    att.extractedText = await file.text();
    return att;
  }

  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    att.extractedText = await parsePdf(file, onProgress);
    return att;
  }

  if (lower.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    att.extractedText = await parseDocx(file, onProgress);
    return att;
  }

  if (/\.(xlsx|xls|ods)$/i.test(lower) || file.type.includes('spreadsheetml')) {
    att.extractedText = await parseXlsx(file, onProgress);
    return att;
  }

  if (file.type.startsWith('image/')) {
    att.preview = await fileToDataUrl(file);
    att.extractedText = `[IMAGE: ${file.name}] (chưa OCR — cần cấu hình Gemini Vision trong /settings để mô tả ảnh)`;
    return att;
  }

  // Unknown → try reading as text
  try {
    att.extractedText = await file.text();
  } catch {
    att.extractedText = `[Binary file ${file.name} — không trích xuất được nội dung]`;
  }
  return att;
}

async function parsePdf(file: File, onProgress?: (s: string) => void): Promise<string> {
  onProgress?.('Parsing PDF...');
  try {
    // @ts-ignore - optional dep, dynamically imported
    const pdfjs: any = await import(/* webpackIgnore: true */ 'pdfjs-dist').catch(() => null);
    if (!pdfjs) throw new Error('Chưa cài pdfjs-dist. Chạy: npm i pdfjs-dist');
    if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.min.mjs';
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const out: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress?.(`Page ${p}/${pdf.numPages}`);
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      out.push(tc.items.map((it: any) => it.str).join(' '));
    }
    return out.join('\n\n');
  } catch (e: any) {
    return `[Lỗi parse PDF: ${e?.message || e}. Cài thêm: npm i pdfjs-dist]`;
  }
}

async function parseDocx(file: File, onProgress?: (s: string) => void): Promise<string> {
  onProgress?.('Parsing DOCX...');
  try {
    // @ts-ignore - optional dep, dynamically imported
    const mammoth: any = await import(/* webpackIgnore: true */ 'mammoth').catch(() => null);
    if (!mammoth) return '[Chưa cài mammoth. Chạy: npm i mammoth]';
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return res.value || '';
  } catch (e: any) {
    return `[Lỗi parse DOCX: ${e?.message || e}]`;
  }
}

async function parseXlsx(file: File, onProgress?: (s: string) => void): Promise<string> {
  onProgress?.('Parsing XLSX...');
  try {
    // @ts-ignore - optional dep, dynamically imported
    const XLSX: any = await import(/* webpackIgnore: true */ 'xlsx').catch(() => null);
    if (!XLSX) return '[Chưa cài xlsx. Chạy: npm i xlsx]';
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const out: string[] = [];
    for (const name of wb.SheetNames) {
      out.push(`# Sheet: ${name}`);
      out.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
    }
    return out.join('\n\n');
  } catch (e: any) {
    return `[Lỗi parse XLSX: ${e?.message || e}]`;
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function buildAttachmentsBlock(attachments: Attachment[]): string {
  if (!attachments.length) return '';
  const TOTAL_CAP = 200_000;
  let used = 0;
  const blocks: string[] = [];
  for (const a of attachments) {
    if (!a.extractedText) continue;
    const remain = TOTAL_CAP - used;
    if (remain <= 0) { blocks.push(`<attached_file name="${a.name}" truncated="true">[bỏ qua vì vượt 200k chars]</attached_file>`); continue; }
    const text = a.extractedText.length > remain ? a.extractedText.slice(0, remain) + '\n...[truncated]' : a.extractedText;
    used += text.length;
    blocks.push(`<attached_file name="${a.name}" type="${a.type}" size="${a.size || ''}">\n${text}\n</attached_file>`);
  }
  return blocks.join('\n\n');
}
