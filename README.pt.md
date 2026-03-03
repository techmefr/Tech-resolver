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
