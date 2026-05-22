import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ui/ProtectedRoute';
import './i18n';

// Code-splitting : pages lourdes ou peu utilisées → chunks séparés.
// Tableau de bord et Login restent en eager pour TTI initial.
const ElevesPage         = lazy(() => import('./pages/Eleves').then(m => ({ default: m.ElevesPage })));
const PersonnelPage      = lazy(() => import('./pages/Personnel').then(m => ({ default: m.PersonnelPage })));
const ClassesPage        = lazy(() => import('./pages/Classes').then(m => ({ default: m.ClassesPage })));
const NotesPage          = lazy(() => import('./pages/Notes').then(m => ({ default: m.NotesPage })));
const EvaluationsPage    = lazy(() => import('./pages/Evaluations').then(m => ({ default: m.EvaluationsPage })));
const ProgressionPage    = lazy(() => import('./pages/Progression').then(m => ({ default: m.ProgressionPage })));
const BulletinsPage      = lazy(() => import('./pages/Bulletins').then(m => ({ default: m.BulletinsPage })));
const FinancesPage       = lazy(() => import('./pages/Finances').then(m => ({ default: m.FinancesPage })));
const ParametresPage     = lazy(() => import('./pages/Parametres').then(m => ({ default: m.ParametresPage })));
const AnneeScolairesPage = lazy(() => import('./pages/AnneeScolaires').then(m => ({ default: m.AnneeScolairesPage })));
const MatieresPage       = lazy(() => import('./pages/Matieres').then(m => ({ default: m.MatieresPage })));
const UtilisateursPage   = lazy(() => import('./pages/Utilisateurs').then(m => ({ default: m.UtilisateursPage })));
const PointagePage       = lazy(() => import('./pages/Pointage').then(m => ({ default: m.PointagePage })));
const ScannerPage        = lazy(() => import('./pages/Pointage/Scanner').then(m => ({ default: m.ScannerPage })));
const AbsencesPage       = lazy(() => import('./pages/Absences').then(m => ({ default: m.AbsencesPage })));
const EmploiDuTempsPage  = lazy(() => import('./pages/EmploiDuTemps').then(m => ({ default: m.EmploiDuTempsPage })));
const CalendrierPage     = lazy(() => import('./pages/Calendrier').then(m => ({ default: m.CalendrierPage })));
const MessageriePage     = lazy(() => import('./pages/Messagerie').then(m => ({ default: m.MessageriePage })));
const ActivitesPage      = lazy(() => import('./pages/Activites').then(m => ({ default: m.ActivitesPage })));
const DocumentsPage      = lazy(() => import('./pages/Documents').then(m => ({ default: m.DocumentsPage })));
const PortailParentPage  = lazy(() => import('./pages/PortailParent').then(m => ({ default: m.PortailParentPage })));
const RapportsPage       = lazy(() => import('./pages/Rapports').then(m => ({ default: m.RapportsPage })));
const BibliothequeePage  = lazy(() => import('./pages/Bibliotheque').then(m => ({ default: m.BibliothequeePage })));
const DemandesAbsencePersonnelPage = lazy(() => import('./pages/DemandesAbsencePersonnel').then(m => ({ default: m.DemandesAbsencePersonnelPage })));

// Mêmes listes que la Sidebar — source de vérité unique côté frontend
const ROLES = {
  gestion:    ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'],
  lecture:    ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'],
  academique: ['admin', 'directeur', 'gestionnaire', 'professeur'],
  finances:   ['admin', 'gestionnaire', 'agent de scolarité'],
  pointage:   ['admin', 'directeur', 'gestionnaire', 'pointeur'],
  adminOnly:  ['admin'],
};

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--rule)', borderTopColor: 'var(--terra)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/guide" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/portail/:token" element={<PortailParentPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/eleves" element={
              <ProtectedRoute roles={ROLES.gestion}><ElevesPage /></ProtectedRoute>
            } />
            <Route path="/personnel" element={
              <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire']}><PersonnelPage /></ProtectedRoute>
            } />
            <Route path="/classes" element={
              <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire', 'professeur']}><ClassesPage /></ProtectedRoute>
            } />
            <Route path="/annees-scolaires" element={
              <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire']}><AnneeScolairesPage /></ProtectedRoute>
            } />
            <Route path="/matieres" element={
              <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire']}><MatieresPage /></ProtectedRoute>
            } />
            <Route path="/notes" element={
              <ProtectedRoute roles={ROLES.academique}><NotesPage /></ProtectedRoute>
            } />
            <Route path="/evaluations" element={
              <ProtectedRoute roles={ROLES.academique}><EvaluationsPage /></ProtectedRoute>
            } />
            <Route path="/progression" element={
              <ProtectedRoute roles={ROLES.gestion}><ProgressionPage /></ProtectedRoute>
            } />
            <Route path="/activites" element={
              <ProtectedRoute roles={ROLES.academique}><ActivitesPage /></ProtectedRoute>
            } />
            <Route path="/documents" element={
              <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire']}><DocumentsPage /></ProtectedRoute>
            } />
            <Route path="/bulletins" element={
              <ProtectedRoute roles={ROLES.academique}><BulletinsPage /></ProtectedRoute>
            } />
            <Route path="/absences" element={
              <ProtectedRoute roles={ROLES.lecture}><AbsencesPage /></ProtectedRoute>
            } />
            <Route path="/emploi-du-temps" element={
              <ProtectedRoute roles={ROLES.lecture}><EmploiDuTempsPage /></ProtectedRoute>
            } />
            <Route path="/calendrier" element={
              <ProtectedRoute roles={ROLES.lecture}><CalendrierPage /></ProtectedRoute>
            } />
            <Route path="/messagerie" element={
              <ProtectedRoute roles={ROLES.lecture}><MessageriePage /></ProtectedRoute>
            } />
            <Route path="/pointage" element={
              <ProtectedRoute roles={ROLES.pointage}><PointagePage /></ProtectedRoute>
            } />
            <Route path="/finances" element={
              <ProtectedRoute roles={ROLES.finances}><FinancesPage /></ProtectedRoute>
            } />
            <Route path="/rapports" element={
              <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire']}><RapportsPage /></ProtectedRoute>
            } />
            <Route path="/bibliotheque" element={
              <ProtectedRoute roles={ROLES.gestion}><BibliothequeePage /></ProtectedRoute>
            } />
            <Route path="/demandes-absence-personnel" element={
              <ProtectedRoute roles={ROLES.gestion}><DemandesAbsencePersonnelPage /></ProtectedRoute>
            } />
            <Route path="/utilisateurs" element={
              <ProtectedRoute roles={ROLES.adminOnly}><UtilisateursPage /></ProtectedRoute>
            } />
            <Route path="/parametres" element={
              <ProtectedRoute roles={ROLES.adminOnly}><ParametresPage /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
