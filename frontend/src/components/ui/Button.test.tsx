import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('affiche le contenu et appelle onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enregistrer</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('est désactivé et ininteractif quand loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Charger</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applique la classe de variante', () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn', 'btn-danger');
  });
});
