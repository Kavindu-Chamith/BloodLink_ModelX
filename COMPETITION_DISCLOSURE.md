# ModelX 2 competition disclosure

Prepared 10 November 2026 from repository history, the entrant's statements, and the competition requirements supplied by the entrant.

## Authorship and project history

The entrant states that the BloodLink idea and project are theirs and that they continued developing the system during ModelX 2. The visible history in this checkout begins on 29 October 2026 and records changes through 10 November, within the published 10 October–10 November competition period. This checkout does not establish the first creation date of every existing component. Competition materials should accurately distinguish the existing project baseline from work completed during the event. Preserve credit for all contributors shown in Git history.

## AI assistance

OpenAI Codex assisted with:

- Reviewing the project against the supplied competition rules.
- Removing superseded local testing and teammate-task documents, updating the documentation index, and correcting setup and contribution instructions.
- Reviewing official NBTS, WHO and Sri Lanka Open Data sources for candidate data and reuse terms; recording that review without copying restricted data.
- Removing the synthetic generator's dependency on blood-group aggregates from an unverified uploaded sample, regenerating its fixtures, and updating provenance documentation.
- Replacing personal-looking values and real institution contact details in demo seeds and test fixtures with explicit placeholders.
- Revising donor-facing copy so a profile match is not described as medical eligibility, and updating project documentation to distinguish synthetic data, outreach matching and unverified legal-compliance claims.
- Preparing a competition walkthrough, scene captions and narration draft. The video itself was not edited during these compliance changes.

This disclosure covers Codex assistance recorded in this collaboration. Each team member should add any other AI tools they used and what they used them for. The entrant and team are responsible for reviewing and owning submitted work.

## Data and demo

The checked-in donor, institution, request, response, history and stock records are generated in-repository and labeled `SYNTHETIC_TEST_DATA_NOT_REAL`. They are workflow fixtures, not evidence about current blood-service demand, inventory or population trends. The approximate town-center coordinates still need a documented source or authorship confirmation. See [the data-source review](docs/MODELX_DATA_SOURCE_REVIEW.md).

The previously prepared MP4 is a captioned tour made from browser-test screenshots and representative synthetic states. It is not a live end-to-end recording and does not meet the competition's real-data demonstration requirement. It was left unchanged as requested.

## Submission status

The entrant confirms that the proposal gate was passed, the locked roster is correct, and anonymous reviewer access is available; these points were not independently checked here. The published implementation package requires a technical report, a two-page summary and a three-minute video working on real data. This repository does not currently contain a clearly identified competition implementation report or two-page summary.

The compliance commits in this checkout use their actual 10 November timestamps and have not been pushed. The current documentation edits are uncommitted.
