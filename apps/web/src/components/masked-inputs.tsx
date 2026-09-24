'use client'

import { formatCentsToBrl, formatCnpj, parseBrlToCents } from '@gex/shared'

type BaseInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'inputMode'
>

// Cada campo entrega ao formulário o dado que a API espera (centavos,
// dígitos do CNPJ); a máscara é só apresentação.

export interface MoneyInputProps extends Omit<BaseInputProps, 'onPaste'> {
  value: number
  onChange: (cents: number) => void
}

export function MoneyInput({ value, onChange, ...rest }: MoneyInputProps) {
  const display = value > 0 ? formatCentsToBrl(value) : ''

  // Digitando, cada dígito entra como centavo (155313 -> 1.553,13).
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '')
    const cents = digits === '' ? 0 : Number(digits)
    // Acima de MAX_SAFE_INTEGER o número perde precisão (e formatCentsToBrl lança).
    if (Number.isSafeInteger(cents)) onChange(cents)
  }

  // Colando, o texto é lido como valor em reais ("10" -> 10,00). Se não for
  // um valor válido, a colagem é ignorada e o valor atual fica intacto —
  // extrair só os dígitos daria um valor diferente sem o usuário perceber.
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    try {
      onChange(parseBrlToCents(event.clipboardData.getData('text')))
    } catch {
      // mantém o valor atual
    }
  }

  return (
    <input {...rest} inputMode="numeric" value={display} onChange={handleChange} onPaste={handlePaste} />
  )
}

export interface CnpjInputProps extends BaseInputProps {
  value: string
  onChange: (digits: string) => void
}

export function CnpjInput({ value, onChange, ...rest }: CnpjInputProps) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  // formatCnpj só formata os 14 dígitos completos; até lá, dígitos crus.
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
