interface PaginationProps { page: number; total: number; limit: number; onChange: (page: number) => void; }

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);
  if (total === 0) return null;

  return (
    <div className="pagination">
      <span>
        {from}–{to} sur <span className="font-mono">{total}</span> résultat{total > 1 ? 's' : ''}
      </span>
      <div className="row gap-2">
        <button
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
          Précédent
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Suivant
          <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
        </button>
      </div>
    </div>
  );
}
