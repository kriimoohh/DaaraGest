import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ui/ProtectedRoute';
import { ElevesPage } from './pages/Eleves';
import { ProfesseursPage } from './pages/Professeurs';
import { ClassesPage } from './pages/Classes';
import { NotesPage } from './pages/Notes';
import { EvaluationsPage } from './pages/Evaluations';
import { ProgressionPage } from './pages/Progression';
import { BulletinsPage } from './pages/Bulletins';
import { FinancesPage } from './pages/Finances';
import { ParametresPage } from './pages/Parametres';
import { AnneeScolairesPage } from './pages/AnneeScolaires';
import { MatieresPage } from './pages/Matieres';
import { UtilisateursPage } from './pages/Utilisateurs';
import { PointagePage } from './pages/Pointage';
import { ScannerPage } from './pages/Pointage/Scanner';
import { AbsencesPage } from './pages/Absences';
import { EmploiDuTempsPage } from './pages/EmploiDuTemps';
import { CalendrierPage } from './pages/Calendrier';
import { MessageriePage } from './pages/Messagerie';
import { ActivitesPage } from './pages/Activites';
import { DocumentsPage } from './pages/Documents';
import { PortailParentPage } from './pages/PortailParent';
import { RapportsPage } from './pages/Rapports';
import { BibliothequeePage } from './pages/Bibliotheque';
import './i18n';

// Mêmes listes que la Sidebar — source de vérité unique côté frontend
const ROLES = {
  gestion:    ['admin', 'directeur', 'gestionnaire', 'agent de scolarité'],
  lecture:    ['admin', 'directeur', 'gestionnaire', 'agent de scolarité', 'professeur', 'pointeur'],
  academique: ['admin', 'directeur', 'gestionnaire', 'professeur'],
  finances:   ['admin', 'gestionnaire', 'agent de scolarité'],
  pointage:   ['admin', 'directeur', 'gestionnaire', 'pointeur'],
  adminOnly:  ['admin'],
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
          <Route path="/professeurs" element={
            <ProtectedRoute roles={['admin', 'directeur', 'gestionnaire']}><ProfesseursPage /></ProtectedRoute>
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
          <Route path="/utilisateurs" element={
            <ProtectedRoute roles={ROLES.adminOnly}><UtilisateursPage /></ProtectedRoute>
          } />
          <Route path="/parametres" element={
            <ProtectedRoute roles={ROLES.adminOnly}><ParametresPage /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
