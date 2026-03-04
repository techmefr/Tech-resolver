# Tech-Resolver

Resolver de payload para el mapeo de formularios hacia APIs. Declare la estructura de su API una sola vez usando marcadores `t-` y resuélvala contra cualquier valor de formulario en tiempo de ejecución.

Sin dependencias. Agnóstico al framework. Compatible con TanStack Form, React Hook Form, Formik u objetos simples.

---

## El problema

Cada formulario que se comunica con una API necesita una capa de mapeo — transformar lo que el usuario ingresó en el JSON que espera el backend. Este mapeo generalmente se escribe a mano, se repite en cada funcionalidad y está fuertemente acoplado tanto a la librería de formularios como a la estructura de la API.

Cuando la API cambia, hay que recorrer cada formulario para actualizar el payload manualmente.

Tech-Resolver desacopla todo eso. Usted describe el JSON destino una sola vez como una plantilla. Al momento de enviar, una única llamada a función lo completa.

---

## Instalación

```bash
pnpm add tech-resolver
```

---

## Patrón recomendado — archivos de payload

Organice sus plantillas en archivos dedicados, uno por recurso. Copie el payload directamente desde su cliente API (Bruno, Postman, Insomnia), reemplace los valores dinámicos con marcadores `t-` y exporte una constante por operación.

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

Si la API cambia, se actualiza un solo archivo. Cada formulario que use ese payload se actualiza automáticamente.

---

## Ejemplo complejo — creación con relaciones

Un payload real con relaciones anidadas, adjuntos y valores estáticos.

**Sin Tech-Resolver — reconstruido a mano en cada formulario:**

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

**Con Tech-Resolver — declarado una vez, usado en todas partes:**

```ts
// payloads/userPayload.ts — copiado desde Bruno, valores reemplazados por marcadores t-
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
// En el formulario — eso es todo
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// Pasar valores desde cualquier fuente
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // objeto simple
```

---

## Create vs Update — dos plantillas por recurso

Los payloads de creación y actualización tienen formas estructuralmente diferentes. Declare ambos en el mismo archivo:

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

En el formulario, elija la plantilla según el modo actual:

```ts
const template = isEditing ? UpsPayloadUpdate : UpsPayloadCreate

onSubmit: ({ value }) => withPayload(template, payload => sdk.ups.mutate(payload))(value)
```

---

## Relaciones en modo edición — attach/detach

`resolve` maneja estructuras de payload estáticas. Al editar, cambiar una relación requiere desconectar el valor antiguo y conectar el nuevo. Esta lógica de diff reside en su aplicación como una utilidad pura:

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

Úsela junto con `resolve` al momento de enviar:

```ts
onSubmit: async ({ value }) => {
    const payload = resolve(UpsPayloadUpdate, value) as any
    payload.mutate[0].relations.type = buildRelationOps(value.type_id, initialValues.type_id)
    await sdk.ups.mutate(payload.mutate)
}
```

Tanto `resolve` como `buildRelationOps` son funciones puras — sin estado compartido, triviales de probar de forma independiente.

```ts
// test — sin store, sin mock, sin contexto
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

## Alcance de `resolve`

| Caso | Manejado por `resolve` | Manejado en otro lugar |
|---|---|---|
| Estructura estática del payload | ✅ | |
| Campos de atributos (crear + actualizar) | ✅ | |
| Relaciones anidadas en creación | ✅ | |
| Attach/detach en edición | | `buildRelationOps` en la app |
| Diffs de relaciones en array | | utilidad de diff en la app |
| Relaciones condicionales (comprobación de null) | | condicional en el handler de envío |

`resolve` cubre la parte estructural. La lógica relacional dinámica permanece en la capa de aplicación como utilidades puras y testeables.

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

## Objetos anidados

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

---

## Operaciones en lote

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

Recorre recursivamente el `template` y reemplaza cada cadena que comienza con `t-` por la entrada correspondiente en `values`. Devuelve `null` para claves ausentes. Todo lo demás se devuelve sin cambios.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Devuelve una función resolver pre-tipada contra `V`. Úsela cuando el mismo resolver se invoca en múltiples lugares.

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

Devuelve un handler que resuelve la plantilla contra los valores proporcionados y pasa el resultado al callback. Agnóstico al framework — funciona con cualquier librería de formularios o valores simples.

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
- Las cadenas que contienen `t-` pero no comienzan con ese prefixo no se modifican

---

## Licencia

MIT
