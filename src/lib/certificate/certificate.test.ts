import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { renderCertificatePdf, type CertificateInput } from './index';
vi.mock('qrcode', { spy: true });
const input: CertificateInput = { publicId:'abcdefghijklmnopqrstuv', issuerDisplayName:'Fictional Institute', recipientDisplayName:'Example Person', title:'Workshop', achievement:'Completed a workshop', issuedAt:'2026-01-01T00:00:00Z', expiresAt:null, verifyUrl:'https://example.test/verify/abcdefghijklmnopqrstuv', template:{ heading:'Certificate',bodyPrefix:'Presented to',signatoryName:'Example Signer',signatoryTitle:'Director',accent:'forest',orientation:'landscape' } };
describe('certificate',()=>{
  it.each(['landscape','portrait'] as const)('creates a parseable A4 %s PDF',async orientation=>{
    const bytes=await renderCertificatePdf({...input,template:{...input.template,orientation}});
    expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('%PDF');
    const doc=await PDFDocument.load(bytes); const page=doc.getPage(0);
    expect(page.getWidth()).toBeCloseTo(orientation==='landscape'?841.89:595.28);
    expect(page.getHeight()).toBeCloseTo(orientation==='landscape'?595.28:841.89);
  });
  it('handles Unicode and extreme lengths and uses exactly the supplied QR URL',async()=>{
    const spy=vi.mocked(QRCode.create);
    await expect(renderCertificatePdf({...input,recipientDisplayName:'?? ??'.repeat(100),achievement:'Long ??'.repeat(4000)})).resolves.toBeInstanceOf(Uint8Array);
    expect(spy).toHaveBeenCalledWith(input.verifyUrl,{errorCorrectionLevel:'M'});
    const matrix=spy.mock.results[0].value.modules;
    expect(matrix.data).toEqual(QRCode.create(input.verifyUrl,{errorCorrectionLevel:'M'}).modules.data);
    spy.mockRestore();
  });
});

