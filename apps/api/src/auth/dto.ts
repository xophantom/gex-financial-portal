import { loginSchema } from '@gex/shared';
import { createZodDto } from 'nestjs-zod';

// Mesmo raciocínio de requests/dto.ts: embrulha loginSchema para o Swagger
// gerar o corpo de POST /auth/login a partir do schema que já valida a
// entrada, em vez de descrevê-lo à mão numa segunda definição.
export class LoginDto extends createZodDto(loginSchema) {}
