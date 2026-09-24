'use client'

import { formatCentsToBrl, formatCnpj } from '@gex/shared'

type BaseInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'inputMode'
>

// Todo campo mascarado guarda os DÍGITOS crus como fonte da verdade (ou o
// inteiro de centavos, para o dinheiro) — a máscara é só a forma de exibir
// esse valor. Nenhuma string brasileira formatada é o que sai deste
// componente para o formulário; é sempre o dado que a API espera.

export interface MoneyInputProps extends BaseInputProps {
  value: number
  onChange: (cents: number) => void
}

export function MoneyInput({ value, onChange, ...rest }: MoneyInputProps) {
  const display = value > 0 ? formatCentsToBrl(value) : ''

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '')
    onChange(digits === '' ? 0 : Number(digits))
  }

  return <input {...rest} inputMode="numeric" value={display} onChange={handleChange} />
}

export interface CnpjInputProps extends BaseInputProps {
  value: string
  onChange: (digits: string) => void
}

export function CnpjInput({ value, onChange, ...rest }: CnpjInputProps) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  // formatCnpj só reconhece o padrão de 14 dígitos completo — enquanto o
  // usuário digita, exibimos os dígitos crus; a pontuação aparece de uma vez
  // no 14º dígito, e é isso que o teste confere no valor final.
  const display = digits.length === 14 ? formatCnpj(digits) : digits

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value.replace(/\D/g, '').slice(0, 14))
  }

  return <input {...rest} inputMode="numeric" value={display} onChange={handleChange} />
}

export interface CompetenceInputProps extends BaseInputProps {
  value: string
  onChange: (masked: string) => void
}

export function CompetenceInput({ value, onChange, ...rest }: CompetenceInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6)
    const masked = digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`
    onChange(masked)
  }

  return <input {...rest} inputMode="numeric" value={value} onChange={handleChange} />
}
