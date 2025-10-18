# Development Workflow

## PRP (Product Requirements Prompt) Workflow

### Core Philosophy
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It
- **Dependency Inversion**: Depend on abstractions, not concretions
- **Single Responsibility**: One clear purpose per unit
- **Fail Fast**: Check errors early, raise exceptions immediately

### Workflow Commands

#### 1. `/generate-prp` Workflow
**Input**: `INITIAL.md` (design inputs)
**Output**: `REQUIREMENTS.md` + `PRPs/feature.md`

Creates formal requirements document and implementation plan (PRP) with requirement traceability.

#### 2. `/execute-prp` Workflow
**Input**: `PRPs/feature.md`
**Output**: Implementation with coordination

**Agent Coordination Steps:**
1. Project-manager creates/updates `PROJECT_PLAN.md`
2. Implement code with requirement references
3. Independent-reviewer reviews code quality
4. Validation-gates validates requirements (not just tests)
5. Documentation-manager updates docs
6. Project-manager updates plan with progress

#### 3. Session-Based Execution
**First session**: `/execute-prp` → project-manager briefing → implement tasks
**Subsequent sessions**: 
- Consult project-manager for session briefing
- Consult relevant PRP for implementation context
- Brief user and implement next priority tasks

### Key Artifacts
- **`PRPs/feature.md`**: Design guidelines, requirements, implementation approach, gotchas
- **`REQUIREMENTS.md`**: Formal requirements with IDs and acceptance criteria
- **`PROJECT_PLAN.md`**: Task coordination, phases, requirement traceability
- **`VALIDATION_REPORT.md`**: Ongoing requirement validation status
- **`INTEGRATION_REPORT_[PHASE].md`**: Phase completion validation narrative

### Important Reminders
- **ALWAYS activate Serena at session start**: `activate serena project`
- **Consult project-manager** at session start for briefing
- **Reference PRP throughout** implementation for patterns, gotchas, validation gates
- **Coordinate with subagents** for ALL changes (may bypass for trivial changes)

## Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring
- `test/*` - Test additions

### Commit Format
```
<type>(<scope>): <subject>

<body>

<footer>
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**NEVER** include "claude code" or "written by claude" in commit messages.
