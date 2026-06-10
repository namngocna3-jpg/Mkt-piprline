"use client";
import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

type Settings = Record<string, string>;

const SECTIONS: { title: string; subtitle: string; items: { key: string; label: string; placeholder?: string; type?: string; hint?: string; secret?: boolean; }[] }[] = [
  {
    title: 'AI Viết bài',
    subtitle: 'Cấu hình các provider sinh text cho Dashboard.',
    items: [
      { key: 'ANTHROPIC_API_KEY', label: 'Anthropic Claude', placeholder: 'sk-ant-...', secret: true, hint: 'console.anthropic.com' },
      { key: 'ANTHROPIC_MODEL', label: 'Claude model', placeholder: 'claude-opus-4-5' },
      { key: 'OPENAI_API_KEY', label: 'OpenAI', placeholder: 'sk-...', secret: true, hint: 'platform.openai.com' },
      { key: 'OPENAI_MODEL', label: 'OpenAI model', placeholder: 'gpt-4o' },
      { key: 'GEMINI_API_KEY', label: 'Google Gemini', placeholder: 'AIza...', secret: true, hint: 'aistudio.google.com' },
      { key: 'GEMINI_MODEL', label: 'Gemini model', placeholder: 'gemini-2.0-flash' },
    ],
  },
  {
    title: 'TwinExpert (Twin Chat)',
    subtitle: 'Twin Chat (/chat) hỗ trợ nhiều API key — quản lý trong giao diện chat. Đây là default fallback cho Dashboard.',
    items: [
      { key: 'TWINEXPERT_API_KEY', label: 'TwinExpert default key', placeholder: 'twe_...', secret: true, hint: 'twinexpert.com/profile/api-keys' },
      { key: 'TWINEXPERT_TWIN_ID', label: 'Default Twin ID', placeholder: 'twin_xxx' },
    ],
  },
  {
    title: 'Tạo ảnh',
    subtitle: 'AI image generation cho Dashboard.',
    items: [
      { key: 'IMAGE_PROVIDER', label: 'Provider', placeholder: 'openai hoặc gemini', hint: 'Mặc định: openai (DALL-E 3). Gemini dùng imagen-3.0' },
    ],
  },
  {
    title: 'Research / Scraping',
    subtitle: 'API key cho RSS, X (Twitter via Apify) và Brave Web Search.',
    items: [
      { key: 'RAPID_API_KEY', label: 'RapidAPI', placeholder: 'rapidapi...', secret: true, hint: 'rapidapi.com — dùng cào X/Instagram' },
      { key: 'BRAVE_API_KEY', label: 'Brave Search', placeholder: 'BSA...', secret: true, hint: 'api.search.brave.com' },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [twinValidation, setTwinValidation] = useState<{ valid?: boolean; error?: string; usage?: any } | null>(null);
  const [validating, setValidating] = useState(false);
  const [twins, setTwins] = useState<any[]>([]);
  const [twinsLoading, setTwinsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { if (d.settings) setSettings(d.settings); });
  }, []);

  const update = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setLoading(true); setSaveMsg('');
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
    const d = await res.json();
    setLoading(false);
    setSaveMsg(d.success ? '✓ Đã lưu' : `Lỗi: ${d.error || 'unknown'}`);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const validateTwin = async () => {
    if (!settings.TWINEXPERT_API_KEY) return;
    setValidating(true); setTwinValidation(null);
    const r = await fetch('/api/chat/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: settings.TWINEXPERT_API_KEY }) });
    setTwinValidation(await r.json());
    setValidating(false);
  };

  const fetchTwins = async () => {
    setTwinsLoading(true);
    const r = await fetch(`/api/twinexpert/twins?apiKey=${encodeURIComponent(settings.TWINEXPERT_API_KEY || '')}`);
    const d = await r.json();
    setTwins(d.twins || []);
    setTwinsLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Settings</h1>
      <p style={{ color: 'var(--color-body-muted)', marginBottom: 32, fontSize: 17 }}>
        API key được lưu trong Supabase Postgres, không cần restart server. Hệ thống ưu tiên giá trị ở DB, fallback sang .env.
      </p>

      {SECTIONS.map(section => (
        <section key={section.title} style={{ marginBottom: 36 }}>
          <h3 style={{ marginBottom: 4 }}>{section.title}</h3>
          <p style={{ color: 'var(--color-body-muted)', fontSize: 14, marginBottom: 16 }}>{section.subtitle}</p>
          <div className="card" style={{ padding: 6 }}>
            {section.items.map((item, idx) => {
              const shown = !!reveal[item.key];
              return (
                <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, padding: '14px 16px', borderBottom: idx < section.items.length - 1 ? '1px solid var(--color-divider-soft)' : 'none', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{item.label}</div>
                    {item.hint && <div style={{ fontSize: 12, color: 'var(--color-body-muted)', marginTop: 2 }}>{item.hint}</div>}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={item.secret && !shown ? 'password' : 'text'}
                      className="input-field"
                      placeholder={item.placeholder}
                      value={settings[item.key] || ''}
                      onChange={e => update(item.key, e.target.value)}
                      style={{ paddingRight: item.secret ? 38 : 14, fontFamily: item.secret ? 'var(--font-mono)' : undefined, fontSize: item.secret ? 13 : 15 }}
                    />
                    {item.secret && (
                      <button
                        type="button"
                        onClick={() => setReveal(r => ({ ...r, [item.key]: !r[item.key] }))}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)' }}
                      >
                        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {section.title === 'TwinExpert (Twin Chat)' && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={validateTwin} disabled={validating || !settings.TWINEXPERT_API_KEY}>
                {validating ? 'Đang check...' : 'Validate + Usage'}
              </button>
              <button className="btn-secondary" onClick={fetchTwins} disabled={twinsLoading || !settings.TWINEXPERT_API_KEY}>
                {twinsLoading ? 'Đang tải...' : 'Lấy danh sách Twins'}
              </button>
              {twinValidation && (
                <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, color: twinValidation.valid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {twinValidation.valid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {twinValidation.valid ? 'Key hợp lệ' : (twinValidation.error || 'Invalid')}
                </span>
              )}
            </div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && twinValidation?.usage && (
            <div className="card-pearl" style={{ marginTop: 8, fontSize: 13, padding: 12 }}>
              <div><b>Usage:</b></div>
              {twinValidation.usage.day_used !== undefined && <div>Hôm nay: {twinValidation.usage.day_used} / {twinValidation.usage.day_limit ?? '∞'}</div>}
              {twinValidation.usage.month_used !== undefined && <div>Tháng này: {twinValidation.usage.month_used} / {twinValidation.usage.month_limit ?? '∞'}</div>}
              {!twinValidation.usage.day_used && !twinValidation.usage.month_used && <div style={{ color: 'var(--color-body-muted)' }}>API không trả về thông tin usage chuẩn — dữ liệu raw: <code style={{ fontSize: 11 }}>{JSON.stringify(twinValidation.usage).slice(0, 200)}</code></div>}
            </div>
          )}

          {section.title === 'TwinExpert (Twin Chat)' && twins.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {twins.map((t: any) => {
                const tid = t.id || t._id || t.twin_id || t.twinId || '';
                const name = t.name || t.title || t.display_name || tid;
                const active = settings.TWINEXPERT_TWIN_ID === tid;
                return (
                  <div
                    key={tid}
                    onClick={() => update('TWINEXPERT_TWIN_ID', tid)}
                    className="card-pearl"
                    style={{ padding: 10, cursor: 'pointer', borderRadius: 11, border: active ? '2px solid var(--color-primary)' : '1px solid transparent' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-body-muted)', fontFamily: 'var(--font-mono)' }}>{tid}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      <div style={{ position: 'sticky', bottom: 0, padding: '16px 0', background: 'var(--color-canvas-parchment)', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--color-hairline)' }}>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu tất cả'}</button>
        {saveMsg && <span style={{ fontSize: 14, color: saveMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)' }}>{saveMsg}</span>}
      </div>
    </div>
  );
}
