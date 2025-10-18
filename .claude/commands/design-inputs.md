# Assemble Design Inputs

## Design input file to create: $ARGUMENTS

Interactive command to thoroughly explore and refine system design inputs before generating formal requirements and PRP. This command facilitates a structured conversation to clarify concepts, explore architecture patterns, identify requirements, and assess risks. The output is a comprehensive design inputs file suitable for `/generate-prp`.

**This is an interactive exercise** - not a one-shot file generation. The goal is to have a thorough discussion that produces high-quality design inputs. The first four steps below list a comprehensive set of questions to explore to clarify and crystallize the design intent and approach. This should be a combination of interactive discussion with the user along with recommendations from your own knowledge (augmented with external research as appropriate). The remaining steps then synthesize the findings from these initial explorations into clear, concise, and thorough design inputs that can be used in the further stages of the design process to create requirements, system architecture, and a project plan. The user will provide some initial design input information in $ARGUMENTS, to goal here to flesh that out and update the design input file based on the below guidance.

## Execution Process

### Step 1: Concept Clarification & Vision

1. **System Purpose Discovery**
   - "Tell me about what you're trying to build..."
   - What problem does this solve? Who are the users?
   - What makes this solution valuable?
   - How will you know if this is successful?

2. **Scope Boundaries Definition**
   - What's in scope vs. out of scope for MVP?
   - What can be deferred to future phases?
   - Any specific constraints or limitations?
   - Timeline or resource constraints?

3. **Success Criteria Establishment**
   - What does "done" look like?
   - Key performance indicators?
   - User acceptance criteria?
   - Business value metrics?

### Step 2: Architectural Exploration
1. **Technology Stack Research**
   - What technologies best fit the requirements?
   - Any existing technology constraints or preferences?
   - Integration with existing systems?
   - Performance or scalability considerations?

2. **Architecture Pattern Analysis**
   - What architectural patterns apply (microservices, monolith, event-driven, etc.)?
   - How should components be organized?
   - What are the major system boundaries?
   - How does data flow through the system?

3. **Integration Points Identification**
   - What external systems will this integrate with?
   - What APIs or protocols are involved?
   - What are the interface requirements?
   - Any authentication or security considerations?

### Step 3: Requirements Deep Dive
1. **Functional Requirements Exploration**
   - Core features and user workflows?
   - Input/output requirements?
   - Business logic and rules?
   - User interface needs?

2. **Non-Functional Requirements Analysis**
   - Performance requirements (response times, throughput)?
   - Security requirements (authentication, encryption, access control)?
   - Scalability needs (concurrent users, data volume)?
   - Reliability and availability requirements?

3. **Quality Attributes Definition**
   - Usability requirements?
   - Maintainability constraints?
   - Portability needs?
   - Compliance requirements?

4. **Constraints Identification**
   - Technical constraints (legacy systems, platforms)?
   - Regulatory constraints (compliance, security)?
   - Resource constraints (infrastructure)?

### Step 4: Risk & Complexity Assessment
1. **Technical Risk Analysis**
   - What could go wrong technically?
   - Unknown or unproven technologies?
   - Complex integrations or dependencies?
   - Performance or scalability concerns?

2. **Implementation Complexity Evaluation**
   - What parts will be most challenging to implement?
   - Any particularly complex algorithms or logic?
   - Difficult user interface requirements?
   - Challenging integration points?

3. **Dependency Risk Assessment**
   - What external factors could impact success?
   - Third-party service dependencies?

4. **Mitigation Strategy Development**
   - How to address identified risks?
   - Fallback plans or alternatives?
   - Risk monitoring approaches?
   - Early validation strategies?

### Step 5: Research Phase

1. **Codebase Analysis** (if existing project)
   - Search for similar features/patterns in the codebase
   - Identify files to reference in design inputs
   - Note existing conventions to follow
   - Check test patterns for validation approach
   - Find examples of similar implementations

2. **External Research**
   - Augment any research conducted in earlier steps based on assessment of existing codebase
   - Search for similar features/patterns online
   - Library documentation (include specific URLs)
   - Implementation examples (GitHub/StackOverflow/blogs)
   - Best practices and common pitfalls
   - Security considerations and standards

3. **Documentation & Standards Research**
   - Official API documentation for integrations
   - Industry standards or protocols
   - Security frameworks or compliance requirements
   - Performance benchmarks or guidelines
   - Testing methodologies and tools

### Step 6: Design Inputs Synthesis

1. **Progressive Refinement Through Conversation**
   - Ask clarifying questions on unclear areas
   - Explore alternatives and trade-offs
   - Challenge assumptions and identify gaps
   - Validate understanding with user
   - Iterate on design decisions

2. **Option Exploration**
   - Present different architectural approaches
   - Discuss technology alternatives
   - Evaluate trade-offs (performance vs. complexity, etc.)
   - Consider MVP vs. full vision differences
   - Recommend preferred approaches with rationale

3. **Reality Checking**
   - Validate feasibility of requirements
   - Identify potential bottlenecks or issues
   - Confirm resource and timeline assumptions
   - Challenge overly complex or ambitious scope
   - Ensure requirements are testable and measurable

4. **Final Synthesis**
   - Summarize understanding and confirm alignment
   - Organize findings into coherent design inputs
   - Prioritize requirements and features
   - Document key decisions and rationale
   - Prepare comprehensive design inputs file

### Step 7: Design Inputs File Generation

Create comprehensive $ARGUMENTS file with:

#### FEATURE Section
- Clear, specific description of what's being built
- Functional requirements with user workflows
- Non-functional requirements (performance, security, scalability)
- Integration requirements with external systems
- Quality attributes and constraints

#### EXAMPLES Section
- Relevant code patterns from `examples/` folder (if existing project)
- Specific files and patterns to follow
- Both code structure and testing patterns
- Architecture patterns to mirror
- Error handling approaches to replicate

#### DOCUMENTATION Section
- Specific API documentation URLs with relevant sections
- Library guides and best practices documentation
- MCP server documentation for external integrations
- Industry standards or compliance documentation
- Security frameworks and guidelines
- Performance benchmarks and testing tools

#### OTHER CONSIDERATIONS Section
- Technology-specific gotchas and common pitfalls
- Security considerations and requirements
- Performance thresholds and monitoring needs
- Error handling and logging requirements
- Testing strategy and coverage requirements
- Deployment and operational considerations
- Migration or integration considerations
- Risk mitigation strategies

## Interactive Guidelines

### Conversation Flow
- **Start Open**: "Tell me about what you're trying to build..."
- **Progressive Refinement**: Each question builds on previous answers
- **Deep Dive**: Ask follow-ups to explore unclear areas
- **Option Presentation**: Show alternatives and trade-offs
- **Reality Check**: Challenge assumptions and identify gaps
- **Confirmation**: Summarize and validate understanding

### Key Questions to Explore
- "What problem are you solving and for whom?"
- "What would success look like?"
- "What are your non-negotiable requirements?"
- "What can be simplified or deferred?"
- "What similar systems have you seen?"
- "What are your biggest concerns or risks?"
- "How will users interact with this?"
- "What performance is required?"
- "What security considerations apply?"
- "How will this integrate with existing systems?"

### Quality Checkpoints
- [ ] Problem and users clearly defined
- [ ] Success criteria measurable and specific
- [ ] Functional requirements comprehensive
- [ ] Non-functional requirements quantified
- [ ] Architecture approach selected with rationale
- [ ] Technology stack justified
- [ ] Integration points identified
- [ ] Risks assessed with mitigation strategies
- [ ] Examples and patterns identified
- [ ] Documentation resources compiled
- [ ] Scope appropriately bounded for MVP

## Output Summary

After interactive exploration, provide summary:

```markdown
# Design Inputs Assembly Complete

## System Concept
- **Purpose**: [Clear problem statement and value proposition]
- **Users**: [Target users and use cases]
- **Success Criteria**: [Measurable outcomes]

## Architecture Approach
- **Pattern**: [Selected architectural pattern with rationale]
- **Technology Stack**: [Chosen technologies with justification]
- **Integration Points**: [External systems and interfaces]

## Requirements Summary
- **Functional**: [Count] core features identified
- **Non-Functional**: [Count] performance/security/scalability requirements
- **Constraints**: [Key limitations and boundaries]

## Risk Assessment
- **High Risk Areas**: [Top 3 technical/implementation risks]
- **Mitigation Strategies**: [Approaches to address risks]
- **Complexity Factors**: [Most challenging aspects]

## Design Inputs File
- **Created**: $ARGUMENTS
- **Sections**: Feature description, Examples, Documentation, Other Considerations
- **Quality Score**: [1-10]/10 for PRP generation readiness

## Next Steps
1. Review $ARGUMENTS for completeness
2. Run: `/generate-prp $ARGUMENTS`
```

Remember: The goal is thorough exploration through conversation, resulting in comprehensive design inputs that set up `/generate-prp` for success.

