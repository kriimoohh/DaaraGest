import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PortailParentPage } from './index';

const DATA = {
  etablissement: { nom_fr: 'École Test', logo_url: null },
  eleve: { id: 'e1', nom_fr: 'FALL', prenom_fr: 'Awa', matricule: 'CAAM-E-26-001', sexe: 'F' },
  inscription: {
    annee_scolaire: { id: 'a1', libelle: '2025-2026' },
    classe_fr: { id: 'c1', nom_fr: 'CM2 A', filiere: 'FR' },
    classe_ar: null,
  },
  note_max_base: 20,
  notes: [{
    id: 'n1', periode: 1, valeur: '15',
    note_max_effectif: 20, coeff_effectif: 2,
    matiere: { nom_fr: 'Mathématiques', nom_ar: 'رياضيات', filiere: 'FR', coeff_defaut: '2' },
  }],
  bulletins: [],
  paiements: [],
  absences: [],
  evaluations_formatives: [],
  activites: [],
};

function renderPortail() {
  return render(
    <MemoryRouter initialEntries={['/portail/tok-123']}>
      <Routes>
        <Route path="/portail/:token" element={<PortailParentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortailParentPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('affiche l\'élève et ses notes quand le lien est valide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(DATA) }));
    renderPortail();
    expect(await screen.findByText('FALL')).toBeInTheDocument();
    expect(screen.getByText('École Test')).toBeInTheDocument();
    expect(screen.getByText('CAAM-E-26-001')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques')).toBeInTheDocument();
  });

  it('affiche l\'état d\'erreur quand le lien est invalide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    renderPortail();
    expect(await screen.findByText('portail_parent.invalide')).toBeInTheDocument();
  });
});
