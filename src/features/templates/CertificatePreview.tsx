import type { TemplateConfig } from '../../lib/api/types';

const SAMPLE_RECORD = {
  recipientDisplayName: 'Rowan Example',
  title: 'Community First Aid',
  achievement: 'Completed the 12-hour community first aid course with practical assessment.',
};

/** An on-page HTML approximation of the certificate using fictional sample data. The PDF is rendered separately. */
export function CertificatePreview({ config, issuerName, record = SAMPLE_RECORD, label = 'Certificate preview with fictional sample data' }: { config: TemplateConfig; issuerName: string; record?: typeof SAMPLE_RECORD; label?: string }) {
  return <figure className={`fsc-cert fsc-cert-${config.accent}${config.orientation === 'portrait' ? ' fsc-cert-portrait' : ''}`} aria-label={label} style={{ margin: 0 }}>
    <span className="fsc-cert-issuer">{issuerName}</span>
    <h3>{config.heading || 'Certificate heading'}</h3>
    {config.bodyPrefix && <p>{config.bodyPrefix}</p>}
    <span className="fsc-cert-name">{record.recipientDisplayName}</span>
    <p><strong>{record.title}</strong></p>
    <p>{record.achievement}</p>
    {(config.signatoryName || config.signatoryTitle) && <p className="fsc-cert-sign">{config.signatoryName}{config.signatoryName && config.signatoryTitle ? ' · ' : ''}{config.signatoryTitle}</p>}
    <p>Verify this record online at the official VeriMark address.</p>
  </figure>;
}
