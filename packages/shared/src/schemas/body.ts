// Corpo que não é um objeto JSON (null, lista, texto) recebe esta mensagem em
// vez do padrão do Zod, em inglês.
const NOT_AN_OBJECT = 'Envie os dados como um objeto JSON'

export const jsonBody = { invalid_type_error: NOT_AN_OBJECT, required_error: NOT_AN_OBJECT }
