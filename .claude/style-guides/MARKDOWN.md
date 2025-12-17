# Style Guide for Markdown Documents

## Top-Level Guideliens
- Do not create documents unprompted, wait for user requests or provide suggestions and receive approval first
- **Be concise**, identify the key points and avoid redundancy within and across documents
    - When updating/adding to an existing document, review all existing content in the entire document and eliminate redundancy through consolidation as needed
    - Avoid redundancy across documents, we want a single source of truth - consider document scope and make use of references/links between documents as needed
- Unless specifically directed otherwise, technical documentation (including system architecture description, system design descriptions, and any supplementary documents created) should reflect the current state of the project, not a historical record of changes, improvements, evolution, etc.
    - We can highlight key learnings but we should not capture the evolution of the design - that is covered through the project documentation (plan, etc.) and through the repository history

## Document format

- Include a one-line title with H1 header format
- Use H2 headers for all subsequent sections (e.g. the title is the only H1 header in the document)
- Include the following document header as the first content below the title

```markdown
## Document Control
- **Version**: 1.0
- **Last Updated**: [Date]
```

- Include an overview section with a brief background and scope description
- Include table of contents for long documents
- Link to related documents as needed

## Style 
- Use backticks around filenames, e.g. `REQUIREMENTS.md`
