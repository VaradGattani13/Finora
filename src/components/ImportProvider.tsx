'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CATEGORIES } from '@/lib/categories';
import { fmtRupee } from '@/lib/format';

type Suggestion = {
  date: string;
  narration: string;
  amount: number;
  balance: number;
  type: 'expense' | 'deposit';
  raw: string;
  category: string | null;
  keep?: boolean;
};

type Ctx = {
  openJson: () => void;
  openPdf: () => void;
  busy: boolean;
  /** Bumped after every successful import so consumers can refetch. */
  version: number;
};

const ImportCtx = createContext<Ctx | null>(null);

export default function ImportProvider({ children }: { children: React.ReactNode }) {
  const jsonRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'info' | 'error' } | null>(null);
  const [pdfMeta, setPdfMeta] = useState<{ total: number; kept: number } | null>(null);
  const [version, setVersion] = useState(0);

  const openJson = useCallback(() => jsonRef.current?.click(), []);
  const openPdf = useCallback(() => pdfRef.current?.click(), []);

  async function pickJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setMsg({
        text: `Imported ${data.created} entries${data.skipped ? ` (skipped ${data.skipped})` : ''}.`,
        kind: 'info',
      });
      setVersion((v) => v + 1);
    } catch (err: any) {
      setMsg({ text: err.message, kind: 'error' });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function pickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PDF parse failed');
      setSuggestions((data.suggestions as Suggestion[]).map((s) => ({ ...s, keep: true })));
      setPdfMeta({ total: data.totalRows, kept: data.kept });
      setMsg(null);
    } catch (err: any) {
      setMsg({ text: err.message, kind: 'error' });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function commitAll() {
    const kept = suggestions.filter((s) => s.keep !== false);
    if (kept.length === 0) return;
    const entries = kept.map((s) => ({
      date: s.date,
      type: s.type,
      category: s.type === 'expense' ? s.category ?? 'misc' : null,
      amount: s.amount,
      note: s.narration.slice(0, 120),
    }));
    setBusy(true);
    try {
      const res = await fetch('/api/entries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMsg({ text: `Saved ${data.created} entries.`, kind: 'info' });
      setSuggestions([]); setPdfMeta(null);
      setVersion((v) => v + 1);
    } catch (err: any) {
      setMsg({ text: err.message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const keptCount = suggestions.filter((s) => s.keep !== false).length;

  return (
    <ImportCtx.Provider value={{ openJson, openPdf, busy, version }}>
      {children}

      <input ref={jsonRef} type="file" accept=".json,application/json" onChange={pickJson} style={{ display: 'none' }} />
      <input ref={pdfRef} type="file" accept=".pdf,application/pdf" onChange={pickPdf} style={{ display: 'none' }} />

      {/* Toast — import runs from the header menu, so feedback has to travel with it. */}
      {(busy || msg) && (
        <div
          role="status"
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 80,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--menu-bg)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${msg?.kind === 'error' ? 'var(--danger)' : 'var(--accent)'}`,
            borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow)',
            fontSize: 13, color: 'var(--text-primary)', maxWidth: 340,
          }}
        >
          <span>{busy ? 'Working…' : msg?.text}</span>
          {!busy && (
            <button className="btn-secondary" style={{ padding: '2px 8px' }} onClick={() => setMsg(null)}>
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* PDF review modal */}
      {suggestions.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70, display: 'grid', placeItems: 'center',
            background: 'rgba(0,0,0,0.45)', padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSuggestions([]); setPdfMeta(null); } }}
        >
          <div className="panel" style={{ width: 900, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>Review imported rows</h2>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {pdfMeta &&
                `Parsed ${pdfMeta.total} rows, ${pdfMeta.kept} above ₹10. Uncheck to skip; adjust type and category as needed.`}
            </div>

            <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th></th><th>Date</th><th>Type</th><th>Category</th><th>Narration</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="checkbox"
                          checked={s.keep !== false}
                          onChange={(e) => {
                            const c = [...suggestions];
                            c[i] = { ...c[i], keep: e.target.checked };
                            setSuggestions(c);
                          }}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{s.date}</td>
                      <td>
                        <select
                          value={s.type}
                          onChange={(e) => {
                            const c = [...suggestions];
                            const type = e.target.value as 'expense' | 'deposit';
                            c[i] = { ...c[i], type, category: type === 'deposit' ? null : c[i].category };
                            setSuggestions(c);
                          }}
                        >
                          <option value="expense">Expense</option>
                          <option value="deposit">Deposit</option>
                        </select>
                      </td>
                      <td>
                        {s.type === 'expense' ? (
                          <select
                            value={s.category ?? ''}
                            onChange={(e) => {
                              const c = [...suggestions];
                              c[i] = { ...c[i], category: e.target.value || null };
                              setSuggestions(c);
                            }}
                          >
                            <option value="">— pick —</option>
                            {CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{s.narration}</td>
                      <td className="amt" style={{ color: s.type === 'expense' ? 'var(--danger)' : 'var(--good)' }}>
                        {(s.type === 'expense' ? '−' : '+') + fmtRupee(s.amount).replace('-', '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn" onClick={commitAll} disabled={busy || keptCount === 0}>
                Save {keptCount} entries
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setSuggestions([]); setPdfMeta(null); }}
                disabled={busy}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </ImportCtx.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportCtx);
  if (!ctx) throw new Error('useImport must be used inside <ImportProvider>');
  return ctx;
}
