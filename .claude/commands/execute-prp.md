# Execute PRP

Implement features using the PRP file through a structured, session-based execution model with requirements traceability and comprehensive validation.

## PRP File: $ARGUMENTS

## Execution Process

### Step 1: Invoke Project Manager for Plan Integration
**CRITICAL FIRST STEP**: Before any implementation, the project manager must integrate the PRP into the overall project plan (note this may have happened already in a prior session if this is not a new PRP).

**Use the project-manager subagent** to review this PRP and integrate into the project plan if needed:
   - Provide PRP file path: $ARGUMENTS
   - Request `PROJECT_PLAN.md` creation or review & update
   
**Project Manager will:**
   - On first session with new PRP:
      - Read PRP and `REQUIREMENTS.md`
      - Create `PROJECT_PLAN.md` (if new project) or update it (if existing)
      - Break PRP into session-sized tasks, referencing the relevant PRP for each task in the plan
      - Establish task-to-requirement mapping
   - Determine scope (tasks) for current session
   - Generate session briefing for the current session
   
**Receive from Project Manager:**
   - Session briefing with priority tasks for this session
   - Requirement IDs to implement
   - Context links (requirements, design docs)
   - Key considerations and risks

### Step 2: Load Context & Understand Requirements

1. **Load PRP**
   - Read the specified PRP file completely
   - Understand all context and requirements
   - Note requirement IDs this PRP implements
   - Follow all instructions in the PRP and extend research if needed
   
2. **Load Requirements**
   - Read `REQUIREMENTS.md` for detailed acceptance criteria
   - Understand each requirement's acceptance criteria
   - Note non-functional requirements (performance, security, etc.)
   - Check requirement dependencies
   
3. **Ensure Complete Context**
   - Do more web searches if needed
   - Explore codebase for patterns
   - Gather all needed context to implement fully

### Step 3: ULTRATHINK & Plan

1. **Deep Planning**
   - Think hard before executing
   - Create comprehensive plan addressing all requirements
   - Break down complex tasks into smaller, manageable steps
   
2. **Use Todo Tool**
   - Use `TodoWrite` tool to create and track implementation plan
   - Each todo should reference specific requirement(s)
   - Include validation steps in todos
   
3. **Identify Patterns**
   - Find implementation patterns from existing code to follow
   - Note testing patterns to replicate
   - Understand validation approach

### Step 4: Review with User

**IMPORTANT**: Review the session plan and implementation approach with the user:
- Concisely (<100 lines) summarize the session plan and design approach
- Resolve any user questions, and adjust the plan as needed
- Receive explicit approval from the user to proceed to the next step

### Step 5: Execute Implementation

1. **Implement the Code**
   - Execute the PRP step by step
   - Reference requirement IDs in code comments where applicable
   - Follow patterns identified in research
   - Implement all components per plan
   
2. **Write Comprehensive Tests**

   **Two Categories of Tests:**
   
   a. **Requirement-Validating Tests**: Directly verify requirement acceptance criteria
      - MUST reference requirement IDs in docstrings for traceability
      - These tests prove the system meets its formal requirements
      - Tracked in `VALIDATION_REPORT.md` for requirements traceability
      - Example: Testing user login with valid credentials validates REQ-F-AUTH-001
   
   b. **Supporting Tests**: Verify implementation correctness and code quality
      - Do NOT need requirement IDs in docstrings
      - Must pass for CI/regression testing
      - Cover edge cases, helper functions, internal logic
      - Example: Testing password hash function handles unicode characters
   
   **Both types are necessary and expected.** Supporting tests ensure code quality, while requirement-validating tests prove requirements are met.

   Example with both test types:
   
   ```python
   # ============================================
   # REQUIREMENT-VALIDATING TESTS
   # ============================================
   
   def test_user_login():
       """
       Validates: REQ-F-AUTH-001
       Acceptance Criteria: User can log in with valid credentials
       """
       # Test implementation validating the requirement
       
   def test_account_lockout():
       """
       Validates: REQ-F-AUTH-001
       Acceptance Criteria: Account locks after 5 failed attempts
       """
       # Test implementation validating the requirement
   
   # ============================================
   # SUPPORTING TESTS (Code Quality & Edge Cases)
   # ============================================
   
   def test_password_hash_deterministic():
       """Test that password hashing is deterministic for same input."""
       # Supporting test - no requirement ID needed
       
   def test_email_normalization_edge_cases():
       """Test email normalization handles various edge cases."""
       # Supporting test - validates helper function
   ```

### Step 6: Validate Against Requirements

**Use the validation-gates subagent** to validate that requirements are met:
   - Provide requirement IDs being implemented
   - Specify acceptance criteria to validate
   - Request requirement-based validation (not just test passing)
   
**Validation Gates will:**
   - Run all validation commands from PRP
   - Verify each requirement acceptance criterion
   - Check integration points
   - Measure non-functional requirements (performance, security)
   - Ensure all tests pass (requirement-validating AND supporting tests)
   - Update `VALIDATION_REPORT.md` with requirement validation status (tracking requirement-validating tests)
   - **At phase completion**: Create `INTEGRATION_REPORT_[PHASE_NAME].md` documenting:
     - Components/subsystems integrated
     - Interface boundaries tested
     - End-to-end validation results
     - Top-level requirements validated
   
**Iterate Until Requirements Met:**
   - Review validation results
   - Fix any failures
   - Re-run validation with validation-gates subagent
   - Continue until all requirement acceptance criteria validated
   - Don't just make tests pass - validate requirements are met

**Phase Completion Check:**
   - If this completes a project phase, ensure integration report is created
   - Verify all phase requirements are validated
   - Confirm system is in stable, integrated state

### Step 7: Review & Documentation

**Use the independent-reviewer subagent** to review code quality:
   - Request comprehensive code review
   - Highlight requirement implementations
   - Note any requirement-related design decisions
   - Iterate as needed to resolve concerns with implementation, escalating any unresolved questions to the user
   - Receive review summary with findings

**Use the documentation-manager subagent** to update documentation:
   - Provide code changes summary
   - Note requirements implemented
   - Request documentation updates for all affected files
   - Receive documentation update summary
   
**Incorporate Feedback:**
   - Address review findings from independent-reviewer
   - Verify documentation updates are complete
   - Re-validate with validation-gates subagent if changes made

### Step 8: Update Project Plan & Complete Session

**Use the project-manager subagent** to summarize the session and update the plan:
   - Report tasks completed with requirement IDs
   - Provide requirement validation status from validation-gates
   - Note if phase completion occurred (with integration report)
   - Identify any blockers or new discoveries
   - Recommend next session priorities
   
**Project Manager will:**
   - Update task statuses in `PROJECT_PLAN.md`
   - Coordinate requirement status updates in `REQUIREMENTS.md`
   - Update task-to-requirement mapping
   - Mark phase complete if integration checkpoint reached
   - Prepare next session briefing (if work remains)
   - Add change log entry

**Ensure Session Completion:**
   - All session tasks complete
   - Code reviewed and approved
   - Tests pass and requirements validated
   - If phase complete: integration report exists and all phase requirements validated
   - Documentation current
   - `PROJECT_PLAN.md` updated
   - Codebase in stable, working state

### Step 9: Final Verification

1. **Read PRP Again**
   - Ensure all items implemented
   - Check all requirement IDs addressed
   - Verify success criteria met
   
2. **Run Final Validation Suite**
   - All tests pass (requirement-validating and supporting tests)
   - All requirements validated (acceptance criteria met)
   - No regressions introduced
   - Integration points verified
   - If phase complete: integration report exists and is complete
   
3. **Report Completion Status**
   - Requirements implemented and validated
   - Validation report updated
   - Integration report created (if phase complete)
   - Documentation current
   - Phase status (in progress or completed)
   - Ready for next session or completion

## Session-Based Execution Model

### What is a "Session"?
A session represents one Claude Code conversation where:
- Specific tasks from `PROJECT_PLAN.md` are implemented
- Code is written, reviewed, tested, documented, and validated
- `PROJECT_PLAN.md` is updated with progress
- Codebase is left in stable, working state
- Context window usage stays under ~60%

### Multi-Session Implementation

The project manager coordinates updates and execution of the project plan, which may consist of several individual PRPs across the term of the project, through multiple coding execution sessions.

For each session:
1. Consult project-manager subagent to provide list of tasks for the session
2. Receive session briefing
3. Implement the tasks
4. Review with independent-reviewer subagent
5. Validate with validation-gates subagent
6. Update docs with documentation-manager subagent
7. Update plan with project-manager subagent

### Session Scope Guidelines
Each session should:
- Implement 1-3 related tasks
- Validate specific requirements
- Produce working, tested code
- Update all documentation
- Leave clear handoff for next session

### PRP as Living Implementation Guide

**The PRP file remains your authoritative implementation reference across ALL sessions addressing the current feature set:**

**Why the PRP Matters:**
- Contains researched patterns from codebase analysis
- Documents gotchas and pitfalls to avoid
- Specifies validation gates that verify requirements
- Links to external documentation and examples
- Provides requirement acceptance criteria context

**PRP Complements PROJECT_PLAN.md:**
- **PRP**: Implementation wisdom (patterns, gotchas, validation approach)
- **PROJECT_PLAN.md**: Task coordination (priorities, dependencies, status)
- **Both are needed** for successful multi-session implementation

**If PRP needs updates:**
- Discoveries during implementation may warrant PRP updates
- Consult user before modifying PRP
- Document rationale for changes
- Prompt project manager to update `PROJECT_PLAN.md` to reference updated PRP sections

## Reference the PRP
You can always reference the PRP again if needed throughout implementation.

## Coordination with Sub-Agents

### Project Manager (project-manager subagent)
- **Session Start**: Use subagent to receive briefing and priorities
- **During Session**: Use subagent to consult on scope questions
- **Session End**: Use subagent to report progress and update plan

### Validation Gates (validation-gates subagent)
- **After Implementation**: Use subagent to validate requirements, not just tests
- **Provide**: Requirement IDs and acceptance criteria
- **Receive**: Validation status, evidence, and updated `VALIDATION_REPORT.md`

### Independent Reviewer (independent-reviewer subagent)
- **After Implementation**: Use subagent to request code review
- **Highlight**: Requirement implementations
- **Incorporate**: Review feedback from `REVIEW_SUMMARY_*.md`

### Documentation Manager (documentation-manager subagent)
- **After Implementation**: Use subagent to update docs
- **Provide**: Changes summary and requirements implemented
- **Ensure**: Documentation reflects current state

## Important Notes

- **Requirements First**: Everything traces back to `REQUIREMENTS.md`
- **Validation is Requirements-Based**: Not just "tests pass" but "requirements validated"
- **Session State**: Each session ends with stable, working code
- **No Shortcuts**: Review, validate, document - every time
- **Traceability**: Maintain clear links from code → tests → requirements

Remember: If validation fails, use error patterns in PRP to fix and retry. Nothing is "done" until requirements are validated and `PROJECT_PLAN.md` is updated.
