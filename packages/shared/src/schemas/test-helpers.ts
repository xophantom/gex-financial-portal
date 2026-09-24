// Helpers dos testes de schema; fora do build e da cobertura.
export const ENGLISH_DEFAULT =
  /Required|Invalid (enum value|input|type)|Expected .* received|(String|Number|Array) must/

interface ParseResult {
  success: boolean
  error?: { issues: { message: string; path: (string | number)[] }[] }
}

interface Schema {
  safeParse: (input: unknown) => ParseResult
}

export function firstIssue(result: ParseResult) {
  if (result.success) throw new Error('expected parsing to fail')
  return result.error!.issues[0]
}

// Nenhum schema pode vazar a mensagem padrão (em inglês) do Zod.
export function localizedIssues(cases: { name: string; schema: Schema; input: unknown }[]) {
  return cases.flatMap(({ name, schema, input }) => {
    const result = schema.safeParse(input)
    if (result.success) throw new Error(`${name} unexpectedly accepted a broken payload`)
    return result.error!.issues.map((issue) => ({ name, message: issue.message }))
  })
}
