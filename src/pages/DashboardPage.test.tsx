import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import DashboardPage from './DashboardPage';
afterEach(cleanup);
it('combines dashboard filters, presents empty state, and resets both controls',()=>{
 render(<MemoryRouter><DashboardPage /></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('Search records'),{target:{value:'Alex'}});
 fireEvent.change(screen.getByLabelText('Standing'),{target:{value:'revoked'}});
 expect(screen.getByText('No matching records')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
 expect((screen.getByLabelText('Search records') as HTMLInputElement).value).toBe('');
 expect((screen.getByLabelText('Standing') as HTMLSelectElement).value).toBe('all');
 expect(screen.getByText('Alex Santos')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Issue a credential'}).getAttribute('href')).toBe('/workspace/issue');
});
