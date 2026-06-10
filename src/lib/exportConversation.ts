import type { ChatMessage, Conversation } from './chatTypes';

function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMarkdown(conv: Conversation, msgs: ChatMessage[]) {
  const lines: string[] = [];
  lines.push(`# ${conv.title || 'Untitled'}`);
  lines.push('');
  lines.push(`> Tạo: ${conv.createdAt || ''} · ${msgs.length} messages`);
  if (conv.systemPrompt) {
    lines.push('');
    lines.push('## System prompt');
    lines.push('```');
    lines.push(conv.systemPrompt);
    lines.push('```');
  }
  lines.push('');
  for (const m of msgs) {
    lines.push(`### ${m.role === 'user' ? '👤 User' : '🤖 Assistant'}`);
    lines.push('');
    lines.push(m.content);
    if (m.attachments && m.attachments.length) {
      lines.push('');
      lines.push('_Attachments:_');
      for (const a of m.attachments) lines.push(`- ${a.name} (${a.type})`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  download(`${slug(conv.title)}.md`, lines.join('\n'), 'text/markdown');
}

export function exportJson(conv: Conversation, msgs: ChatMessage[]) {
  download(`${slug(conv.title)}.json`, JSON.stringify({ conversation: conv, messages: msgs }, null, 2), 'application/json');
}

export function exportText(conv: Conversation, msgs: ChatMessage[]) {
  const text = msgs.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n');
  download(`${slug(conv.title)}.txt`, text);
}

export function exportPdf(conv: Conversation, msgs: ChatMessage[]) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(conv.title)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; line-height: 1.5; max-width: 820px; margin: 0 auto; color: #1d1d1f; }
    .role { font-weight: 600; margin-top: 18px; }
    .user { color: #0066cc; }
    .assistant { color: #1d1d1f; }
    pre { background: #f5f5f7; padding: 12px; border-radius: 8px; overflow-x: auto; }
    code { font-family: "SF Mono", Menlo, monospace; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }
    @media print { body { padding: 12mm; } }
  </style></head><body>
    <h1>${escapeHtml(conv.title || 'Untitled')}</h1>
    ${conv.systemPrompt ? `<details><summary>System prompt</summary><pre>${escapeHtml(conv.systemPrompt)}</pre></details>` : ''}
    ${msgs.map(m => `
      <div class="role ${m.role}">${m.role === 'user' ? '👤 User' : '🤖 Assistant'}</div>
      <div>${escapeHtml(m.content).replace(/\n/g, '<br/>')}</div>
      <hr/>
    `).join('')}
    <script>window.onload = () => setTimeout(() => window.print(), 500)</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function slug(s: string) {
  return (s || 'conversation').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'chat';
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
}
