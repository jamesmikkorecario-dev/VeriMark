import { Route, Routes } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import DashboardPage from '../pages/DashboardPage';
import DeferredPage from '../pages/DeferredPage';
import NotFoundPage from '../pages/NotFoundPage';
import RouteEffects from './RouteEffects';
export default function App() {
return <><RouteEffects /><Routes><Route path="/" element={<LandingPage />} /><Route path="/workspace" element={<DashboardPage />} /><Route path="/workspace/:section" element={<DeferredPage />} /><Route path="/preview/:section" element={<DeferredPage />} /><Route path="*" element={<NotFoundPage />} /></Routes></>;
}
