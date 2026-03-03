# T-Resolver

Payload resolver for form-to-API mapping. Declare your API shape once using `t-` markers, resolve it against any form values at runtime.

Zero dependencies. Framework agnostic. Works with TanStack Form, React Hook Form, Formik, or plain objects.

Part of the [Tech-SDK](https://github.com/techmefr/Tech-SDK) ecosystem.

---

## The problem

Every form that talks to an API needs a mapping layer — transforming what the user typed into the JSON your backend expects. This mapping is usually written by hand, repeated across every feature, and tightly coupled to both the form library and the API shape.

T-Resolver decouples that. You describe the target JSON once as a template. At submit time, one function call fills it in.

---

## Installation

```bash
pnpm add tech-resolver
```

---

## Usage

### Basic

Define a payload template using `t-<fieldName>` markers where form values should be injected. Static values are passed through as-is.

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

### With TanStack Form

```ts
import { useForm } from '@tanstack/vue-form'
import { resolve } from 'tech-resolver'

const form = useForm({
    defaultValues: { first_name: '', email: '', role: null },
    onSubmit: async ({ value }) => {
        const payload = resolve(template, value)
        await api.post('/users', payload)
    },
})
```

### Nested objects

The resolver walks any depth of nesting:

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

// {
//   meta: { source: 'web', version: 2 },
//   data: { profile: { full_name: 'Bob', contact: { email: 'bob@example.com' } } }
// }
```

### Batch operations

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

// {
//   mutate: [
//     { operation: 'create', attributes: { name: 'Carol' } },
//     { operation: 'attach', relation: 'roles', id: 1 },
//     { operation: 'attach', relation: 'teams', id: 4 },
//   ]
// }
```

---

## Type-safe usage

Use `createResolver` to bind the resolver to a specific values type. TypeScript will then validate the values object at every call site.

```ts
import { createResolver } from 'tech-resolver'

const resolveUser = createResolver<{
    first_name: string
    email: string
    role: number
}>()

// TypeScript checks that values matches the generic type
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

Recursively walks `template` and replaces every string starting with `t-` with the matching entry from `values`. Returns `null` for missing keys. Everything else is returned as-is.

| Parameter | Type | Description |
|-----------|------|-------------|
| `template` | `JsonValue` | Any JSON-serializable value — string, number, boolean, null, object, array |
| `values` | `Record<string, unknown>` | The form values to inject |

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Returns a resolver function pre-typed against `V`. Use this when the same resolver is called in multiple places to avoid repeating the type annotation.

---

## How markers work

A marker is any string value in the template that starts with `t-`:

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (no prefix, returned as-is)
```

- If the key exists in `values`, its value replaces the marker — regardless of type (string, number, boolean, null, object)
- If the key is missing from `values`, the marker resolves to `null`
- Strings that contain `t-` but do not start with it (e.g. `"attr-name"`) are left unchanged

---

## Project structure

```
src/
├── resolver.ts     resolve() and createResolver()
├── types.ts        JsonValue, IResolveValues
└── index.ts        public exports
```

---

## License

MIT
