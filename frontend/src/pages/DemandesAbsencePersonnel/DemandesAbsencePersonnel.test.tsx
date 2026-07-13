import { render, screen } from '@testing-library/react';
import { DemandesAbsencePersonnelPage } from './index';

const DEMANDES = [{
  id: 'd1',
  personnel_id: 'p1',
  date_debut: '2026-07-01',
  date_fin: '2026-07-03',
  motif: 'Raison familiale',
  type_absence: 'PERMISSION',
  statut: 'EN_ATTENTE',
  commentaire: null,
  traite_le: null,
  created_at: '2026-06-28',
  personnel: { utilisateur: { nom_fr: 'DIOP', prenom_fr: 'Moussa' } },
  traiteur: null,
}];

vi.mock('../../hooks/useApi', () => ({
  useApi: () => ({
    get: (path: string) => Promise.resolve(path.startsWith('/api/v1/personnel') ? { data: [] } : DEMANDES),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: { role: 'admin' } }),
}));

describe('DemandesAbsencePersonnelPage', () => {
  it('affiche la liste avec badge de statut et actions de direction', async () => {
    render(<DemandesAbsencePersonnelPage />);
    expect(await screen.findByText(/DIOP/)).toBeInTheDocument();
    // Badge de statut harmonisé (classes du design system) — le libellé apparaît
    // aussi dans les pills de filtre, on cible l'élément portant la classe badge.
    const badge = screen.getAllByText('En attente').find(el => el.classList.contains('badge'));
    expect(badge).toHaveClass('badge', 'badge-warning');
    // Actions direction visibles sur une demande en attente
    expect(screen.getByRole('button', { name: 'Approuver' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: 'Refuser' })).toHaveClass('btn-danger');
  });
});
