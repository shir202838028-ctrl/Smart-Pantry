import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  ChefHat,
  LogOut,
  Menu,
  Refrigerator,
  ShoppingCart,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/recipes', label: 'מתכונים', icon: ChefHat },
  { to: '/pantry', label: 'המזווה שלי', icon: Refrigerator },
  { to: '/shopping-list', label: 'רשימת קניות', icon: ShoppingCart },
]

export default function AppLayout() {
  const { signOut, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-emerald-50 text-emerald-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/recipes" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <ChefHat className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold text-gray-800">
              מזווה חכם
            </span>
          </NavLink>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={linkClass}>
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              className="ms-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              התנתק
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile navigation */}
        {mobileOpen && (
          <nav className="flex flex-col gap-1 border-t border-gray-200 px-4 py-3 md:hidden">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={linkClass}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false)
                signOut()
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              התנתק
            </button>
          </nav>
        )}
      </header>

      {user && (
        <p className="mx-auto max-w-6xl px-4 pt-4 text-sm text-gray-500">
          מחובר כ־<span className="font-medium">{user.email}</span>
        </p>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
