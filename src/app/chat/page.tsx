"use client";
import React, { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Search, MessageSquarePlus, Trash2, Settings as SettingsIcon, Pencil, GitBranch, Copy as CopyIcon, RefreshCw, X as XIcon, Send, Globe, Paperclip, BookText, FileDown, Square } from 'lucide-react';
import type { ApiKey, Conversation, ChatMessage, Attachment } from '@/lib/chatTypes';
import { TEMPLATES, CATEGORIES } from '@/lib/templates';
import { buildHistory, buildApiMessage } from '@/lib/historyBuilder';
import { parseFile, buildAttachmentsBlock } from '@/lib/fileParser';
import { exportMarkdown, exportJson, exportText, exportPdf } from '@/lib/exportConversation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import dynamic from 'next/dynamic';
const MermaidBlock = dynamic(() => import('./MermaidBlock'), { ssr: false });

const PERSONA_PRESETS = [
  { name: 'CMO sắc bén', prompt: 'Bạn là một CMO sắc bén, dày dạn trận mạc. Trả lời ngắn gọn, đi thẳng vào ROI và execution. Mọi đề xuất phải gắn với business outcome đo lường được.' },
  { name: 'Senior Content Strategist', prompt: 'Bạn là Senior Content Strategist 10 năm kinh nghiệm. Trả lời có cấu trúc rõ: insight → strategy → execution. Luôn ví dụ cụ thể.' },
  { name: 'Brutally honest CEO', prompt: 'Bạn là một CEO thẳng thắn brutal. Không nói lời an ủi, vạch lỗ hổng trong logic người hỏi, thách thức giả định, đòi data trước khi cho lời khuyên.' },
  { name: 'Coach phát triển bản thân', prompt: 'Bạn là coach phát triển bản thân ấm áp nhưng có chuyên môn. Đặt câu hỏi gợi mở trước khi đưa lời khuyên. Luôn kết bằng action item nhỏ trong 24h.' },
];

export default function ChatPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [activeKey, setActiveKey] = useState<ApiKey | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConv, setCurrentConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPersona, setShowPersona] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string>('');
  const [renamingTitle, setRenamingTitle] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string>('');
  const [editingMsgText, setEditingMsgText] = useState('');
  const [parsingStatus, setParsingStatus] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { reloadKeys(); }, []);
  useEffect(() => { if (activeKey) reloadConversations(); }, [activeKey, searchQuery]);
  useEffect(() => { if (currentConv) reloadMessages(currentConv.id); }, [currentConv]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [messages.length, streaming]);

  const reloadKeys = async () => {
    const r = await fetch('/api/chat/api-keys');
    const d = await r.json();
    const list = (d.keys || []).map((k: any) => ({ id: k.id, name: k.name, key: k.key, twinName: k.twin_name, description: k.description, isActive: k.is_active }));
    setKeys(list);
    const active = list.find((k: ApiKey) => k.isActive) || list[0] || null;
    setActiveKey(active);
  };

  const reloadConversations = async () => {
    const params = new URLSearchParams();
    if (activeKey?.id) params.set('keyId', activeKey.id);
    if (searchQuery) params.set('q', searchQuery);
    const r = await fetch(`/api/chat/conversations?${params}`);
    const d = await r.json();
    const list = (d.conversations || []).map((c: any) => ({
      id: c.id, keyId: c.key_id, title: c.title, systemPrompt: c.system_prompt, remoteId: c.remote_id, namespace: c.namespace, createdAt: c.created_at, updatedAt: c.updated_at,
    }));
    setConversations(list);
  };

  const reloadMessages = async (cid: string) => {
    const r = await fetch(`/api/chat/messages?conversationId=${cid}`);
    const d = await r.json();
    const list = (d.messages || []).map((m: any) => ({
      id: m.id, conversationId: m.conversation_id, role: m.role, content: m.content,
      attachments: m.attachments ? (typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments) : undefined,
      position: m.position, createdAt: m.created_at,
    }));
    setMessages(list);
  };

  const newConv = async () => {
    if (!activeKey) return alert('Hãy thêm 1 API key trước (icon Settings phía trên).');
    const r = await fetch('/api/chat/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId: activeKey.id, title: 'Chat mới' }),
    });
    const d = await r.json();
    if (d.id) {
      await reloadConversations();
      const conv: Conversation = { id: d.id, keyId: activeKey.id, title: 'Chat mới', namespace: d.namespace };
      setCurrentConv(conv);
      setMessages([]);
    }
  };

  const deleteConv = async (id: string) => {
    if (!confirm('Xoá hội thoại này?')) return;
    await fetch('/api/chat/conversations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (currentConv?.id === id) { setCurrentConv(null); setMessages([]); }
    reloadConversations();
  };

  const renameConv = async (id: string, title: string) => {
    await fetch('/api/chat/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title }) });
    setRenamingId(''); reloadConversations();
    if (currentConv?.id === id) setCurrentConv({ ...currentConv, title });
  };

  const savePersona = async (prompt: string) => {
    if (!currentConv) return;
    await fetch('/api/chat/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentConv.id, systemPrompt: prompt }) });
    setCurrentConv({ ...currentConv, systemPrompt: prompt });
    setShowPersona(false);
  };

  const branchFrom = async (msgPosition: number) => {
    if (!currentConv) return;
    const r = await fetch('/api/chat/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: currentConv.id, throughPosition: msgPosition }) });
    const d = await r.json();
    if (d.id) {
      await reloadConversations();
      const newConv = conversations.find(c => c.id === d.id) || { id: d.id, keyId: activeKey!.id, title: (currentConv.title || '') + ' · nhánh' } as Conversation;
      setCurrentConv(newConv as any);
      reloadMessages(d.id);
    }
  };

  const truncateAfter = async (position: number) => {
    if (!currentConv) return;
    await fetch('/api/chat/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: currentConv.id, truncateAfter: position }) });
    reloadMessages(currentConv.id);
  };

  const handleAttachFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      try {
        const att = await parseFile(file, (s) => setParsingStatus(s));
        setAttachments(prev => [...prev, att]);
      } catch (e: any) {
        alert(`Lỗi parse ${file.name}: ${e?.message || e}`);
      }
    }
    setParsingStatus('');
  };

  const stopStream = () => { abortRef.current?.abort(); setStreaming(false); };

  const handleSend = async (overrideText?: string) => {
    if (!activeKey) return alert('Chưa có API key active');
    if (!currentConv) { await newConv(); return; }
    const text = (overrideText ?? input).trim();
    if (!text && !attachments.length) return;

    const userPosition = messages.length;
    const aiPosition = userPosition + 1;
    const userMsg: ChatMessage = { id: 'm_' + nanoid(10), conversationId: currentConv.id, role: 'user', content: text, attachments: attachments.length ? attachments : undefined, position: userPosition };
    const aiMsg: ChatMessage = { id: 'm_' + nanoid(10), conversationId: currentConv.id, role: 'assistant', content: '', position: aiPosition };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput('');
    const currentAttachments = attachments;
    setAttachments([]);

    // Persist user msg
    await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userMsg.id, conversationId: currentConv.id, role: 'user', content: text, attachments: currentAttachments, position: userPosition }) });

    // Optional web search
    let webBlock = '';
    if (webSearchOn) {
      try {
        const r = await fetch('/api/chat/brave-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text }) });
        const d = await r.json();
        if (d.block) webBlock = d.block;
      } catch {}
    }

    const history = buildHistory(messages);
    const attBlock = buildAttachmentsBlock(currentAttachments);
    const apiMessage = buildApiMessage({ systemPrompt: currentConv.systemPrompt || undefined, history, webSearchBlock: webBlock, attachmentsBlock: attBlock, userQuestion: text });

    setStreaming(true);
    abortRef.current = new AbortController();
    let full = '';
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId: activeKey.id, conversationId: currentConv.id, content: apiMessage }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Stream HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
          let eventName = 'message'; const dataLines: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          if (!dataLines.length) continue;
          let payload: any = dataLines.join('\n');
          try { payload = JSON.parse(payload); } catch {}
          if (eventName === 'delta') {
            const chunk = (typeof payload === 'string' ? payload : null) || payload?.content || payload?.delta || '';
            if (chunk) {
              full += chunk;
              setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: full } : m));
            }
          } else if (eventName === 'message_complete') {
            full = payload?.content || full;
            setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: full } : m));
          } else if (eventName === 'error') {
            throw new Error(payload?.message || 'Stream error');
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        full = full || `❌ Lỗi: ${e?.message || e}`;
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: full } : m));
      }
    } finally {
      setStreaming(false);
      await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: aiMsg.id, conversationId: currentConv.id, role: 'assistant', content: full, position: aiPosition }) });

      // Auto-rename if it's the very first AI response
      if (userPosition === 0 && full) autoRenameConv(currentConv, text, full);
    }
  };

  const autoRenameConv = async (conv: Conversation, userQ: string, aiA: string) => {
    let title = '';
    try {
      const r = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuestion: userQ, aiAnswer: aiA }),
      });
      if (r.ok) {
        const d = await r.json();
        title = (d.title || '').trim();
      }
    } catch { /* fall through to fallback */ }
    if (!title) title = userQ.replace(/\s+/g, ' ').slice(0, 60) || 'Chat mới';
    await fetch('/api/chat/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: conv.id, title }) });
    setCurrentConv({ ...conv, title });
    reloadConversations();
  };

  const regenerateLast = async () => {
    const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx < 0) return;
    const realIdx = messages.length - 1 - lastUserIdx;
    const userMsg = messages[realIdx];
    await truncateAfter(realIdx);
    setMessages(prev => prev.slice(0, realIdx));
    setTimeout(() => handleSend(userMsg.content), 50);
  };

  const startEditMsg = (m: ChatMessage) => { setEditingMsgId(m.id); setEditingMsgText(m.content); };

  const submitEditMsg = async (m: ChatMessage) => {
    await truncateAfter(m.position);
    setMessages(prev => prev.slice(0, m.position));
    setEditingMsgId('');
    setTimeout(() => handleSend(editingMsgText), 50);
  };

  const onCompose = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-shell">
      <ChatSidebar
        open={sidebarOpen} setOpen={setSidebarOpen}
        keys={keys} activeKey={activeKey} setActiveKey={async (k: ApiKey) => {
          await fetch('/api/chat/api-keys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, setActive: true }) });
          setActiveKey(k);
        }}
        conversations={conversations} currentConv={currentConv} setCurrentConv={setCurrentConv}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        onNew={newConv} onDelete={deleteConv}
        renamingId={renamingId} renamingTitle={renamingTitle} setRenamingId={setRenamingId} setRenamingTitle={setRenamingTitle} submitRename={renameConv}
        onOpenKeyModal={() => setShowKeyModal(true)}
      />

      <div className="chat-main">
        <div className="frosted" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', minHeight: 52 }}>
          <button className="btn-ghost" onClick={() => setSidebarOpen(o => !o)} style={{ display: 'none' }}>☰</button>
          <div style={{ flex: 1, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
            {currentConv?.title || 'Twin Chat'}
          </div>
          {currentConv && (
            <>
              <button className="btn-ghost" onClick={() => setShowPersona(true)} title="Persona / System prompt"><BookText size={16} /></button>
              <ExportMenu onPick={(fmt) => {
                if (!currentConv) return;
                if (fmt === 'md') exportMarkdown(currentConv, messages);
                if (fmt === 'json') exportJson(currentConv, messages);
                if (fmt === 'txt') exportText(currentConv, messages);
                if (fmt === 'pdf') exportPdf(currentConv, messages);
              }} />
            </>
          )}
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 16px', color: 'var(--color-body-muted)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, marginBottom: 12, color: 'var(--color-ink)', letterSpacing: '-0.022em' }}>
                  Twin của bạn đã sẵn sàng.
                </div>
                <p style={{ fontSize: 17, marginBottom: 24 }}>Hỏi bất cứ gì. Hoặc bắt đầu từ một template.</p>
                <button className="btn-primary" onClick={() => setShowTemplates(true)}>📚 Mở thư viện template</button>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                msg={m}
                editingId={editingMsgId}
                editingText={editingMsgText}
                setEditingText={setEditingMsgText}
                onStartEdit={() => startEditMsg(m)}
                onSubmitEdit={() => submitEditMsg(m)}
                onCancelEdit={() => setEditingMsgId('')}
                onCopy={() => { navigator.clipboard.writeText(m.content); }}
                onBranch={() => branchFrom(m.position)}
                onDelete={async () => { await fetch('/api/chat/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) }); reloadMessages(currentConv!.id); }}
                onRegen={i === messages.length - 1 && m.role === 'assistant' ? regenerateLast : undefined}
                streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
              />
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--color-hairline)', background: 'var(--color-canvas)' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {!!attachments.length && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {attachments.map(a => (
                  <span key={a.id} style={{ background: 'var(--color-surface-pearl)', padding: '6px 10px', borderRadius: 8, fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    📎 {a.name}
                    <button className="btn-ghost" style={{ padding: 2 }} onClick={() => setAttachments(prev => prev.filter(x => x.id !== a.id))}><XIcon size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            {parsingStatus && <div style={{ fontSize: 12, color: 'var(--color-body-muted)', marginBottom: 6 }}>⏳ {parsingStatus}</div>}

            <div className="composer">
              <textarea
                ref={composerRef}
                placeholder={currentConv ? 'Hỏi gì đó… (Enter để gửi, Shift+Enter xuống dòng)' : 'Tạo Chat mới ở sidebar để bắt đầu'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onCompose}
                rows={Math.min(6, Math.max(1, input.split('\n').length))}
                disabled={!currentConv}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="btn-ghost" style={{ cursor: 'pointer', padding: 6 }} title="Đính kèm file">
                  <Paperclip size={16} />
                  <input type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && handleAttachFiles(e.target.files)} />
                </label>
                <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setShowTemplates(true)} title="Templates"><BookText size={16} /></button>
                <button
                  className="btn-ghost"
                  style={{ padding: 6, color: webSearchOn ? 'var(--color-primary)' : undefined }}
                  onClick={() => setWebSearchOn(v => !v)}
                  title="Web Search (Brave)"
                ><Globe size={16} /></button>
                <div style={{ marginLeft: 'auto' }}>
                  {streaming ? (
                    <button className="btn-icon" onClick={stopStream} title="Dừng"><Square size={14} /></button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => handleSend()}
                      disabled={!currentConv || (!input.trim() && !attachments.length)}
                      style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Send size={14} /> Gửi
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTemplates && <TemplatesPicker onClose={() => setShowTemplates(false)} onPick={(t) => { setInput(t.prompt); setShowTemplates(false); composerRef.current?.focus(); }} />}
      {showPersona && currentConv && <PersonaModal current={currentConv.systemPrompt || ''} onClose={() => setShowPersona(false)} onSave={savePersona} />}
      {showKeyModal && <ApiKeysModal onClose={() => setShowKeyModal(false)} onChange={reloadKeys} />}
    </div>
  );
}

// ============== SUB COMPONENTS ==============

function ChatSidebar(props: any) {
  const { keys, activeKey, setActiveKey, conversations, currentConv, setCurrentConv, searchQuery, setSearchQuery, onNew, onDelete, renamingId, renamingTitle, setRenamingId, setRenamingTitle, submitRename, onOpenKeyModal, open } = props;
  return (
    <aside className={`chat-sidebar${open ? ' open' : ''}`}>
      <div style={{ padding: '14px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <a href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--color-ink)' }}>← Pipeline</a>
          <button className="btn-ghost" style={{ padding: 6, marginLeft: 'auto' }} title="Quản lý API key" onClick={onOpenKeyModal}><SettingsIcon size={16} /></button>
        </div>

        {keys.length > 1 && (
          <select
            value={activeKey?.id || ''}
            onChange={(e) => { const k = keys.find((x: ApiKey) => x.id === e.target.value); if (k) setActiveKey(k); }}
            className="input-field"
            style={{ padding: '8px 10px', marginBottom: 8 }}
          >
            {keys.map((k: ApiKey) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        )}

        <button className="btn-primary" onClick={onNew} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
          <Plus size={14} /> Chat mới
        </button>

        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--color-ink-muted-48)' }} />
          <input
            placeholder="Tìm hội thoại..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ padding: '7px 12px 7px 30px', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 14px' }}>
        {conversations.map((c: Conversation) => (
          <div key={c.id} className={`conv-item${currentConv?.id === c.id ? ' active' : ''}`} onClick={() => setCurrentConv(c)}>
            {renamingId === c.id ? (
              <input
                autoFocus
                className="input-field"
                style={{ padding: '2px 6px', fontSize: 13 }}
                value={renamingTitle}
                onChange={e => setRenamingTitle(e.target.value)}
                onBlur={() => submitRename(c.id, renamingTitle)}
                onKeyDown={e => { if (e.key === 'Enter') submitRename(c.id, renamingTitle); if (e.key === 'Escape') setRenamingId(''); }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="conv-title" onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenamingTitle(c.title); }}>{c.title || 'Untitled'}</span>
            )}
            <button className="btn-ghost" style={{ padding: 2 }} onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenamingTitle(c.title); }}><Pencil size={11} /></button>
            <button className="btn-ghost" style={{ padding: 2, color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}><Trash2 size={12} /></button>
          </div>
        ))}
        {conversations.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--color-body-muted)' }}>Chưa có hội thoại nào.</div>}
      </div>
    </aside>
  );
}

function MessageBubble({ msg, editingId, editingText, setEditingText, onStartEdit, onSubmitEdit, onCancelEdit, onCopy, onBranch, onDelete, onRegen, streaming }: any) {
  const isEditing = editingId === msg.id;
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {isEditing ? (
          <div className="composer" style={{ maxWidth: '70%' }}>
            <textarea
              value={editingText}
              onChange={e => setEditingText(e.target.value)}
              autoFocus
              rows={4}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmitEdit(); } if (e.key === 'Escape') onCancelEdit(); }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={onCancelEdit}>Huỷ</button>
              <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={onSubmitEdit}>Gửi lại</button>
            </div>
          </div>
        ) : (
          <div className="bubble-user">{msg.content}</div>
        )}
        {!!msg.attachments?.length && (
          <div style={{ fontSize: 12, color: 'var(--color-body-muted)' }}>📎 {msg.attachments.map((a: Attachment) => a.name).join(', ')}</div>
        )}
        {!isEditing && (
          <div style={{ display: 'flex', gap: 4, opacity: 0.6, fontSize: 12 }}>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={onCopy} title="Copy"><CopyIcon size={12} /></button>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={onStartEdit} title="Sửa"><Pencil size={12} /></button>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={onBranch} title="Tạo nhánh"><GitBranch size={12} /></button>
            <button className="btn-ghost" style={{ padding: 4, color: 'var(--color-danger)' }} onClick={onDelete} title="Xoá"><Trash2 size={12} /></button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="bubble-ai">
      <div className={`prose-msg${streaming && !msg.content ? ' stream-cursor' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code({ inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match?.[1];
              const raw = String(children ?? '').replace(/\n$/, '');
              if (!inline && lang === 'mermaid') return <MermaidBlock code={raw} />;
              return <code className={className} {...props}>{children}</code>;
            },
          }}
        >
          {msg.content || ''}
        </ReactMarkdown>
        {streaming && msg.content && <span className="stream-cursor" />}
      </div>
      <div style={{ display: 'flex', gap: 4, opacity: 0.6, fontSize: 12, marginTop: 6 }}>
        <button className="btn-ghost" style={{ padding: 4 }} onClick={onCopy} title="Copy"><CopyIcon size={12} /></button>
        {onRegen && <button className="btn-ghost" style={{ padding: 4 }} onClick={onRegen} title="Regenerate"><RefreshCw size={12} /></button>}
        <button className="btn-ghost" style={{ padding: 4 }} onClick={onBranch} title="Tạo nhánh"><GitBranch size={12} /></button>
        <button className="btn-ghost" style={{ padding: 4, color: 'var(--color-danger)' }} onClick={onDelete} title="Xoá"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function TemplatesPicker({ onClose, onPick }: { onClose: () => void; onPick: (t: any) => void }) {
  const [cat, setCat] = useState<string>('Tất cả');
  const [q, setQ] = useState('');
  const filtered = TEMPLATES.filter(t => (cat === 'Tất cả' || t.category === cat) && (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.prompt.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 18 }}>📚 50 Quick Prompts</h3>
          <button className="btn-ghost" onClick={onClose}><XIcon size={18} /></button>
        </div>
        <div style={{ padding: '12px 20px 0' }}>
          <input className="input-field" placeholder="Tìm template..." value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className={`tag ${cat === 'Tất cả' ? 'active' : ''}`} onClick={() => setCat('Tất cả')}>Tất cả</button>
            {CATEGORIES.map(c => <button key={c} className={`tag ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {filtered.map(t => (
            <div key={t.id} className="card-pearl" style={{ cursor: 'pointer', padding: 14 }} onClick={() => onPick(t)}>
              <div style={{ fontSize: 11, color: 'var(--color-body-muted)', marginBottom: 4 }}>{t.category}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-muted-80)', lineHeight: 1.4 }}>{t.prompt.slice(0, 110)}…</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonaModal({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (p: string) => void }) {
  const [text, setText] = useState(current);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 18 }}>🎭 Persona / System prompt</h3>
          <button className="btn-ghost" onClick={onClose}><XIcon size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--color-body-muted)', marginBottom: 10 }}>Áp dụng cho hội thoại hiện tại. Sẽ được prepend vào mỗi tin nhắn.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {PERSONA_PRESETS.map(p => <button key={p.name} className="tag" onClick={() => setText(p.prompt)}>{p.name}</button>)}
          </div>
          <textarea
            className="input-field"
            style={{ minHeight: 180, resize: 'vertical', fontFamily: 'var(--font-text)', fontSize: 14 }}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ví dụ: Bạn là một Marketing Strategist sắc bén..."
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn-ghost" onClick={onClose}>Huỷ</button>
            <button className="btn-primary" onClick={() => onSave(text)}>Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeysModal({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', key: '', twinName: '', description: '' });
  const [validating, setValidating] = useState('');
  const [validateResult, setValidateResult] = useState<any>(null);

  const load = async () => {
    const r = await fetch('/api/chat/api-keys');
    const d = await r.json();
    setKeys(d.keys || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.key || !form.name) return alert('Cần name + key');
    await fetch('/api/chat/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, isActive: keys.length === 0 }) });
    setForm({ name: '', key: '', twinName: '', description: '' });
    load(); onChange();
  };
  const del = async (id: string) => { if (!confirm('Xoá key?')) return; await fetch('/api/chat/api-keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load(); onChange(); };
  const setActive = async (id: string) => { await fetch('/api/chat/api-keys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, setActive: true }) }); load(); onChange(); };
  const rename = async (id: string, name: string) => { await fetch('/api/chat/api-keys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) }); load(); onChange(); };
  const validate = async (apiKey: string) => {
    setValidating(apiKey); setValidateResult(null);
    const r = await fetch('/api/chat/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) });
    const d = await r.json();
    setValidateResult(d);
    setValidating('');
  };

  const mask = (k: string) => k.length <= 14 ? k : `${k.slice(0, 8)}...${k.slice(-4)}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 18 }}>🔑 API Keys (TwinExpert)</h3>
          <button className="btn-ghost" onClick={onClose}><XIcon size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="card-pearl" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 10, fontSize: 14 }}>Thêm key mới</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input className="input-field" placeholder="Tên (vd: Personal)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder="Twin ID" value={form.twinName} onChange={e => setForm({ ...form, twinName: e.target.value })} />
            </div>
            <input className="input-field" placeholder="API key (sk-... / twe_...)" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} style={{ marginBottom: 8, fontFamily: 'var(--font-mono)' }} />
            <input className="input-field" placeholder="Mô tả (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ marginBottom: 10 }} />
            <button className="btn-primary" onClick={add}>+ Thêm key</button>
          </div>

          {keys.map(k => (
            <div key={k.id} className="card" style={{ marginBottom: 10, padding: 14, borderColor: k.is_active ? 'var(--color-primary)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input defaultValue={k.name} onBlur={(e) => e.target.value !== k.name && rename(k.id, e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 15, fontWeight: 600, outline: 'none', flex: 1 }} />
                {k.is_active ? <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>● ACTIVE</span> : <button className="btn-ghost" onClick={() => setActive(k.id)}>Set active</button>}
                <button className="btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={() => del(k.id)}><Trash2 size={14} /></button>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-body-muted)' }}>{mask(k.key || '')}</div>
              {k.twin_name && <div style={{ fontSize: 12, color: 'var(--color-body-muted)' }}>Twin: {k.twin_name}</div>}
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button className="btn-ghost" onClick={() => validate(k.key)} disabled={validating === k.key}>{validating === k.key ? 'Đang check...' : '✓ Validate + Usage'}</button>
              </div>
              {validateResult && validating === '' && validateResult.usage && (
                <div style={{ marginTop: 8, padding: 8, background: 'var(--color-surface-pearl)', borderRadius: 8, fontSize: 12 }}>
                  <div>✅ Key hợp lệ.</div>
                  {validateResult.usage.day_used !== undefined && (
                    <div>Hôm nay: {validateResult.usage.day_used}/{validateResult.usage.day_limit ?? '∞'} requests</div>
                  )}
                  {validateResult.usage.month_used !== undefined && (
                    <div>Tháng này: {validateResult.usage.month_used}/{validateResult.usage.month_limit ?? '∞'}</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {keys.length === 0 && <div style={{ color: 'var(--color-body-muted)', fontSize: 13 }}>Chưa có API key nào. Tạo tại <a href="https://twinexpert.com/profile/api-keys" target="_blank" rel="noreferrer">TwinExpert</a>.</div>}
        </div>
      </div>
    </div>
  );
}

function ExportMenu({ onPick }: { onPick: (fmt: 'md' | 'json' | 'txt' | 'pdf') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-ghost" onClick={() => setOpen(o => !o)} title="Export"><FileDown size={16} /></button>
      {open && (
        <div onMouseLeave={() => setOpen(false)} style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 11, boxShadow: 'var(--shadow-elevated)', padding: 6, minWidth: 140, zIndex: 30 }}>
          {(['md', 'json', 'txt', 'pdf'] as const).map(f => (
            <button key={f} className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', display: 'flex' }} onClick={() => { onPick(f); setOpen(false); }}>{f.toUpperCase()}</button>
          ))}
        </div>
      )}
    </div>
  );
}
