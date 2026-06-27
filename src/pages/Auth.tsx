import { useState, type FormEvent } from 'react'
import { Loader2, Lock, Mail, ShoppingBasket } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const isLogin = mode === 'login'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setMessage(
          'החשבון נוצר! בדקו את האימייל לאישור, ולאחר מכן התחברו.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'משהו השתבש')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(isLogin ? 'register' : 'login')
    setError(null)
    setMessage(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <ShoppingBasket className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">מזווה חכם</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLogin
              ? 'ברוכים השבים! התחברו כדי להמשיך.'
              : 'צרו חשבון כדי להתחיל.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              אימייל
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 py-2.5 pe-3 ps-10 text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              סיסמה
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 py-2.5 pe-3 ps-10 text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 font-medium text-white transition hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {isLogin ? 'התחברות' : 'צור חשבון'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? 'אין לך חשבון?' : 'כבר יש לך חשבון?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-emerald-600 hover:text-emerald-700"
          >
            {isLogin ? 'הרשמה' : 'התחברות'}
          </button>
        </p>
      </div>
    </div>
  )
}
