# Development Guidelines

- **KISS** - value simplicity in design and implementation
- Prioritize **readability** and **maintainability** in code
- Write **modular** code with clear separation of concerns
- Include **comments** to explain complex logic
- **YAGNI** - Do not implement features until they are necessary
- Follow consistent **naming conventions** for variables, functions, and files
- Write **unit tests** for critical components and functionalities

# Documentation Guidelines

- Do not create documents unprompted, wait for user requests (feel free to provide suggestions)
- **Be concise**, identify the key points and avoid redundancy within and across documents
- Use backticks around filenames, e.g. `REQUIREMENTS.md`
- When updating/adding, review existing content in the document and strive to eliminate redundancy through consolidation
- Technical documentation should reflect the current state of the project, not a historical record of changes; we can highlight key learnings but we should not capture the evolution of the design; that is covered through the project documentation (plan, etc.) and through the repository history

# Custom Commands

Interpret the following commands when requested by the user:

**EXECUTE_PLANNED_TASK**

This command refers you to a plan a planned task or phase, as well as reference documents to review that provide the context to guide the execution.

**Arguments:**

[0]: Task or phase identifier
[1]: Project plan document to refer to for details on the scope and acceptance criteria for the phase/task
[2+]: Additional documents to review for context

**Instructions:**

- Review the listed input documents
- Create a todo list for the implementation
- Assess your confidence in completing the implementation correctly and with high quality; assign a score 0-100% that reflects the likelihood of success
  - Remember that confidence/likelihood of success is distinct from complexity - we have have high likelihood of success in the face of high complexity as long as we have a sound approach, good test coverage, and appropriate risk mitigations
- Raise any concerns, risks, or gaps that you perceive that have not been addressed already
- Provide these to the user for review prior to starting implementation

**CONTEXT_INITIALIZATION**

This command initializes your context at the start of a work session

**Arguments:**

[0+]: List of documents to review for context

**Instructions:**

- Review the provided documents to familiarize yourself with the project context
- Summarize the key takeaways and raise any questions or areas needing clarification
