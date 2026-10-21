# Source register

This register records provenance. Inclusion does not mean that a source is
adopted wholesale. Where a requirement cites practitioner experience, it was
validated against production TypeScript applications that are not public; the
normative basis remains the public sources listed here.

## Public and official sources

| Source | Use |
| --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Mandatory frontend accessibility target |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) | Interaction and keyboard contracts for custom widgets |
| [WCAG-EM](https://www.w3.org/TR/WCAG-EM/) | Method for scoped conformance evaluation |
| [W3C accessibility evaluation guidance](https://www.w3.org/WAI/test-evaluate/) | Manual, automated and assistive-technology evaluation layers |
| [axe-core](https://github.com/dequelabs/axe-core) | Automated checks against rendered interface states |
| [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) | Static JSX accessibility checks |
| [Testing Library](https://testing-library.com/docs/queries/about/) | Tests through semantic roles, names and labels |
| [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) | Browser-level axe integration for critical flows |
| [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0) | Pinned verifiable application-security requirements and assurance levels |
| [OWASP Top 10:2025](https://owasp.org/Top10/2025/) | Current web security awareness coverage, not the verification baseline |
| [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | API-specific threat coverage |
| [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) | Adversarial web testing guidance |
| [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | Secure development lifecycle and supply-chain framework |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | Authentication assurance and phishing-resistant authentication |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) | Boundary validation, error handling, logging and secret handling |
| [ESLint rules reference](https://eslint.org/docs/latest/rules/) | `no-magic-numbers`, `func-style` and `prefer-arrow-callback` as the checks behind the code-form invariants |
| [typescript-eslint rules](https://typescript-eslint.io/rules/) | Typed `no-magic-numbers` and `naming-convention` for constants modules |
| [MDN arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) | Lexical `this` semantics behind the default callable form |
| [TypeScript documentation](https://www.typescriptlang.org/docs/) | Compiler behavior and strictness options |
| [Node.js documentation](https://nodejs.org/docs/latest/api/) | Runtime and package boundary behavior |
| [React documentation](https://react.dev/) | React programming model |
| [Vite documentation](https://vite.dev/guide/) | Build tool, environment variable exposure and Vite 8 migration |
| [Vitest documentation](https://vitest.dev/guide/) | Component test runner configuration and Vitest 5 migration |
| [jsdom](https://github.com/jsdom/jsdom) | DOM environment for component tests |
| [Playwright documentation](https://playwright.dev/docs/intro) | Browser-level critical-flow tests and web server orchestration |
| [Fastify documentation](https://fastify.dev/docs/latest/) | Fastify lifecycle, validation, serialization, plugins and encapsulation |
| [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) | zod schemas as Fastify validation and serialization contract |
| [zod documentation](https://zod.dev/) | Runtime schemas for requests and configuration |
| [class-validator](https://github.com/typestack/class-validator) | Nest DTO validation |
| [SWC](https://swc.rs/docs/configuration/compilation) | Decorator metadata transform for Nest tests |
| [PostgreSQL documentation](https://www.postgresql.org/docs/current/) | Grants, policies and function security semantics |
| [Nest documentation](https://docs.nestjs.com/) | Nest architecture and security mechanisms |
| [Supabase documentation](https://supabase.com/docs) | RLS, grants, authentication and key handling |
| [GitLab documentation](https://docs.gitlab.com/ci/) | Optional CI template and variable safety |
| [Yarn documentation](https://yarnpkg.com/) | Package-manager pinning and immutable installs |
| [ESLint documentation](https://eslint.org/docs/latest/) | Flat Config and static-analysis behavior |
| [`@stylistic` documentation](https://eslint.style/) | ESLint-owned source formatting |
| [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) | Default commit-message convention |
| [commitlint documentation](https://commitlint.js.org/) | Commit-message validation |
| [Husky documentation](https://typicode.github.io/husky/) | Versioned native Git hooks |
| [lint-staged documentation](https://github.com/lint-staged/lint-staged) | Fast checks scoped to staged files |
| [Alistair Cockburn, Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/) | Ports and adapters for infrastructure (`STRUCT-PORT-001`) |
| [Martin Fowler, Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html) | Transactions behind an opaque handle (`STRUCT-PORT-001`) |

Exact standard and tool versions are recorded when their requirements are
implemented, so future updates can be reviewed deliberately. Security profiles
remain pinned to ASVS 5.0.0 until a reviewed foundation change updates the
requirement mappings and project migration guidance.
