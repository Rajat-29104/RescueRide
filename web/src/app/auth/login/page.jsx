"use client"

import Link from 'next/link'
import { ArrowUpRight, ShieldCheck, Smartphone } from 'lucide-react'

import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">
          <ShieldCheck size={14} aria-hidden="true" />
          Secure sign in
        </span>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to get back on the road with RoadRescue.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-[#E8DFC9] bg-white p-5 shadow-[0_18px_50px_rgba(45,36,15,0.08)] sm:p-7">
        <LoginForm />
      </div>

      <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
        <span>New to RoadRescue?</span>
        <Link
          href="/auth/register"
          className="inline-flex items-center gap-1 font-bold text-amber-800 hover:text-amber-900"
        >
          Create an account
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="text-center lg:hidden">
        <Link 
          href="/install" 
          className="inline-flex items-center gap-1.5 rounded-full border border-[#DCCDA9] bg-[#FFF9EF] px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#7C6B44] shadow-sm hover:bg-[#F5EDD0]"
        >
          <Smartphone size={14} className="text-[#7C6B44]" />
          <span>Install RoadRescue app</span>
        </Link>
      </div>
    </div>
  )
}