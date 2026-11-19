import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PromotionalReveals } from '../components/motion/PromotionalReveals';
import { ButtonLink, Icon, SectionLabel, StatusPill } from '../components/ui';
import { PublicLayout } from '../components/layout/Layouts';
import { useEnvironment } from '../components/layout/environment';
import { formatDate } from '../features/credentials/shared/format';
import { DEMO_PUBLIC_IDS } from '../lib/api/demo/state';
import './pages.css';

function LinkArrow({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="link-arrow" to={to}>{children}<Icon name="arrow" /></Link>;
}

const DAY = 86_400_000;
/** The seeded valid record (demo/state.ts) is issued a week before the demo state is created, so the example matches its real page. */
const DEMO_ISSUED = formatDate(new Date(Date.now() - 7 * DAY).toISOString());

function CredentialPaper({ demo }: { demo: boolean }) {
  return (
    <article className="record-paper" aria-label="Fictional example credential">
      <div className="paper-top"><span>VERIMARK / FICTIONAL PUBLIC RECORD</span><span className="paper-mark" aria-hidden="true"><span>V</span><i /></span></div>
      <div className="paper-index"><span>01 / ACHIEVEMENT</span><span>COMPLETION</span></div>
      <h2 className="paper-title">Community Research<br />Workshop</h2>
      <p className="paper-recipient">Awarded to <strong>Alex Santos</strong></p>
      <div className="paper-detail-grid">
        <div><small>ISSUED BY</small><strong>Fieldwork Collective</strong></div>
        <div><small>ISSUED ON</small><strong>{demo ? DEMO_ISSUED : '12 Nov 2026'}</strong></div>
      </div>
      <div className="paper-bottom"><span>RECORD NO. {demo ? DEMO_PUBLIC_IDS.valid : 'VM-2026-0482'}</span><StatusPill status="valid" /></div>
    </article>
  );
}

export default function LandingPage() {
  const demo = useEnvironment() === 'demo';
  // With a real backend there is no demonstration to open: issuers go to sign-in.
  const workspaceTo = demo ? '/demo' : '/sign-in';
  const sampleTo = demo ? `/verify/${DEMO_PUBLIC_IDS.valid}` : '/verify';
  return (
    <PublicLayout>
      <PromotionalReveals>
        <section className="hero experience-container">
          <div className="hero-grid">
            <div className="hero-content" data-motion="hero">
              <SectionLabel>THE CREDENTIAL INFRASTRUCTURE</SectionLabel>
              <h1>Achievement,<br /><em>on the record.</em></h1>
              <p className="hero-intro">Issue meaningful credentials. Share them with confidence. Give anyone a clear way to check the record.</p>
              <div className="hero-actions">
                <ButtonLink to={workspaceTo}>{demo ? 'Open the live demo' : 'Sign in to your workspace'} <Icon name="arrow" /></ButtonLink>
                <ButtonLink to="/verify" variant="outline">Verify a credential <Icon name="arrow" /></ButtonLink>
                <Link className="link-arrow hero-method-link" to="/#method" state={{ sectionScroll: true }}>See how it works<Icon name="arrow" /></Link>
              </div>
              <p className="hero-footnote">Built for learning communities, associations,<br />and organizations that can stand behind their work.</p>
            </div>
            <div className="hero-right route-enter motion-stage-2" data-motion="credential">
              <div className="hero-preview-title"><span>ONE RECORD. A CLEARER STORY.</span><span>001—003</span></div>
              <CredentialPaper demo={demo} />
              <div className="hero-preview-foot"><em>01</em><p>Records with context.<br /><strong>Trust begins with clarity.</strong></p><Icon name="arrow" /></div>
            </div>
          </div>
        </section>
        <section className="statement-strip">
          <div className="experience-container strip-grid" data-reveal="">
            <h2>A credential is only as useful as the story it can tell <em>and the details others can check.</em></h2>
            <div className="strip-decoration">
              <svg className="statement-star" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" focusable="false"><path d="M40 2v76M2 40h76M13 13l54 54M13 67l54-54" /></svg>
              <p>A more thoughtful way<br />to document achievement.</p>
            </div>
          </div>
        </section>
        <section id="method" data-section-target="" tabIndex={-1} aria-labelledby="method-heading" className="section experience-container">
          <SectionLabel>THE VERIMARK METHOD</SectionLabel>
          <div className="heading-split" data-reveal="">
            <h2 id="method-heading">From recognition<br />to <em>reassurance.</em></h2>
            <p>A single, understandable path from issuing an achievement to checking its current standing.</p>
          </div>
          <div className="three-cards">
            {[
              ['Prepare', 'Capture the recipient, achievement and issuing organization in a consistent record.', workspaceTo],
              ['Issue', 'Review the details carefully before recording an achievement and sharing its unique reference.', workspaceTo],
              ['Verify', 'Let anyone compare the exact record details and view its current reported standing.', '/verify'],
            ].map(([title, copy, to], i) => (
              <article className="method-card" data-reveal="" key={title}>
                <span>0{i + 1} / 03</span>
                <Icon name={i === 0 ? 'records' : i === 1 ? 'plus' : 'check'} />
                <h3><LinkArrow to={to}>{title}</LinkArrow></h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="feature-section">
          <div className="experience-container feature-layout">
            <div className="feature-copy" data-reveal="">
              <SectionLabel>BUILT AROUND THE RECORD</SectionLabel>
              <h2>The important details.<br /><em>Nothing lost.</em></h2>
              <p>Names, achievements, issuing organizations, dates and status belong together. Clear hierarchy makes the information easier to read and compare.</p>
              <ButtonLink to={sampleTo} variant="outline">{demo ? 'Explore a sample record' : 'Check a record'} <Icon name="arrow" /></ButtonLink>
            </div>
            <article className="verification-example" data-reveal="">
              <span>VERIFICATION / FICTIONAL EXAMPLE</span>
              <div className="example-check"><Icon name="check" size={28} /></div>
              <small>{demo ? 'REPORTED STANDING · FICTIONAL RECORD' : 'ILLUSTRATIVE STANDING ONLY'}</small>
              <h3>A record, <em>not just a badge.</em></h3>
              <p>{demo
                ? 'This is a fictional record from the live demo, and the sample record link opens its real public verification page. Compare the recipient, achievement and issuer with what was presented. The demo runs on data kept only in your browser tab: nothing is sent to a server.'
                : 'This fictional example illustrates a record’s standing. Compare the recipient, achievement and issuer with what was presented.'}</p>
              <div className="mini-facts">
                <div><small>REFERENCE</small><strong>{demo ? DEMO_PUBLIC_IDS.valid : 'VM-2026-0482'}</strong></div>
                <div><small>STANDING</small><strong>VALID · DEMO</strong></div>
              </div>
            </article>
          </div>
        </section>
        <section className="section experience-container">
          <SectionLabel>DESIGNED FOR THE PEOPLE BEHIND IT</SectionLabel>
          <div className="audience-grid" data-reveal="">
            <h2>One platform.<br /><em>Three points of view.</em></h2>
            <div>
              {[
                ['issuers', 'Issue responsibly and keep a record of what your organization recognizes.', workspaceTo],
                ['recipients', 'Keep an understandable record of your accomplishments and share the exact reference. Your issuer sends you a private link; no account needed.', ''],
                ['verifiers', 'Check what the record says—and whether it is still reported as valid.', '/verify'],
              ].map(([audience, copy, to], i) => (
                <div className="audience-row" key={audience}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{to ? <LinkArrow to={to}>For {audience}</LinkArrow> : <>For {audience}</>}</h3>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="closing-section">
          <div className="experience-container">
            <SectionLabel>READY TO TAKE A CLOSER LOOK?</SectionLabel>
            <h2>A little more<br /><em>certainty, by design.</em></h2>
            <div className="closing-bottom">
              <p>{demo
                ? <>Open the live demo: a fictional issuer workspace you can really use. Issue, replace and revoke records, share a recipient link, check the public page. No account or setup needed; the fictional data stays in this browser tab and can be reset at any time.<br /></>
                : <>Sign in to issue and manage credentials for your organization. Recipients and verifiers never need an account.<br /></>}
                QR links provide access, not authenticity; issuer recognition is not accreditation.</p>
              <ButtonLink to={workspaceTo} variant="light">{demo ? 'Explore the live demo' : 'Sign in'} <Icon name="arrow" /></ButtonLink>
            </div>
          </div>
        </section>
      </PromotionalReveals>
    </PublicLayout>
  );
}
