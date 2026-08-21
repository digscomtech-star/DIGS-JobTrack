---
name: API codegen integer compatibility
description: A generated Zod client in this workspace uses Zod 3.
---

Generated schemas currently target Zod 3, so OpenAPI integer fields can produce unsupported `zod.int()` calls during typechecking. Use numeric schemas for generated API contracts unless the generator/dependency pairing is upgraded together.

**Why:** Code generation succeeded but the chained library typecheck failed when integer schemas were introduced.

**How to apply:** After OpenAPI changes, run codegen and the library typecheck before implementing server routes; if integer generation fails, use compatible numeric schemas and parse ids at the route boundary.