# T-Resolver

Resolver de payload para el mapeo de formularios hacia APIs. Declare la estructura de su API una sola vez usando marcadores `t-` y resuélvala contra cualquier valor de formulario en tiempo de ejecución.

Sin dependencias. Agnóstico al framework. Compatible con TanStack Form, React Hook Form, Formik u objetos simples.

Parte del ecosistema [Tech-SDK](https://github.com/techmefr/Tech-SDK).

---

## El problema

Cada formulario que se comunica con una API necesita una capa de mapeo — transformar lo que el usuario ingresó en el JSON que espera el backend. Este mapeo generalmente se escribe a mano, se repite en cada funcionalidad y está fuertemente acoplado tanto a la librería de formularios como a la estructura de la API.

T-Resolver desacopla todo eso. Usted describe el JSON destino una sola vez como una plantilla. Al momento de enviar, una única llamada a función lo completa.

---

## Instalación

```bash
pnpm add @tech-sdk/resolver
```

---

## Uso

### Básico

Defina una plantilla de payload usando marcadores `t-<nombreDelCampo>` donde deben inyectarse los valores del formulario. Los valores estáticos se pasan tal cual.

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

### Con TanStack Form

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

### Objetos anidados

El resolver recorre cualquier nivel de anidamiento:

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

### Operaciones en lote

Los arrays se resuelven elemento por elemento, permitiendo payloads con múltiples operaciones:

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

## Uso con tipos

Use `createResolver` para vincular el resolver a un tipo de valores específico. TypeScript validará el objeto values en cada sitio de llamada.

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

Recorre recursivamente el `template` y reemplaza cada cadena que comienza con `t-` por la entrada correspondiente en `values`. Devuelve `null` para claves ausentes. Todo lo demás se devuelve sin cambios.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Devuelve una función resolver pre-tipada contra `V`. Úsela cuando el mismo resolver se invoca en múltiples lugares.

---

## Cómo funcionan los marcadores

Un marcador es cualquier valor de tipo cadena en la plantilla que comienza con `t-`:

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (sin prefijo, devuelto tal cual)
```

- Si la clave existe en `values`, su valor reemplaza al marcador — independientemente del tipo
- Si la clave no está en `values`, el marcador se resuelve a `null`
- Las cadenas que contienen `t-` pero no comienzan con ese prefijo no se modifican

---

## Licencia

MIT
