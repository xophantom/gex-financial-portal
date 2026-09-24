import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Portal de Solicitações Financeiras',
    template: '%s · Portal de Solicitações Financeiras',
  },
  description: 'Cadastro, aprovação e pagamento de solicitações financeiras de fornecedores.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Um único adapter na raiz: nuqs precisa dele para ler e escrever a
            URL do App Router em qualquer tela que use useQueryStates. */}
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
