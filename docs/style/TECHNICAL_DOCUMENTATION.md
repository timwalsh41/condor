## System Architecture Description

The system architecture description document provides a high level overview of the system architecture:
   - List major components, including their high level responsibilities and information & data flow between them
   - Utilize C4 component diagram practice to illustrate key workflows and aspects of architecture
   - Detail the technology stack
   - Identify key dependencies, third party libraries, etc.
   - Discuss the test strategy - unit tests are the bare minimum; integration and regression tests, a robust CI approach, and thorough reporting/tracking are the expectation
   - Use PlantUML for UML diagrams

## System Design Descriptions

System design descriptions provide detailed design information on major architectural components/subsystems of the software system: 
   - Describe the responsibilities of the subsystem
   - Provide a theory of operation for how the subsystem fulfills those responsibilities
   - Provide block diagrams and class diagrams illustrating the implementation of the subcomponent
   - Describe interfaces - what data comes in, what goes out, what format does it take, what standards/protocols are used, etc.
   - Discuss the error handling strategy
   - List out any dependencies, third party libraries, etc.
   - Include class and sequence diagrams (use PlantUML for rendering) to illustrate implementations and key interactions within the subsystem
   - Confirm with user if not clearly articulated in the design inputs what subsystem(s) should have a system design description
   - Use hooks or placeholders as needed for aspects that are not fully defined at the outset
   - Note that we use the term "component" and "subsystem" interchangeably - a component for the purposes of the architecture description should get a system design description document as well

## Focused design documents

Focused design documents complement the formal templated technical project documents (system design descriptions and system architecture description). These documents provide implementation-level detail without formal template constraints but should be comprehensive and well-structured. These may be created at the user's behest to document specific workflows, algorithms, or implementation details that warrant focused attention.

- **When to Create**: 
  - Complex algorithms or workflows that need detailed explanation
  - Implementation details too granular for system design descriptions
  - User-requested deep dives into specific functionality
  - Proactive documentation of intricate code that would benefit future developers
- **Content Requirements**:
  - **Document Scope**: Clear statement of what specific functionality/workflow/algorithm is being documented
  - **Functionality Description**: What the component does and why it exists
  - **Implementation Overview**: High-level approach and key design decisions
  - **Theory of Operation**: Detailed explanation of how the implementation works
  - **Design Tradeoffs**: Rationale for design choices, alternatives considered, performance implications
  - **Performance Considerations**: Time/space complexity, scalability factors, optimization opportunities
  - **Dependencies**: Third-party libraries, internal modules, external services used
  - **Visual Documentation**: Class diagrams, sequence diagrams, flowcharts using PlantUML where helpful
  - **Code Examples**: Key implementation snippets demonstrating critical logic
  - **Error Handling**: How failures are detected and handled
  - **Testing Approach**: How the functionality is tested and validated
- **Naming Convention**: Use descriptive names like `[ComponentName]_[Algorithm/Workflow]_Design.md`
- **Location**: Place in `docs/design/` subdirectory for organization