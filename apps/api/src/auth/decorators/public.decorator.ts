import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

// Os guards são globais e negam por padrão; @Public() é o jeito explícito de
// abrir uma rota.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
