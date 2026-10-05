// How many blocking entries a refusal lists before it stops enumerating.
export const MAX_REPORTED_BLOCKING_ENTRIES = 5

// Matches the two-space indentation the repository writes in every manifest.
export const MANIFEST_INDENT_SPACES = 2

// Permissions of a file the foundation writes without a template to copy them
// from, such as the requirement index.
export const GENERATED_FILE_MODE = 0o644

// `process.argv` starts with the runtime and the script path.
export const CLI_ARGUMENTS_OFFSET = 2
