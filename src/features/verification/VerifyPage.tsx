import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/Layouts';
import { Button, FormField, LoadingState, StatusPill, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import { ApiError, type VerificationResult } from '../../lib/api/types';
import './public-record.css';

const idPattern = /^[A-Za-z0-9_-]{22}$/;
const headings = { valid:'Valid record', expired:'Record expired', revoked:'Record revoked', replaced:'Record replaced' };
const explanations = { valid:'This record is currently valid in the issuer database.', expired:'The validity period for this record has ended.', revoked:'The issuer has withdrawn this record.', replaced:'This record has been superseded. Compare the replacement separately.' };
export function RecordTime({ value }: { value:string }) { return <time dateTime={value}>{new Date(value).toLocaleString('en-GB', { timeZone:'UTC', dateStyle:'long', timeStyle:'short' })} UTC</time>; }
export default function VerifyPage() {
  const { publicId } = useParams(); const api = useApi(); const navigate = useNavigate();
  const [entry,setEntry] = useState(''); const [validation,setValidation] = useState(''); const [attempt,setAttempt] = useState(0);
  const [state,setState] = useState<{id:string; result?:VerificationResult; error?:unknown} | null>(null);
  useEffect(() => {
    if (!publicId || !idPattern.test(publicId)) return;
    let active = true;
    api.verifyCredential(publicId).then(result => { if(active) setState({id:publicId,result}); }, error => { if(active) setState({id:publicId,error}); });
    return () => { active = false; };
  }, [api,publicId,attempt]);
  const current = state?.id === publicId ? state : null;
  const result = current?.result;
  const missing = publicId && (!idPattern.test(publicId) || (current?.error instanceof ApiError && current.error.code === 'NOT_FOUND'));
  const limited = current?.error instanceof ApiError && current.error.code === 'RATE_LIMITED';
  const title = !publicId ? 'Verify a record' : missing ? 'Record not found' : result ? headings[result.status] : current?.error ? limited ? 'Too many checks' : 'Unable to verify' : 'Checking record';
  const retry = () => { setState(null); setAttempt(n=>n+1); };
  return <PublicLayout><section className="container"><div className="public-record">
    {api.mode === 'demo' && <p>Demonstration · Fictional data</p>}<h1>{title}</h1>
    {!publicId ? <form onSubmit={e=>{ e.preventDefault(); let id=entry.trim(); try { const url=new URL(id); const match=url.pathname.match(/^\/verify\/([^/]+)\/?$/); id=match?.[1] ?? ''; } catch { /* A plain ID is also accepted. */ } if(!idPattern.test(id)) {setValidation('Enter a 22-character record ID or a full verification URL.'); return;} setValidation(''); navigate(`/verify/${id}`); }}>
      <FormField id="record-id" label="Record ID or verification URL" error={validation}><TextInput value={entry} onChange={e=>setEntry(e.target.value)} /></FormField><Button type="submit">Check record</Button>
    </form> : <div aria-live="polite" className="public-record-result" data-status={result?.status}>
      {missing ? <p>No public record was found for this ID.</p> : result ? <>
        <StatusPill status={result.status}/><p>{explanations[result.status]}</p>
        <dl><dt>Recipient</dt><dd>{result.recipientDisplayName}</dd><dt>Title</dt><dd>{result.title}</dd><dt>Achievement</dt><dd>{result.achievement}</dd><dt>Issuer</dt><dd>{result.issuer.displayName}</dd><dt>Issuer review</dt><dd>{result.issuer.reviewState === 'reviewed' ? 'Identity and authority reviewed by VeriMark — not an accreditation' : result.issuer.reviewState === 'pending' ? 'Not yet reviewed' : 'Suspended'}</dd><dt>Issued</dt><dd><RecordTime value={result.issuedAt}/></dd><dt>Expiry</dt><dd>{result.expiresAt ? <RecordTime value={result.expiresAt}/> : 'No expiry'}</dd><dt>Checked at</dt><dd><RecordTime value={result.checkedAt}/></dd><dt>Record ID</dt><dd>{result.publicId}</dd></dl>
        {result.status === 'replaced' && result.replacementPublicId && idPattern.test(result.replacementPublicId) && <Link to={`/verify/${result.replacementPublicId}`}>View replacement record</Link>}
        <p>Compare these details with the document you were shown. A QR code or link only locates this record.</p><p>This is an online database check, not a cryptographic proof.</p>
      </> : current?.error ? <><p>{limited ? `Please retry after ${current.error instanceof ApiError ? current.error.retryAfterSeconds ?? 60 : 60} seconds.` : 'No conclusion can be drawn about this record. Please try again.'}</p><Button onClick={retry}>Try again</Button></> : <LoadingState label="Checking the current record…"/>}
    </div>}
  </div></section></PublicLayout>;
}
