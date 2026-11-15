import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Brand, Button, ButtonLink, EmptyState, ErrorState, FormField, Icon, LoadingState, Select, StatusPill, TextInput } from './ui';

describe('shared accessible controls', () => {
  it('labels fields, retains entered text and associates hints and errors', () => {
    const { rerender } = render(<FormField id="reference" label="Reference" hint="Use the exact reference"><TextInput defaultValue="VM-DEMO" /></FormField>);
    const input = screen.getByRole('textbox', { name: 'Reference' });
    fireEvent.change(input, { target: { value: 'VM-123' } });
    rerender(<FormField id="reference" label="Reference" hint="Use the exact reference" error="Reference unavailable"><TextInput /></FormField>);
    expect(input).toHaveValue('VM-123');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Use the exact reference Reference unavailable');
    rerender(<FormField id="reference" label="Reference"><TextInput /></FormField>);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
  it('preserves caller descriptions and native select behavior', () => {
    render(<><p id="context">Fictional records</p><FormField id="standing" label="Standing" hint="Choose a standing"><Select aria-describedby="context" defaultValue="all"><option value="all">All</option><option value="valid">Valid</option></Select></FormField></>);
    const select = screen.getByRole('combobox', { name: 'Standing' });
    expect(select).toHaveAccessibleDescription('Fictional records Choose a standing');
    fireEvent.change(select, { target: { value: 'valid' } });
    expect(select).toHaveValue('valid');
  });
  it('defaults actions to non-submitting buttons and prevents disabled actions', () => {
    const submit = vi.fn(); const action = vi.fn();
    render(<form onSubmit={submit}><Button onClick={action}>Open</Button><Button disabled onClick={action}>Unavailable</Button></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unavailable' }));
    expect(action).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
  });
  it('uses real navigable links and keeps decorative icons out of the accessible name', () => {
    render(<MemoryRouter><Brand /><ButtonLink to="/workspace"><Icon name="arrow" />Explore workspace</ButtonLink></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'VeriMark home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Explore workspace' })).toHaveAttribute('href', '/workspace');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
describe('shared outcomes', () => {
  it.each(['valid', 'revoked', 'expired', 'replaced'] as const)('states %s in text without making a live announcement for each badge', status => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(status === 'valid' ? 'Valid record' : status[0].toUpperCase() + status.slice(1))).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('announces pending work without success or retry controls', () => {
    render(<LoadingState label="Loading records" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading records');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('distinguishes an outage with a working retry action', () => {
    const retry = vi.fn();
    render(<ErrorState title="Unable to load records" onRetry={retry}>Please try again.</ErrorState>);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load records');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('offers a supplied empty-state recovery without announcing an error', () => {
    const clear = vi.fn();
    render(<EmptyState title="No matching records" action={<Button onClick={clear}>Clear filters</Button>}>Change your search.</EmptyState>);
    expect(screen.getByRole('heading', { name: 'No matching records' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
