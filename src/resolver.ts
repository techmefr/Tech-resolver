import type { JsonValue, IResolveValues } from './types'

const T_PREFIX = 't-'

export function resolve(template: JsonValue, values: IResolveValues): JsonValue {
    if (Array.isArray(template)) {
        return template.map(item => resolve(item, values))
    }

    if (typeof template === 'object' && template !== null) {
        return Object.fromEntries(
            Object.entries(template).map(([k, v]) => [k, resolve(v, values)])
        )
    }

    if (typeof template === 'string' && template.startsWith(T_PREFIX)) {
        const key = template.slice(T_PREFIX.length)
        const value = values[key]
        return value !== undefined ? (value as JsonValue) : null
    }

    return template
}

export function createResolver<V extends IResolveValues>(): (
    template: JsonValue,
    values: Partial<V>
) => JsonValue {
    return (template, values) => resolve(template, values as IResolveValues)
}

export function withPayload<V extends IResolveValues>(
    template: JsonValue,
    callback: (payload: JsonValue) => Promise<void> | void
): (ctx: { value: V }) => Promise<void> {
    return async ({ value }) => {
        await callback(resolve(template, value))
    }
}
