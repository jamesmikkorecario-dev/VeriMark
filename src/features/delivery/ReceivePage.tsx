import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/Layouts';
import { Button, FormField, LoadingState, StatusPill, TextInput } from '../../components/ui';
import { useApi } from '../../lib/api/context';
import { ApiError, type DeliveredCredential } from '../../lib/api/types';
import { renderCertificatePdf, verificationUrl } from '../../lib/certificate';
import { certificateFilename, downloadPdf } from '../../lib/certificate/download';
import { RecordTime } from '../verification/VerifyPage';
import '../verification/public-record.css';

export default function ReceivePage() {
  const api = useApi(); const token = useRef<string | null>(null);
  const [attempt,setAttempt] = useState(0);
  const [state,setState] = useState<{result?:DeliveredCredential; error?:unknown} | null>(null);
  const [pdf,setPdf] = useState<'idle'|'pending'|'failed'>('idle'); const [copy,setCopy] = useState('');
  useEffect(() => {
    if (token.current === null) {
      token.current = window.location.hash.slice(1);
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
    let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const previous = meta?.getAttribute('content'); const created = !meta;
    if (!meta) {meta=document.createElement('meta'); meta.name='referrer'; document.head.append(meta);}
    meta.content='no-referrer';
    return () => { if(created) meta.remove(); else if(previous === null || previous === undefined) meta.removeAttribute('content'); else meta.content=previous; };
  }, []);
  useEffect(() => {
    if (!token.current || !/^[A-Za-z0-9_-]{43}$/.test(token.current)) return;
    let active = true;
    api.exchangeDelivery(token.current).then(result=>{if(active)setState({result});},error=>{if(active)setState({error});});
    return () => {active=false;};
  }, [api,attempt]);
  // Read the fragment only in the effect; the initial render never echoes it.
  const unavailable = state?.error instanceof ApiError && state.error.code === 'DELIVERY_UNAVAILABLE';
  // An invalid fragment needs no network request but still needs a state update.
  useEffect(() => { if (!token.current || !/^[A-Za-z0-9_-]{43}$/.test(token.current)) setState({error:new ApiError('DELIVERY_UNAVAILABLE','Unavailable')}); }, []);
  const result=state?.result;
  return <PublicLayout><section className="container"><div className="public-record">
    {api.mode === 'demo' && <p>Demonstration · Fictional data</p>}
    <h1>{unavailable ? 'Access link unavailable' : state?.error ? 'Temporarily unable to open record' : result ? 'Your certificate' : 'Opening your record'}</h1>
    <div aria-live="polite">
    {unavailable ? <p>This access link is unavailable. Contact the issuer for a new link.</p> : state?.error ? <><p>We cannot open your record right now. Please try again.</p><Button onClick={()=>{setState(null);setAttempt(n=>n+1);}}>Try again</Button></> : !result ? <LoadingState label="Exchanging your private access link…"/> : <>
      <StatusPill status={result.status}/><dl><dt>Recipient</dt><dd>{result.recipientDisplayName}</dd><dt>Title</dt><dd>{result.title}</dd><dt>Achievement</dt><dd>{result.achievement}</dd><dt>Issuer</dt><dd>{result.issuerDisplayName}</dd><dt>Issued</dt><dd><RecordTime value={result.issuedAt}/></dd><dt>Expiry</dt><dd>{result.expiresAt ? <RecordTime value={result.expiresAt}/> : 'No expiry'}</dd><dt>Record ID</dt><dd>{result.publicId}</dd></dl>
      <div className="public-record-actions"><Button disabled={pdf==='pending'} onClick={async()=>{setPdf('pending');try { const bytes=await renderCertificatePdf({...result,verifyUrl:verificationUrl(result.publicId)}); downloadPdf(bytes,certificateFilename(result.publicId));setPdf('idle'); } catch {setPdf('failed');}}}>{pdf==='pending' ? 'Preparing PDF…' : 'Download certificate (PDF)'}</Button>
      {pdf==='failed' && <p role="alert">The PDF could not be prepared. Please try the download again.</p>}
      <Link to={`/verify/${result.publicId}`}>Open public verification page</Link>
      <FormField id="public-link" label="Public verification link" hint="Select this link to copy it manually if needed."><TextInput readOnly value={verificationUrl(result.publicId)} /></FormField>
      <Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(verificationUrl(result.publicId));setCopy('Public link copied.');}catch{setCopy('Copy is unavailable. Select and copy the public link above.');}}}>Copy public link</Button><p>{copy}</p></div>
      <p>This private access link is personal. Share the public verification page instead.</p><p>The document alone is not proof. The public page checks the current online database record.</p>
    </>}
    </div>
  </div></section></PublicLayout>;
}

