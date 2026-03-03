# Tech-Resolver

用于表单到 API 映射的 Payload 解析器。使用 `t-` 标记一次性声明您的 API 结构，在运行时将其解析为任意表单值。

零依赖。框架无关。兼容 TanStack Form、React Hook Form、Formik 或普通对象。

---

## 问题所在

每个与 API 通信的表单都需要一个映射层——将用户输入的内容转换为后端期望的 JSON 格式。这种映射通常是手动编写的，在每个功能模块中重复出现，并与表单库和 API 结构紧密耦合。

当 API 发生变化时，需要逐一检查每个表单并手动更新 payload。

Tech-Resolver 将这一切解耦。您将目标 JSON 一次性描述为模板。提交时，一次函数调用即可完成填充。

---

## 安装

```bash
pnpm add tech-resolver
```

---

## 推荐模式 — payload 文件

将模板组织在专用文件中，每个资源对应一个文件。直接从 API 客户端（Bruno、Postman、Insomnia）复制 payload，将动态值替换为 `t-` 标记，并为每个操作导出一个常量。

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

如果 API 发生变化，只需更新一个文件。所有使用该 payload 的表单都会自动更新。

---

## 复杂示例 — 带关联关系的创建操作

一个包含嵌套关联、附件和静态值的真实 payload。

**不使用 Tech-Resolver — 在每个表单中手动重建：**

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

**使用 Tech-Resolver — 声明一次，到处使用：**

```ts
// payloads/userPayload.ts — 从 Bruno 复制，值替换为 t- 标记
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
// 在表单中 — 就这些
import { UserPayloadCreate } from '@/payloads'
import { withPayload } from 'tech-resolver'

const handler = withPayload(UserPayloadCreate, payload => sdk.users.create(payload))

// 从任意来源传入值
onSubmit: ({ value }) => handler(value)   // TanStack Form
handleSubmit(handler)                      // React Hook Form
onSubmit: handler                          // Formik
handler(myValues)                          // 普通对象
```

---

## 基础用法

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

## 嵌套对象

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

---

## 批量操作

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

递归遍历 `template`，将所有以 `t-` 开头的字符串替换为 `values` 中的对应值。缺失键返回 `null`，其余内容原样返回。

### `createResolver<V>()`

```ts
function createResolver<V extends Record<string, unknown>>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue
```

返回一个预先绑定到 `V` 类型的解析器函数。当同一解析器在多处调用时使用此方式。

### `withPayload(template, callback)`

```ts
function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (values: V) => Promise<void>
```

返回一个 handler，将模板解析为提供的值并将结果传递给 callback。框架无关——适用于任何表单库或普通值。

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
