import { Navigate, useParams } from 'react-router-dom';
import { useEnvironment } from '../components/layout/environment';
import { DEMO_PUBLIC_IDS } from '../lib/api/demo/state';

/**
 * Routes from the retired M1 prototype. Every old address still resolves, to the working product:
 * /workspace and /workspace/* lead into the issuer application, /preview/* into the public pages.
 */

/** /workspace: the interactive demo where one exists, otherwise the application (which asks for sign-in). */
export function WorkspaceRedirect() {
  const demo = useEnvironment() === 'demo';
  return <Navigate to={demo ? '/demo' : '/app'} replace />;
}

const WORKSPACE_SECTIONS: Record<string, string> = {
  records: '/app/credentials', credentials: '/app/credentials', issue: '/app/issue', templates: '/app/templates',
  activity: '/app/activity', settings: '/app/organization', organization: '/app/organization',
};

export function WorkspaceSectionRedirect() {
  const { section = '' } = useParams();
  return <Navigate to={Object.hasOwn(WORKSPACE_SECTIONS, section) ? WORKSPACE_SECTIONS[section] : '/app'} replace />;
}

/** /preview/record showed a sample record: the seeded one in the demo, the verification form otherwise. */
export function PreviewRecordRedirect() {
  const demo = useEnvironment() === 'demo';
  return <Navigate to={demo ? `/verify/${DEMO_PUBLIC_IDS.valid}` : '/verify'} replace />;
}
