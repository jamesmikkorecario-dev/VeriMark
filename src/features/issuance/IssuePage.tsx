import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, ErrorState, FormField, LoadingState, Select, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import { ApiError, type BatchDraft, type BatchPreview, type DraftRowInput, type FieldError, type IssueResult, type Template } from '../../lib/api/types';
import { verificationUrl } from '../../lib/certificate';
import { CSV_COLUMN_FOR_FIELD, normalizeDraftRow, readRecipientCsvFile, sampleRecipientCsv, toCsv, todayUtc, validateDraftRow, type CsvRowError, type RecipientCsvResult } from '../../lib/csv';
import { useWorkspace } from '../organizations/WorkspaceContext';
import { DemoNotice, ErrorSummary, PageIntro, ScrollRegion, TextArea } from '../credentials/shared/components';
import { errorCode, fieldLabel, fieldMessage, friendlyError, type FriendlyError } from '../credentials/shared/errors';
import { downloadFile, formatDate, newIdempotencyKey } from '../credentials/shared/format';

type Step = 'setup' | 'recipients' | 'review' | 'done';
type Mode = 'single' | 'csv';
type SingleValues = Required<Record<keyof DraftRowInput, string>>;
const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'setup', label: 'Template and method' }, { id: 'recipients', label: 'Recipients' }, { id: 'review', label: 'Review and issue' }, { id: 'done', label: 'Issued' },
];
const EMPTY_SINGLE: SingleValues = { recipientDisplayName: '', title: '', achievement: '', recipientEmail: '', expiresOn: '' };
const SINGLE_IDS: Record<keyof DraftRowInput, string> = { recipientDisplayName: 'issue-name', title: 'issue-title', achievement: 'issue-achievement', recipientEmail: 'issue-email', expiresOn: 'issue-expires' };
const DRAFT_FIELDS = Object.keys(SINGLE_IDS) as Array<keyof DraftRowInput>;

/** Server field names may be bare ("title") or paths ("rows[2].title"); keep the last segment. */
const baseField = (field: string) => field.split(/[.[\]]/).filter(Boolean).pop() ?? field;
const asDraftField = (field: string): keyof DraftRowInput | null => {
  const base = baseField(field);
  if ((DRAFT_FIELDS as string[]).includes(base)) return base as keyof DraftRowInput;
  const fromColumn = (Object.entries(CSV_COLUMN_FOR_FIELD) as Array<[keyof DraftRowInput, string]>).find(([, column]) => column === base);
  return fromColumn ? fromColumn[0] : null;
};

interface Approval { batchId: string; approvalId: string; idempotencyKey: string }
type TemplatesLoad = { state: 'loading' } | { state: 'error'; error: FriendlyError } | { state: 'ready'; templates: Template[] };

export default function IssuePage() {
  const api = useApi();
  const { organization, canIssue } = useWorkspace();
  const [load, setLoad] = useState<TemplatesLoad>({ state: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [step, setStep] = useState<Step>('setup');
  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState<Mode>('single');
  const [single, setSingle] = useState<SingleValues>(EMPTY_SINGLE);
  const [singleErrors, setSingleErrors] = useState<Partial<Record<keyof DraftRowInput, string>>>({});
  const [csvFileName, setCsvFileName] = useState('');
  const [csv, setCsv] = useState<RecipientCsvResult | null>(null);
  const [csvReading, setCsvReading] = useState(false);
  const [csvMissing, setCsvMissing] = useState(false);
  const [batch, setBatch] = useState<BatchDraft | null>(null);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<null | 'preview' | 'issue'>(null);
  const [flowError, setFlowError] = useState<FriendlyError | null>(null);
  const [serverIneligible, setIneligible] = useState(false);
  const ineligible = organization.reviewState !== 'reviewed' || serverIneligible;
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const pendingRef = useRef(false);
  const approvalRef = useRef<Approval | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!canIssue) return;
    let active = true;
    api.listTemplates(organization.id)
      .then(templates => {
        if (!active) return;
        const usable = templates.filter(t => !t.archived);
        setLoad({ state: 'ready', templates: usable });
        setTemplateId(current => current || usable[0]?.id || '');
      })
      .catch(error => { if (active) setLoad({ state: 'error', error: friendlyError(error) }); });
    return () => { active = false; };
  }, [api, organization.id, canIssue, reloadKey]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    stepHeading.current?.focus();
  }, [step]);

  const setApprovalBoth = (next: Approval | null) => { approvalRef.current = next; setApproval(next); };
  const invalidateDraft = () => { setBatch(null); setPreview(null); setApprovalBoth(null); setConfirmed(false); };

  if (!canIssue) {
    return <section className="fsc-page">
      <PageIntro eyebrow={organization.displayName} title="Issue credentials" />
      <DemoNotice />
      <EmptyState title="Issuing is not available for your role" action={<ButtonLink to="/app/credentials" variant="outline">View records</ButtonLink>}>
        You have read-only access. Ask an owner if you need to issue credentials.
      </EmptyState>
    </section>;
  }

  const template = load.state === 'ready' ? load.templates.find(t => t.id === templateId) : undefined;
  const singleRow = () => normalizeDraftRow(single);
  const rowsToSubmit = (): DraftRowInput[] => (mode === 'single' ? [singleRow()] : csv?.rows ?? []);

  function applyServerFieldErrors(fields: FieldError[]) {
    if (mode === 'single') {
      const mapped: Partial<Record<keyof DraftRowInput, string>> = {};
      fields.forEach(f => { const field = asDraftField(f.field); if (field) mapped[field] = fieldMessage(field, f.code); });
      setSingleErrors(mapped);
      if (!Object.keys(mapped).length) setFlowError(friendlyError(new ApiError('VALIDATION', '')));
    } else {
      const rowErrors: CsvRowError[] = fields.map(f => {
        const field = asDraftField(f.field);
        return { row: f.row ?? 0, field: field ? CSV_COLUMN_FOR_FIELD[field] : baseField(f.field), code: f.code as CsvRowError['code'] };
      });
      setCsv(current => ({ rows: current?.rows ?? [], errors: rowErrors }));
    }
    setStep('recipients');
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function onCsvChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    invalidateDraft(); setFlowError(null); setCsvMissing(false);
    if (!file) { setCsv(null); setCsvFileName(''); return; }
    setCsvFileName(file.name); setCsvReading(true);
    try { setCsv(await readRecipientCsvFile(file, todayUtc())); }
    catch { setCsv({ rows: [], errors: [{ row: 0, field: '', code: 'MALFORMED' }] }); }
    finally { setCsvReading(false); }
  }

  async function createPreview(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current || ineligible) return;
    setFlowError(null);
    if (mode === 'single') {
      const issues = validateDraftRow(singleRow(), todayUtc());
      const mapped: Partial<Record<keyof DraftRowInput, string>> = {};
      issues.forEach(issue => { mapped[issue.field] ??= fieldMessage(issue.field, issue.code); });
      setSingleErrors(mapped);
      if (issues.length) { requestAnimationFrame(() => summaryRef.current?.focus()); return; }
    } else if (!csv || csv.errors.length || !csv.rows.length) {
      if (!csv) setCsvMissing(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    pendingRef.current = true; setPending('preview');
    try {
      const draft = batch ?? await api.createBatch(organization.id, { templateId, source: mode, rows: rowsToSubmit() });
      setBatch(draft);
      const next = await api.previewBatch(organization.id, draft.batchId);
      setPreview(next); setConfirmed(false); setApprovalBoth(null); setStep('review');
    } catch (error) {
      handlePreparationError(error);
    } finally { pendingRef.current = false; setPending(null); }
  }

  function handlePreparationError(error: unknown) {
    const code = errorCode(error);
    if (code === 'VALIDATION' && error instanceof ApiError && error.fields.length) { setBatch(null); applyServerFieldErrors(error.fields); return; }
    if (code === 'ISSUER_NOT_ELIGIBLE') setIneligible(true);
    setFlowError(friendlyError(error));
  }

  async function approveAndIssue() {
    if (pendingRef.current || !preview || !confirmed || ineligible || blocked) return;
    pendingRef.current = true; setPending('issue'); setFlowError(null);
    try {
      let current = approvalRef.current;
      if (!current || current.batchId !== preview.batchId) {
        const approved = await api.approveBatch(organization.id, preview.batchId, { expectedRevision: preview.revision, previewDigest: preview.previewDigest });
        // One idempotency key per approved batch, kept for every retry of the same issue request.
        current = { batchId: preview.batchId, approvalId: approved.approvalId, idempotencyKey: newIdempotencyKey() };
        setApprovalBoth(current);
      }
      const issued = await api.issueBatch(organization.id, preview.batchId, { approvalId: current.approvalId, idempotencyKey: current.idempotencyKey });
      setResult(issued); setStep('done');
    } catch (error) {
      await handleIssueError(error);
    } finally { pendingRef.current = false; setPending(null); }
  }

  async function handleIssueError(error: unknown) {
    const code = errorCode(error);
    const friendly = friendlyError(error);
    switch (code) {
      case 'REVISION_CONFLICT': {
        setApprovalBoth(null); setConfirmed(false);
        try {
          if (preview) setPreview(await api.previewBatch(organization.id, preview.batchId));
          setFlowError({ code, title: 'The records changed', message: 'The draft changed since you reviewed it. Review the records below again before issuing. Nothing was issued.' });
        } catch (reloadError) { setFlowError(friendlyError(reloadError)); }
        stepHeading.current?.focus();
        return;
      }
      case 'APPROVAL_REQUIRED':
        setApprovalBoth(null); setConfirmed(false); setFlowError(friendly); return;
      case 'VALIDATION':
        if (error instanceof ApiError && error.fields.length) { invalidateDraft(); applyServerFieldErrors(error.fields); return; }
        setFlowError(friendly); return;
      case 'ISSUER_NOT_ELIGIBLE':
        setIneligible(true); setFlowError(friendly); return;
      case 'IDEMPOTENCY_CONFLICT': case 'FORBIDDEN': case 'UNAUTHENTICATED':
        setBlocked(true); setFlowError(friendly); return;
      default:
        setFlowError(approvalRef.current
          ? { code, title: 'Issuing could not be confirmed', message: 'We could not confirm whether these records were issued. Trying again is safe: it repeats the same request, so nothing is issued twice.' }
          : friendly);
    }
  }

  function startOver() {
    invalidateDraft(); setResult(null); setSingle(EMPTY_SINGLE); setSingleErrors({}); setCsv(null); setCsvFileName('');
    setFlowError(null); setBlocked(false); setStep('setup');
  }

  function exportLinks() {
    if (!result || !preview) return;
    const names = new Map(preview.rows.map(row => [row.sourceRow, row.recipientDisplayName]));
    const rows = result.credentials.map(c => [c.publicId, verificationUrl(c.publicId), names.get(c.sourceRow) ?? '']);
    downloadFile(toCsv([['public_id', 'verification_url', 'recipient_name'], ...rows]), 'verimark-issued-records.csv', 'text/csv;charset=utf-8');
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const csvErrors = csv?.errors ?? [];
  const singleSummary = DRAFT_FIELDS.filter(f => singleErrors[f]).map(f => ({ id: SINGLE_IDS[f], message: singleErrors[f] as string }));

  const eligibilityNotice = ineligible && <div className="fsc-notice fsc-notice-warn" role="note">
    <h2>{organization.reviewState === 'suspended' ? 'Issuing is suspended for your organization' : 'Your organization must be reviewed before it can issue'}</h2>
    <p>VeriMark checks each organization's identity before it can issue credentials. You can prepare and check records now, but nothing can be issued until the review is complete. The review is an identity check, not an accreditation.</p>
  </div>;

  const errorBox = flowError && <div className={`fsc-notice ${flowError.code === 'REVISION_CONFLICT' || flowError.code === 'APPROVAL_REQUIRED' ? 'fsc-notice-warn' : 'fsc-notice-error'}`} role="alert">
    <h3>{flowError.title}</h3><p>{flowError.message}</p>
    {flowError.code === 'IDEMPOTENCY_CONFLICT' && <div className="fsc-actions" style={{ marginTop: 10 }}><ButtonLink to="/app/credentials" variant="outline" size="sm">Check records</ButtonLink><Button size="sm" variant="ghost" onClick={startOver}>Start over</Button></div>}
  </div>;

  return <section className="fsc-page">
    <PageIntro eyebrow={organization.displayName} title="Issue credentials">
      <p>Prepare one record or a CSV file of up to 200 records, review exactly what will be issued, then approve. Issued records cannot be edited; corrections are made by replacement.</p>
    </PageIntro>
    <DemoNotice />
    {eligibilityNotice}

    {load.state === 'loading' && <LoadingState label="Loading templates…" />}
    {load.state === 'error' && <ErrorState title={load.error.title} onRetry={() => { setLoad({ state: 'loading' }); setReloadKey(k => k + 1); }}>{load.error.message}</ErrorState>}
    {load.state === 'ready' && load.templates.length === 0 && <EmptyState title="Create a template first" action={<ButtonLink to="/app/templates">Go to templates</ButtonLink>}>
      Every credential uses a template for its wording and layout.
    </EmptyState>}

    {load.state === 'ready' && load.templates.length > 0 && <>
      <nav aria-label="Issuing steps"><ol className="fsc-stepper">{STEPS.map((s, i) => <li key={s.id} aria-current={s.id === step ? 'step' : undefined} className={i < stepIndex ? 'fsc-done' : undefined}>{s.label}</li>)}</ol></nav>

      {step === 'setup' && <form className="fsc-panel fsc-form" onSubmit={e => { e.preventDefault(); setStep('recipients'); }}>
        <h2 ref={stepHeading} tabIndex={-1}>Choose a template and method</h2>
        <FormField id="issue-template" label="Template">
          <Select value={templateId} onChange={e => { setTemplateId(e.target.value); invalidateDraft(); }}>
            {load.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </FormField>
        <fieldset className="fsc-fieldset">
          <legend>How will you add recipients?</legend>
          <label className="fsc-choice"><input type="radio" name="issue-mode" value="single" checked={mode === 'single'} onChange={() => { setMode('single'); invalidateDraft(); }} /><span>One recipient<small>Fill in a short form.</small></span></label>
          <label className="fsc-choice"><input type="radio" name="issue-mode" value="csv" checked={mode === 'csv'} onChange={() => { setMode('csv'); invalidateDraft(); }} /><span>CSV upload<small>Up to 200 recipients from a spreadsheet export.</small></span></label>
        </fieldset>
        <div className="fsc-actions"><Button type="submit" disabled={!template}>Continue</Button></div>
      </form>}

      {step === 'recipients' && <form className="fsc-panel fsc-form" onSubmit={createPreview} noValidate>
        <h2 ref={stepHeading} tabIndex={-1}>{mode === 'single' ? 'Recipient details' : 'Upload recipients'}</h2>
        <p className="fsc-lede">Template: <strong>{template?.name}</strong></p>
        {mode === 'single' && <>
          <ErrorSummary items={singleSummary} summaryRef={summaryRef} />
          <FormField id="issue-name" label="Recipient name" hint="Shown publicly on the verification page. Up to 200 characters." error={singleErrors.recipientDisplayName}>
            <TextInput value={single.recipientDisplayName} autoComplete="off" onChange={e => { setSingle({ ...single, recipientDisplayName: e.target.value }); invalidateDraft(); }} />
          </FormField>
          <FormField id="issue-title" label="Title" hint="For example the course or programme. Up to 200 characters." error={singleErrors.title}>
            <TextInput value={single.title} onChange={e => { setSingle({ ...single, title: e.target.value }); invalidateDraft(); }} />
          </FormField>
          <FormField id="issue-achievement" label="Achievement" hint="What the recipient achieved. Up to 2000 characters." error={singleErrors.achievement}>
            <TextArea value={single.achievement} onChange={e => { setSingle({ ...single, achievement: e.target.value }); invalidateDraft(); }} />
          </FormField>
          <div className="fsc-form-grid">
            <FormField id="issue-email" label="Recipient e-mail (optional)" hint="Private. VeriMark does not send e-mail." error={singleErrors.recipientEmail}>
              <TextInput type="email" value={single.recipientEmail} autoComplete="off" onChange={e => { setSingle({ ...single, recipientEmail: e.target.value }); invalidateDraft(); }} />
            </FormField>
            <FormField id="issue-expires" label="Expiry date (optional)" hint="Leave empty if the credential does not expire. Must be after today." error={singleErrors.expiresOn}>
              <TextInput type="date" value={single.expiresOn} onChange={e => { setSingle({ ...single, expiresOn: e.target.value }); invalidateDraft(); }} />
            </FormField>
          </div>
        </>}
        {mode === 'csv' && <>
          <ErrorSummary items={csvMissing ? [{ id: 'issue-csv', message: 'Choose a CSV file to upload.' }] : csvErrors.length ? [{ id: 'csv-errors', message: `${csvErrors.length} ${csvErrors.length === 1 ? 'problem' : 'problems'} found in the file. Fix them and upload it again.` }] : []} summaryRef={summaryRef} />
          <div className="fsc-notice">
            <p>Columns: <code>recipient_name</code>, <code>title</code>, <code>achievement</code> (required) and <code>email</code>, <code>expires_on</code> (optional, date as YYYY-MM-DD). First line is the header. At most 200 records and 2 MiB.</p>
            <div className="fsc-actions" style={{ marginTop: 10 }}><Button size="sm" variant="outline" onClick={() => downloadFile(sampleRecipientCsv(), 'verimark-recipients-sample.csv', 'text/csv;charset=utf-8')}>Download sample CSV</Button></div>
          </div>
          <FormField id="issue-csv" label="CSV file" hint="Cell contents are read as plain text and never run as formulas." error={csvMissing ? 'Choose a CSV file to upload.' : undefined}>
            <input type="file" accept=".csv,text/csv" className="text-input" onChange={onCsvChange} />
          </FormField>
          {csvReading && <LoadingState label="Checking the file…" />}
          {csv && !csvReading && csvErrors.length === 0 && <p className="fsc-status-line" role="status">{csv.rows.length} {csv.rows.length === 1 ? 'record' : 'records'} in {csvFileName} passed the checks.</p>}
          {csvErrors.length > 0 && <div id="csv-errors" tabIndex={-1}>
            <ScrollRegion label="Problems found in the CSV file">
              <table className="fsc-table fsc-cards">
                <caption>{csvErrors.length} {csvErrors.length === 1 ? 'problem' : 'problems'} in {csvFileName || 'the file'}. Row 1 is the first line after the header.</caption>
                <thead><tr><th scope="col">Row</th><th scope="col">Column</th><th scope="col">Problem</th></tr></thead>
                <tbody>{csvErrors.map((e, i) => <tr key={`${e.row}-${e.field}-${e.code}-${i}`}>
                  <td data-label="Row">{e.row === 0 ? 'Header / file' : e.row}</td>
                  <td data-label="Column">{e.field ? fieldLabel(e.field) : '—'}</td>
                  <td data-label="Problem">{fieldMessage(e.field, e.code)}</td>
                </tr>)}</tbody>
              </table>
            </ScrollRegion>
          </div>}
        </>}
        {errorBox}
        <div className="fsc-actions">
          <Button type="submit" disabled={pending !== null || ineligible || (mode === 'csv' && (csvReading || csvErrors.length > 0))}>{pending === 'preview' ? 'Preparing preview…' : 'Review records'}</Button>
          <Button variant="ghost" onClick={() => { setFlowError(null); setStep('setup'); }} disabled={pending !== null}>Back</Button>
        </div>
      </form>}

      {step === 'review' && preview && <div className="fsc-panel fsc-form">
        <h2 ref={stepHeading} tabIndex={-1}>Review before issuing</h2>
        <dl className="fsc-dl">
          <dt>Records to issue</dt><dd>{preview.rowCount}</dd>
          <dt>Template</dt><dd>{preview.templateName}</dd>
          <dt>Issuer</dt><dd>{organization.displayName}</dd>
        </dl>
        <ScrollRegion label="Records that will be issued">
          <table className="fsc-table fsc-cards">
            <caption>Exactly these {preview.rowCount} {preview.rowCount === 1 ? 'record' : 'records'} will be issued.</caption>
            <thead><tr><th scope="col">Row</th><th scope="col">Recipient</th><th scope="col">Title</th><th scope="col">Achievement</th><th scope="col">Expires</th></tr></thead>
            <tbody>{preview.rows.map(row => <tr key={row.sourceRow}>
              <td data-label="Row">{row.sourceRow}</td><td data-label="Recipient">{row.recipientDisplayName}</td><td data-label="Title">{row.title}</td>
              <td data-label="Achievement">{row.achievement}</td><td data-label="Expires">{formatDate(row.expiresAt)}</td>
            </tr>)}</tbody>
          </table>
        </ScrollRegion>
        {errorBox}
        <label className="fsc-check"><input type="checkbox" checked={confirmed} disabled={pending !== null || approval !== null} onChange={e => setConfirmed(e.target.checked)} />I have reviewed these records; issued records cannot be edited</label>
        <div className="fsc-actions">
          <Button onClick={approveAndIssue} disabled={!confirmed || pending !== null || ineligible || blocked} aria-describedby={ineligible ? undefined : 'issue-hint'}>
            {pending === 'issue' ? 'Issuing…' : approval ? 'Try issuing again' : `Approve and issue ${preview.rowCount} ${preview.rowCount === 1 ? 'record' : 'records'}`}
          </Button>
          {!approval && <Button variant="ghost" onClick={() => { setFlowError(null); invalidateDraft(); setStep('recipients'); }} disabled={pending !== null}>Back to edit</Button>}
        </div>
        <p id="issue-hint" className="field-hint">Records are issued together: either all of them or none.</p>
      </div>}

      {step === 'done' && result && <div className="fsc-panel fsc-form">
        <h2 ref={stepHeading} tabIndex={-1}>{result.credentials.length} {result.credentials.length === 1 ? 'record' : 'records'} issued</h2>
        <p role="status">The records are now online. Share each recipient's record from its page, or export the verification links.</p>
        <ScrollRegion label="Issued records">
          <table className="fsc-table fsc-cards">
            <caption>Issued records</caption>
            <thead><tr><th scope="col">Row</th><th scope="col">Recipient</th><th scope="col">Public ID</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{result.credentials.map(c => {
              const name = preview?.rows.find(r => r.sourceRow === c.sourceRow)?.recipientDisplayName ?? '';
              return <tr key={c.id}><td data-label="Row">{c.sourceRow}</td><td data-label="Recipient">{name}</td><td data-label="Public ID" className="fsc-mono">{c.publicId}</td>
                <td data-label="Record"><Link to={`/app/credentials/${encodeURIComponent(c.id)}`} aria-label={`Open record for ${name || c.publicId}`}>Open record</Link></td></tr>;
            })}</tbody>
          </table>
        </ScrollRegion>
        <div className="fsc-actions">
          <Button variant="outline" onClick={exportLinks}>Export record links (CSV)</Button>
          <Button variant="ghost" onClick={startOver}>Issue more</Button>
        </div>
      </div>}
    </>}
  </section>;
}
