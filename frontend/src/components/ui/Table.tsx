import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  headerRender?: () => React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div style={{ height: 14, background: 'var(--paper-3)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export function Table<T extends Record<string, unknown>>({
  columns, data, loading = false, emptyMessage = 'Aucun résultat',
  sortKey, sortDir, onSort,
}: TableProps<T>) {
  return (
    <div className="card">
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map(col => {
                const isSorted = sortKey === col.key;
                const canSort = col.sortable && onSort;
                return (
                  <th
                    key={col.key}
                    onClick={canSort ? () => onSort(col.key) : undefined}
                    style={{ cursor: canSort ? 'pointer' : undefined, width: col.width }}
                  >
                    {col.headerRender ? col.headerRender() : canSort ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {col.header}
                        <span style={{ color: isSorted ? 'var(--terra)' : 'var(--ink-4)', fontSize: 10 }}>
                          {isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </span>
                    ) : col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
              : data.length === 0
                ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="empty">{emptyMessage}</div>
                    </td>
                  </tr>
                )
                : data.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td key={col.key}>
                        {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
