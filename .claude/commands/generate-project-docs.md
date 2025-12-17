# Create Project Documentation

## Overview

Generate initial set of project documentation based on the provided design inputs in $ARGUMENTS. The templates in `.claude/doc_templates/` folder clearly guide the creation of these documents. While we expect the design inputs to be comprehensive, make this as interactive as needed to resolve any questions or concerns encountered during the process of creating this documentation.

| Document | Destination | Template | Description |
|----------|-------------|----------|-------------|
| `README.md` | Project root | N/A | project overview and quick start (installing dependencies, building code, running tests, running main applications/systems) |
| `REQUIREMENTS.md` | `project/` | `REQUIREMENTS_TEMPLATE.md` | System technical requirements |
| `PROJECT_PLAN.md` | `project/` | `PROJECT_PLAN_TEMPLATE.md` | Project plan |
| `VALIDATION_REPORT.md` | `validation/` | `VALIDATION_REPORT_TEMPLATE.md` | Requirements validation report |
| `SYSTEM_ARCHITECTURE.md` | `docs/` | `ARCHITECTURE_TEMPLATE.md` | System architecture description |
| `<subsystem_name>_DESIGN.md` | `docs/` | `SYSTEM_DESIGN_TEMPLATE.md` | Subsystem design description |

Refer also to the markdown style guide at `.claude/style-guides/MARKDOWN.md`.

## Specific Guidance

1. **Generate requirements**
   - Identify functional requirements (what system must do)
   - Identify non-functional requirements (performance, security, etc.)
   - Define user stories
   - Define acceptance criteria:
      - Be specific and measurable
      - Specify any testing requirements
   - Establish priorities based on scope
   - Assign requirement IDs following the format laid out in the document template
   - Set version to 1.0
   - Document initial creation in change history
2. **Create project plan**:
   - Identify major project phases, where a project phase represents a cohesive set of functionality that:
      - Delivers meaningful user-facing value or system capability
      - May bring together multiple independently-developed components
      - Results in a stable, integrated system state
   - Break down phases into specific tasks, where each task completes some incremental functionality with a user-verifiable output (code that can be executed, tests that can be run, documentation that can be reviewed, etc.)
   - Refer to $ARGUMENTS for specific guidance on structuring project plan to address technical risk early
3. **Create system architecture description**:
   - Refer to `TECHNICAL_DOCUMENTATION` style guide for detailed instructions
4. **Create subsystem design descriptions**:
   - Refer to `TECHNICAL_DOCUMENTATION` style guide for detailed instructions

## Review Checklist
- [ ] Requirements have clear, testable acceptance criteria
- [ ] All design inputs captured in requirements
- [ ] Requirements have specific, measurable acceptance criteria
- [ ] Project plan references specific requirement IDs
- [ ] Clear implementation path with requirement traceability
- [ ] Validation gates verify system meets requirements (as distinct from just passing all existing tests)
- [ ] Validation gates are implemented as automated tests where possible
