import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('ne rend rien quand il n\'y a aucun résultat', () => {
    const { container } = render(<Pagination page={1} total={0} limit={10} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche la plage et le total (page 1, 10/page, 25 résultats)', () => {
    render(<Pagination page={1} total={25} limit={10} onChange={() => {}} />);
    expect(screen.getByText(/1–10 sur/)).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('désactive « Précédent » sur la première page', () => {
    render(<Pagination page={1} total={25} limit={10} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Précédent/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeEnabled();
  });

  it('désactive « Suivant » sur la dernière page', () => {
    render(<Pagination page={3} total={25} limit={10} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('appelle onChange avec la page suivante', async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} total={25} limit={10} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
