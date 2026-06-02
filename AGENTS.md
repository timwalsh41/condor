# General Agent Instructions

You must always follow the best practices outlined in this document. If there is a valid reason why you cannot follow one of these practices, you must inform the user and document the reasons.

Before beginning any task, make sure you review the documentation (docs/ and README.md), and the existing tests to understand the project. You must review code related to your request to understand preferred style: for example, you must review other tests before writing a new test suite.

Always ask for clarification when user intent is unclear, ambiguous, or contradictory. Make sure we have complete alignment on objectives, approach, and acceptance criteria before undertaking any code changes.

Prioritize retrieval-led reasoning over pretrained-knowledge-led reasoning.

Stay in scope: only modify files directly related to the current task. Do not refactor, reformat, rename, or clean up files that are not in scope, even if you notice an opportunity for improvement. Report those observations to the user instead.

# Repo Information

Refer to the `README.md` in the project root for a description of the project. General technical documentation is available in `docs/SYSTEM_ARCHITECTURE.md`, `docs/BACKEND_DESIGN.md`, `docs/FRONTEND_DESIGN.md`, and `docs/UX_WORKFLOW_SPEC.md`. Please refer to those as needed, and keep them up to date while making changes in the codebase.

Guidance on producing technical documentation is provided in `.claude/style-guides/TECHNICAL_DOCUMENTATION.md`. Refer to `.claude/style-guides/MARKDOWN.md` for markdown style.

# Design Principles

- KISS (Keep It Simple, Stupid): choose straightforward solutions over complex ones whenever possible
    - Simple solutions are easier to understand, maintain, and debug
    - Prioritize readability and maintainability highly
- YAGNI (You Aren't Gonna Need It): Do not build functionality on speculation - implement features only when they are needed, not when you anticipate they might be useful in the future
- Dependency inversion: high-level modules should not depend on low-level modules, both should depend on abstractions
- Open/Closed Principle: software entities should be open for extension but closed for modification
- Single Responsibility: Each function, class, and module should have one clear purpose
- Fail Fast: Check for potential errors early and raise exceptions immediately when issues occur
- Write modular code with clear separation of concerns
- Implement leakage-free interfaces where implementation details stay within component boundaries and consumers depend only on explicitly defined contracts, not internal implementation
- Follow consistent naming conventions for variables, functions, and files
- Write tests as you go to verify functionality, don't put it off to a later phase
- Google-style docstrings for all public functions, classes, modules
- Comment complex logic (explain why moreso than how)
- Keep documentation current with implementation
- Think before executing - does the proposed plan make sense within the context of the project and the in-scope goals for the task? Consult the user for clarification when needed
- For complex code, always prefer using third-party libraries instead of writing new code that has to be maintained
- Eliminate dead code, don't leave it "just in case", git keeps history — but if you are uncertain whether code is truly dead, ask before deleting
- Refactor to limit repetition by abstracting operations into separate classes/functions

# Ensure Comprehensive Test Coverage

- Create tests for all new features (functions, classes, routes, etc.) - no feature is complete without tests
- Update tests when logic changes
- Unit tests live next to code in local `tests/` folders
- Integration tests live in project root `/tests` folder (cross-component)
- Include at least: happy path, edge case, failure case, valid/invalid inputs
- Cover as much as possible with automated tests supplementing as needed with manual (user-executed) tests

# Security

- Always write secure code
- Never hardcode sensitive data
- Do not log sensitive data
- All user input must be validated
- Never roll your own cryptography system

# Code Quality

- All generated code must be production ready
- Unless otherwise explicitly approved by user, there must be no stubs "for production"
- There must not be any non-production logic branches in the main code package itself
- Any code or package differences between Development and Production must be avoided unless absolutely necessary

# Dependencies and Network Access

- Do not install packages, libraries, or tools not already present in the project's dependency specification without explicit user approval
- Do not make outbound network requests from code unless the feature explicitly requires it and it has been discussed with the user
- When a new dependency is genuinely needed, propose it to the user first: state what it does, why it is the right choice, and any relevant licensing or security considerations

# Testing and Validation

Testing:

- **Backend unit tests** (from project root): `uv run pytest backend/`
- **Backend integration tests** (from project root): `uv run pytest tests/`
- **Frontend unit tests** (from `frontend/`): `npm test`
- **Frontend E2E tests** (from `frontend/`): `npm run test:e2e`

Linting:

- **Frontend** (from `frontend/`): `npm run lint`
- **Backend** (from project root): `uv run ruff check backend/`

# File Operations

ALWAYS use git mv for moving or renaming files, never use mv or file manipulation tools:

```bash
git mv old_path new_path
```

**CRITICAL**: When moving or renaming files in a git repository, you MUST use `git mv` instead of regular `mv` or file manipulation tools. This ensures git properly tracks the file history and prevents issues with version control.
