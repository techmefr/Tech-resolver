# T-Resolver

Payload-Resolver für das Mapping von Formularen zu APIs. Beschreiben Sie Ihre API-Struktur einmal mit `t-`-Markierungen und lösen Sie diese zur Laufzeit gegen beliebige Formularwerte auf.

Keine Abhängigkeiten. Framework-agnostisch. Kompatibel mit TanStack Form, React Hook Form, Formik oder einfachen Objekten.

Teil des [Tech-SDK](https://github.com/techmefr/Tech-SDK)-Ökosystems.

---

## Das Problem

Jedes Formular, das mit einer API kommuniziert, benötigt eine Mapping-Schicht — die Transformation der Benutzereingaben in das vom Backend erwartete JSON. Dieses Mapping wird typischerweise manuell geschrieben, in jedem Feature wiederholt und ist sowohl an die Form-Bibliothek als auch an die API-Struktur gekoppelt.

T-Resolver entkoppelt das. Sie beschreiben das Ziel-JSON einmalig als Template. Beim Absenden füllt ein einziger Funktionsaufruf es aus.

---

## Installation

```bash
pnpm add @tech-sdk/resolver
```

---

## Verwendung

### Grundlegend

Definieren Sie ein Payload-Template mit `t-<Feldname>`-Markierungen, wo Formularwerte injiziert werden sollen. Statische Werte werden unverändert übernommen.

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

### Mit TanStack Form

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

### Verschachtelte Objekte

Der Resolver durchläuft beliebige Verschachtelungstiefen:

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

### Batch-Operationen

Arrays werden elementweise aufgelöst, was Multi-Operationen-Payloads ermöglicht:

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

## Typsichere Verwendung

Verwenden Sie `createResolver`, um den Resolver an einen bestimmten Wertetyp zu binden. TypeScript prüft dann das Values-Objekt an jeder Aufrufstelle.

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

Durchläuft das `template` rekursiv und ersetzt jeden String, der mit `t-` beginnt, durch den entsprechenden Eintrag aus `values`. Gibt `null` für fehlende Schlüssel zurück. Alles andere wird unverändert zurückgegeben.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Gibt eine auf `V` vortypisierte Resolver-Funktion zurück. Verwenden Sie dies, wenn derselbe Resolver an mehreren Stellen aufgerufen wird.

---

## Funktionsweise der Markierungen

Eine Markierung ist jeder String-Wert im Template, der mit `t-` beginnt:

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (kein Präfix, unverändert zurückgegeben)
```

- Existiert der Schlüssel in `values`, ersetzt sein Wert die Markierung — unabhängig vom Typ
- Fehlt der Schlüssel in `values`, wird die Markierung zu `null` aufgelöst
- Strings, die `t-` enthalten, aber nicht damit beginnen, bleiben unverändert

---

## Lizenz

MIT
