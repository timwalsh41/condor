# Assemble Design Inputs

## Design input file to create: $ARGUMENTS

Interactively construct comprehensive design inputs with the user by exploring and refining the concept before generating formal requirements and other project documentation. This command facilitates a structured conversation to clarify concepts, explore architecture patterns, identify requirements, and assess risks. The output is a comprehensive design inputs file suitable for `/generate-prp`. The user will provide an initial starting point in $ARGUMENTS, and through this process we'll further flesh that out to the point that wee can generate a coherent project vision and requirements that must be met to ensure success. In this process, you will modify and update $ARGUMENTS based on your discussion with the user.

**This is an interactive exercise** - not a one-shot file generation. The goal is to have a thorough discussion that produces high-quality design inputs. The first four steps below list a comprehensive set of questions to explore to clarify and crystallize the design intent and approach. This should be a combination of interactive discussion with the user along with recommendations from your own knowledge (augmented with external research as appropriate). The remaining steps then synthesize the findings from these initial explorations into clear, concise, and thorough design inputs that can be used in the further stages of the design process to create requirements, system architecture, and a project plan. The user will provide some initial design input information in $ARGUMENTS, the goal here is to flesh that out and update the design input file based on the below guidance. Remember - all requirements should specify the "what", not the "how". Where we have guidance on "how" (algorithms, technologies, libraries, etc.), those should be part of the system architecture, examples, or documentation sections, not captured in the requirements themselves.

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

3. **Success Criteria Establishment**
   - Key performance indicators?
   - User acceptance criteria?

### Step 2: Architectural Exploration
1. **Technology Stack Research**
   - What technologies best fit the requirements?
   - Any existing technology constraints or preferences?
   - Integration with existing systems?
   - Performance or scalability considerations?

2. **Architecture Pattern Analysis**
   - What architectural patterns apply (microservices, monolith, event-driven, etc.)?
   - How should components be organized?
   - What are the major subsystem boundaries?
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

1. **Progressive Iterative Refinement Through Conversation**
   - Ask clarifying questions on unclear areas
   - Explore alternatives and trade-offs
   - Challenge assumptions and identify gaps
   - Validate understanding with user

2. **Option Exploration**
   - Present different architectural approaches
   - Discuss technology alternatives
   - Evaluate trade-offs (performance vs. complexity, etc.)
   - Consider MVP vs. full vision differences
   - Recommend preferred approaches with rationale

3. **Reality Checking**
   - Validate feasibility of requirements
   - Identify potential bottlenecks or issues
   - Challenge overly complex or ambitious scope
   - Ensure requirements are testable and measurable

5. **System Design Approach**
   - xxx

4. **Nominal Execution Plan**
   - Provide initial assessment on sequencing project activities to address technical risk early
   - Progressively build up functionality with user-verifiable checkpoints at each step
   - Identify major project phases, e.g. technical spike(s), MVP, feature expansion, scale-up, etc.

5. **Final Synthesis**
   - Summarize understanding and confirm alignment
   - Organize findings into coherent design inputs
   - Prioritize requirements and features
   - Document key decisions and rationale

### Step 7: Design Inputs File Generation

Update $ARGUMENTS following the existing template/organization, concisely synthesizing the output of your exploratory conversation and decisions

## Interactive Guidelines

### Conversation Flow

- **Deep Dive**: Ask follow-ups to explore unclear areas
- **Option Presentation**: Show alternatives and trade-offs
- **Reality Check**: Challenge assumptions and identify gaps
- **Confirmation**: Summarize and validate understanding

### Acceptance Criteria
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

## Final Thought

Remember: The goal is thorough exploration through conversation, resulting in a comprehensive design inputs that get us off on the right track. We should have full understanding and documentation in $ARGUMENTS of:
- What the system must do (requirements)
- How we will achieve it (system architecture, subsystem design/implementation approach) with a clear approach to address risks and gaps
- A plan of attack (how we will break down the implementation into phases and tasks, focusing on addressing technical risks and validating key design decisions early)
