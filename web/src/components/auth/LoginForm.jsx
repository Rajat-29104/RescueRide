'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { getCurrentUser, signIn, signOut } from '@/lib/auth'
import { ArrowRight, CarFront, Info, LockKeyhole, Mail, ShieldCheck, Wrench } from 'lucide-react'

const loginRoles = [
  { value: 'driver', label: 'Driver', icon: CarFront },
  { value: 'mechanic', label: 'Mechanic', icon: Wrench },
  { value: 'admin', label: 'Admin', icon: ShieldCheck },
]

export default function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState('driver')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      setLoading(true)
      const data = await signIn(formData)

      const userProfile = await getCurrentUser()
      const role = userProfile?.role || data?.user?.user_metadata?.role || data?.session?.user?.user_metadata?.role
      if (!loginRoles.some((loginRole) => loginRole.value === role)) {
        await signOut()
        toast.error('Your account is not ready yet. Please confirm your email or try again after your profile syncs.')
        router.replace('/auth/login')
        return
      }

      if (role !== selectedRole) {
        await signOut()
        const roleLabel = loginRoles.find((loginRole) => loginRole.value === role)?.label
        toast.error(`This account is registered as ${roleLabel}. Choose the matching account type to sign in.`)
        return
      }

      toast.success('Login successful')
      router.replace(`/dashboard/${role}`)
    } catch (err) {
      const message = err?.message || ''
      toast.error(message || 'Unable to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset>
        <legend className="mb-2.5 text-xs font-bold text-slate-800">Login as</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Login as">
          {loginRoles.map(({ value, label, icon: Icon }) => {
            const isSelected = selectedRole === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedRole(value)}
                className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="login-email" className="mb-2 block text-xs font-bold text-slate-800">
          Email Address
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          leftIcon={<Mail size={17} />}
          className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/70 pl-11 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-amber-500 focus:bg-white"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="login-password" className="block text-xs font-bold text-slate-800">
            Password
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-semibold text-amber-800 transition-colors hover:text-amber-950"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="login-password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          leftIcon={<LockKeyhole size={17} />}
          className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/70 pl-11 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-amber-500 focus:bg-white"
        />
      </div>
      <Button 
        type="submit"
        rightIcon={!loading && <ArrowRight size={17} />}
        className="h-12 w-full rounded-xl bg-[#1A1609] text-sm font-bold tracking-wide text-white transition-all hover:bg-[#2A2211] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={() => toast('Coming soon, register manually.', { icon: <Info size={16} className="text-amber-600" /> })}
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
      >
        <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>
    </form>
  )
}