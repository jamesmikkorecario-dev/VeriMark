import { Route, Routes } from 'react-router-dom';
import { useApi } from '../lib/api/context';
import { EnvironmentContext } from '../components/layout/environment';
import LandingPage from '../pages/LandingPage';
import DashboardPage from '../pages/DashboardPage';
import DeferredPage from '../pages/DeferredPage';
import NotFoundPage from '../pages/NotFoundPage';
import VerifyPage from '../features/verification/VerifyPage';
import ReceivePage from '../features/delivery/ReceivePage';
import { AuthProvider } from '../features/auth/AuthContext';
import RequireAuth from '../features/auth/RequireAuth';
import SignInPage from '../features/auth/SignInPage';
import SignUpPage from '../features/auth/SignUpPage';
import ResetPasswordPage from '../features/auth/ResetPasswordPage';
import UpdatePasswordPage from '../features/auth/UpdatePasswordPage';
import InvitePage from '../features/auth/InvitePage';
import AppLayout from '../features/organizations/AppLayout';
import OnboardingPage from '../features/organizations/OnboardingPage';
import OrganizationPage from '../features/organizations/OrganizationPage';
import AppNotFound from '../features/organizations/AppNotFound';
import ReviewPage from '../features/admin/ReviewPage';
import DashboardHome from '../features/activity/DashboardHome';
import ActivityPage from '../features/activity/ActivityPage';
import CredentialsPage from '../features/credentials/CredentialsPage';
import CredentialDetailPage from '../features/credentials/CredentialDetailPage';
import IssuePage from '../features/issuance/IssuePage';
import TemplatesPage from '../features/templates/TemplatesPage';
import RouteEffects from './RouteEffects';

export default function App() {
  const api = useApi();
  return (
    <EnvironmentContext.Provider value={api.mode}>
      <AuthProvider>
        <RouteEffects />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/verify/:publicId" element={<VerifyPage />} />
          <Route path="/receive" element={<ReceivePage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<DashboardHome />} />
            <Route path="credentials" element={<CredentialsPage />} />
            <Route path="credentials/:credentialId" element={<CredentialDetailPage />} />
            <Route path="issue" element={<IssuePage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="organization" element={<OrganizationPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="*" element={<AppNotFound />} />
          </Route>
          <Route path="/workspace" element={<DashboardPage />} />
          <Route path="/workspace/:section" element={<DeferredPage />} />
          <Route path="/preview/:section" element={<DeferredPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </EnvironmentContext.Provider>
  );
}
