# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-03-03

### Added

- `withPayload(template, callback)` — framework-agnostic handler factory that resolves a template against provided values and passes the result to a callback; works with TanStack Form, React Hook Form, Formik or plain objects
- 4 additional tests covering `withPayload` behavior: callback invocation, missing keys, real-world mutate payload, async callback

### Changed

- Package renamed from `@tech-sdk/resolver` to `tech-resolver`
- `withPayload` signature updated to accept values directly `(values: V) => Promise<void>` instead of TanStack-specific `({ value: V }) => Promise<void>`, making it fully framework agnostic

### Documentation

- Added recommended payload file pattern (`payloads/userPayload.ts` with named exports per operation)
- Added complex real-world example showing create with nested relations and attachments
- README translated to French, German, Spanish, Italian, Portuguese and Chinese

---

## [0.1.0] - 2026-03-03

Initial release of `tech-resolver`.

### Added

- `resolve(template, values)` — recursive pure function that walks any JSON-serializable template and replaces `t-<key>` markers with the matching values; handles strings, numbers, booleans, null, nested objects and arrays at any depth
- `createResolver<V>()` — factory that returns a resolver pre-typed against a given values shape for type-safe reuse across a module
- `JsonValue` type — union of all JSON-serializable primitives, arrays and objects
- `IResolveValues` type — `Record<string, unknown>` alias for the values parameter
- 21 tests covering primitives, all marker behaviors, flat and nested objects, arrays, real-world mutate payloads and batch operations
