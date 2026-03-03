import { describe, it, expect, vi } from 'vitest'
import { resolve, createResolver, withPayload } from '../resolver'

describe('resolve', () => {
    describe('primitives', () => {
        it('returns a static string unchanged', () => {
            expect(resolve('hello', {})).toBe('hello')
        })

        it('returns a static number unchanged', () => {
            expect(resolve(42, {})).toBe(42)
        })

        it('returns a boolean unchanged', () => {
            expect(resolve(true, {})).toBe(true)
        })

        it('returns null unchanged', () => {
            expect(resolve(null, {})).toBeNull()
        })
    })

    describe('t- markers', () => {
        it('replaces a t- string with the matching value', () => {
            expect(resolve('t-name', { name: 'Alice' })).toBe('Alice')
        })

        it('returns null for a t- key not present in values', () => {
            expect(resolve('t-missing', {})).toBeNull()
        })

        it('replaces a t- marker with a numeric value', () => {
            expect(resolve('t-role', { role: 3 })).toBe(3)
        })

        it('replaces a t- marker with a boolean value', () => {
            expect(resolve('t-active', { active: false })).toBe(false)
        })

        it('replaces a t- marker with a null value', () => {
            expect(resolve('t-ref', { ref: null })).toBeNull()
        })

        it('does not replace a string that merely contains t-', () => {
            expect(resolve('attr-name', {})).toBe('attr-name')
        })
    })

    describe('objects', () => {
        it('resolves a flat object with mixed static and dynamic fields', () => {
            const result = resolve(
                { operation: 'create', name: 't-name' },
                { name: 'Bob' }
            )
            expect(result).toEqual({ operation: 'create', name: 'Bob' })
        })

        it('resolves a nested object recursively', () => {
            const result = resolve(
                { user: { name: 't-name', email: 't-email' } },
                { name: 'Carol', email: 'carol@test.com' }
            )
            expect(result).toEqual({ user: { name: 'Carol', email: 'carol@test.com' } })
        })

        it('resolves deeply nested objects', () => {
            const result = resolve(
                { a: { b: { c: 't-value' } } },
                { value: 42 }
            )
            expect(result).toEqual({ a: { b: { c: 42 } } })
        })
    })

    describe('arrays', () => {
        it('resolves an array by mapping over items', () => {
            const result = resolve(
                [{ op: 'create', name: 't-name' }, { op: 'attach', id: 't-role' }],
                { name: 'Dave', role: 7 }
            )
            expect(result).toEqual([
                { op: 'create', name: 'Dave' },
                { op: 'attach', id: 7 },
            ])
        })

        it('resolves an array of primitives', () => {
            expect(resolve(['t-a', 't-b', 'static'], { a: 1, b: 2 })).toEqual([1, 2, 'static'])
        })
    })

    describe('real-world payload shapes', () => {
        it('resolves a standard mutate payload', () => {
            const result = resolve(
                {
                    mutate: [
                        {
                            operation: 'create',
                            attributes: { name: 't-first_name', email: 't-email' },
                        },
                    ],
                },
                { first_name: 'Eve', email: 'eve@test.com' }
            )
            expect(result).toEqual({
                mutate: [
                    {
                        operation: 'create',
                        attributes: { name: 'Eve', email: 'eve@test.com' },
                    },
                ],
            })
        })

        it('resolves a batch payload with multiple operations', () => {
            const result = resolve(
                {
                    mutate: [
                        { operation: 'create', attributes: { name: 't-name' } },
                        { operation: 'attach', relation: 'roles', id: 't-role' },
                    ],
                },
                { name: 'Frank', role: 42 }
            )
            expect(result).toEqual({
                mutate: [
                    { operation: 'create', attributes: { name: 'Frank' } },
                    { operation: 'attach', relation: 'roles', id: 42 },
                ],
            })
        })

        it('keeps static nested values alongside dynamic ones', () => {
            const result = resolve(
                { meta: { source: 'web', version: 2, user: 't-user_id' } },
                { user_id: 99 }
            )
            expect(result).toEqual({ meta: { source: 'web', version: 2, user: 99 } })
        })
    })
})

describe('withPayload', () => {
    it('calls the callback with the resolved payload', async () => {
        const callback = vi.fn()
        const template = { attributes: { name: 't-name' } }
        const handler = withPayload(template, callback)

        await handler({ name: 'Alice' })

        expect(callback).toHaveBeenCalledWith({ attributes: { name: 'Alice' } })
    })

    it('returns null for missing keys', async () => {
        const callback = vi.fn()
        const handler = withPayload({ id: 't-id' }, callback)

        await handler({})

        expect(callback).toHaveBeenCalledWith({ id: null })
    })

    it('passes a real-world mutate payload to the callback', async () => {
        const callback = vi.fn()
        const template = {
            mutate: [{ operation: 'create', attributes: { name: 't-name', role_id: 't-role' } }],
        }
        const handler = withPayload(template, callback)

        await handler({ name: 'Bob', role: 2 })

        expect(callback).toHaveBeenCalledWith({
            mutate: [{ operation: 'create', attributes: { name: 'Bob', role_id: 2 } }],
        })
    })

    it('awaits an async callback', async () => {
        const results: string[] = []
        const handler = withPayload('t-name', async (payload) => {
            await Promise.resolve()
            results.push(payload as string)
        })

        await handler({ name: 'Carol' })

        expect(results).toEqual(['Carol'])
    })
})

describe('createResolver', () => {
    it('returns a bound resolver that replaces t- keys', () => {
        const resolveUser = createResolver<{ name: string; role: number }>()
        expect(resolveUser('t-name', { name: 'Alice' })).toBe('Alice')
    })

    it('returns null for a missing key', () => {
        const resolveUser = createResolver<{ name: string }>()
        expect(resolveUser('t-name', {})).toBeNull()
    })

    it('resolves a full payload', () => {
        const resolveUser = createResolver<{ first_name: string; role: number }>()
        const result = resolveUser(
            { attributes: { name: 't-first_name', role_id: 't-role' } },
            { first_name: 'Grace', role: 5 }
        )
        expect(result).toEqual({ attributes: { name: 'Grace', role_id: 5 } })
    })
})
