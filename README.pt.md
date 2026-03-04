# Tech-Resolver

Resolver de payload para mapeamento de formulários para APIs. Declare a estrutura da sua API uma única vez usando marcadores `t-` e resolva-a contra quaisquer valores de formulário em tempo de execução.

Sem dependências. Agnóstico ao framework. Compatível com TanStack Form, React Hook Form, Formik ou objetos simples.

---

## O problema

Todo formulário que se comunica com uma API precisa de uma camada de mapeamento — transformar o que o usuário digitou no JSON que o backend espera. Esse mapeamento geralmente é escrito à mão, repetido em cada funcionalidade e fortemente acoplado tanto à biblioteca de formulários quanto à estrutura da API.

Quando a API muda, é necessário percorrer cada formulário para atualizar o payload manualmente.

Tech-Resolver desacopla tudo isso. Você descreve o JSON de destino uma única vez como um template. No momento do envio, uma única chamada de função o preenche.

---

## Instalação

```bash
pnpm add tech-resolver
```

---

## Padrão recomendado — arquivos de payload

Organize seus templates em arquivos dedicados, um por recurso. Copie o payload diretamente do seu cliente API (Bruno, Postman, Insomnia), substitua os valores dinâmicos por marcadores `t-` e exporte uma constante por operação.

```
payloads/
  userPayload.ts
  teamPayload.ts
  index.ts
```

```ts
// payloads/userPayload.ts
export const UserPayloadCreate = {
    mutate: [{
        operation: 'create',
        attributes: {
            name: 't-name',
            email: 't-email',
            status: 'active',
        },
    }],
}

export const UserPayloadMutate = {
    mutate: [{
        operation: 'update',
        attributes: {
            name: 't-name',
            email: 't-email',
        },
    }],
}

export const UserPayloadDelete = {
    mutate: [{
        operation: 'delete',
        key: 't-id',
    }],
}
```

```ts
// payloads/index.ts
export * from './userPayload'
export * from './teamPayload'
```

Se a API mudar, você atualiza um único arquivo. Cada formulário que usa esse payload é atualizado automaticamente.

---

## Exemplo complexo — criação com relações

Um payload real com relações aninhadas, anexos e valores estáticos.

**Sem Tech-Resolver — reconstruído à mão em cada formulário:**

```ts
onSubmit: async ({ value }) => {
    await sdk.users.create({
        mutate: [{
            operation: 'create',
            attributes: {
                name: value.name,
                email: value.email,
                status: 'active',
            },
            relations: {
                role: { operation: 'attach', key: value.roleId },
                team: { operation: 'attach', key: value.teamId },
                address: {
                    operation: 'create',
                    attributes: {
                        street: value.street,
                        city: value.city,
                        country: value.country,
                    },
                },
            },
        }],
    })
}
```

**Com Tech-Resolver — declarado uma vez, usado em todo lugar:**

```ts
// payloads/userPayload.ts — copiado do Bruno, valores substituídos por marcadores t-
export const UserPayloadCreate = {
    mutate: [{
        operation: 'create',
        attributes: {
            name: 't-name',
            email: 't-email',
            status: 'active',
        },
        relations: {
            role: { operation: 'attach', key: 't-roleId' },
            team: { operation: 'attach', key: 't-teamId' },
            address: {
                operation: 'create',
                attributes: {
                    street: 't-street',
                    city: 't-city',
                    country: 't-country',
                },
            },
        },
    }],
}
```

```ts
// No formulário — é só isso
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// Passar valores de qualquer fonte
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // objeto simples
```

---

## Create vs Update — dois templates por recurso

Os payloads de criação e atualização têm formas estruturalmente diferentes. Declare ambos no mesmo arquivo:

```ts
// payloads/upsPayload.ts
export const UpsPayloadCreate = {
    mutate: [{
        operation: 'create',
        attributes: { name: 't-name', serial_number: 't-serial' },
        relations: {
            ups: { operation: 'create', attributes: { power_in_kw: 't-power_in_kw' } },
            type: { operation: 'attach', key: 't-type_id' },
        },
    }],
}

export const UpsPayloadUpdate = {
    mutate: [{
        operation: 'update',
        key: 't-id',
        attributes: { name: 't-name', serial_number: 't-serial' },
        relations: {
            ups: { operation: 'update', key: 't-ups_id', attributes: { power_in_kw: 't-power_in_kw' } },
        },
    }],
}
```

No formulário, escolha o template com base no modo atual:

```ts
const template = isEditing ? UpsPayloadUpdate : UpsPayloadCreate

onSubmit: ({ value }) => withPayload(template, payload => sdk.ups.mutate(payload))(value)
```

---

## Relações no modo de edição — attach/detach

`resolve` lida com estruturas de payload estáticas. Ao editar, alterar uma relação requer desconectar o valor antigo e conectar o novo. Essa lógica de diff reside na sua aplicação como um utilitário puro:

```ts
// utils/relationOps.ts
export function buildRelationOps(
    current: number | null,
    initial: number | null,
): Array<{ operation: string; key: number }> {
    if (current === initial) return []
    const ops: Array<{ operation: string; key: number }> = []
    if (initial !== null) ops.push({ operation: 'detach', key: initial })
    if (current !== null) ops.push({ operation: 'attach', key: current })
    return ops
}
```

Use-o junto com `resolve` no momento do envio:

```ts
onSubmit: async ({ value }) => {
    const payload = resolve(UpsPayloadUpdate, value) as any
    payload.mutate[0].relations.type = buildRelationOps(value.type_id, initialValues.type_id)
    await sdk.ups.mutate(payload.mutate)
}
```

Tanto `resolve` quanto `buildRelationOps` são funções puras — sem estado compartilhado, triviais de testar de forma independente.

```ts
// test — sem store, sem mock, sem contexto
it('generates detach + attach when relation changes', () => {
    expect(buildRelationOps(7, 5)).toEqual([
        { operation: 'detach', key: 5 },
        { operation: 'attach', key: 7 },
    ])
})

it('returns empty array when relation is unchanged', () => {
    expect(buildRelationOps(5, 5)).toEqual([])
})
```

---

## Escopo de `resolve`

| Caso | Tratado por `resolve` | Tratado em outro lugar |
|---|---|---|
| Estrutura estática do payload | ✅ | |
| Campos de atributos (criar + atualizar) | ✅ | |
| Relações aninhadas na criação | ✅ | |
| Attach/detach na edição | | `buildRelationOps` na app |
| Diffs de relações em array | | utilitário de diff na app |
| Relações condicionais (verificação de null) | | condicional no handler de envio |

`resolve` cobre a parte estrutural. A lógica relacional dinâmica permanece na camada de aplicação como utilitários puros e testáveis.

---

## Uso básico

```ts
import { resolve } from 'tech-resolver'

const template = {
    mutate: [{
        operation: 'create',
        attributes: {
            name: 't-first_name',
            email: 't-email',
            role_id: 't-role',
        },
    }],
}

const payload = resolve(template, {
    first_name: 'Alice',
    email: 'alice@example.com',
    role: 3,
})

// {
//   mutate: [{
//     operation: 'create',
//     attributes: { name: 'Alice', email: 'alice@example.com', role_id: 3 }
//   }]
// }
```

---

## Objetos aninhados

O resolver percorre qualquer nível de aninhamento:

```ts
const payload = resolve(
    {
        meta: { source: 'web', version: 2 },
        data: {
            profile: {
                full_name: 't-name',
                contact: { email: 't-email' },
            },
        },
    },
    { name: 'Bob', email: 'bob@example.com' }
)
```

---

## Operações em lote

Arrays são resolvidos item por item, permitindo payloads com múltiplas operações:

```ts
const payload = resolve(
    {
        mutate: [
            { operation: 'create', attributes: { name: 't-name' } },
            { operation: 'attach', relation: 'roles', id: 't-role' },
            { operation: 'attach', relation: 'teams', id: 't-team' },
        ],
    },
    { name: 'Carol', role: 1, team: 4 }
)
```

---

## Uso com tipos

Use `createResolver` para vincular o resolver a um tipo específico de valores. O TypeScript validará o objeto values em cada ponto de chamada.

```ts
import { createResolver } from 'tech-resolver'

const resolveUser = createResolver<{
    first_name: string
    email: string
    role: number
}>()

const payload = resolveUser(template, {
    first_name: 'Dave',
    email: 'dave@example.com',
    role: 2,
})
```

---

## API

### `resolve(template, values)`

```ts
function resolve(template: JsonValue, values: IResolveValues): JsonValue
```

Percorre recursivamente o `template` e substitui cada string que começa com `t-` pela entrada correspondente em `values`. Retorna `null` para chaves ausentes. Todo o resto é retornado sem alteração.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Retorna uma função resolver pré-tipada em `V`. Use quando o mesmo resolver é chamado em vários lugares.

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

Retorna um handler que resolve o template contra os valores fornecidos e passa o resultado ao callback. Agnóstico ao framework — funciona com qualquer biblioteca de formulários ou valores simples.

---

## Como os marcadores funcionam

Um marcador é qualquer valor do tipo string no template que começa com `t-`:

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (sem prefixo, retornado sem alteração)
```

- Se a chave existe em `values`, seu valor substitui o marcador — independentemente do tipo
- Se a chave está ausente em `values`, o marcador é resolvido para `null`
- Strings que contêm `t-` mas não começam com esse prefixo permanecem inalteradas

---

## Licença

MIT
