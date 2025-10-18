# Product Requirements: [Project Name]

## Document Control
- **Version**: 1.0
- **Last Updated**: [Date]
- **Status**: Draft | Active | Archived
- **Project Phase**: Planning | Development | Testing | Production

## Product Vision

### Overview
[High-level description of what this product is and why it exists. What problem does it solve?]

### Goals & Objectives
- [Primary business/user goal 1]
- [Primary business/user goal 2]
- [Key success metric]

### Stakeholders & Users
| Stakeholder | Role | Primary Needs |
|-------------|------|---------------|
| [User Type 1] | [Description] | [What they need from the system] |
| [User Type 2] | [Description] | [What they need from the system] |

## Functional Requirements

### [Feature Area 1: e.g., Authentication]

#### REQ-F-AUTH-001: [Requirement Title]
- **Description**: [Clear, concise description of what the system must do]
- **Priority**: Critical | High | Medium | Low
- **Status**: Planned | In Progress | Implemented | Validated
- **User Story**: As a [user type], I want to [action] so that [benefit]
- **Acceptance Criteria**:
  - [ ] [Specific, testable criterion 1]
  - [ ] [Specific, testable criterion 2]
  - [ ] [Edge case or error condition]
- **Dependencies**: [Other requirement IDs this depends on, or "None"]
- **Implementation Notes**: 
  - PRPs: [References to PRPs implementing this]
  - Files: [Key implementation files]
- **Validation**: 
  - Tests: [Test files validating this requirement]
  - Integration Report: [Reference if applicable]

#### REQ-F-AUTH-002: [Another Requirement]
[Follow same structure...]

### [Feature Area 2: e.g., API]

#### REQ-F-API-001: [Requirement Title]
[Follow same structure...]

---

## Non-Functional Requirements

### Performance (REQ-NF-P)

#### REQ-NF-P-001: [Performance Requirement]
- **Description**: [Specific performance requirement]
- **Priority**: Critical | High | Medium | Low
- **Status**: Planned | In Progress | Implemented | Validated
- **Acceptance Criteria**:
  - [ ] [Measurable performance criterion with specific threshold]
  - [ ] [Performance under load conditions]
- **Measurement Method**: [How this will be measured/tested]
- **Dependencies**: [Related requirements]
- **Validation**:
  - Tests: [Performance test files]
  - Benchmarks: [Performance test results]

### Security (REQ-NF-S)

#### REQ-NF-S-001: [Security Requirement]
- **Description**: [Security requirement]
- **Priority**: Critical | High | Medium | Low
- **Status**: Planned | In Progress | Implemented | Validated
- **Acceptance Criteria**:
  - [ ] [Security criterion]
  - [ ] [Compliance requirement]
- **Security Standards**: [OWASP, SOC2, etc.]
- **Dependencies**: [Related requirements]
- **Validation**:
  - Tests: [Security test files]
  - Audits: [Security audit reports]

### Scalability (REQ-NF-SC)

#### REQ-NF-SC-001: [Scalability Requirement]
- **Description**: [Scalability requirement]
- **Priority**: Critical | High | Medium | Low
- **Status**: Planned | In Progress | Implemented | Validated
- **Acceptance Criteria**:
  - [ ] [Scalability criterion with specific thresholds]
- **Dependencies**: [Related requirements]
- **Validation**:
  - Tests: [Load/stress test files]

### Usability (REQ-NF-U)

#### REQ-NF-U-001: [Usability Requirement]
- **Description**: [Usability requirement]
- **Priority**: Critical | High | Medium | Low
- **Status**: Planned | In Progress | Implemented | Validated
- **Acceptance Criteria**:
  - [ ] [Usability criterion]
- **Dependencies**: [Related requirements]
- **Validation**:
  - Method: [How usability will be validated]

---

## Technical Constraints

### Technology Stack
- **Languages**: [Python 3.11, TypeScript 5.0, etc.]
- **Frameworks**: [FastAPI, React, etc.]
- **Databases**: [PostgreSQL, Redis, etc.]
- **Infrastructure**: [AWS, Docker, Kubernetes, etc.]
- **Third-party Services**: [Stripe, SendGrid, etc.]

### Platform Requirements
- **Operating Systems**: [Linux, Windows, macOS]
- **Browser Support**: [Chrome 90+, Firefox 88+, Safari 14+]
- **Mobile Platforms**: [iOS 14+, Android 10+]
- **Deployment Targets**: [Cloud, on-premises, hybrid]

### Technical Standards
- **Code Quality**: [PEP8, ESLint rules, etc.]
- **Testing Requirements**: [Minimum coverage, test types]
- **Documentation Standards**: [Docstring format, API docs]
- **Version Control**: [Git workflow, branch strategy]

---

## Integration Requirements

Integration requirements define how components, subsystems, or external systems interact through well-defined interfaces. The integration type indicates who controls the interface and helps guide validation approach.

### Internal Integration

#### INT-001: [Internal Integration Name]
- **Type**: Internal
- **Integration Scope**: [e.g., "Backend subsystem integration: Auth module ↔ User module"]
- **Description**: [What integration is needed and why]
- **Interface Contract**: [How components communicate - API, function calls, shared memory, etc.]
- **Controlled By**: Our team (internal)
- **Components**: [List of components/modules involved]
- **Data Flow**: [What data flows between components]
- **Requirements**: [Related functional/non-functional requirement IDs]
- **Dependencies**: [Other requirements or integrations this depends on]
- **Validation Approach**: [How this integration will be tested]

#### INT-002: [Another Internal Integration]
- **Type**: Internal
- **Integration Scope**: [e.g., "Frontend-Backend integration via REST API"]
- **Description**: [What integration is needed and why]
- **Interface Contract**: [OpenAPI spec, gRPC proto, etc.]
- **Controlled By**: Our team (internal)
- **Components**: [List of components/modules involved]
- **Data Flow**: [What data flows between components]
- **Requirements**: [Related functional/non-functional requirement IDs]
- **Dependencies**: [Other requirements or integrations this depends on]
- **Validation Approach**: [How this integration will be tested]

### External Integration

#### INT-003: [External System Name]
- **Type**: External
- **Integration Scope**: [e.g., "Third-party payment processing"]
- **Description**: [What system and why integration is needed]
- **Interface Contract**: [REST API version, SDK version, protocol spec]
- **Controlled By**: [Third-party name] (external)
- **Integration Method**: REST API | GraphQL | Message Queue | Database | SDK | Other
- **Authentication**: [API key, OAuth2, etc.]
- **Data Flow**: [What data flows in/out]
- **Requirements**: [Related functional/non-functional requirement IDs]
- **Documentation**: [Links to external API docs]
- **SLA/Rate Limits**: [Performance expectations, rate limits, availability SLA]
- **Error Handling**: [How external system failures are handled]
- **Dependencies**: [Other requirements or integrations this depends on]
- **Validation Approach**: [How this integration will be tested - may need mocks/stubs]

#### INT-004: [Another External System]
[Follow same structure...]

---

**Integration Requirement Examples:**

*Internal - Cloud Web Application:*
```markdown
#### INT-001: Frontend-Backend API Integration
- **Type**: Internal
- **Integration Scope**: React frontend ↔ FastAPI backend
- **Description**: Frontend communicates with backend via REST API for all data operations
- **Interface Contract**: OpenAPI 3.0 specification (api/openapi.yaml)
- **Controlled By**: Our team (internal)
- **Components**: React app, FastAPI backend, API gateway
- **Data Flow**: HTTP requests/responses with JSON payloads
- **Requirements**: REQ-F-AUTH-001, REQ-F-USER-001, REQ-NF-P-001
- **Validation Approach**: Integration tests with real HTTP calls, contract testing
```

*Internal - Embedded System:*
```markdown
#### INT-002: Sensor-Processor Data Pipeline
- **Type**: Internal
- **Integration Scope**: Sensor driver ↔ Data processor module
- **Description**: Sensor driver provides raw data to processor via shared memory buffer
- **Interface Contract**: C header file (sensor_interface.h) with struct definitions
- **Controlled By**: Our team (internal)
- **Components**: SensorDriver, DataProcessor, SharedMemoryManager
- **Data Flow**: Sensor samples written to circular buffer, processor reads and processes
- **Requirements**: REQ-F-SENS-001, REQ-NF-P-002 (timing constraints)
- **Validation Approach**: Integration test with actual sensor hardware, timing validation
```

*External - Payment Integration:*
```markdown
#### INT-003: Stripe Payment Processing
- **Type**: External
- **Integration Scope**: Backend payment service ↔ Stripe API
- **Description**: Process customer payments via Stripe payment gateway
- **Interface Contract**: Stripe API v2023-10-16 (REST)
- **Controlled By**: Stripe (external)
- **Integration Method**: REST API via Stripe Python SDK
- **Authentication**: API keys (test/production)
- **Data Flow**: Payment intents, charges, webhooks for payment events
- **Requirements**: REQ-F-PAY-001, REQ-NF-S-002 (PCI compliance)
- **Documentation**: https://stripe.com/docs/api
- **SLA/Rate Limits**: 100 requests/second, 99.99% uptime
- **Error Handling**: Retry logic with exponential backoff, fallback error messages
- **Validation Approach**: Integration tests with Stripe test mode, webhook testing
```

---

## Requirements Traceability Matrix

| Requirement ID | Title | Priority | Status | Dependencies | PRPs | Validated |
|----------------|-------|----------|--------|--------------|------|-----------|
| REQ-F-AUTH-001 | User login | Critical | Implemented | None | PRP-001 | ✓ |
| REQ-F-AUTH-002 | Password reset | High | In Progress | REQ-F-AUTH-001 | PRP-002 | - |
| REQ-F-API-001 | Search endpoint | High | Planned | REQ-F-AUTH-001 | - | - |
| REQ-NF-P-001 | Response time | Critical | Implemented | REQ-F-AUTH-001 | PRP-001 | ✓ |
| REQ-NF-S-001 | Encryption | Critical | Implemented | REQ-F-AUTH-001 | PRP-001 | ✓ |

---

## Requirements Coverage Analysis

### Implementation Coverage
- **Total Requirements**: [Count]
- **Planned**: [Count and %]
- **In Progress**: [Count and %]
- **Implemented**: [Count and %]
- **Validated**: [Count and %]

### Priority Breakdown
- **Critical**: [Count] - [% Complete]
- **High**: [Count] - [% Complete]
- **Medium**: [Count] - [% Complete]
- **Low**: [Count] - [% Complete]

### Requirements by Area
- **Authentication**: [Count] - [% Complete]
- **API**: [Count] - [% Complete]
- **Performance**: [Count] - [% Complete]
- **Security**: [Count] - [% Complete]

---

## Change History

### Version 1.0 - [Date]
**Initial Release**
- Created initial requirements document
- Defined MVP scope
- Established requirement ID scheme

**Requirements Added:**
- REQ-F-AUTH-001: User login functionality
- REQ-F-AUTH-002: Password reset
- REQ-F-API-001: Search endpoint
- REQ-NF-P-001: Response time requirements
- REQ-NF-S-001: Data encryption

**Implementation Status:**
- All requirements in "Planned" status
- No PRPs generated yet

---

### Version 1.1 - [Date]
**[Change Description]**

**Requirements Added:**
- [REQ-ID]: [Brief description]

**Requirements Modified:**
- [REQ-ID]: [What changed and why]
  - **Previous**: [Old requirement description]
  - **Updated**: [New requirement description]
  - **Rationale**: [Why the change was made]
  - **Impact**: [What existing code/tests need to change]

**Requirements Deprecated:**
- [REQ-ID]: [What requirement is deprecated and why]
  - **Replacement**: [New requirement ID if applicable]
  - **Migration Path**: [How to transition from old to new]

**Implementation Updates:**
- Implemented by: PRPs/[feature-name].md
- Tasks completed: [Task IDs from PROJECT_PLAN.md]
- Validated: [Date of validation]

**Impact Assessment:**
- **Breaking Changes**: Yes/No - [Description if yes]
- **Backward Compatibility**: Maintained/Lost - [Details]
- **Migration Required**: Yes/No - [Migration steps if yes]
- **Testing Impact**: [New tests needed, regression testing required]

---

## Requirement ID Scheme

### Format
`REQ-[Type]-[Area]-[Number]`

### Types
- **F**: Functional requirement
- **NF**: Non-functional requirement

### Non-Functional Subtypes
- **P**: Performance
- **S**: Security
- **SC**: Scalability
- **U**: Usability
- **R**: Reliability
- **M**: Maintainability

### Areas (Examples)
- **AUTH**: Authentication & Authorization
- **API**: API/Endpoints
- **UI**: User Interface
- **DB**: Database
- **INT**: Integration
- **CORE**: Core Business Logic

### Numbering
- Sequential within each area
- Zero-padded to 3 digits (001, 002, etc.)
- Never reuse deprecated requirement IDs

### Examples
- `REQ-F-AUTH-001`: First functional requirement for authentication
- `REQ-NF-P-001`: First performance non-functional requirement
- `REQ-F-API-042`: Forty-second functional requirement for API

---

## Notes for AI Agents

### When Creating Requirements (via /generate-prp)
1. Read existing `REQUIREMENTS.md` to understand current state
2. Assign new requirement IDs following the scheme
3. Set appropriate priorities based on user input and dependencies
4. Write specific, testable acceptance criteria
5. Mark new requirements as "Planned" status
6. Update traceability matrix
7. Add entry to change history
8. Bump version number appropriately (semantic versioning)

### When Implementing Requirements (via /execute-prp)
1. Reference specific requirement IDs in code comments
2. Map tests to requirement acceptance criteria
3. **Project manager updates requirement status** as work progresses (Planned → In Progress → Implemented → Validated)
4. Link PRPs to requirements in "Implementation Notes" section
5. Update traceability matrix status column after each session
6. Update requirements coverage analysis periodically

### When Validating Requirements (validation-gates agent)
1. Verify all acceptance criteria are met
2. Report validation results to top-level agent
3. **Top-level agent reports to project manager, who updates requirement status in REQUIREMENTS.md to "Validated"**
4. Record validation evidence in `VALIDATION_REPORT.md`
5. Update validation reports with requirement traceability

### Requirement Status Lifecycle
1. **Planned**: Requirement defined, not yet assigned to task
2. **In Progress**: Task implementing requirement is active
3. **Implemented**: Code written, tests pass, not yet validated
4. **Validated**: All acceptance criteria met, independently verified

### Guidelines for Good Requirements
- **Specific**: Clearly defined, no ambiguity
- **Measurable**: Can be validated with specific tests
- **Achievable**: Realistic given constraints
- **Relevant**: Aligns with product vision
- **Testable**: Acceptance criteria can be verified
- **Traceable**: Clear links to implementation and tests
