import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/types';
import { createFakeApi, installDialogPolyfill, makeWorkspace, renderPage, template } from '../credentials/shared/testing';
import TemplatesPage from './TemplatesPage';

beforeAll(installDialogPolyfill);

describe('TemplatesPage', () => {
  it('shows an empty state with a create action and creates a template', async () => {
    const api = createFakeApi();
    api.listTemplates.mockResolvedValue([]);
    api.saveTemplate.mockImplementation((_org, input) => Promise.resolve(template({ id: 'tpl-new', name: input.name, config: input.config, revision: 1 })));
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, { api });
    expect(await screen.findByRole('heading', { name: 'No templates yet' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    await user.type(screen.getByLabelText('Template name'), 'Workshop attendance');
    const heading = screen.getByLabelText('Heading');
    await user.clear(heading);
    await user.type(heading, 'Certificate of Attendance');
    expect(within(screen.getByRole('figure')).getByRole('heading', { name: 'Certificate of Attendance' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Orientation'), 'portrait');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.saveTemplate).toHaveBeenCalledWith('org-1', { name: 'Workshop attendance', config: expect.objectContaining({ heading: 'Certificate of Attendance', orientation: 'portrait' }) });
    expect(await screen.findByRole('status')).toHaveTextContent('Template “Workshop attendance” saved.');
    expect(screen.getByRole('heading', { name: 'Workshop attendance' })).toBeInTheDocument();
  });

  it('validates required fields and limits before saving', async () => {
    const api = createFakeApi();
    api.listTemplates.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, { api });
    await user.click(await screen.findByRole('button', { name: 'Create template' }));
    await user.clear(screen.getByLabelText('Heading'));
    await user.type(screen.getByLabelText('Signatory name'), 'x'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByLabelText('Template name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Heading')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Signatory name')).toHaveAccessibleDescription(/120 characters or fewer/);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the template name.');
    expect(api.saveTemplate).not.toHaveBeenCalled();
  });

  it('saves edits with the expected revision and offers a reload on revision conflict', async () => {
    const api = createFakeApi();
    api.listTemplates.mockResolvedValueOnce([template()]).mockResolvedValueOnce([template({ revision: 5, name: 'Course completion (updated)' })]);
    api.saveTemplate.mockRejectedValue(new ApiError('REVISION_CONFLICT', 'row version mismatch at relation templates'));
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, { api });
    await user.click(await screen.findByRole('button', { name: 'Edit Course completion' }));
    await user.type(screen.getByLabelText('Template name'), ' v2');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.saveTemplate).toHaveBeenCalledWith('org-1', expect.objectContaining({ id: 'tpl-1', name: 'Course completion v2', expectedRevision: 2 }));
    expect(await screen.findByText('This changed since you opened it')).toBeInTheDocument();
    expect(screen.queryByText(/row version mismatch/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload latest version' }));
    await waitFor(() => expect(screen.getByLabelText('Template name')).toHaveValue('Course completion (updated)'));
    api.saveTemplate.mockResolvedValue(template({ revision: 6, name: 'Course completion (updated)' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.saveTemplate).toHaveBeenLastCalledWith('org-1', expect.objectContaining({ expectedRevision: 5 }));
  });

  it('archives only after confirmation and returns focus to the trigger on cancel', async () => {
    const api = createFakeApi();
    api.listTemplates.mockResolvedValue([template(), template({ id: 'tpl-2', name: 'Volunteer hours' })]);
    api.archiveTemplate.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, { api });
    const trigger = await screen.findByRole('button', { name: 'Archive Volunteer hours' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Archive this template?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.archiveTemplate).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive template' }));
    expect(api.archiveTemplate).toHaveBeenCalledWith('org-1', 'tpl-2');
    expect(await screen.findByRole('status')).toHaveTextContent('archived');
    expect(screen.queryByRole('heading', { name: 'Volunteer hours' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 archived template is hidden/)).toBeInTheDocument();
  });

  it('gives viewers a read-only view', async () => {
    const api = createFakeApi();
    api.listTemplates.mockResolvedValue([template()]);
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, { api, workspace: makeWorkspace({ role: 'viewer' }) });
    await user.click(await screen.findByRole('button', { name: 'View Course completion' }));
    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Archive|Create template|Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a friendly error with retry when loading fails', async () => {
    const api = createFakeApi();
    api.listTemplates.mockRejectedValueOnce(new ApiError('TEMPORARILY_UNAVAILABLE', 'upstream 503 pg_bouncer')).mockResolvedValueOnce([template()]);
    const user = userEvent.setup();
    renderPage(<TemplatesPage />, { api });
    expect(await screen.findByRole('alert')).toHaveTextContent('Service temporarily unavailable');
    expect(screen.queryByText(/pg_bouncer/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Course completion' })).toBeInTheDocument();
  });

  it('labels demo mode', async () => {
    const api = createFakeApi('demo');
    api.listTemplates.mockResolvedValue([]);
    renderPage(<TemplatesPage />, { api });
    expect(await screen.findByText(/fictional/)).toBeInTheDocument();
  });
});
