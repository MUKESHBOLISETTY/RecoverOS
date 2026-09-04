import './App.css'
import Login from './pages/auth/Login'
import SignUp from './pages/auth/SignUp'
import { Toaster } from 'react-hot-toast';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import RecoveryCases from './pages/RecoveryCases';
import CaseJourney from './pages/CaseJourney';
import Settings from './pages/Settings';
import Audit from './pages/Audit';
import Insights from './pages/Insights';
import ProtectedRoute from './components/auth/ProtectedRoute';
import OnboardingGuard from './components/layout/OnboardingGuard';
import Onboarding from './pages/Onboarding';

import { TooltipProvider } from './components/ui/tooltip'

function App() {

  return (
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}

function AppContent() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path='/' element={<Navigate to="/dashboard" replace />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<SignUp />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute><OnboardingGuard><MainLayout /></OnboardingGuard></ProtectedRoute>}>
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/cases' element={<RecoveryCases />} />
          <Route path='/cases/:id' element={<CaseJourney />} />
          <Route path='/settings' element={<Settings />} />
          <Route path='/audit' element={<Audit />} />
          <Route path='/insights' element={<Insights />} />
        </Route>

        <Route path='/onboarding' element={<ProtectedRoute><OnboardingGuard><Onboarding /></OnboardingGuard></ProtectedRoute>} />
      </Routes>
    </>
  )
}

export default App
