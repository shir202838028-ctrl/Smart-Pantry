import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import Auth from './pages/Auth'
import Recipes from './pages/Recipes'
import Pantry from './pages/Pantry'
import ShoppingList from './pages/ShoppingList'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  // Not authenticated: only the Auth page is reachable.
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    )
  }

  // Authenticated: render the main app shell with nested routes.
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/recipes" replace />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/pantry" element={<Pantry />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="*" element={<Navigate to="/recipes" replace />} />
      </Route>
    </Routes>
  )
}

export default App
