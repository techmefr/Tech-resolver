# Tech-Resolver

Résolveur de payload pour le mapping formulaire-vers-API. Déclarez la structure de votre API une seule fois avec des marqueurs `t-` et résolvez-la contre n'importe quelles valeurs de formulaire au moment de l'exécution.

Zéro dépendance. Agnostique au framework. Compatible avec TanStack Form, React Hook Form, Formik ou des objets simples.

---

## Le problème

Chaque formulaire qui communique avec une API nécessite une couche de mapping — transformer ce que l'utilisateur a saisi en JSON attendu par le backend. Ce mapping est généralement écrit à la main, répété dans chaque fonctionnalité, et fortement couplé à la fois à la librairie de formulaire et à la structure de l'API.

Quand l'API change, vous parcourez chaque formulaire pour mettre à jour le payload manuellement.

Tech-Resolver découple tout ça. Vous décrivez le JSON cible une seule fois sous forme de template. Au moment de la soumission, un seul appel de fonction le remplit.

---

## Installation

```bash
pnpm add tech-resolver
```

---

## Pattern recommandé — fichiers de payload

Organisez vos templates dans des fichiers dédiés, un par ressource. Copiez le payload directement depuis votre client API (Bruno, Postman, Insomnia), remplacez les valeurs dynamiques par des marqueurs `t-`, et exportez une constante par opération.

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

Si l'API change, vous mettez à jour un seul fichier. Chaque formulaire utilisant ce payload est mis à jour automatiquement.

---

## Exemple complexe — création avec relations

Un payload réel avec des relations imbriquées, des pièces jointes et des valeurs statiques.

**Sans Tech-Resolver — reconstruit à la main dans chaque formulaire :**

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

**Avec Tech-Resolver — déclaré une fois, utilisé partout :**

```ts
// payloads/userPayload.ts — copié depuis Bruno, valeurs remplacées par des marqueurs t-
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
// Dans le formulaire — c'est tout
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// Passer les valeurs depuis n'importe quelle source
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // objet simple
```

---

## Utilisation basique

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

## Objets imbriqués

Le résolveur parcourt n'importe quelle profondeur d'imbrication :

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

## Opérations en lot

Les tableaux sont résolus élément par élément, permettant des payloads multi-opérations :

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

## Utilisation typée

Utilisez `createResolver` pour lier le résolveur à un type de valeurs spécifique. TypeScript validera l'objet values à chaque appel.

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

Parcourt récursivement le `template` et remplace chaque chaîne commençant par `t-` par l'entrée correspondante dans `values`. Retourne `null` pour les clés manquantes. Tout le reste est retourné tel quel.

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

Retourne une fonction de résolution pré-typée sur `V`. À utiliser quand le même résolveur est appelé à plusieurs endroits.

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

Retourne un handler qui résout le template contre les valeurs fournies et passe le résultat au callback. Agnostique au framework — fonctionne avec n'importe quelle librairie de formulaire ou des valeurs simples.

---

## Fonctionnement des marqueurs

Un marqueur est toute valeur de type chaîne dans le template qui commence par `t-` :

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   (pas de préfixe, retourné tel quel)
```

- Si la clé existe dans `values`, sa valeur remplace le marqueur — quel que soit son type
- Si la clé est absente de `values`, le marqueur est résolu en `null`
- Les chaînes qui contiennent `t-` mais ne commencent pas par ce préfixe sont laissées inchangées

---

## Licence

MIT
