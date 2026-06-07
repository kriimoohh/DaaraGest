import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from './Badge';

describe('Badge', () => {
  it('affiche le libellé', () => {
    render(<Badge label="Actif" variant="success" />);
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('applique la classe de la variante (error → badge-danger)', () => {
    render(<Badge label="KO" variant="error" />);
    expect(screen.getByText('KO')).toHaveClass('badge', 'badge-danger');
  });

  it('rend un <span> non cliquable par défaut', () => {
    render(<Badge label="Neutre" variant="neutral" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('rend un <button> et déclenche onClick quand onClick est fourni', async () => {
    const onClick = vi.fn();
    render(<Badge label="Filtre" variant="info" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filtre' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
