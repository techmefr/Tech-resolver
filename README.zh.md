# T-Resolver

用于表单到 API 映射的 Payload 解析器。使用 `t-` 标记一次性声明您的 API 结构，在运行时将其解析为任意表单值。

零依赖。框架无关。兼容 TanStack Form、React Hook Form、Formik 或普通对象。

[Tech-SDK](https://github.com/techmefr/Tech-SDK) 生态系统的一部分。

---

## 问题所在

每个与 API 通信的表单都需要一个映射层——将用户输入的内容转换为后端期望的 JSON 格式。这种映射通常是手动编写的，在每个功能模块中重复出现，并与表单库和 API 结构紧密耦合。

T-Resolver 将这一切解耦。您将目标 JSON 一次性描述为模板。提交时，一次函数调用即可完成填充。

---

## 安装

```bash
pnpm add @tech-sdk/resolver
```

---

## 使用

### 基础用法

使用 `t-<字段名>` 标记定义 payload 模板，标记处将被注入表单值。静态值原样传递。

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

### 与 TanStack Form 配合使用

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

### 嵌套对象

解析器可遍历任意深度的嵌套结构：

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

### 批量操作

数组按元素逐一解析，支持多操作 payload：

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

## 类型安全用法

使用 `createResolver` 将解析器绑定到特定的值类型。TypeScript 将在每个调用处验证 values 对象。

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

递归遍历 `template`，将所有以 `t-` 开头的字符串替换为 `values` 中的对应值。缺失键返回 `null`，其余内容原样返回。

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

返回一个预先绑定到 `V` 类型的解析器函数。当同一解析器在多处调用时使用此方式。

---

## 标记的工作原理

标记是模板中任何以 `t-` 开头的字符串值：

```
"t-first_name"  →  values.first_name
"t-role"        →  values.role
"operation"     →  "operation"   （无前缀，原样返回）
```

- 如果键存在于 `values` 中，其值将替换标记——无论类型如何
- 如果键在 `values` 中不存在，标记解析为 `null`
- 包含 `t-` 但不以其开头的字符串保持不变

---

## 许可证

MIT
