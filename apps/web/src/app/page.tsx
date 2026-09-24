import { redirect } from 'next/navigation'

// Sem sessão, o proxy já manda para /login antes de chegar aqui.
export default function Home() {
  redirect('/dashboard')
}
