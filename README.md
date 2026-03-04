# Tech-Resolver

Payload resolver for form-to-API mapping. Declare your API structure once using `t-` markers and resolve it against any form values at runtime.

Zero dependencies. Framework agnostic. Compatible with TanStack Form, React Hook Form, Formik or plain objects.

---

## The problem

Every form that communicates with an API needs a mapping layer — transforming what the user typed into the JSON the backend expects. This mapping is usually written by hand, repeated in every feature, and tightly coupled to both the form library and the API structure.

When the API changes, you hunt through every form to update the payload manually.

Tech-Resolver decouples all of that. You describe the target JSON once as a template. At submit time, a single function call fills it in.

---

## Installation

```bash
pnpm add tech-resolver
```

---

## Recommended pattern — payload files

Organize your templates in dedicated files, one per resource. Copy the payload directly from your API client (Bruno, Postman, Insomnia), replace dynamic values with `t-` markers, and export one constant per operation.

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

If the API changes, you update one file. Every form using that payload is updated automatically.

---

## Complex example — create with relations

A real-world payload with nested relations, attachments and static values.

**Without Tech-Resolver — rebuilt by hand in every form:**

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

**With Tech-Resolver — declared once, used everywhere:**

```ts
// payloads/userPayload.ts — copy from Bruno, replace values with t- markers
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
// In the form — that's all
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// Pass values from any source
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // plain object
```

---

## Create vs Update — two templates per resource

Create and update payloads have structurally different shapes. Declare both in the same file:

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

In the form, pick the template based on the current mode:

```ts
const template = isEditing ? UpsPayloadUpdate : UpsPayloadCreate

onSubmit: ({ value }) => withPayload(template, payload => sdk.ups.mutate(payload))(value)
```

---

## Relations in edit mode — attach/detach

`resolve` handles static payload shapes. When editing, changing a relation requires detaching the old value and attaching the new one. This diff logic lives in your app as a pure utility:

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

Use it alongside `resolve` at submit time:

```ts
onSubmit: async ({ value }) => {
    const payload = resolve(UpsPayloadUpdate, value) as any
    payload.mutate[0].relations.type = buildRelationOps(value.type_id, initialValues.type_id)
    await sdk.ups.mutate(payload.mutate)
}
```

Both `resolve` and `buildRelationOps` are pure functions — no shared state, trivial to test independently.

```ts
// test — no store, no mock, no context
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

## Scope of `resolve`

| Case | Handled by `resolve` | Handled elsewhere |
|---|---|---|
| Static payload structure | ✅ | |
| Attribute fields (create + update) | ✅ | |
| Nested relations on create | ✅ | |
| Attach/detach on edit | | `buildRelationOps` in app |
| Array relation diffs | | diff utility in app |
| Conditional relations (null check) | | conditional in submit handler |

`resolve` covers the structural part. Dynamic relational logic stays in the application layer as pure, testable utilities.

---

## Basic usage

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

## Nested objects

The resolver traverses any depth of nesting:

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

## Batch operations

Arrays are resolved item by item, enabling multi-operation payloads:

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

## Type-safe usage

Use `createResolver` to bind the resolver to a specific value type. TypeScript will validate the values object at every call site.

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

Recursively traverses `template` and replaces every string starting with `t-` with the corresponding entry in `values`. Returns `null` for missing keys. Everything else is returned unchanged.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Returns a resolver function pre-typed against `V`. Use when the same resolver is called in multiple places.

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

Returns a handler that resolves the template against the provided values and passes the result to the callback. Framework agnostic — works with any form library or plain values.

---

## How markers work

A marker is any string value in the template that starts with `t-`:

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (no prefix, returned unchanged)
```

- If the key exists in `values`, its value replaces the marker — regardless of type
- If the key is absent from `values`, the marker resolves to `null`
- Strings that contain `t-` but do not start with it are left unchanged

---

## License

MIT
