/**
 * Canonical V2 program-builder store re-export.
 *
 * The underlying implementation lives at
 * `src/stores/programBuilder/useProgramBuilderStore.ts` (the "V2 engine"),
 * but we re-export it here under the name `useAdvancedProgramStore` for two
 * reasons:
 *
 *   1. The legacy store at `src/stores/useProgramBuilderStore.ts` still
 *      exists and exports a hook with the *same* name. Importing both via
 *      relative paths in the same file is awkward and error-prone; aliasing
 *      the V2 hook gives consumers an unambiguous symbol.
 *
 *   2. Specs and product docs refer to this engine as the "Advanced Program
 *      Store". Centralizing the alias here means a future rename of the
 *      underlying file is a one-line change.
 *
 * Always import from this module in V2-only code paths (the new
 * ProgramBuilder page, Macro-Timeline, Week-Builder, and any future
 * components built against the periodized data model).
 */

export { useProgramBuilderStore as useAdvancedProgramStore } from "./programBuilder/useProgramBuilderStore";
