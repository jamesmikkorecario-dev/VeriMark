export function certificateFilename(publicId: string): string { return `verimark-${publicId.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`; }
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type:'application/pdf' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
