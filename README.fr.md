# T-Resolver

Résolveur de payload pour le mapping formulaire-vers-API. Déclarez la structure de votre API une seule fois avec des marqueurs `t-`, puis résolvez-la contre n'importe quelles valeurs de formulaire au moment de l'exécution.

Zéro dépendance. Agnostique. Compatible avec TanStack Form, React Hook Form, Formik ou des objets simples.

Fait partie de l'écosystème [Tech-SDK](https://github.com/techmefr/Tech-SDK).

---

## Le problème

Chaque formulaire qui communique avec une API nécessite une couche de mapping — transformer ce que l'utilisateur a saisi en JSON attendu par le backend. Ce mapping est généralement écrit à la main, répété dans chaque fonctionnalité, et fortement couplé à la fois à la librairie de formulaire et à la structure de l'API.

T-Resolver découple tout ça. Vous décrivez le JSON cible une seule fois sous forme de template. Au moment de la soumission, un seul appel de fonction le remplit.

---

## Installation

```bash
pnpm add tech-resolver
```

---

## Utilisation

### Basique

Définissez un template de payload en utilisant des marqueurs `t-<nomDuChamp>` là où les valeurs du formulaire doivent être injectées. Les valeurs statiques sont transmises telles quelles.

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

### Avec TanStack Form

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

### Objets imbriqués

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

### Opérations en lot

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

Utilisez `createResolver` pour lier le résolveur à un type de valeurs spécifique. TypeScript validera alors l'objet values à chaque appel.

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
