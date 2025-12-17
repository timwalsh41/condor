# Complete Task

Close out the in-progress task from the project plan by executing on the specific substeps listed in $ARGUMENTS, which will include one or more items from the following list:

- **Independent review:** Trigger the `independent-reviewer` subagent to perform a thorough review of the implementation to verify the code updates are of high quality and meet the acceptance criteria, confirm that test updates provide adequate coverage, and produce a review report
- **Validation update:** Trigger the `validation-gates` subagent to review the requirement acceptance criteria, create new tests as needed to fully validate relevant requirements, review validation test results for objective evidence that acceptance criteria are satisfied, and update the validation report. In general this will occur when code changes have been implemented that would impact requirement validation status, but again do not make any updates to the report without explicit alignment with the user to do so.
- **Requirement status update**: Update the requirements document based on validation progress or any new requirements that have been generated
- **Project plan update:** Update the project plan status to reflect completion of the task and add or modify future tasks/phases as needed based on learnings from the current task
- **Technical documentation update**: Update the technical architecture and design documentation as needed to reflect design decisions and learnings from the current task

Note that the user may not use the exact terms above in the list of substeps above, do your best to interpret user intent, and ask for clarification as needed. Update documents only as explicitly directed by the user; if you feel updates to documents that were not listed are merited, then state that to the user with your rationale and receive explicit approval before editing.
