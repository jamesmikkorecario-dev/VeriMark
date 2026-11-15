import type { CertificateInput } from './index';

export async function createPdf(input: CertificateInput): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts, rgb }, QRCode] = await Promise.all([import('pdf-lib'), import('qrcode')]);
  const doc = await PDFDocument.create();
  const landscape = input.template.orientation === 'landscape';
  const [width, height] = landscape ? [841.89, 595.28] : [595.28, 841.89];
  const page = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const accent = { forest: rgb(.08,.24,.20), ink: rgb(.11,.22,.19), ochre: rgb(.47,.35,.10) }[input.template.accent];
  // Standard fonts cannot encode arbitrary Unicode. Replace unsupported code points individually.
  const clean = (s: string) => Array.from(s.replace(/\s+/gu, ' '), c => { try { font.encodeText(c); return c; } catch { return '?'; } }).join('');
  let y = height - 58;
  const text = (value: string, size = 12, maxLines = 2, display = false) => {
    const face = display ? serif : font;
    const lines: string[] = []; let line = '';
    for (const c of clean(value).slice(0, 12000)) {
      if (face.widthOfTextAtSize(line + c, size) > width - 112) { lines.push(line); line = ''; }
      line += c;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) { let last = shown[maxLines - 1]; while (face.widthOfTextAtSize(last + '...', size) > width - 112) last = last.slice(0,-1); shown[maxLines - 1] = last + '...'; }
    for (const row of shown) { page.drawText(row, { x:56, y, size, font:face, color:accent }); y -= size * 1.3; }
    y -= 10;
  };
  page.drawRectangle({ x:24, y:24, width:width-48, height:height-48, borderWidth:1, borderColor:accent });
  text(input.template.heading, 25, 2, true);
  text(input.template.bodyPrefix);
  text(input.recipientDisplayName, 21, 2, true);
  text(input.title, 15, 2);
  text(input.achievement, 11, landscape ? 3 : 9);
  text(`Issued by ${input.issuerDisplayName}`, 11);
  text(`Issued: ${input.issuedAt.slice(0,10)} UTC${input.expiresAt ? ` | Expires: ${input.expiresAt.slice(0,10)} UTC` : ''}`, 10, 1);
  text(`${input.template.signatoryName} | ${input.template.signatoryTitle}`, 10, 2);
  const matrix = QRCode.create(input.verifyUrl, { errorCorrectionLevel:'M' }).modules;
  const extent = 76; const unit = extent / (matrix.size + 8);
  for (let row=0; row<matrix.size; row++) for (let col=0; col<matrix.size; col++) if (matrix.get(row,col)) page.drawRectangle({ x:56+(col+4)*unit, y:52+(matrix.size-row+3)*unit, width:unit, height:unit, color:rgb(0,0,0) });
  y = 117;
  // Footer is independent of body height, leaving room for the QR quiet zone.
  page.drawText(clean(`Record ID: ${input.publicId}`), { x:145,y,size:9,font,color:accent });
  const url = clean(input.verifyUrl);
  for (let start=0; start<url.length; start+=65) page.drawText(url.slice(start,start+65), {x:145,y:100-Math.floor(start/65)*11,size:8,font,color:accent});
  page.drawText('Scan or visit to check the current record. This document alone is not proof.', {x:145,y:57,size:7,font,color:accent});
  return doc.save();
}
