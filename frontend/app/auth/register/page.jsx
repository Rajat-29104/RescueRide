import AuthForm from '../../../components/AuthForm'

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams
  const role = ['driver', 'mechanic'].includes(params?.role) ? params.role : 'driver'
  return <AuthForm variant="register" initialRole={role} />
}
