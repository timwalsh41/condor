# Create Requirements & PRP

## Design inputs file: $ARGUMENTS

Generate formal requirements document (`REQUIREMENTS.md`) and comprehensive PRP for feature implementation. This command handles both new projects (no existing requirements) and updates to existing projects (extending/modifying requirements).

The command creates/updates `REQUIREMENTS.md` with formal requirements including IDs, acceptance criteria, and traceability, then generates a PRP that references these requirements for implementation.

## Execution Process

### Step 1: Determine Context
1. **Check for existing `REQUIREMENTS.md`**
   - If exists: This is an update/addition to existing project
   - If not: This is a new project

2. **Read design inputs**
   - Parse $ARGUMENTS file (typically `INITIAL.md` or similar)
   - Extract feature descriptions, examples, documentation references
   - Understand user intent and constraints

### Step 2: Requirements Generation/Update

**For New Projects (no existing `REQUIREMENTS.md`):**
1. **Extract Requirements from Design Inputs**
   - Identify functional requirements (what system must do)
   - Identify non-functional requirements (performance, security, etc.)
   - Define user stories and acceptance criteria
   - Establish priorities based on MVP scope

2. **Assign Requirement IDs**
   - Follow scheme: REQ-[Type]-[Area]-[Number]
   - Types: F (Functional), NF (Non-Functional with subtypes P/S/SC/U)
   - Areas: AUTH, API, UI, DB, etc. based on feature domains
   - Number: Sequential, zero-padded to 3 digits

3. **Create REQUIREMENTS.md**
   - Use template from `.claude/doc-templates/REQUIREMENTS_TEMPLATE.md`
   - See example at `examples/EXAMPLE_REQUIREMENTS.md`
   - Fill in product vision and stakeholders
   - Add all identified requirements with:
     - Clear descriptions
     - Priorities (Critical/High/Medium/Low)
     - Status: "Planned" for all new requirements
     - Specific, testable acceptance criteria
     - Dependencies between requirements
   - Set version to 1.0
   - Document initial creation in change history

**For Existing Projects (updating REQUIREMENTS.md):**
1. **Read Current Requirements**
   - Load existing `REQUIREMENTS.md`
   - Review current requirement IDs and version
   - Understand existing feature areas

2. **Identify Changes from Design Inputs**
   - New requirements to add
   - Existing requirements to modify
   - Requirements to deprecate (if applicable)

3. **Update REQUIREMENTS.md**
   - **Add new requirements**:
     - Assign next available IDs in appropriate areas
     - Mark status as "Planned"
     - Link dependencies to existing requirements
   - **Modify existing requirements**:
     - Keep same requirement ID
     - Update description and acceptance criteria
     - Document rationale for change
     - Mark status appropriately (may go back to "Planned" if major change)
   - **Deprecate requirements** (if needed):
     - Mark as deprecated, don't delete
     - Reference replacement requirement if applicable
     - Document migration path
   - **Update Change History**:
     - Bump version (semantic versioning: major.minor)
     - Document all changes with rationale
     - Note impact on existing implementation
   - **Update Traceability Matrix**:
     - Add rows for new requirements
     - Update status for modified requirements

### Step 3: Research Phase

1. **Codebase Analysis** (if existing project)
   - Search for similar features/patterns in the codebase
   - Identify files to reference in PRP
   - Note existing conventions to follow
   - Check test patterns for validation approach
   - Find examples of requirement implementation

2. **External Research**
   - Search for similar features/patterns online
   - Library documentation (include specific URLs)
   - Implementation examples (GitHub/StackOverflow/blogs)
   - Best practices and common pitfalls
   - Security considerations for requirements

3. **User Clarification** (if needed)
   - Specific patterns to mirror and where to find them?
   - Integration requirements and where to find them?
   - Acceptance criteria unclear?

### Step 4: PRP Generation

Using PRPs/templates/prp_base.md as template:

#### Critical Context to Include
- **Requirements Traceability**: List specific requirement IDs this PRP implements
- **Acceptance Criteria**: Map PRP tasks to requirement acceptance criteria
- **Documentation**: URLs with specific sections
- **Code Examples**: Real snippets from codebase (for existing projects)
- **Gotchas**: Library quirks, version issues
- **Patterns**: Existing approaches to follow (for existing projects)

#### Implementation Blueprint
- Start with pseudocode showing approach
- Reference specific requirements for each component
- Map tasks to requirement acceptance criteria
- Include error handling strategy from requirements
- List tasks to be completed in order with requirement references

#### Validation Gates (Must be Executable)
```bash
# Example for Python
ruff check --fix && mypy .
uv run pytest tests/ -v --cov
```

**Critical**: Validation must verify requirement acceptance criteria, not just code correctness.

### Step 5: Quality Review

*** CRITICAL: ULTRATHINK ABOUT THE REQUIREMENTS AND PRP BEFORE FINALIZING ***

Review checklist:
- [ ] Requirements have clear, testable acceptance criteria
- [ ] Requirement IDs follow proper scheme
- [ ] All design inputs captured in requirements
- [ ] PRP references specific requirement IDs
- [ ] PRP tasks map to requirement acceptance criteria
- [ ] Validation gates verify requirements, not just tests
- [ ] Change history updated (if existing project)
- [ ] Version bumped appropriately (if existing project)

## Output Files

1. **`REQUIREMENTS.md`** (created or updated)
   - Location: Root of project
   - Contains formal requirements with IDs and acceptance criteria
   - Version tracked with change history

2. **`PRPs/{feature-name}.md`** (created)
   - Location: PRPs/ directory
   - References specific requirement IDs
   - Includes requirements traceability section
   - Maps tasks to acceptance criteria

## Output Summary

After generating both files, provide summary:

```markdown
# Requirements & PRP Generation Complete

## Requirements Document
- **File**: `REQUIREMENTS.md`
- **Version**: [X.Y] (New/Updated)
- **Requirements Added**: [Count] new requirements
- **Requirements Modified**: [Count] existing requirements updated
- **Requirements Deprecated**: [Count] requirements marked deprecated

### New/Updated Requirements
| Requirement ID | Title | Priority | Status |
|----------------|-------|----------|--------|
| REQ-F-XXX-001 | [Title] | [Priority] | Planned |
| ... | ... | ... | ... |

## PRP Generated
- **File**: `PRPs/{feature-name}.md`
- **Implements Requirements**: [List of requirement IDs]
- **Confidence Score**: [1-10]/10

### Requirements Traceability
- REQ-F-XXX-001: [Brief how it's implemented]
- REQ-F-XXX-002: [Brief how it's implemented]
- ...

## Next Steps
1. Review `REQUIREMENTS.md` for completeness
2. Review PRP for implementation approach
3. Run: `/execute-prp PRPs/{feature-name}.md`
```

## Quality Checklist (Before Finalizing)

- [ ] All necessary context included in PRP
- [ ] Requirements have specific, measurable acceptance criteria
- [ ] Validation gates are executable by AI and verify requirements
- [ ] PRP references existing patterns (for updates)
- [ ] Clear implementation path with requirement traceability
- [ ] Error handling documented per requirements
- [ ] Non-functional requirements addressed (performance, security)
- [ ] Change history complete and accurate (for updates)

**Score the outputs on confidence level (1-10) for one-pass implementation success using Claude Code.**

Remember: The goal is one-pass implementation success through comprehensive requirements and context. The PRP should be executable by /execute-prp with high confidence that requirements will be met.