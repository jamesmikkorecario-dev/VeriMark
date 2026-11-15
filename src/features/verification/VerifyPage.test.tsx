import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiProvider } from '../../lib/api/context';
import { ApiError, type VeriMarkApi, type VerificationResult } from '../../lib/api/types';
import VerifyPage from './VerifyPage';
const id='abcdefghijklmnopqrstuv';
const record: VerificationResult={ publicId:id,status:'valid',issuer:{displayName:'Fictional Institute',reviewState:'reviewed'},recipientDisplayName:'Example Person',title:'Workshop',achievement:'Completed workshop',issuedAt:'2026-01-01T00:00:00Z',expiresAt:null,checkedAt:'2026-11-01T12:00:00Z',proofType:'online_database',replacementPublicId:null };
function mount(handler: VeriMarkApi['verifyCredential'],path=`/verify/${id}`){ const api={mode:'demo',verifyCredential:vi.fn(handler)} as unknown as VeriMarkApi; render(<ApiProvider api={api}><MemoryRouter initialEntries={[path]}><Routes><Route path="/verify" element={<VerifyPage/>}/><Route path="/verify/:publicId" element={<VerifyPage/>}/></Routes></MemoryRouter></ApiProvider>);return api; }
afterEach(cleanup);
describe('public verification',()=>{
  it.each(['valid','expired','revoked','replaced'] as const)('shows %s and only comparison fields',async status=>{
    mount(async()=>({...record,status,replacementPublicId:status==='replaced'?'zyxwvutsrqponmlkjihgfe':null,recipientEmail:'PRIVATE_SENTINEL',reason:'SECRET_REASON'}));
    expect(await screen.findByText('Example Person')).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(status,'i')).length).toBeGreaterThan(0);
    expect(screen.queryByText('PRIVATE_SENTINEL')).not.toBeInTheDocument();expect(screen.queryByText('SECRET_REASON')).not.toBeInTheDocument();
    if(status==='replaced') expect(screen.getByText('View replacement record')).toHaveAttribute('href','/verify/zyxwvutsrqponmlkjihgfe');
    expect(screen.getByText(/not a cryptographic proof/)).toBeInTheDocument();
  });
  it.each([['NOT_FOUND','Record not found'],['RATE_LIMITED','Too many checks'],['FORBIDDEN','Unable to verify'],['UNABLE_TO_VERIFY','Unable to verify']] as const)('maps %s safely',async(code,heading)=>{
    mount(async()=>{throw new ApiError(code,'RAW_SERVER_SECRET',{retryAfterSeconds:17});});
    expect(await screen.findByRole('heading',{name:heading})).toBeInTheDocument();expect(screen.queryByText('RAW_SERVER_SECRET')).not.toBeInTheDocument();
    if(code==='RATE_LIMITED') expect(screen.getByText(/17 seconds/)).toBeInTheDocument();
  });
  it('retries a network failure without concluding not found',async()=>{let calls=0;mount(async()=>{if(!calls++)throw new Error('network');return record;});await screen.findByText(/No conclusion/);fireEvent.click(screen.getByText('Try again'));expect(await screen.findByText('Example Person')).toBeInTheDocument();});
  it('short circuits malformed IDs',async()=>{const api=mount(async()=>record,'/verify/bad');await screen.findByText('No public record was found for this ID.');expect(api.verifyCredential).not.toHaveBeenCalled();});
  it('validates input and extracts a pasted URL',async()=>{const api=mount(async()=>record,'/verify');fireEvent.click(screen.getByText('Check record'));expect(screen.getByText(/Enter a 22-character/)).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Record ID or verification URL'),{target:{value:`https://example.test/verify/${id}`}});fireEvent.click(screen.getByText('Check record'));await waitFor(()=>expect(api.verifyCredential).toHaveBeenCalledWith(id));});
  it('announces loading',()=>{mount(()=>new Promise(()=>{}));expect(screen.getByRole('status')).toHaveTextContent('Checking');});
});
