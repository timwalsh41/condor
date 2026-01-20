# CLAUDE.md

System direction for requirements-driven AI-based product development coding workflow.

## Development Approach

We will use a requirements-driven process, emphasizing rigorous traceability from comprehensive technical requirements through evidence-based validation to ensure that we are building the right product and building it correctly. We will maintain formal project and technical documentation, creating these early and updating as we work through the development process:

| Document                                                  | Destination   | Template                         | Description                                                                                                                 |
| --------------------------------------------------------- | ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                               | Project root  | N/A                              | Project overview and quick start (installing dependencies, building code, running tests, running main applications/systems) |
| `REQUIREMENTS.md`                                         | `project/`    | `REQUIREMENTS_TEMPLATE.md`       | System technical requirements                                                                                               |
| `PROJECT_PLAN.md`                                         | `project/`    | `PROJECT_PLAN_TEMPLATE.md`       | Project plan                                                                                                                |
| `VALIDATION_REPORT.md`                                    | `validation/` | `VALIDATION_REPORT_TEMPLATE.md`  | Requirements validation report                                                                                              |
| `INTEGRATION_REPORT_PHASE_[PHASE_NUMBER]_[PHASE_NAME].md` | `validation/` | `INTEGRATION_REPORT_TEMPLATE.md` | Integration reports                                                                                                         |
| `SYSTEM_ARCHITECTURE.md`                                  | `docs/`       | `ARCHITECTURE_TEMPLATE.md`       | System architecture description                                                                                             |
| `<subsystem_name>_DESIGN.md`                              | `docs/`       | `SYSTEM_DESIGN_TEMPLATE.md`      | Subsystem design description                                                                                                |

_Document templates are in `.claude/doc-templates`_

Our intent is to implement a controlled process with rigorous requirements tracking and documentation, but to allow for flexibility as well. Things don't always go to plan, and we may need to deviate, experiment, or iterate to resolve unforeseen challenges. We'll do our best to create an accurate and achievable set of requirements and attendant project plan, and adjust as needed along the way. Whatever turns the project takes though, we must **always** ensure our documentation is accurate and up-to-date.

## 🎯 Core Development Philosophy

### KISS (Keep It Simple, Stupid)

Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug. Prioritize this readability and maintainability highly.

### YAGNI (You Aren't Gonna Need It)

Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

### 🧪 Ensure Comprehensive Test Coverage

#### Testing Principles

- **Create tests for all new features** (functions, classes, routes, etc.) - no feature is complete without tests!
- **Update tests when logic changes**
- **Unit tests live next to code** in local `tests/` folders (see Project Architecture)
- **Backend integration tests** live in project root `/tests` folder (cross-component, Python/pytest)
- **Playwright integration tests** live in `frontend/tests/` (requires backend and node_modules)
- **Include at least**: happy path, edge case, failure case
- **Cover as much as possible with automated tests** supplementing as needed with manual (user-executed) tests

#### Two Test Types

1. **Requirement-Validating Tests**: Directly verify requirement acceptance criteria
   - **MUST** reference requirement IDs in docstrings
   - Tracked in `VALIDATION_REPORT.md` for requirements traceability
   - Can be unit tests (component-level) or integration tests (system-level)
2. **Supporting Tests**: Verify implementation correctness and code quality
   - Do NOT need requirement IDs in docstrings
   - Must pass for CI/regression, but not tracked in validation report

Both types must pass, but only requirement-validating tests prove requirements are met. For requirement-validating tests, include requirement ID in docstring.

### Design Principles

- **Dependency Inversion**: High-level modules should not depend on low-level modules. Both should depend on abstractions.
- **Open/Closed Principle**: Software entities should be open for extension but closed for modification.
- **Single Responsibility**: Each function, class, and module should have one clear purpose.
- **Fail Fast**: Check for potential errors early and raise exceptions immediately when issues occur.
- Write **modular** code with clear separation of concerns
- **Implement leakage-free interfaces** where implementation details stay within component boundaries and consumers depend only on explicitly defined contracts, not internal implementation
- Follow consistent **naming conventions** for variables, functions, and files

### General Development Guidelines

- **Write tests as you go** to verify functionality, don't put it off to a later phase
- **Google-style docstrings** for all public functions, classes, modules
- **Comment complex logic** explain why moreso than how
- **Keep documentation current** with implementation
- **Think before executing** - does the proposed plan make sense within the context of the project and the in-scope goals for the task? Consult the user for clarification when needed.

### Project Planning and Execution Guidelines

- **Do not include a timeline** in the main project plan or any subplans; we are not tracking a schedule but rather the completion of tasks
- **Each task should result in some user-exercisable element** such as code that can be built and executed, a user-facing demo, unit tests that can be run, or documentation that can be reviewed
- **Status for each task in the project plan** should be one of `Not Started`, `In Progress`, `Complete`, or `Deprecated`
- **Status for each requirement in `REQUIREMENTS.md`** should be one of `Planned`, `In Progress`, `Implemented`, `Validated`, or `Deprecated`

### Guidance for Creating and Maintaining Documentation

- **Be concise** - consider what is the core information that needs to be captured, and avoid redundancy
  - Use references as needed to avoid redundancy across files
  - Always review your work to ensure these two guidelines are followed
- **Document the current state** - don't refer to changes, improvements, refactors, etc., the documentation should reflect the current state only, not the history
  - Ensure all documentation, including `README.md` is kept up to date and accurately reflects current project state, dependencies, and setup instructions
  - Remove or update obsolete documentation that references past implementations
  - An exception would be dedicated technical documentation of spikes or experimental phases to address risk/complexity and guide the design
- **Refer to the markdown style guide** at `.claude/style-guides/MARKDOWN.md` when creating or editing markdown documents (with or without a template)
- **Don't create new documents unprompted** - seek explicit approval from the user
- **Focused design documents** can be used to complement the formal technical project documents to go into more detail on the implementation of a specific feature or technology, technical documentation style guide at `.claude/style-guides/TECHNICAL_DOCUMENTATION.md` for further guidance as needed

### Don't Assume!

**Always ask for clarification when user intent is unclear, ambiguous, or contradictory.** Make sure we have complete alignment on objectives, approach, and acceptance criteria before undertaking any code changes.

## 🏗️ Integration Points & Interfaces

Project phase completions represent integration points where multiple independently-developed components converge and are validated as a cohesive system. Assess with the user if an integration report is appropriate when a project phase is completed. Rely on the `validation-gates` agent to run tests to produce objective evidence of validation and create/update the integration report.

## 🧱 Project & Code Structure

### Project Organization

Follow vertical slice architecture with unit tests next to code, and any needed backend integration tests placed in a separate `tests/` folder at project root. Documentation should be created in the appropriate folder, either `docs/` (technical documentation), `project/` (project management documentation), or `validation/` (validation and integration reports).

```
docs/                           # Technical documentation
project/                        # Project management documentation
src/
    __init__.py
    main.py
    tests/                      # Unit tests for main.py
        test_main.py
    conftest.py
    module/
        __init__.py
        implementation.py
        tests/                  # Unit tests for module
            test_implementation.py
tests/                          # Backend integration tests
    conftest.py
    test_backend_integration.py
    # Note: Playwright integration tests are in frontend/tests/ due to node_modules dependencies
validation/                     # Formal validation documents
```

### File Limits (Enforce loosely)

- **Files: 1000 lines max** - Refactor if approaching
- **Functions: 100 lines max** - Single responsibility
- **Class declarations: 300 lines max** - Single concept
- **Line length: 100 characters max**

### Code Management Practices

- **Eliminate dead code** - Don't leave it "just in case", git keeps history
- **Refactor to limit repetition** - Abstract operations into separate classes/functions
