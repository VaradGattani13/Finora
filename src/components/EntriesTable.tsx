'use client';
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';
import { fmtRupee } from '@/lib/format';
import type { EntryDTO } from '@/types/entry';

type SortKey = 'date' | 'amount' | 'category' | 'type';
type Dir = 'asc' | 'desc';
const PAGE = 25;

export default function EntriesTable({
  entries, title, readOnly, onEdit, onDelete,
}: {
  entries: EntryDTO[];
  title: string;
  readOnly?: boolean;
  onEdit?: (e: EntryDTO) => void;
  onDelete?: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>('date');
  const [dir, setDir] = useState<Dir>('desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'deposit'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [shown, setShown] = useState(PAGE);

  // Any change to the filters or ordering starts the list from the top again.
  useEffect(() => { setShown(PAGE); }, [sort, dir, typeFilter, catFilter, entries.length]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (typeFilter !== 'all' && e.type !== typeFilter) return false;
        if (catFilter !== 'all' && e.category !== catFilter) return false;
        return true;
      }),
    [entries, typeFilter, catFilter]
  );

  const sorted = useMemo(() => {
    const mul = dir === 'asc' ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      switch (sort) {
        case 'amount':
          return (a.amount - b.amount) * mul;
        case 'type':
          return a.type.localeCompare(b.type) * mul;
        case 'category': {
          const al = a.category ? CAT_BY_ID[a.category]?.label ?? '' : '';
          const bl = b.category ? CAT_BY_ID[b.category]?.label ?? '' : '';
          return al.localeCompare(bl) * mul;
        }
        default:
          return a.date.localeCompare(b.date) * mul;
      }
    });
  }, [filtered, sort, dir]);

  const page = sorted.slice(0, shown);
  const usedCats = useMemo(
    () => CATEGORIES.filter((c) => entries.some((e) => e.category === c.id)),
    [entries]
  );

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      // Dates and amounts are most useful largest-first on the first click.
      setDir(key === 'amount' || key === 'date' ? 'desc' : 'asc');
    }
  }

  const th = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th
      onClick={() => toggleSort(key)}
      className="th-sort"
      aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      style={{ textAlign: align }}
    >
      {label}
      <span className="sort-caret">{sort === key ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </th>
  );

  return (
    <div className="panel">
      <div className="chart-head">
        <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
        <div className="table-filters">
          <select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
            <option value="all">All types</option>
            <option value="expense">Expenses</option>
            <option value="deposit">Deposits</option>
          </select>
          <select aria-label="Filter by category" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {usedCats.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {(typeFilter !== 'all' || catFilter !== 'all') && (
            <button className="btn-secondary" onClick={() => { setTypeFilter('all'); setCatFilter('all'); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="chart-empty">No entries match these filters.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table style={{ minWidth: 660 }}>
              <thead>
                <tr>
                  {th('date', 'Date')}
                  {th('type', 'Type')}
                  {th('category', 'Category')}
                  <th>Note</th>
                  {th('amount', 'Amount', 'right')}
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {page.map((e) => {
                  const cat = e.type === 'expense' && e.category ? CAT_BY_ID[e.category] : null;
                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                      <td>
                        <span className={`tag ${e.type === 'expense' ? 'exp' : 'dep'}`}>
                          {e.type === 'expense' ? 'Expense' : 'Deposit'}
                        </span>
                      </td>
                      <td>
                        {cat ? (
                          <span className="cat-cell">
                            <span className="legend-swatch" style={{ background: cat.color }} />
                            {cat.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                        )}
                      </td>
                      <td>
                        {e.note}
                        {e.recurringRuleId && (
                          <span className="pill-recurring" title="Created by a recurring rule">recurring</span>
                        )}
                      </td>
                      <td
                        className="amt"
                        style={{ color: e.type === 'expense' ? 'var(--danger)' : 'var(--good)', whiteSpace: 'nowrap' }}
                      >
                        {(e.type === 'expense' ? '−' : '+') + fmtRupee(e.amount).replace('-', '')}
                      </td>
                      {!readOnly && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn-secondary" style={{ marginRight: 4 }} onClick={() => onEdit?.(e)}>
                            Edit
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => onDelete?.(e.id)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="table-foot">
            <span className="muted-note" style={{ margin: 0 }}>
              Showing {page.length} of {sorted.length}
              {sorted.length !== entries.length && ` (filtered from ${entries.length})`}
            </span>
            {shown < sorted.length && (
              <button className="btn-secondary" onClick={() => setShown((s) => s + PAGE)}>
                Show {Math.min(PAGE, sorted.length - shown)} more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
