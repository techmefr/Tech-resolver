# Tech-Resolver

Payload-Resolver für das Mapping von Formularen zu APIs. Beschreiben Sie Ihre API-Struktur einmal mit `t-`-Markierungen und lösen Sie diese zur Laufzeit gegen beliebige Formularwerte auf.

Keine Abhängigkeiten. Framework-agnostisch. Kompatibel mit TanStack Form, React Hook Form, Formik oder einfachen Objekten.

---

## Das Problem

Jedes Formular, das mit einer API kommuniziert, benötigt eine Mapping-Schicht — die Transformation der Benutzereingaben in das vom Backend erwartete JSON. Dieses Mapping wird typischerweise manuell geschrieben, in jedem Feature wiederholt und ist sowohl an die Form-Bibliothek als auch an die API-Struktur gekoppelt.

Ändert sich die API, müssen Sie jedes Formular durchsuchen und den Payload manuell aktualisieren.

Tech-Resolver entkoppelt das alles. Sie beschreiben das Ziel-JSON einmalig als Template. Beim Absenden füllt ein einziger Funktionsaufruf es aus.

---

## Installation

```bash
pnpm add tech-resolver
```

---

## Empfohlenes Muster — Payload-Dateien

Organisieren Sie Ihre Templates in dedizierten Dateien, eine pro Ressource. Kopieren Sie den Payload direkt aus Ihrem API-Client (Bruno, Postman, Insomnia), ersetzen Sie dynamische Werte durch `t-`-Markierungen und exportieren Sie eine Konstante pro Operation.

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

Ändert sich die API, aktualisieren Sie eine einzige Datei. Jedes Formular, das diesen Payload verwendet, wird automatisch aktualisiert.

---

## Komplexes Beispiel — Erstellen mit Relationen

Ein realer Payload mit verschachtelten Relationen, Anhängen und statischen Werten.

**Ohne Tech-Resolver — in jedem Formular manuell neu erstellt:**

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

**Mit Tech-Resolver — einmal deklariert, überall verwendet:**

```ts
// payloads/userPayload.ts — aus Bruno kopiert, Werte durch t- Markierungen ersetzt
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
// Im Formular — das ist alles
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// Werte aus beliebiger Quelle übergeben
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // einfaches Objekt
```

---

## Grundlegende Verwendung

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

## Verschachtelte Objekte

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

---

## Batch-Operationen

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

Durchläuft das `template` rekursiv und ersetzt jeden String, der mit `t-` beginnt, durch den entsprechenden Eintrag aus `values`. Gibt `null` für fehlende Schlüssel zurück. Alles andere wird unverändert zurückgegeben.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Gibt eine auf `V` vortypisierte Resolver-Funktion zurück. Verwenden Sie dies, wenn derselbe Resolver an mehreren Stellen aufgerufen wird.

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

Gibt einen Handler zurück, der das Template gegen die übergebenen Werte auflöst und das Ergebnis an den Callback weitergibt. Framework-agnostisch — funktioniert mit jeder Form-Bibliothek oder einfachen Werten.

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
