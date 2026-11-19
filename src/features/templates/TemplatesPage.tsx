import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, EmptyState, ErrorState, FormField, LoadingState, Select, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import { ApiError, type Template, type TemplateConfig } from '../../lib/api/types';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { ErrorSummary, Modal, PageIntro } from '../credentials/shared/components';
import { fieldMessage, friendlyError, type FriendlyError } from '../credentials/shared/errors';
import { formatDate } from '../credentials/shared/format';
import { CertificatePreview } from './CertificatePreview';

const EMPTY_CONFIG: TemplateConfig = { heading: 'Certificate of Completion', bodyPrefix: 'This certifies that', signatoryName: '', signatoryTitle: '', accent: 'forest', orientation: 'landscape' };
const TEXT_LIMITS = { name: 120, heading: 120, bodyPrefix: 200, signatoryName: 120, signatoryTitle: 120 } as const;
type TextField = keyof typeof TEXT_LIMITS;
const FIELD_IDS: Record<string, string> = { name: 'tpl-name', heading: 'tpl-heading', bodyPrefix: 'tpl-body', signatoryName: 'tpl-sign-name', signatoryTitle: 'tpl-sign-title', accent: 'tpl-accent', orientation: 'tpl-orientation' };

interface Draft { original: Template | null; name: string; config: TemplateConfig }

function validateTemplate(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  const values: Record<TextField, string> = { name: draft.name, ...draft.config };
  (Object.keys(TEXT_LIMITS) as TextField[]).forEach(field => {
    const value = values[field].trim();
    if ((field === 'name' || field === 'heading') && !value) errors[field] = fieldMessage(field, 'REQUIRED');
    else if (value.length > TEXT_LIMITS[field]) errors[field] = fieldMessage(field, 'TOO_LONG');
  });
  return errors;
}

type Load = { state: 'loading' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; templates: Template[] };

export default function TemplatesPage() {
  const api = useApi();
  const { organization, canIssue } = useWorkspace();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<Template | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Template | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<FriendlyError | null>(null);
  const [status, setStatus] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const fetchTemplates = useCallback(async () => {
    const templates = await api.listTemplates(organization.id);
    setLoad({ state: 'ready', templates });
    return templates;
  }, [api, organization.id]);

  const reload = useCallback(() => {
    setLoad({ state: 'loading' });
    fetchTemplates().catch(error => setLoad({ state: 'error', error: friendlyError(error) }));
  }, [fetchTemplates]);

  useEffect(() => {
    let active = true;
    api.listTemplates(organization.id)
      .then(templates => { if (active) setLoad({ state: 'ready', templates }); })
      .catch(error => { if (active) setLoad({ state: 'error', error: friendlyError(error) }); });
    return () => { active = false; };
  }, [api, organization.id]);

  const [focusKey, setFocusKey] = useState(0);
  useEffect(() => { if (focusKey > 0) editorHeading.current?.focus(); }, [focusKey]);

  const announce = (message: string) => { setStatus(message); requestAnimationFrame(() => statusRef.current?.focus()); };
  const openEditor = (template: Template | null) => {
    setViewing(null); setErrors({}); setSaveError(null); setStatus('');
    setDraft({ original: template, name: template?.name ?? '', config: { ...(template?.config ?? EMPTY_CONFIG) } });
    setFocusKey(k => k + 1);
  };
  const view = (template: Template) => { setViewing(template); setFocusKey(k => k + 1); };
  const closeEditor = () => { setDraft(null); setErrors({}); setSaveError(null); };
  const setConfig = <K extends keyof TemplateConfig>(key: K, value: TemplateConfig[K]) => setDraft(current => (current ? { ...current, config: { ...current.config, [key]: value } } : current));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    const found = validateTemplate(draft);
    setErrors(found); setSaveError(null);
    if (Object.keys(found).length) { requestAnimationFrame(() => summaryRef.current?.focus()); return; }
    setSaving(true);
    try {
      const config: TemplateConfig = { ...draft.config, heading: draft.config.heading.trim(), bodyPrefix: draft.config.bodyPrefix.trim(), signatoryName: draft.config.signatoryName.trim(), signatoryTitle: draft.config.signatoryTitle.trim() };
      const saved = await api.saveTemplate(organization.id, draft.original
        ? { id: draft.original.id, name: draft.name.trim(), config, expectedRevision: draft.original.revision }
        : { name: draft.name.trim(), config });
      setLoad(current => current.state === 'ready'
        ? { state: 'ready', templates: draft.original ? current.templates.map(t => (t.id === saved.id ? saved : t)) : [...current.templates, saved] }
        : current);
      setDraft(null);
      announce(`Template “${saved.name}” saved.`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION' && error.fields.length) {
        const mapped: Record<string, string> = {};
        error.fields.forEach(f => { const key = f.field.split('.').pop() ?? f.field; mapped[FIELD_IDS[key] ? key : 'name'] = fieldMessage(key, f.code); });
        setErrors(mapped);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else setSaveError(friendlyError(error));
    } finally { setSaving(false); }
  }

  async function reloadLatest() {
    if (!draft?.original) return;
    const id = draft.original.id;
    setSaveError(null);
    try {
      const templates = await fetchTemplates();
      const latest = templates.find(t => t.id === id && !t.archived);
      if (latest) { openEditor(latest); setStatus('Latest version loaded. Your unsaved changes were discarded.'); }
      else { closeEditor(); announce('This template is no longer available.'); }
    } catch (error) { setSaveError(friendlyError(error)); }
  }

  async function confirmArchive() {
    if (!archiveTarget || archiving) return;
    setArchiving(true); setArchiveError(null);
    try {
      await api.archiveTemplate(organization.id, archiveTarget.id);
      const name = archiveTarget.name;
      setArchiveTarget(null);
      if (draft?.original?.id === archiveTarget.id) setDraft(null);
      setLoad(current => current.state === 'ready' ? { state: 'ready', templates: current.templates.map(t => (t.id === archiveTarget.id ? { ...t, archived: true } : t)) } : current);
      announce(`Template “${name}” archived.`);
    } catch (error) { setArchiveError(friendlyError(error)); }
    finally { setArchiving(false); }
  }

  const active = load.state === 'ready' ? load.templates.filter(t => !t.archived) : [];
  const archivedCount = load.state === 'ready' ? load.templates.length - active.length : 0;
  const summaryItems = Object.entries(errors).map(([field, message]) => ({ id: FIELD_IDS[field] ?? 'tpl-name', message }));

  return <section className="fsc-page">
    <PageIntro eyebrow={organization.displayName} title="Templates" actions={canIssue && load.state === 'ready' && active.length > 0 && !draft ? <Button onClick={() => openEditor(null)}>Create template</Button> : undefined}>
      <p>Templates set the wording and layout of certificates. Changing a template never alters records that were already issued.</p>
    </PageIntro>
    {!canIssue && <p className="fsc-notice">You can view templates. Only owners and issuers can create, edit or archive them.</p>}
    {status && <p className="fsc-status-line" role="status" tabIndex={-1} ref={statusRef}>{status}</p>}

    {load.state === 'loading' && <LoadingState label="Loading templates…" />}
    {load.state === 'error' && <ErrorState title={load.error.title} onRetry={reload}>{load.error.message}</ErrorState>}
    {load.state === 'ready' && active.length === 0 && !draft && <EmptyState title="No templates yet"
      action={canIssue ? <Button onClick={() => openEditor(null)}>Create template</Button> : undefined}>
      {canIssue ? 'Create a template before issuing your first credential.' : 'An owner or issuer needs to create a template first.'}
    </EmptyState>}

    {load.state === 'ready' && active.length > 0 && <div>
      <h2 className="sr-only">Available templates</h2>
      <ul className="fsc-cards-grid">{active.map(t => <li key={t.id} className="fsc-card" aria-current={draft?.original?.id === t.id || viewing?.id === t.id ? 'true' : undefined}>
        <h3>{t.name}</h3>
        <p>{t.config.heading} · {t.config.orientation === 'portrait' ? 'Portrait' : 'Landscape'} · updated {formatDate(t.updatedAt, '—')}</p>
        <div className="fsc-actions">
          {canIssue
            ? <><Button size="sm" variant="outline" onClick={() => openEditor(t)} aria-label={`Edit ${t.name}`}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => { setArchiveError(null); setArchiveTarget(t); }} aria-label={`Archive ${t.name}`}>Archive</Button></>
            : <Button size="sm" variant="outline" onClick={() => view(t)} aria-label={`View ${t.name}`}>View</Button>}
        </div>
      </li>)}</ul>
      {archivedCount > 0 && <p className="fsc-lede" style={{ marginTop: 12 }}>{archivedCount} archived {archivedCount === 1 ? 'template is' : 'templates are'} hidden. Archived templates cannot be used for new records.</p>}
    </div>}

    {viewing && !canIssue && <div className="fsc-two">
      <div className="fsc-panel">
        <h2 ref={editorHeading} tabIndex={-1}>{viewing.name}</h2>
        <dl className="fsc-dl">
          <dt>Heading</dt><dd>{viewing.config.heading}</dd>
          <dt>Text before the name</dt><dd>{viewing.config.bodyPrefix || '—'}</dd>
          <dt>Signatory</dt><dd>{[viewing.config.signatoryName, viewing.config.signatoryTitle].filter(Boolean).join(', ') || '—'}</dd>
          <dt>Accent</dt><dd>{viewing.config.accent}</dd>
          <dt>Orientation</dt><dd>{viewing.config.orientation}</dd>
        </dl>
        <div className="fsc-actions" style={{ marginTop: 16 }}><Button variant="outline" onClick={() => setViewing(null)}>Close</Button></div>
      </div>
      <CertificatePreview config={viewing.config} issuerName={organization.displayName} />
    </div>}

    {draft && canIssue && <div className="fsc-two">
      <form className="fsc-panel fsc-form" onSubmit={save} noValidate aria-labelledby="tpl-editor-title">
        <h2 id="tpl-editor-title" ref={editorHeading} tabIndex={-1}>{draft.original ? `Edit “${draft.original.name}”` : 'New template'}</h2>
        <ErrorSummary items={summaryItems} summaryRef={summaryRef} />
        {saveError && <div className={`fsc-notice ${saveError.code === 'REVISION_CONFLICT' ? 'fsc-notice-warn' : 'fsc-notice-error'}`} role="alert">
          <h3>{saveError.title}</h3><p>{saveError.message}</p>
          {saveError.code === 'REVISION_CONFLICT' && <div className="fsc-actions" style={{ marginTop: 10 }}><Button size="sm" variant="outline" onClick={reloadLatest}>Reload latest version</Button></div>}
        </div>}
        <FormField id="tpl-name" label="Template name" hint="Only your organization sees this name. Up to 120 characters." error={errors.name}>
          <TextInput value={draft.name} maxLength={240} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        </FormField>
        <FormField id="tpl-heading" label="Heading" hint="For example “Certificate of Completion”. Up to 120 characters." error={errors.heading}>
          <TextInput value={draft.config.heading} maxLength={240} onChange={e => setConfig('heading', e.target.value)} />
        </FormField>
        <FormField id="tpl-body" label="Text before the name" hint="Optional. Up to 200 characters." error={errors.bodyPrefix}>
          <TextInput value={draft.config.bodyPrefix} maxLength={400} onChange={e => setConfig('bodyPrefix', e.target.value)} />
        </FormField>
        <div className="fsc-form-grid">
          <FormField id="tpl-sign-name" label="Signatory name" hint="Optional." error={errors.signatoryName}>
            <TextInput value={draft.config.signatoryName} maxLength={240} onChange={e => setConfig('signatoryName', e.target.value)} />
          </FormField>
          <FormField id="tpl-sign-title" label="Signatory title" hint="Optional." error={errors.signatoryTitle}>
            <TextInput value={draft.config.signatoryTitle} maxLength={240} onChange={e => setConfig('signatoryTitle', e.target.value)} />
          </FormField>
          <FormField id="tpl-accent" label="Accent colour" error={errors.accent}>
            <Select value={draft.config.accent} onChange={e => setConfig('accent', e.target.value as TemplateConfig['accent'])}>
              <option value="forest">Forest</option><option value="ink">Ink</option><option value="ochre">Ochre</option>
            </Select>
          </FormField>
          <FormField id="tpl-orientation" label="Orientation" error={errors.orientation}>
            <Select value={draft.config.orientation} onChange={e => setConfig('orientation', e.target.value as TemplateConfig['orientation'])}>
              <option value="landscape">Landscape</option><option value="portrait">Portrait</option>
            </Select>
          </FormField>
        </div>
        <div className="fsc-actions">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</Button>
          <Button variant="ghost" onClick={closeEditor} disabled={saving}>Cancel</Button>
        </div>
      </form>
      <div>
        <h2 className="sr-only">Live preview</h2>
        <CertificatePreview config={draft.config} issuerName={organization.displayName} />
        <p className="fsc-lede" style={{ marginTop: 10, fontSize: 13 }}>Preview with fictional sample data. The downloadable PDF follows the same settings.</p>
      </div>
    </div>}

    <Modal open={archiveTarget !== null} title="Archive this template?" onClose={() => setArchiveTarget(null)} busy={archiving}>
      <p>“{archiveTarget?.name}” will no longer be available for new records. Records already issued with it are not changed.</p>
      {archiveError && <p className="fsc-notice fsc-notice-error" role="alert">{archiveError.title}. {archiveError.message}</p>}
      <div className="fsc-actions">
        <Button onClick={confirmArchive} disabled={archiving}>{archiving ? 'Archiving…' : 'Archive template'}</Button>
        <Button variant="ghost" onClick={() => setArchiveTarget(null)} disabled={archiving}>Cancel</Button>
      </div>
    </Modal>
  </section>;
}
