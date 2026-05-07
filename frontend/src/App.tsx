import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Layout } from './components/layout/Layout';
import { ElevesPage } from './pages/Eleves';
import { ProfesseursPage } from './pages/Professeurs';
import { ClassesPage } from './pages/Classes';
import { NotesPage } from './pages/Notes';
import { BulletinsPage } from './pages/Bulletins';
import { FinancesPage } from './pages/Finances';
import { ParametresPage } from './pages/Parametres';
import { AnneeScolairesPage } from './pages/AnneeScolaires';
import { MatieresPage } from './pages/Matieres';
import { UtilisateursPage } from './pages/Utilisateurs';
import { PointagePage } from './pages/Pointage';
import './i18n';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/eleves" element={<ElevesPage />} />
          <Route path="/professeurs" element={<ProfesseursPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/bulletins" element={<BulletinsPage />} />
          <Route path="/finances" element={<FinancesPage />} />
          <Route path="/annees-scolaires" element={<AnneeScolairesPage />} />
          <Route path="/matieres" element={<MatieresPage />} />
          <Route path="/utilisateurs" element={<UtilisateursPage />} />
          <Route path="/pointage" element={<PointagePage />} />
          <Route path="/parametres" element={<ParametresPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
