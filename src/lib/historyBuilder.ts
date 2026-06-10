import type { ChatMessage } from './chatTypes';

const MAX_TOTAL = 50_000;
const MAX_PER_MSG = 4_000;

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6);
  const tail = max - head - 20;
  return text.slice(0, head) + '\n... [truncated] ...\n' + text.slice(-tail);
}

function summarizeAttachments(msg: ChatMessage): string {
  if (!msg.attachments || msg.attachments.length === 0) return '';
  const lines = msg.attachments.map(a => `[${a.name} — ${a.type}, ${a.size ?? '?'} bytes]`);
  return `\n(attachments: ${lines.join(', ')})`;
}

export function buildHistory(prev: ChatMessage[]): string {
  if (!prev.length) return '';
  const numbered: string[] = [];
  let total = 0;

  for (let i = 0; i < prev.length; i++) {
    const m = prev[i];
    const role = m.role === 'user' ? 'NGƯỜI DÙNG' : 'TRỢ LÝ';
    const body = truncate((m.content || '') + summarizeAttachments(m), MAX_PER_MSG);
    const entry = `--- Tin nhắn ${i + 1} (${role}) ---\n${body}`;
    if (total + entry.length > MAX_TOTAL) {
      numbered.push('--- [history truncated for context limit] ---');
      break;
    }
    numbered.push(entry);
    total += entry.length;
  }
  return `<conversation_so_far>\n${numbered.join('\n\n')}\n</conversation_so_far>`;
}

export function buildApiMessage(opts: {
  systemPrompt?: string;
  history: string;
  webSearchBlock?: string;
  attachmentsBlock?: string;
  userQuestion: string;
}): string {
  const parts: string[] = [];
  if (opts.systemPrompt) parts.push(`<system_prompt>\n${opts.systemPrompt}\n</system_prompt>`);
  if (opts.history) parts.push(opts.history);
  if (opts.webSearchBlock) parts.push(opts.webSearchBlock);
  if (opts.attachmentsBlock) parts.push(opts.attachmentsBlock);
  parts.push(`<user_question>\n${opts.userQuestion}\n</user_question>`);
  return parts.join('\n\n');
}
