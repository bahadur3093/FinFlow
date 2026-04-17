import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import Layout from './components/layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BudgetsPage from './pages/BudgetsPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import PDFUnlockerPage from './pages/PDFUnlockerPage.jsx';

const Protected = ({ children }) => {
  const token = useAuthStore(s => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/pdf-unlocker" element={<PDFUnlockerPage />} />
      </Route>
    </Routes>
  );
}
