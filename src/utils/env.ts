/**
 * Environment flag behind a safe accessor: `import.meta.env` only exists when a
 * bundler defines it, and reading `.DEV` blindly would throw in a plain Node run
 * (tests, scripts, SSR).
 */
export const IS_DEV: boolean = import.meta.env?.DEV === true
