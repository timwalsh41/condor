name: "Base PRP Template v2 - Context-Rich with Validation Loops"
description: |

## Purpose
Template optimized for AI agents to implement features with sufficient context, requirements traceability, and self-validation capabilities to achieve working code through iterative refinement.

## Core Principles
1. **Requirements First**: All work traces back to formal requirements in `REQUIREMENTS.md`
2. **Context is King**: Include ALL necessary documentation, examples, and caveats
3. **Validation Loops**: Provide executable tests/lints the AI can run and fix
4. **Information Dense**: Use keywords and patterns from the codebase
5. **Progressive Success**: Start simple, validate, then enhance
6. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Requirements Traceability

### Requirements Implemented by This PRP
List all requirement IDs from `REQUIREMENTS.md` that this PRP implements, for example:

```markdown
- **REQ-F-AUTH-001**: User Login Functionality
  - Acceptance Criteria implemented:
    - User can log in with valid email/password credentials
    - Invalid credentials return 401 error with appropriate message
    - Account locks after 5 failed login attempts
  - Test files: tests/test_auth_login.py
  
- **REQ-NF-P-001**: Response Time Requirements
  - Acceptance Criteria implemented:
    - Login response time < 200ms (99th percentile)
    - Database query time < 50ms average
  - Test files: tests/test_performance.py
  
- **REQ-NF-S-001**: Security Requirements
  - Acceptance Criteria implemented:
    - All authentication data transmitted over TLS 1.2+
    - Passwords hashed using bcrypt with cost factor 12
    - No sensitive data logged
  - Test files: tests/test_security.py
```

**IMPORTANT**: Every feature implemented in this PRP must trace back to specific requirements. Requirements drive what we build, and requirement-validating tests prove we built it correctly.

---

## Goal
[What needs to be built - be specific about the end state and desires]

## Why
- [Business value and user impact]
- [Integration with existing features]
- [Problems this solves and for whom]

## What
[User-visible behavior and technical requirements, referencing specific requirement IDs]

### Success Criteria (Requirements-Based)
Map to requirement acceptance criteria from `REQUIREMENTS.md`, e.g.:

- [ ] **REQ-F-AUTH-001**: User login functionality fully implemented
  - [ ] Valid credentials return JWT token
  - [ ] Invalid credentials return 401 error
  - [ ] Account lockout after 5 failed attempts
  
- [ ] **REQ-NF-P-001**: Performance requirements met
  - [ ] Login response time < 200ms (99th percentile)
  
- [ ] **REQ-NF-S-001**: Security requirements met
  - [ ] TLS encryption verified
  - [ ] Password hashing validated
  - [ ] No sensitive data in logs confirmed

**CRITICAL**: These are not just code completion criteria - they are requirement validation criteria.

## All Needed Context

### Documentation & References (list all context needed to implement the feature)
```yaml
# MUST READ - Include these in your context window

- file: REQUIREMENTS.md
  why: Formal requirements with acceptance criteria - source of truth
  requirements: [REQ-F-AUTH-001, REQ-NF-P-001, REQ-NF-S-001]

- url: [Official API docs URL]
  why: [Specific sections/methods you'll need]
  
- file: [path/to/example.py]
  why: [Pattern to follow, gotchas to avoid]
  
- doc: [Library documentation URL] 
  section: [Specific section about common pitfalls]
  critical: [Key insight that prevents common errors]

- docfile: [PRPs/ai_docs/file.md]
  why: [docs that the user has pasted in to the project]

```

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase
```bash

```

### Desired Codebase tree with files to be added and responsibility of file
```bash

```

### Known Gotchas of our codebase & Library Quirks
```python
# CRITICAL: [Library name] requires [specific setup]
# Example: FastAPI requires async functions for endpoints
# Example: This ORM doesn't support batch inserts over 1000 records
# Example: We use pydantic v2 and ...
```

## Implementation Blueprint

### Data models and structure

Create the core data models, we ensure type safety and consistency.
```python
Examples: 
 - orm models
 - pydantic models
 - pydantic schemas
 - pydantic validators

```

### list of tasks to be completed to fullfill the PRP in the order they should be completed

**CRITICAL**: Each task must reference the requirement(s) it implements.

```yaml
Task 1: Implement User Login Endpoint (REQ-F-AUTH-001)
Requirements: REQ-F-AUTH-001, REQ-NF-S-001
Acceptance Criteria:
  - Valid credentials return JWT token
  - Invalid credentials return 401 error
  
MODIFY src/existing_module.py:
  - FIND pattern: "class OldImplementation"
  - INJECT after line containing "def __init__"
  - PRESERVE existing method signatures

CREATE src/new_feature.py:
  - MIRROR pattern from: src/similar_feature.py
  - MODIFY class name and core logic
  - KEEP error handling pattern identical
  - REFERENCE: REQ-F-AUTH-001 in docstring

Task 2: Add Account Lockout Logic (REQ-F-AUTH-001)
Requirements: REQ-F-AUTH-001
Acceptance Criteria:
  - Account lockout after 5 failed attempts
  - Lockout duration configurable
  
CREATE src/auth/lockout.py:
  - Implement failed attempt tracking
  - Add lockout duration logic
  - REFERENCE: REQ-F-AUTH-001 in docstring

Task 3: Write Tests for Login Functionality (REQ-F-AUTH-001, REQ-NF-P-001)
Requirements: REQ-F-AUTH-001, REQ-NF-P-001
Acceptance Criteria: All requirement acceptance criteria have corresponding tests

CREATE tests/test_auth_login.py:
  - Test valid credentials (REQ-F-AUTH-001)
  - Test invalid credentials (REQ-F-AUTH-001)
  - Test account lockout (REQ-F-AUTH-001)
  - Test response time (REQ-NF-P-001)
  - Each test MUST reference requirement ID in docstring

...(...)

Task N: Validate Requirements (ALL)
Requirements: ALL from this PRP
Acceptance Criteria: All requirement acceptance criteria validated

VALIDATE using validation-gates agent:
  - Verify REQ-F-AUTH-001 acceptance criteria
  - Verify REQ-NF-P-001 performance threshold
  - Verify REQ-NF-S-001 security requirements
  - Update VALIDATION_REPORT.md with evidence
  - Create integration report if applicable

```


### Per task pseudocode as needed added to each task
```python

# Task 1: User Login Endpoint (REQ-F-AUTH-001)
# Pseudocode with CRITICAL details dont write entire code
async def login(credentials: LoginRequest) -> LoginResponse:
    """
    Implements: REQ-F-AUTH-001 - User Login Functionality
    Acceptance Criteria:
    - Valid credentials return JWT token
    - Invalid credentials return 401 error
    """
    # PATTERN: Always validate input first (see src/validators.py)
    validated = validate_credentials(credentials)  # raises ValidationError
    
    # REQ-F-AUTH-001: Check for account lockout
    if is_account_locked(validated.email):
        raise AccountLockedError()  # Returns 429 status
    
    # GOTCHA: This library requires connection pooling
    async with get_connection() as conn:  # see src/db/pool.py
        # Verify credentials against database
        user = await authenticate_user(validated, conn)
        
        if not user:
            # REQ-F-AUTH-001: Track failed attempt for lockout
            await record_failed_attempt(validated.email)
            raise UnauthorizedError()  # Returns 401
        
        # REQ-F-AUTH-001: Generate JWT token
        token = generate_jwt(user)  # see src/auth/jwt.py
        
        # REQ-NF-P-001: Ensure response time < 200ms
        # Database queries optimized with indexes (migration 003)
        
        return LoginResponse(access_token=token, token_type="bearer")
```

### Integration Points
```yaml
DATABASE:
  - migration: "Add column 'feature_enabled' to users table"
  - index: "CREATE INDEX idx_feature_lookup ON users(feature_id)"
  
CONFIG:
  - add to: config/settings.py
  - pattern: "FEATURE_TIMEOUT = int(os.getenv('FEATURE_TIMEOUT', '30'))"
  
ROUTES:
  - add to: src/api/routes.py  
  - pattern: "router.include_router(feature_router, prefix='/feature')"
```

## Validation Loop

**CRITICAL**: Validation is requirements-based, not just test-based. All requirement acceptance criteria must be verified.

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
ruff check src/new_feature.py --fix  # Auto-fix what's possible
mypy src/new_feature.py              # Type checking

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests - Comprehensive Coverage
**Two Categories of Tests:**

1. **Requirement-Validating Tests**: Directly verify requirement acceptance criteria
   - MUST reference requirement IDs in docstrings
   - Tracked in `VALIDATION_REPORT.md` for requirements traceability
   - Example: `test_login_valid_credentials()` validates REQ-F-AUTH-001

2. **Supporting Tests**: Verify implementation correctness and code quality
   - Do NOT need requirement IDs in docstrings
   - Must pass for CI/regression testing
   - Example: `test_password_hash_handles_unicode()` validates helper function behavior

**Both types are necessary and expected.** Supporting tests ensure code quality and catch regressions, while requirement-validating tests prove the system meets its formal requirements.

```python
# CREATE test_new_feature.py with both test types:

# ============================================
# REQUIREMENT-VALIDATING TESTS
# ============================================

def test_login_valid_credentials():
    """
    Validates: REQ-F-AUTH-001
    Acceptance Criteria: User can log in with valid credentials
    """
    response = client.post("/auth/login", json={"email": "test@example.com", "password": "ValidPass123"})
    assert response.status_code == 200
    assert result.token_type == "bearer"

def test_login_invalid_credentials():
    """
    Validates: REQ-F-AUTH-001
    Acceptance Criteria: Invalid credentials return 401 error
    """
    response = client.post("/auth/login", json={"email": "test@example.com", "password": "wrong"})
    assert exc.value.status_code == 401

def test_account_lockout():
    """
    Validates: REQ-F-AUTH-001
    Acceptance Criteria: Account lockout after 5 failed attempts
    """
    for _ in range(5):
        client.post("/auth/login", json={"email": "test@example.com", "password": "wrong"})
    response = client.post("/auth/login", json={"email": "test@example.com", "password": "ValidPass123"})
    assert exc.value.status_code == 429

def test_login_performance():
    """
    Validates: REQ-NF-P-001
    Acceptance Criteria: Login response time < 200ms (99th percentile)
    """
    times = [measure_login_time() for _ in range(100)]
    p99 = sorted(times)[98]
    assert p99 < 200, f"99th percentile {p99}ms exceeds 200ms threshold"

# ============================================
# SUPPORTING TESTS (Code Quality & Edge Cases)
# ============================================

def test_password_hash_deterministic():
    """Test that password hashing is deterministic for same input."""
    hash1 = hash_password("password123")
    hash2 = hash_password("password123")
    assert hash1 == hash2

def test_password_hash_handles_unicode():
    """Test password hashing with unicode characters."""
    password = "pāsswörd🔐"
    hashed = hash_password(password)
    assert verify_password(password, hashed)

def test_email_normalization():
    """Test that email addresses are normalized correctly."""
    assert normalize_email("Test@Example.COM") == "test@example.com"
    assert normalize_email(" user@domain.com ") == "user@domain.com"

def test_token_generation_uniqueness():
    """Test that generated tokens are unique."""
    token1 = generate_token(user_id=1)
    token2 = generate_token(user_id=1)
    assert token1 != token2
```

```bash
# Run and iterate until passing:
uv run pytest test_new_feature.py -v

# Expected: All tests pass (both requirement-validating and supporting tests)
# If failing: Read error, understand root cause, fix code, re-run
# NEVER mock to pass - validate real behavior
```

### Level 3: Integration Test (if applicable)
```bash
# Start the service
uv run python -m src.main --dev

# Test the endpoint
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "ValidPassword123"}'

# Expected: {"access_token": "...", "token_type": "bearer", "status": 200}
# If error: Check logs at logs/app.log for stack trace
```

### Level 4: Requirements Validation with validation-gates Agent
```bash
# Invoke validation-gates agent for requirements validation
# Provide:
#   - Requirement IDs: REQ-F-AUTH-001, REQ-NF-P-001, REQ-NF-S-001
#   - Test files: tests/test_auth_login.py, tests/test_performance.py
#   - Acceptance criteria to verify (from REQUIREMENTS.md)

# Expected outputs:
#   - VALIDATION_REPORT.md updated with requirement status
#   - All acceptance criteria verified
#   - Evidence documented (test results, performance metrics)
#   - Integration report created if major feature
```

## Final validation Checklist

**Requirements-Based Validation** (CRITICAL):
- [ ] All requirement IDs from this PRP have status "Validated" in VALIDATION_REPORT.md
- [ ] Each requirement acceptance criterion has been verified
- [ ] Evidence documented for each requirement validation
- [ ] Integration report created (if major feature completion)

**Code Quality**:
- [ ] All tests pass: `uv run pytest tests/ -v`
- [ ] No linting errors: `uv run ruff check src/`
- [ ] No type errors: `uv run mypy src/`
- [ ] Manual test successful: [specific curl/command]
- [ ] Error cases handled gracefully
- [ ] Logs are informative but not verbose (no sensitive data - REQ-NF-S-001)

**Traceability**:
- [ ] Code comments reference requirement IDs where applicable
- [ ] Test docstrings reference requirement IDs
- [ ] VALIDATION_REPORT.md links tests to requirements
- [ ] PROJECT_PLAN.md updated with requirement validation status

**Documentation**:
- [ ] Documentation updated if needed (by documentation-manager)
- [ ] API docs reflect current implementation
- [ ] README updated if setup changed

**CRITICAL**: Nothing is "done" until requirements are validated, not just tests passing.

---

## Anti-Patterns to Avoid
- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"  
- ❌ Don't ignore failing tests - fix them
- ❌ Don't use sync functions in async context
- ❌ Don't hardcode values that should be config
- ❌ Don't catch all exceptions - be specific
- ❌ **Don't implement code without a requirement** - everything traces directly or indirectly to REQUIREMENTS.md
- ❌ **Don't just make tests pass** - validate actual requirement acceptance criteria and supporting functionality
- ❌ **Don't mock tests to pass** - validate real behavior
- ❌ **Don't skip requirement traceability** - tests reference requirement IDs where relevant
- ❌ **Don't mark requirements validated without evidence** - document validation proof
````