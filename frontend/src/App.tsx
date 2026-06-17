import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RequestPage from './pages/RequestPage'
import AssignPage from './pages/AssignPage'
import AcceptPage from './pages/AcceptPage'
import SettlePage from './pages/SettlePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/request" replace />} />
        <Route path="request" element={<RequestPage />} />
        <Route path="assign" element={<AssignPage />} />
        <Route path="accept" element={<AcceptPage />} />
        <Route path="settle" element={<SettlePage />} />
      </Route>
    </Routes>
  )
}

export default App
