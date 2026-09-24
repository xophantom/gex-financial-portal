import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

// Guards agora são globais (APP_GUARD) por padrão-nega — isto é a única
// forma de abrir mão deliberadamente da autenticação numa rota, em vez de
// simplesmente esquecer de anotar @UseGuards nela.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
