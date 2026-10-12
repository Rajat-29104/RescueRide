'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CarFront, Check, ShieldCheck } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const content = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to RescueRide',
    description: 'Access your roadside requests and account workspace.',
    fields: [
      { label: 'Email address', name: 'email', type: 'email', autoComplete: 'email', required: true, placeholder: 'you@example.com' },
      { label: 'Password', name: 'password', type: 'password', autoComplete: 'current-password', required: true },
    ],
    button: 'Sign in',
  },
  register: {
    eyebrow: 'Get started',
    title: 'Create your account',
    description: 'Choose how you’ll use RescueRide, then enter your details.',
    fields: [
      { label: 'Full name', name: 'full_name', type: 'text', autoComplete: 'name', required: true, minLength: 2 },
      { label: 'Email address', name: 'email', type: 'email', autoComplete: 'email', required: true, placeholder: 'you@example.com' },
      { label: 'Phone number', name: 'phone', type: 'tel', autoComplete: 'tel-national', inputMode: 'numeric', pattern: '[0-9]{10}', maxLength: 10, required: true, placeholder: '10-digit phone number' },
      { label: 'Password', name: 'password', type: 'password', autoComplete: 'new-password', required: true, minLength: 8 },
    ],
    button: 'Create account',
  },
  forgot: {
    eyebrow: 'Account recovery',
    title: 'Reset your password',
    description: 'Enter your account email to request a password reset.',
    fields: [
      { label: 'Email address', name: 'email', type: 'email', autoComplete: 'email', required: true, placeholder: 'you@example.com' },
    ],
    button: 'Send reset link',
  },
  reset: {
    eyebrow: 'Account recovery',
    title: 'Choose a new password',
    description: 'Set a new password for your RescueRide account.',
    fields: [
      { label: 'New password', name: 'password', type: 'password', autoComplete: 'new-password', required: true, minLength: 8 },
      { label: 'Confirm password', name: 'confirmPassword', type: 'password', autoComplete: 'new-password', required: true, minLength: 8 },
    ],
    button: 'Update password',
  },
}

const roles = [
  { value: 'driver', label: 'Driver', description: 'Request and coordinate assistance.' },
  { value: 'mechanic', label: 'Mechanic', description: 'Manage service requests and jobs.' },
]

function errorMessage(error) {
  const message = error?.message || 'Authentication failed. Please try again.'
  if (message.toLowerCase().includes('email rate limit exceeded')) {
    return 'Supabase has temporarily limited signup emails. Try again later or configure custom SMTP in Supabase.'
  }
  return message
}

export default function AuthForm({ variant, initialRole = 'driver' }) {
  const page = content[variant]
  const isRegister = variant === 'register'
  const router = useRouter()
  const [role, setRole] = useState(initialRole)
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus(null)
    setSubmitting(true)

    try {
      const values = new FormData(event.currentTarget)
      const supabase = getSupabaseBrowserClient()

      if (variant === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: String(values.get('email')).trim(),
          password: String(values.get('password')),
          options: {
            data: {
              full_name: String(values.get('full_name')).trim(),
              phone: String(values.get('phone')).trim(),
              role,
            },
            emailRedirectTo: `${window.location.origin}/auth/login`,
          },
        })
        if (error) throw error
        if (!data.session) {
          setStatus({ type: 'success', text: 'Account details accepted. Check your email to confirm the account before signing in.' })
        } else {
          router.replace(`/dashboard/${role}`)
          router.refresh()
        }
        return
      }

      if (variant === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: String(values.get('email')).trim(),
          password: String(values.get('password')),
        })
        if (error) throw error

        let accountRole = data.user.user_metadata?.role
        if (!accountRole) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()
          if (profileError) throw profileError
          accountRole = profile?.role
        }
        if (!['driver', 'mechanic', 'admin'].includes(accountRole)) {
          throw new Error('Your account role is missing. Contact RescueRide support before continuing.')
        }
        router.replace(`/dashboard/${accountRole}`)
        router.refresh()
        return
      }

      if (variant === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(String(values.get('email')).trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (error) throw error
        setStatus({ type: 'success', text: 'If an account exists for that email, a password reset link has been sent.' })
        return
      }

      if (variant === 'reset') {
        const password = String(values.get('password'))
        if (password !== String(values.get('confirmPassword'))) {
          setStatus({ type: 'error', text: 'The passwords do not match. Please check both fields.' })
          return
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setStatus({ type: 'success', text: 'Your password has been updated. You can now sign in.' })
        return
      }
    } catch (error) {
      setStatus({ type: 'error', text: errorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <div className="auth-ambient" aria-hidden="true">
          <span className="auth-orb auth-orb-one" />
          <span className="auth-orb auth-orb-two" />
          <span className="auth-orbit auth-orbit-one" />
          <span className="auth-orbit auth-orbit-two" />
          <span className="auth-route" />
          <span className="auth-map-node auth-map-node-one" />
          <span className="auth-map-node auth-map-node-two" />
        </div>
        <Link className="brand-lockup" href="/">
          <span className="brand-mark"><CarFront size={20} /></span> RescueRide
        </Link>
        <div className="auth-aside-copy">
          <div className="eyebrow" style={{ color: '#9fdedb' }}>Roadside support, thoughtfully connected</div>
          <h1>Support for the moments you didn’t plan for.</h1>
          <p>Keep your requests, service details, and safety tools together in one coordinated experience.</p>
        </div>
        <div className="auth-assurance"><ShieldCheck size={16} /> Account access is protected by the connected RescueRide service.</div>
      </aside>

      <section className="auth-main">
        <div className="auth-card surface">
          <div className="eyebrow">{page.eyebrow}</div>
          <h2 style={{ marginTop: 6 }}>{page.title}</h2>
          <p>{page.description}</p>

          {isRegister && (
            <fieldset className="role-fieldset">
              <legend>Choose your account type</legend>
              <div className="role-options">
                {roles.map((item) => (
                  <label className={`role-option${role === item.value ? ' selected' : ''}`} key={item.value}>
                    <input type="radio" name="accountRole" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)} />
                    <span className="role-option-copy"><strong>{item.label}</strong><span>{item.description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <form className="auth-form" style={{ marginTop: 18 }} onSubmit={handleSubmit}>
            {page.fields.map(({ label, name, type, autoComplete, ...attributes }) => (
              <div className="field" key={name}>
                <label htmlFor={`auth-${name}`}>{label}</label>
                <input id={`auth-${name}`} name={name} type={type} autoComplete={autoComplete} {...attributes} />
              </div>
            ))}
            {status && <div className={`form-notice${status.type === 'error' ? ' form-notice-error' : ''}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.text}</div>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : page.button}
            </button>
          </form>

          <div className="auth-footnote">
            {variant === 'login' && <>Forgot your password? <Link href="/auth/forgot-password">Recover account</Link><br /><br />New to RescueRide? <Link href="/auth/register">Create an account</Link></>}
            {variant === 'register' && <>Already have an account? <Link href="/auth/login">Sign in</Link></>}
            {variant === 'forgot' && <Link href="/auth/login"><ArrowLeft size={13} style={{ verticalAlign: 'middle' }} /> Back to sign in</Link>}
            {variant === 'reset' && <Link href="/auth/login"><ArrowLeft size={13} style={{ verticalAlign: 'middle' }} /> Back to sign in</Link>}
          </div>
          <div className="auth-footnote" style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', fontSize: 10 }}>
            <Check size={13} /> Secure authentication · RescueRide Supabase
          </div>
        </div>
      </section>
    </main>
  )
}
