# Testing Standards

## Two Test Types (BOTH REQUIRED)

### 1. Requirement-Validating Tests
**Purpose**: Directly verify requirement acceptance criteria

**Characteristics**:
- **MUST** reference requirement IDs in docstrings
- Tracked in `VALIDATION_REPORT.md` for requirements traceability
- Can be unit tests (component-level) or integration tests (system-level)
- Prove that requirements are met

**Location**:
- Unit tests: Next to code in local `tests/` folders
- Integration tests: In project root `/tests` folder

**Example**:
```python
def test_user_login_valid_credentials():
    """
    Validates: REQ-F-AUTH-001
    Acceptance Criteria: User can log in with valid credentials
    """
    response = auth_client.login(email="test@example.com", password="ValidPass123")
    assert response.status_code == 200
    assert "access_token" in response.json()
```

### 2. Supporting Tests
**Purpose**: Verify implementation correctness and code quality

**Characteristics**:
- Do NOT need requirement IDs in docstrings
- Must pass for CI/regression, but not tracked in validation report
- Typically unit tests living next to code
- Prove that code works correctly

**Example**:
```python
def test_password_hash_deterministic():
    """Test that password hashing is deterministic for same input."""
    hash1 = hash_password("test123")
    hash2 = hash_password("test123")
    assert hash1 == hash2
```

## Test Requirements

- **Create tests for all new features** (functions, classes, routes, etc.)
- **Update tests when logic changes**
- **Include at least**: happy path, edge case, failure case
- Both test types must pass, but only requirement-validating tests prove requirements are met

## Requirements Validation vs Tests Passing

- **Tests pass** = Code works correctly
- **Requirements validated** = Acceptance criteria met with evidence
- Both are necessary, but validation proves customer value

## Testing Commands (Planned)

### Python (Backend)
```bash
pytest                          # Run all tests
pytest tests/                   # Run integration tests only
pytest src/                     # Run unit tests only
pytest -v                       # Verbose output
pytest --cov                    # With coverage
```

### TypeScript (Frontend)
```bash
npm test                        # Run all tests
npm test -- --coverage          # With coverage
npm test -- --watch             # Watch mode
```

## MVP Testing Approach

**Primary Method**: Manual testing
- Browser compatibility: Chrome, Firefox, Safari, Brave (latest)
- Video format testing: Various MP4 files (different framerates, resolutions)
- Performance testing: On Raspberry Pi 4 with 1080p and 4K videos
- Sync testing: Validate frame-accurate sync with known test videos

**Future** (Post-MVP):
- Unit tests for sync offset calculations
- Integration tests for API endpoints
- E2E tests with Playwright or Cypress
- Performance benchmarks
- Automated browser compatibility tests
