# T-Resolver

Resolver di payload per il mapping da form ad API. Dichiara la struttura della tua API una sola volta usando marcatori `t-` e risolvila contro qualsiasi valore del form a runtime.

Nessuna dipendenza. Agnostico al framework. Compatibile con TanStack Form, React Hook Form, Formik o oggetti semplici.

Parte dell'ecosistema [Tech-SDK](https://github.com/techmefr/Tech-SDK).

---

## Il problema

Ogni form che comunica con un'API necessita di uno strato di mapping — trasformare ciò che l'utente ha inserito nel JSON atteso dal backend. Questo mapping viene solitamente scritto a mano, ripetuto in ogni funzionalità e fortemente accoppiato sia alla libreria di form che alla struttura dell'API.

T-Resolver disaccoppia tutto questo. Descrivi il JSON di destinazione una volta sola come template. Al momento dell'invio, una singola chiamata a funzione lo popola.

---

## Installazione

```bash
pnpm add @tech-sdk/resolver
```

---

## Utilizzo

### Base

Definisci un template di payload usando marcatori `t-<nomeCampo>` dove devono essere iniettati i valori del form. I valori statici vengono passati invariati.

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

### Oggetti annidati

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

### Operazioni in batch

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

Percorre ricorsivamente il `template` e sostituisce ogni stringa che inizia con `t-` con la voce corrispondente in `values`. Restituisce `null` per le chiavi mancanti. Tutto il resto viene restituito invariato.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Restituisce una funzione resolver pre-tipizzata su `V`. Usala quando lo stesso resolver viene chiamato in più punti.

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
