# CLAUDE.md

AI coding assistant system prompt for the PRP (Product Requirements Prompt) workflow.

## 🎯 Core Development Philosophy

### KISS (Keep It Simple, Stupid)

Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

### YAGNI (You Aren't Gonna Need It)

Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

### Design Principles
- **Dependency Inversion**: High-level modules should not depend on low-level modules. Both should depend on abstractions.
- **Open/Closed Principle**: Software entities should be open for extension but closed for modification.
- **Single Responsibility**: Each function, class, and module should have one clear purpose.
- **Fail Fast**: Check for potential errors early and raise exceptions immediately when issues occur.

## 🤝 Agent Coordination Workflow

**YOU MUST coordinate with subagents** throughout implementation for all changes:

1. **Session start** → Consult project-manager for briefing and priorities
2. **Create plan for session** → Communicate to user your confidence (0-100) in successful implementation, identifying any risks or concerns
2. **Execute changes** → Implement code following requirements and documented design & plan
3. **Independent review** → Independent-reviewer provides fresh perspective  
4. **Update documentation** → Documentation-manager updates affected docs
5. **Validate requirements** → Validation-gates performs final checks
6. **Report completion** → Summarize work to project-manager for plan updates

**During session** consult project-manager on scope questions as needed
- **Discretion**: May bypass full PM process for trivial changes
- **Always trigger**: Independent review, documentation updates, and validation for ALL changes

## 📋 Requirements-Driven Development

**Key Artifacts:**
- **`PRPs/feature.md`** - The design guidelines with overview on requirements, implementation approach, gotchas, etc.
- **`REQUIREMENTS.md`** - Source of truth for formal requirements with IDs and acceptance criteria
- **`PROJECT_PLAN.md`** - Task coordination, phases, and requirement traceability
- **`VALIDATION_REPORT.md`** - Ongoing requirement validation status
- **`INTEGRATION_REPORT_[PHASE].md`** - Phase completion validation narrative (created at integration points)

**Two Test Types (BOTH REQUIRED):**

1. **Requirement-Validating Tests**: Directly verify requirement acceptance criteria
   - **MUST** reference requirement IDs in docstrings
   - Tracked in `VALIDATION_REPORT.md` for requirements traceability
   - Can be unit tests (component-level) or integration tests (system-level)
   - **Unit tests**: Live next to code in local `tests/` folders
   - **Integration tests**: Live in project root `/tests` folder
   - Example: `test_user_login()` validates REQ-F-AUTH-001

2. **Supporting Tests**: Verify implementation correctness and code quality
   - Do NOT need requirement IDs in docstrings
   - Must pass for CI/regression, but not tracked in validation report
   - Typically unit tests living next to code
   - Example: `test_password_hash_unicode()` validates helper function

**Example:**

```python
def test_user_login_valid_credentials():
    """
    Validates: REQ-F-AUTH-001
    Acceptance Criteria: User can log in with valid credentials
    """
    # Requirement-validating test
    response = auth_client.login(email="test@example.com", password="ValidPass123")
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_password_hash_deterministic():
    """Test that password hashing is deterministic for same input."""
    # Supporting test - no requirement ID needed
    hash1 = hash_password("test123")
    hash2 = hash_password("test123")
    assert hash1 == hash2
```

**IMPORTANT**: Both types must pass, but only requirement-validating tests prove requirements are met.

## 🔄 Core Workflows

### /generate-prp Workflow
`INITIAL.md` → `/generate-prp` → `REQUIREMENTS.md` + `PRPs/feature.md`

Creates or updates formal requirements document and generates implementation plan (PRP) with requirement traceability.

### /execute-prp Workflow  
`PRPs/feature.md` → `/execute-prp` → Implementation

**Steps:**
1. Project-manager creates/updates `PROJECT_PLAN.md`
2. Implement code with requirement references where relevant
3. Independent-reviewer reviews code quality
4. Validation-gates validates requirements (not just tests)
5. Documentation-manager updates docs
6. Project-manager updates plan with progress and `REQUIREMENTS.md` with status

### Session-Based Execution

**First session**: `/execute-prp` triggers project-manager → receive briefing → implement tasks

**Subsequent sessions**: 
1. Consult project-manager for session briefing (reads `PROJECT_PLAN.md`)
2. Consult relevant PRP file for implementation context
3. Brief user and receive approval to implement next priority task(s) (no explicit command needed)

**Each session ends with**: Stable, tested, validated, documented code with updated plan

### PRP Reference Throughout Implementation

**The PRP is your implementation guide** - refer back to it regularly:

**What the PRP Contains:**
- Requirements context and acceptance criteria
- Implementation patterns from codebase analysis
- External documentation links (libraries, APIs, standards)
- Gotchas and common pitfalls
- Validation gates that verify requirements
- Test requirements with traceability

**When to Consult the PRP:**
- **Session start**: Review relevant sections for tasks being implemented
- **During coding**: Check patterns, conventions, gotchas
- **Writing tests**: Reference validation gates and test requirements
- **Problem-solving**: Consult error patterns and troubleshooting notes
- **Session end**: Verify all PRP guidance followed

**PRP vs `PROJECT_PLAN.md`:**
- **PRP**: WHY and HOW (requirements, patterns, implementation details)
- **`PROJECT_PLAN.md`**: WHAT and WHEN (tasks, dependencies, priorities, status)
- **Use both together** for effective implementation across sessions

**PRP updates:**
- During the course of execution over multiple sessions, it may become evident based on new that the PRP should be updated
- Update the PRP at any time based on learnings, discoveries, or new direction from the user
- Communicate to the user that the PRP is being updated

## 🏗️ Integration Points & Interfaces

**CRITICAL CONCEPT**: Integration points = phase completions where multiple independently-developed components converge and are validated as a cohesive system.

### Implement Leakage-Free Interfaces

**Definition**: Interface where implementation details stay within component boundaries
- Consumers depend only on contracts, not internal implementation
- Changes to implementation don't affect consumers (if contract maintained)
- Interfaces explicitly defined (APIs, function signatures, protocols, schemas)

**Examples of Interface Boundaries:**
- **Software layers**: UI ↔ Business Logic ↔ Data Layer
- **Services**: Service A ↔ Service B (HTTP, gRPC, message queue)
- **Modules**: Module A ↔ Module B (function calls, shared memory)
- **External**: Your System ↔ Third-Party (API, protocol)

### When Integration Reports Required

**Required:**
- ✓ Phase completion (multiple components integrated)
- ✓ Components interact across interface boundaries
- ✓ Top-level requirements validated end-to-end

**Not Required:**
- ✗ Single component changes
- ✗ Bug fixes within existing boundaries
- ✗ Individual task completion (use VALIDATION_REPORT instead)

## 🧱 Code Structure & Modularity

### File Limits (Enforce loosely)

- **Files: 1000 lines max** - Refactor if approaching
- **Functions: 100 lines max** - Single responsibility
- **Class declarations: 300 lines max** - Single concept
- **Line length: 100 characters max**

### Project Architecture

**Test Placement Rules:**
- **Unit tests**: Next to the code they test in local `tests/` folders
- **Integration tests**: In project root `/tests` folder (validates system requirements across components)

Follow vertical slice architecture with unit tests next to code:

```
tests/                          # Integration tests only (end-to-end, system requirements)
    conftest.py
    test_integration_auth_flow.py
    test_integration_checkout.py

src/project/
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

    features/
        feature_name/
            __init__.py
            handlers.py
            tests/              # Unit tests for feature
                test_handlers.py
```

### Code Management

- **Eliminate dead code** - Don't leave it "just in case", git keeps history
- **Atomic commits** - Prefer independent commits for clean reversion
- **Refactor to limit repetition** - Abstract operations into separate classes/functions

## 🧪 Testing Standards

### Test Requirements

- **Create tests for all new features** (functions, classes, routes, etc.)
- **Update tests when logic changes**
- **Unit tests live next to code** in local `tests/` folders (see Project Architecture)
- **Integration tests live in project root** `/tests` folder (cross-component)
- **Include at least**: happy path, edge case, failure case

### For Requirement-Validating Tests

Include requirement ID in docstring:
```python
def test_feature():
    """
    Validates: REQ-F-XXX-001
    Acceptance Criteria: [specific criterion]
    """
```

### For Supporting Tests

Describe what code behavior is being tested:
```python
def test_helper_function():
    """Test that helper function handles edge cases correctly."""
```

## 📝 Style & Conventions

### General Guidelines

- **Google-style docstrings** for all public functions, classes, modules
- **Comment complex logic** with `# Reason:` prefix explaining the why
- **Keep documentation current** with implementation

## 🔄 Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring
- `test/*` - Test additions

### Commit Message Format

**NEVER** include "claude code" or "written by claude" in commit messages.

Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Example:**
```
feat(auth): add JWT token validation

- Implement token verification middleware
- Add expiration checking
- Update tests for token validation

Closes #123
```

## 📚 Documentation Standards

### Update Documentation When

- Interface changes (APIs, function signatures)
- New features added
- Breaking changes introduced
- Configuration updates
- Significant changes to implementation (algorithms, libraries, architecture, etc.)

### Key Documents

- **`README.md`** - Project overview, setup instructions
- **`docs/ARCHITECTURE.md`** - System architecture and design
- **`docs/INTERNAL_API.md`** - Module/class APIs
- **`docs/EXTERNAL_API.md`** - Service APIs
- **System design docs** - Detailed subsystem designs

## 🧠 AI Behavior Rules

### CRITICAL Guidelines

- **NEVER assume or guess** - Ask for clarification when uncertain
- **Always verify file paths** before using them
- **No hallucinated libraries** - Only use verified packages/modules
- **Consult project-manager at session start** to understand current status
- **Think before executing** - does the proposed plan make sense within the context of the project and the in-scope goals for the session? Consult the user for clarification when needed.
- **Keep `CLAUDE.md` updated** when adding new patterns or dependencies
- **Test your code** - No feature is complete without tests
- **Document your decisions** - Future developers (including yourself) will thank you

### Planning Best Practices

- Make a plan before coding
- Assess your confidence in executing the plan correctly in one shot, calling out any risks or concerns
- Use TodoWrite tool to track implementation steps
- Reference specific requirements for each task
- Break complex tasks into smaller, manageable steps
- When planning work over multiple tasks/sessions, capture this timeline in sessions, not calendar days

## ⚠️ Important Notes

### Requirements Validation vs Tests Passing

- **Tests pass** = Code works correctly
- **Requirements validated** = Acceptance criteria met with evidence
- Both are necessary, but validation proves customer value

### Session Completion Criteria

Each session must end with:
- Specific tasks completed
- Code reviewed (independent-reviewer)
- Tests pass and requirements validated (validation-gates)
- Documentation updated (documentation-manager)
- `PROJECT_PLAN.md` updated with progress (project-manager)
- Codebase in stable, working, tested, validated state

### Integration Reports

- **`VALIDATION_REPORT.md`**: Ongoing status - "REQ-F-AUTH-001 is validated ✓"
- **`INTEGRATION_REPORT_[PHASE].md`**: Phase completion narrative - "How we integrated feature xyz and validated end-to-end"
  - Only create integration reports at phase completion, not for individual tasks

_This document is a living guide. Update it as the project evolves and new patterns emerge._