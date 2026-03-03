# Tech-Resolver

Resolver di payload per il mapping da form ad API. Dichiara la struttura della tua API una sola volta usando marcatori `t-` e risolvila contro qualsiasi valore del form a runtime.

Nessuna dipendenza. Agnostico al framework. Compatibile con TanStack Form, React Hook Form, Formik o oggetti semplici.

---

## Il problema

Ogni form che comunica con un'API necessita di uno strato di mapping — trasformare ciò che l'utente ha inserito nel JSON atteso dal backend. Questo mapping viene solitamente scritto a mano, ripetuto in ogni funzionalità e fortemente accoppiato sia alla libreria di form che alla struttura dell'API.

Quando l'API cambia, bisogna cercare in ogni form per aggiornare il payload manualmente.

Tech-Resolver disaccoppia tutto questo. Descrivi il JSON di destinazione una volta sola come template. Al momento dell'invio, una singola chiamata a funzione lo popola.

---

## Installazione

```bash
pnpm add tech-resolver
```

---

## Pattern consigliato — file di payload

Organizza i tuoi template in file dedicati, uno per risorsa. Copia il payload direttamente dal tuo client API (Bruno, Postman, Insomnia), sostituisci i valori dinamici con marcatori `t-` ed esporta una costante per operazione.

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

Se l'API cambia, aggiorni un solo file. Ogni form che usa quel payload viene aggiornato automaticamente.

---

## Esempio complesso — creazione con relazioni

Un payload reale con relazioni annidate, allegati e valori statici.

**Senza Tech-Resolver — ricostruito a mano in ogni form:**

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

**Con Tech-Resolver — dichiarato una volta, usato ovunque:**

```ts
// payloads/userPayload.ts — copiato da Bruno, valori sostituiti con marcatori t-
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
// Nel form — è tutto
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// Passa i valori da qualsiasi sorgente
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // oggetto semplice
```

---

## Utilizzo base

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

## Oggetti annidati

Il resolver percorre qualsiasi livello di annidamento:

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

## Operazioni in batch

Gli array vengono risolti elemento per elemento, abilitando payload con operazioni multiple:

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

## Utilizzo con tipi

Usa `createResolver` per vincolare il resolver a un tipo di valori specifico. TypeScript verificherà l'oggetto values in ogni punto di chiamata.

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

Percorre ricorsivamente il `template` e sostituisce ogni stringa che inizia con `t-` con la voce corrispondente in `values`. Restituisce `null` per le chiavi mancanti. Tutto il resto viene restituito invariato.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Restituisce una funzione resolver pre-tipizzata su `V`. Usala quando lo stesso resolver viene chiamato in più punti.

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

Restituisce un handler che risolve il template contro i valori forniti e passa il risultato al callback. Agnostico al framework — funziona con qualsiasi libreria di form o valori semplici.

---

## Come funzionano i marcatori

Un marcatore è qualsiasi valore stringa nel template che inizia con `t-`:

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (nessun prefisso, restituito invariato)
```

- Se la chiave esiste in `values`, il suo valore sostituisce il marcatore — indipendentemente dal tipo
- Se la chiave è assente da `values`, il marcatore viene risolto in `null`
- Le stringhe che contengono `t-` ma non iniziano con quel prefisso rimangono invariate

---

## Licenza

MIT
