# Product Requirements: Multi-Agent Research Assistant

## Document Control
- **Version**: 1.1
- **Last Updated**: 2025-10-08
- **Status**: Active
- **Project Phase**: Development

## Product Vision

### Overview
A command-line research assistant powered by AI that can search the web, summarize findings, and draft emails about research results. The system demonstrates multi-agent architecture with a primary research agent and a subordinate email drafting agent.

### Goals & Objectives
- Enable users to quickly research topics without manual web searching
- Automate email drafting for sharing research findings
- Demonstrate clean multi-agent system architecture
- Provide streaming responses for better user experience

### Stakeholders & Users
| Stakeholder | Role | Primary Needs |
|-------------|------|---------------|
| Knowledge Workers | Primary Users | Quick research capabilities, automated communication |
| Developers | Maintainers | Clear code structure, comprehensive tests, good documentation |
| System Administrators | Operators | Easy deployment, configuration, monitoring |

## Functional Requirements

### Authentication & API Integration (REQ-F-AUTH)

#### REQ-F-AUTH-001: Brave Search API Authentication
- **Description**: System must authenticate with Brave Search API to perform web searches
- **Priority**: Critical
- **Status**: Validated
- **User Story**: As a user, I need the system to search the web so that I can get current information
- **Acceptance Criteria**:
  - [x] API key loaded from environment variable (BRAVE_API_KEY)
  - [x] Authentication failure returns clear error message
  - [x] API key not logged or exposed in error messages
  - [x] Supports API key rotation without code changes
- **Dependencies**: None
- **Implementation Notes**: 
  - PRPs: PRPs/brave-search-integration.md
  - Files: src/tools/brave_search.py, src/config/settings.py
- **Validation**: 
  - Tests: tests/test_brave_search.py::test_api_authentication
  - Integration Report: validation/INTEGRATION_REPORT_SEARCH.md
  - Evidence: All tests pass, manual testing with invalid key shows proper error

#### REQ-F-AUTH-002: Gmail API OAuth2 Flow
- **Description**: System must authenticate with Gmail API using OAuth2 for draft creation
- **Priority**: Critical
- **Status**: Validated
- **User Story**: As a user, I want to create email drafts in my Gmail account
- **Acceptance Criteria**:
  - [x] OAuth2 flow initiated on first run
  - [x] Browser opens for authorization
  - [x] Token stored securely in credentials/token.json
  - [x] Token automatically refreshed when expired
  - [x] Clear error message if credentials.json missing
- **Dependencies**: None
- **Implementation Notes**:
  - PRPs: PRPs/gmail-integration.md
  - Files: src/tools/gmail_tool.py, src/config/settings.py
- **Validation**:
  - Tests: tests/test_gmail_tool.py::test_oauth_flow
  - Integration Report: validation/INTEGRATION_REPORT_EMAIL.md
  - Evidence: Manual OAuth tested, token refresh verified

### Search Functionality (REQ-F-SEARCH)

#### REQ-F-SEARCH-001: Web Search via Brave API
- **Description**: System can search the web using Brave Search API and return structured results
- **Priority**: Critical
- **Status**: Validated
- **User Story**: As a user, I want to search for information on any topic
- **Acceptance Criteria**:
  - [x] Search query submitted to Brave API
  - [x] Results returned with title, URL, description, relevance score
  - [x] Maximum 10 results per query (configurable)
  - [x] Rate limiting handled gracefully (2000 requests/month limit)
  - [x] Network errors handled with retry logic
- **Dependencies**: REQ-F-AUTH-001
- **Implementation Notes**:
  - PRPs: PRPs/brave-search-integration.md
  - Files: src/tools/brave_search.py, src/agents/research_agent.py
- **Validation**:
  - Tests: tests/test_brave_search.py::test_search_execution
  - Integration Report: validation/INTEGRATION_REPORT_SEARCH.md
  - Evidence: Tests verify result structure, rate limiting tested

#### REQ-F-SEARCH-002: Search Result Summarization
- **Description**: Research agent can summarize search results into coherent answer
- **Priority**: High
- **Status**: Validated
- **User Story**: As a user, I want summarized information, not just raw search results
- **Acceptance Criteria**:
  - [x] Multiple search results synthesized into summary
  - [x] Summary includes key findings
  - [x] Sources cited with URLs
  - [x] Irrelevant results filtered out
- **Dependencies**: REQ-F-SEARCH-001
- **Implementation Notes**:
  - PRPs: PRPs/research-agent.md
  - Files: src/agents/research_agent.py
- **Validation**:
  - Tests: tests/test_research_agent.py::test_summarization
  - Evidence: Manual testing shows coherent summaries with citations

### Email Functionality (REQ-F-EMAIL)

#### REQ-F-EMAIL-001: Email Draft Creation
- **Description**: Email agent can create Gmail drafts with proper MIME formatting
- **Priority**: High
- **Status**: Validated
- **User Story**: As a user, I want to create email drafts about my research
- **Acceptance Criteria**:
  - [x] Draft created in Gmail with subject and body
  - [x] Recipients (to, cc, bcc) supported
  - [x] MIME formatting correct (base64 encoded)
  - [x] Draft ID returned for verification
  - [x] Error handling for API failures
- **Dependencies**: REQ-F-AUTH-002
- **Implementation Notes**:
  - PRPs: PRPs/gmail-integration.md
  - Files: src/tools/gmail_tool.py, src/agents/email_agent.py
- **Validation**:
  - Tests: tests/test_gmail_tool.py::test_draft_creation
  - Integration Report: validation/INTEGRATION_REPORT_EMAIL.md
  - Evidence: Drafts visible in Gmail web interface

### Multi-Agent Orchestration (REQ-F-AGENT)

#### REQ-F-AGENT-001: Research Agent Delegates to Email Agent
- **Description**: Research agent can invoke email agent as a tool for draft creation
- **Priority**: High
- **Status**: Validated
- **User Story**: As a user, I want a single command to research and draft an email
- **Acceptance Criteria**:
  - [x] Research agent has email agent as registered tool
  - [x] Research context passed to email agent
  - [x] Token usage tracked across agents (ctx.usage pattern)
  - [x] Email agent result returned to research agent
  - [x] Errors from email agent handled gracefully
- **Dependencies**: REQ-F-SEARCH-002, REQ-F-EMAIL-001
- **Implementation Notes**:
  - PRPs: PRPs/multi-agent-system.md
  - Files: src/agents/research_agent.py, src/agents/email_agent.py
- **Validation**:
  - Tests: tests/test_multi_agent.py::test_agent_delegation
  - Integration Report: validation/INTEGRATION_REPORT_MULTI_AGENT.md
  - Evidence: End-to-end test: query → search → summarize → email draft

### User Interface (REQ-F-UI)

#### REQ-F-UI-001: Command-Line Interface
- **Description**: Users interact with system via command-line interface
- **Priority**: Critical
- **Status**: Validated
- **User Story**: As a user, I want a simple CLI to use the research assistant
- **Acceptance Criteria**:
  - [x] CLI accepts research queries as input
  - [x] Streaming responses displayed in real-time
  - [x] Tool usage visibility (shows which tools were called)
  - [x] Color-coded output for better readability
  - [x] Graceful exit on Ctrl+C
  - [x] Session management for conversation context
- **Dependencies**: REQ-F-AGENT-001
- **Implementation Notes**:
  - PRPs: PRPs/cli-interface.md
  - Files: cli.py
- **Validation**:
  - Tests: tests/test_cli.py
  - Evidence: Manual testing shows responsive CLI with streaming

---

## Non-Functional Requirements

### Performance (REQ-NF-P)

#### REQ-NF-P-001: Search Response Time
- **Description**: Search operations should complete within reasonable time
- **Priority**: High
- **Status**: Validated
- **Acceptance Criteria**:
  - [x] Brave API search completes in < 3 seconds (95th percentile)
  - [x] Timeout set to 30 seconds prevents hanging
  - [x] Async operations don't block UI updates
- **Measurement Method**: Performance tests with 100 search queries
- **Dependencies**: REQ-F-SEARCH-001
- **Validation**:
  - Tests: tests/test_performance.py::test_search_response_time
  - Benchmarks: 95th percentile = 2.1 seconds ✓
  - Evidence: validation/perf_results_search_2025-10-08.json

#### REQ-NF-P-002: Email Draft Creation Performance
- **Description**: Email draft creation should be responsive
- **Priority**: Medium
- **Status**: Validated
- **Acceptance Criteria**:
  - [x] Draft creation completes in < 2 seconds (95th percentile)
  - [x] Does not block during OAuth token refresh
- **Measurement Method**: Performance tests with 50 draft creations
- **Dependencies**: REQ-F-EMAIL-001
- **Validation**:
  - Tests: tests/test_performance.py::test_email_draft_performance
  - Benchmarks: 95th percentile = 1.7 seconds ✓

### Security (REQ-NF-S)

#### REQ-NF-S-001: API Key Protection
- **Description**: API keys and credentials must be protected from exposure
- **Priority**: Critical
- **Status**: Validated
- **Acceptance Criteria**:
  - [x] API keys loaded from environment variables, never hardcoded
  - [x] .env file excluded from version control (.gitignore)
  - [x] API keys not logged or included in error messages
  - [x] .env.example provided with placeholder values
- **Security Standards**: OWASP API Security Best Practices
- **Dependencies**: REQ-F-AUTH-001, REQ-F-AUTH-002
- **Validation**:
  - Tests: tests/test_security.py::test_no_secrets_in_logs
  - Audits: Manual code review, grep for sensitive patterns
  - Evidence: No API keys found in logs or error output

#### REQ-NF-S-002: OAuth Token Storage Security
- **Description**: OAuth tokens must be stored securely
- **Priority**: Critical
- **Status**: Validated
- **Acceptance Criteria**:
  - [x] Tokens stored in credentials/ directory
  - [x] credentials/ excluded from version control
  - [x] Token files have restricted permissions (600)
  - [x] Token refresh doesn't expose refresh token in logs
- **Security Standards**: OAuth 2.0 Security Best Practices
- **Dependencies**: REQ-F-AUTH-002
- **Validation**:
  - Tests: tests/test_security.py::test_token_file_permissions
  - Evidence: File permissions verified, .gitignore includes credentials/

### Reliability (REQ-NF-R)

#### REQ-NF-R-001: Network Error Handling
- **Description**: System handles network failures gracefully
- **Priority**: High
- **Status**: Validated
- **Acceptance Criteria**:
  - [x] Network timeouts handled with clear error messages
  - [x] API rate limits detected and reported to user
  - [x] Temporary failures trigger retry with exponential backoff
  - [x] Maximum 3 retry attempts before giving up
- **Dependencies**: REQ-F-SEARCH-001, REQ-F-EMAIL-001
- **Validation**:
  - Tests: tests/test_reliability.py::test_network_error_handling
  - Evidence: Tested with simulated network failures

### Maintainability (REQ-NF-M)

#### REQ-NF-M-001: Code Quality Standards
- **Description**: Code follows consistent quality standards
- **Priority**: High
- **Status**: Validated
- **Acceptance Criteria**:
  - [x] All code passes ruff linting with no errors
  - [x] Type hints used throughout (mypy passes)
  - [x] Test coverage > 80%
  - [x] Docstrings for all public functions/classes
  - [x] No files > 500 lines of code
- **Dependencies**: None
- **Validation**:
  - Tests: CI pipeline runs linting and type checking
  - Benchmarks: Coverage report shows 87% coverage ✓
  - Evidence: validation/code_quality_report_2025-10-08.txt

---

## Technical Constraints

### Technology Stack
- **Languages**: Python 3.11+
- **Frameworks**: Pydantic AI 0.0.14+, asyncio
- **APIs**: Brave Search API, Google Gmail API
- **Libraries**: 
  - httpx (async HTTP client)
  - google-api-python-client (Gmail)
  - pydantic (data validation)
  - python-dotenv (environment variables)
- **Development Tools**: pytest, ruff, mypy

### Platform Requirements
- **Operating Systems**: Linux, macOS, Windows (WSL)
- **Python Version**: 3.11 or higher
- **Deployment**: Command-line tool, local execution

### Technical Standards
- **Code Quality**: Follow PEP8, use ruff for linting
- **Testing Requirements**: Unit tests for all features, integration tests for workflows, >80% coverage
- **Documentation Standards**: Google-style docstrings, comprehensive README
- **Version Control**: Git with feature branches, conventional commits

---

## Integration Requirements

### External Systems

#### INT-001: Brave Search API
- **Description**: Web search functionality via Brave Search
- **Integration Type**: REST API
- **Authentication**: API key in X-Subscription-Token header
- **Data Flow**: Query (out) → Search results (in)
- **Requirements**: REQ-F-AUTH-001, REQ-F-SEARCH-001, REQ-NF-P-001
- **Documentation**: https://api-dashboard.search.brave.com/app/documentation
- **SLA/Rate Limits**: 2000 requests/month (free tier), < 5 second response time

#### INT-002: Google Gmail API
- **Description**: Email draft creation in Gmail
- **Integration Type**: REST API
- **Authentication**: OAuth 2.0 with refresh token
- **Data Flow**: Draft content (out) → Draft ID (in)
- **Requirements**: REQ-F-AUTH-002, REQ-F-EMAIL-001
- **Documentation**: https://developers.google.com/gmail/api/guides
- **SLA/Rate Limits**: 250 quota units per user per second

---

## Requirements Traceability Matrix

| Requirement ID | Title | Priority | Status | Dependencies | PRPs | Validated |
|----------------|-------|----------|--------|--------------|------|-----------|
| REQ-F-AUTH-001 | Brave API Auth | Critical | Validated | None | PRP-001 | ✓ 2025-10-08 |
| REQ-F-AUTH-002 | Gmail OAuth | Critical | Validated | None | PRP-002 | ✓ 2025-10-08 |
| REQ-F-SEARCH-001 | Web Search | Critical | Validated | REQ-F-AUTH-001 | PRP-001 | ✓ 2025-10-08 |
| REQ-F-SEARCH-002 | Summarization | High | Validated | REQ-F-SEARCH-001 | PRP-003 | ✓ 2025-10-08 |
| REQ-F-EMAIL-001 | Draft Creation | High | Validated | REQ-F-AUTH-002 | PRP-002 | ✓ 2025-10-08 |
| REQ-F-AGENT-001 | Multi-Agent | High | Validated | REQ-F-SEARCH-002, REQ-F-EMAIL-001 | PRP-004 | ✓ 2025-10-08 |
| REQ-F-UI-001 | CLI Interface | Critical | Validated | REQ-F-AGENT-001 | PRP-005 | ✓ 2025-10-08 |
| REQ-NF-P-001 | Search Performance | High | Validated | REQ-F-SEARCH-001 | PRP-001 | ✓ 2025-10-08 |
| REQ-NF-P-002 | Email Performance | Medium | Validated | REQ-F-EMAIL-001 | PRP-002 | ✓ 2025-10-08 |
| REQ-NF-S-001 | API Key Protection | Critical | Validated | REQ-F-AUTH-001, REQ-F-AUTH-002 | PRP-006 | ✓ 2025-10-08 |
| REQ-NF-S-002 | Token Security | Critical | Validated | REQ-F-AUTH-002 | PRP-002 | ✓ 2025-10-08 |
| REQ-NF-R-001 | Error Handling | High | Validated | REQ-F-SEARCH-001, REQ-F-EMAIL-001 | PRP-007 | ✓ 2025-10-08 |
| REQ-NF-M-001 | Code Quality | High | Validated | None | All PRPs | ✓ 2025-10-08 |

---

## Requirements Coverage Analysis

### Implementation Coverage
- **Total Requirements**: 13
- **Planned**: 0 (0%)
- **In Progress**: 0 (0%)
- **Implemented**: 0 (0%)
- **Validated**: 13 (100%)

### Priority Breakdown
- **Critical**: 6 - 100% Complete
- **High**: 6 - 100% Complete
- **Medium**: 1 - 100% Complete
- **Low**: 0 - N/A

### Requirements by Area
- **Authentication**: 2 - 100% Complete
- **Search**: 2 - 100% Complete
- **Email**: 1 - 100% Complete
- **Multi-Agent**: 1 - 100% Complete
- **UI**: 1 - 100% Complete
- **Non-Functional**: 6 - 100% Complete

---

## Change History

### Version 1.0 - 2025-10-01
**Initial Release - MVP Scope**

**Requirements Added:**
- REQ-F-AUTH-001: Brave Search API Authentication
- REQ-F-AUTH-002: Gmail API OAuth2 Flow
- REQ-F-SEARCH-001: Web Search via Brave API
- REQ-F-EMAIL-001: Email Draft Creation
- REQ-F-AGENT-001: Multi-Agent Orchestration
- REQ-F-UI-001: Command-Line Interface
- REQ-NF-P-001: Search Response Time
- REQ-NF-S-001: API Key Protection
- REQ-NF-S-002: OAuth Token Storage Security
- REQ-NF-R-001: Network Error Handling
- REQ-NF-M-001: Code Quality Standards

**Implementation Status:**
- All requirements in "Planned" status
- PRPs not yet generated

---

### Version 1.1 - 2025-10-08
**Added Summarization and Performance Requirements**

**Requirements Added:**
- REQ-F-SEARCH-002: Search Result Summarization
- REQ-NF-P-002: Email Draft Creation Performance

**Rationale:**
- Users requested summarized research results rather than raw search output
- Performance baseline needed for email draft creation

**Requirements Modified:**
None

**Requirements Deprecated:**
None

**Implementation Updates:**
- All requirements implemented and validated
- Implemented by: PRPs/research-agent.md (REQ-F-SEARCH-002), PRPs/performance-testing.md (REQ-NF-P-002)
- All PRPs executed successfully
- Validation complete: 13/13 requirements validated

**Impact Assessment:**
- **Breaking Changes**: No
- **Backward Compatibility**: Maintained - summarization is addition, not modification
- **Migration Required**: No
- **Testing Impact**: Added 2 new test files, extended integration tests

**Completion:**
- Project reached MVP completion
- All critical and high-priority requirements validated
- System ready for user acceptance testing
