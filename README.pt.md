# T-Resolver

Resolver de payload para mapeamento de formulários para APIs. Declare a estrutura da sua API uma única vez usando marcadores `t-` e resolva-a contra quaisquer valores de formulário em tempo de execução.

Sem dependências. Agnóstico ao framework. Compatível com TanStack Form, React Hook Form, Formik ou objetos simples.

Parte do ecossistema [Tech-SDK](https://github.com/techmefr/Tech-SDK).

---

## O problema

Todo formulário que se comunica com uma API precisa de uma camada de mapeamento — transformar o que o usuário digitou no JSON que o backend espera. Esse mapeamento geralmente é escrito à mão, repetido em cada funcionalidade e fortemente acoplado tanto à biblioteca de formulários quanto à estrutura da API.

T-Resolver desacopla tudo isso. Você descreve o JSON de destino uma única vez como um template. No momento do envio, uma única chamada de função o preenche.

---

## Instalação

```bash
pnpm add @tech-sdk/resolver
```

---

## Uso

### Básico

Defina um template de payload usando marcadores `t-<nomeDoCampo>` onde os valores do formulário devem ser injetados. Valores estáticos são passados sem alteração.

```ts
import { resolve } from '@tech-sdk/resolver'

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

const values = {
    first_name: 'Alice',
    email: 'alice@example.com',
    role: 3,
}

const payload = resolve(template, values)

// {
//   mutate: [{
//     operation: 'create',
//     attributes: { name: 'Alice', email: 'alice@example.com', role_id: 3 }
//   }]
// }
```

### Com TanStack Form

```ts
import { useForm } from '@tanstack/vue-form'
import { resolve } from '@tech-sdk/resolver'

const form = useForm({
    defaultValues: { first_name: '', email: '', role: null },
    onSubmit: async ({ value }) => {
        const payload = resolve(template, value)
        await api.post('/users', payload)
    },
})
```

### Objetos aninhados

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

### Operações em lote

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
import { createResolver } from '@tech-sdk/resolver'

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
