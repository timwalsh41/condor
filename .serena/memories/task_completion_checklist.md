# Task Completion Checklist

## Session Completion Criteria

Each session must end with ALL of the following:

### 1. Code Implementation
- [ ] Specific tasks completed
- [ ] Code follows style guidelines (CLAUDE.md)
- [ ] Complex logic has comments with `# Reason:` prefix
- [ ] Public functions have Google-style docstrings

### 2. Testing
- [ ] **Requirement-validating tests** created (with requirement IDs in docstrings)
- [ ] **Supporting tests** created (for implementation correctness)
- [ ] All tests pass
- [ ] Tests cover: happy path, edge cases, failure cases

### 3. Agent Coordination
- [ ] **Independent-reviewer** reviewed code quality
- [ ] **Validation-gates** validated requirements (not just tests)
- [ ] **Documentation-manager** updated affected documentation
- [ ] **Project-manager** updated `PROJECT_PLAN.md` and `REQUIREMENTS.md`

### 4. Documentation
- [ ] Interface changes documented (if applicable)
- [ ] `README.md` updated (if needed)
- [ ] Architecture docs updated (if significant changes)
- [ ] PRP updated (if new learnings/discoveries)

### 5. Validation
- [ ] Requirements validated with evidence (not just tests passing)
- [ ] `VALIDATION_REPORT.md` updated with validation status
- [ ] Integration report created (if phase completion)

### 6. Final State
- [ ] Codebase in stable, working, tested, validated state
- [ ] No broken tests
- [ ] No compilation/linting errors
- [ ] Ready for next session or deployment

## Agent Discretion
- **May bypass full PM process** for trivial changes (typo fixes, minor docs updates)
- **ALWAYS trigger** for ALL other changes:
  - Independent review
  - Documentation updates
  - Requirements validation

## Commands to Run (When Implemented)

### Python/Backend
```bash
# Linting
ruff check .                    # Check for issues
ruff check --fix .              # Fix auto-fixable issues

# Testing
pytest                          # Run all tests
pytest --cov                    # With coverage

# Formatting
ruff format .                   # Format code
```

### TypeScript/Frontend (When Implemented)
```bash
# Type checking
npm run type-check              # TypeScript type checking

# Linting
npm run lint                    # ESLint check
npm run lint:fix                # Fix auto-fixable issues

# Testing
npm test                        # Run tests
npm test -- --coverage          # With coverage

# Build
npm run build                   # Production build
```

## Integration Points

**Create Integration Report when:**
- ✓ Phase completion (multiple components integrated)
- ✓ Components interact across interface boundaries
- ✓ Top-level requirements validated end-to-end

**Don't create Integration Report for:**
- ✗ Single component changes
- ✗ Bug fixes within existing boundaries
- ✗ Individual task completion (use VALIDATION_REPORT instead)
