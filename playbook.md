# Playbook: From Kickoff to Clickable Prototype

## Agent Roles and Responsibilities

This section outlines the primary roles and functions of each agent involved in the project lifecycle described in this playbook.

*   **Orchestrator:**
    *   Manages the overall project workflow and phase progression according to the playbook.
    *   Assigns tasks to the appropriate agents.
    *   Ensures all deliverables for each phase are completed to the required standard.
    *   Facilitates communication and collaboration between agents.
    *   Manages feedback loops and ensures iterative refinements are carried out.

*   **`pm-agent` (Product Manager Agent):**
    *   Defines and champions the product vision and strategy.
    *   Gathers, documents, and prioritizes business and product requirements (e.g., `ProductRequirements` document).
    *   Leads requirements validation and alignment workshops.
    *   Manages the product backlog and feature prioritization.
    *   Reviews designs and deliverables for alignment with requirements and user needs.
    *   Consolidates and analyzes feedback from various agents and stakeholders.
    *   Facilitates decision-making regarding scope and features.

*   **`ux-agent` (UX Designer Agent):**
    *   Conducts user research and defines user personas and scenarios.
    *   Develops the information architecture, sitemaps, and user flows.
    *   Creates low-fidelity wireframes and high-fidelity design mockups.
    *   Designs UI components and defines the visual style guide (e.g., Gemini Style).
    *   Ensures designs are user-centered, intuitive, and meet accessibility standards.
    *   Incorporates feedback from PM, developers, testers, and user-agents into designs.

*   **`dev-agent` (Developer Agent):**
    *   Provides technical feasibility assessments during planning and design phases.
    *   Implements the front-end of the application based on `ux-agent`'s specifications.
    *   Develops reusable UI components (HTML/CSS/JS).
    *   Assembles pages and builds interactive prototypes.
    *   Collaborates with `ux-agent` to ensure accurate translation of designs into code.
    *   Works with `test-agent` to identify and fix bugs.
    *   Sets up development environments and tools (e.g., Storybook).

*   **`test-agent` (Tester Agent):**
    *   Develops test plans and test scripts based on requirements and user stories.
    *   Conducts various types of testing: guerrilla testing for low-fi wireframes, component testing, page testing for high-fi designs, usability testing for interactive prototypes, and regression testing.
    *   Identifies, documents, and tracks bugs and usability issues.
    *   Provides detailed feedback on the user experience and adherence to specifications.
    *   Verifies that bug fixes and revisions meet the required quality standards.

*   **`entrepreneur-agent`:**
    *   Provides strategic oversight and ensures the project aligns with broader business objectives.
    *   Acts as a key stakeholder in reviewing phase outputs and progress.
    *   Performs "Guard Checks" at the end of phases, in conjunction with the Orchestrator, to approve progression or request further iterations.
    *   Focuses on the overall value proposition and market fit of the product.

*   **`user-agents` (e.g., `user-linguist-agent`, `user-client-agent`, `user-admin-agent`):**
    *   Represent the perspectives and needs of specific end-user groups.
    *   Provide feedback on requirements, personas, scenarios, designs, and prototypes from their unique standpoint.
    *   Participate in user research, usability testing sessions, and feedback rounds.
    *   Help validate that the developing solution meets the practical needs and expectations of its intended users.

---

**Overarching Principle: All phases require complete execution of planned tasks and creation of all specified artifacts (documents, pages, components). Iterative refinement and re-dos of phase steps are standard mechanisms to achieve required quality and completeness, guided by the Orchestrator and Entrepreneur Agent.** ***Ensure continuous synchronization between related artifacts (low-fi, high-fi, specs) throughout the process.***

Below is a detailed, step-by-step playbook for your team—UX designers, product manager, and engineers—to go from kickoff to a validated, clickable prototype. Each phase includes a **checklist of deliverables** and a **"Team Prompt"** that you can use to drive alignment or kick off workshops.

---

## Phase 1 – Kickoff & Requirements Validation

**Goal:** Make sure everyone fully understands the business and product requirements before any design work begins. All sections of the requirements document must be covered.

**Checklist:**

*   [ ] Distribute the **complete** Business & Product Requirements doc to all stakeholders.
*   [ ] Hold a 1-hour Alignment Workshop (PM + UX + Eng), review **all** bullets in sections 1–2 (or equivalent in the current requirements document).
*   [ ] Capture **all** open questions or ambiguities in a shared Google Doc (or Jira ticket/`issues.md`).
*   [ ] Assign a single owner for **each identified** requirement area.

**Team Prompt:**

> "Review **all specified requirements** (e.g., 1.1–2.6). What's unclear? What dependencies do we need to resolve before we can start flows and wireframes? Ensure all aspects are discussed."

---

## Phase 2 – Deep User Understanding: Strategic Persona, Scenario & JTBD Definition

**Goal:** Achieve a profound, strategically-filtered understanding of real user needs. This process will yield:
*   Detailed, validated personas in `internal/personas.md`, including **Key Jobs-to-be-Done (JTBDs)** that are aligned with **product strategic goals** and have **Critical Success Factors (CSFs)** defined.
*   A comprehensive set of user scenarios in `internal/user_scenarios.md`, validated and prioritized using RICE, mapped on a **Value vs. Complexity matrix**, and assessed for **User Delight potential**.
*   **NEW:** Detailed User Journey Maps in `internal/user_journey_maps.md` illustrating key MVP scenarios.
*   **NEW:** A comprehensive set of User Stories and Job Stories in `internal/user_stories_jobs.md` derived from requirements and user understanding.
*   A clearly defined **"MVP Core" set of scenarios** based on strategic value and feasibility (DVF check) in `internal/mvp_core_scenarios.md`.
*   **NEW:** A high-level Product Roadmap in `internal/product_roadmap.md` outlining vision, themes, and MVP focus.
*   A clear understanding of how well core scenarios cover critical JTBDs.
All artifacts are deeply rooted in `ProductRequirements` and direct user feedback, but strategically filtered to focus on impactful outcomes.

**Checklist:**

*   **`ux-agent` (Lead) & `pm-agent`:**
    *   [ ] Plan and schedule **3-4 iterative interview rounds** with `user-agents` and/or real target users.
*   **`ux-agent`:**
    *   [ ] Conduct **Round 1 Interviews**: Initial understanding of roles, goals, pain points, high-level tasks related to `ProductRequirements`.
    *   [ ] Draft initial versions of **all 3 defined personas** in `internal/personas.md`.
*   **`pm-agent` (Lead), `ux-agent`, with `user-agents`:**
    *   [ ] Collaboratively draft **initial high-level scenarios** in `internal/user_scenarios.md`.
*   **`ux-agent` & `pm-agent` (with `user-agents` as primary source):**
    *   [ ] Conduct **Round 2-3 Interviews**: Deeper discussion on personas/scenarios, validating assumptions, detailing steps, edge cases, success criteria.
*   **Team (`pm-agent` and `ux-agent` driving, with `user-agents` input):**
    *   [ ] Iteratively refine `internal/personas.md` (richer details, quotes).
    *   [ ] Iteratively develop and detail `internal/user_scenarios.md` (steps, Primary/Secondary, goals, context, actions, outcomes, cross-referencing, **deep scenario elaboration as detailed below**).
        *   **Глубокая проработка сценариев (Deep Scenario Elaboration):**
            *   **(Happy Path & Beyond):** For each main scenario, consider alternative flows and error paths. What if the user enters incorrect data? What if the system doesn't respond? What if the user wants to cancel mid-action?
            *   **(Context & Preconditions):** Clearly describe the initial state of the system and user before the scenario begins. What data already exists? What is the state of the interface?
            *   **(Edge Cases & Extremes):** Ask "What if...?" What if the list is empty? What if there's a huge amount of data? What if the user tries something unusual?
            *   **(Roles & Permissions):** If there are different roles, how does the scenario change for each? What actions are available/unavailable?
            *   **(Data Variations):** How does the scenario handle different data types (short/long strings, different formats, missing data)?
            *   **("Day in the Life"):** Imagine how this scenario fits into the user's larger workflow. What tasks precede and follow it? This helps identify non-obvious dependencies and needs.
            *   **(User's Emotional State):** While harder to formalize, consider the user's likely state (rushed, confused, confident) and how the interface might react.
*   **`ux-agent` (Lead):**
    *   [ ] **NEW:** Based on finalized personas and MVP scenarios, create detailed **User Journey Maps** for key MVP workflows in `internal/user_journey_maps.md`.
*   **`pm-agent` (Lead) with `ux-agent`:**
    *   [ ] **NEW:** Based on `ProductRequirements`, personas, JTBDs, and scenarios, draft comprehensive **User Stories and Job Stories** in `internal/user_stories_jobs.md`.
*   **Core Team (`entrepreneur-agent` (Lead for strategic alignment), `pm-agent` (Lead for process & product), `ux-agent`, `dev-agent`)**:
    *   [ ] **Strategic JTBD & Scenario Alignment Workshop:**
        *   [ ] For each persona, extract core JTBDs. **Evaluate JTBD alignment with product strategic goals.**
        *   [ ] **Define 1-2 Critical Success Factors (CSFs)** for each key JTBD.
        *   [ ] Document JTBDs (with strategic alignment notes) and CSFs in `internal/personas.md`.
        *   [ ] Review all scenarios in `internal/user_scenarios.md`. Re-evaluate/confirm Primary/Secondary classification.
        *   [ ] Apply **RICE scoring** to prioritize all scenarios. Document results in `internal/scenario_prioritization_RICE.md`.
        *   [ ] Create a **Value vs. Complexity matrix** for scenarios based on RICE scores and strategic value assessment in `internal/value_complexity_matrix.md`.
        *   [ ] Qualitatively assess top scenarios for **User Delight potential**.
        *   [ ] Analyze and confirm how well prioritized scenarios cover core JTBDs and their CSFs.
        *   [ ] Explicitly define and document the **"MVP Core" set of scenarios** based on this comprehensive analysis in `internal/mvp_core_scenarios.md`.
        *   [ ] Perform a quick **Desirability, Viability, Feasibility (DVF) check** on "MVP Core" and "Strategic Big Bet" scenarios.
*   **`pm-agent` (Lead):**
    *   [ ] **NEW:** Based on the strategic workshop and MVP definition, create the initial **Product Roadmap** outlining vision, themes, and MVP release scope in `internal/product_roadmap.md`.
*   **`ux-agent` & `pm-agent`:**
    *   [ ] Conduct **Final Interview Round (Round 3 or 4)** with `user-agents`: Validate personas (with JTBDs & CSFs), the prioritized set of scenarios (including MVP Core), user stories, and journey maps. Gather final feedback.
*   **`pm-agent` (Lead):**
    *   [ ] Ensure `internal/personas.md` (with JTBDs, CSFs, strategic alignment) is finalized and approved.
    *   [ ] Ensure `internal/user_scenarios.md` (with prioritization, RICE insights, Value/Complexity mapping links) is finalized.
    *   [ ] Ensure `internal/mvp_core_scenarios.md` is clearly defined and approved.
    *   [ ] **NEW:** Ensure `internal/user_journey_maps.md` is finalized and approved.
    *   [ ] **NEW:** Ensure `internal/user_stories_jobs.md` is finalized and approved.
    *   [ ] **NEW:** Ensure `internal/product_roadmap.md` is finalized and approved.
    *   [ ] Lead a final team review of all Phase 2 outputs before formally concluding.

**Team Prompt:**

> "Team, Phase 2 is about achieving **strategic, deep user understanding**. Beyond iterative interviews to build detailed personas and scenarios, our **Core Team (`entrepreneur-agent`, `pm-agent`, `ux-agent`, `dev-agent`) will dedicate a workshop to strategic filtering**. We will extract **Jobs-to-be-Done**, align them with **product strategy**, and define **Critical Success Factors**. We'll prioritize scenarios using **RICE**, map them on a **Value vs. Complexity matrix**, and consider their **User Delight potential**. The crucial outcome is a clearly defined **'MVP Core' set of scenarios** that have passed a DVF check. **NEW:** This phase also requires `ux-agent` to create **User Journey Maps** (`internal/user_journey_maps.md`) for MVP flows, and `pm-agent` to draft **User Stories/Job Stories** (`internal/user_stories_jobs.md`) and the initial **Product Roadmap** (`internal/product_roadmap.md`). Our goal is not just a list of user needs, but a **strategically vetted roadmap of opportunities** documented across all Phase 2 artifacts."

---

## Phase 3 – Information Architecture & User Flows

**Goal:** Define the **complete** high-level structure (Information Architecture) and map out **all user flows for the defined MVP Core scenarios**. This phase requires the **actual creation and completion of all specified artifacts** (`internal/card_sorting_results.md`, `internal/sitemap.mmd` with diagrams); **simulations are not acceptable substitutes for deliverables.** The outputs must accurately reflect the decisions made based on previous phases and strategic priorities.

**Checklist:**

*   **`ux-agent`**:
    *   [ ] Conduct **actual card sorting** (e.g., using Miro/UXtweak with team members or representative users) on planned navigation items, focusing on MVP features. **Document the methodology and results** in `internal/card_sorting_results.md`. (If actual sorting is impossible, document the alternative method used, e.g., expert review, and its results.)
    *   [ ] Produce the **finalized sitemap diagram** within `internal/sitemap.mmd`, ensuring it reflects the card sorting results, covers **all pages required for the MVP Core scenarios**, and aligns with `ProductRequirements`.
    *   [ ] For **each MVP Core scenario** defined in `internal/mvp_core_scenarios.md`, draw a **comprehensive user-flow diagram** (e.g., using Mermaid) and **add it directly** to `internal/sitemap.mmd`. Ensure flows detail user steps, system responses, and decision points.
*   **`test-agent`**:
    *   [ ] Create draft manual test cases for all MVP Core scenarios (from `internal/mvp_core_scenarios.md`), based on approved user flow diagrams from `internal/sitemap.mmd`. Apply principles of positive/negative testing and boundary value analysis based on flows and requirements. **(Translate to English: Create draft manual test cases for all MVP Core scenarios (from `internal/mvp_core_scenarios.md`), based on approved user flow diagrams from `internal/sitemap.mmd`. Apply principles of positive and negative testing, and boundary value analysis based on flows and requirements.)**
*   **Team (`pm-agent`, `ux-agent`, `dev-agent`, `test-agent`)**:
    *   [ ] **Review all created artifacts**: `internal/card_sorting_results.md`, the updated `internal/sitemap.mmd` (both sitemap diagram and all MVP user flow diagrams).
    *   [ ] Verify completeness, logical consistency, coverage of MVP scope, and technical feasibility (`dev-agent` input).
    *   [ ] Obtain sign-off on the finalized IA and MVP user flows, documenting any required minor revisions before concluding the phase.

**Team Prompt:**

> "`ux-agent`, present the documented results from card sorting (`internal/card_sorting_results.md`), the finalized sitemap diagram, and the detailed user flows for **all MVP Core scenarios** now included in `internal/sitemap.mmd`. Team, review these artifacts critically. Does the Information Architecture feel intuitive? Do the user flows accurately and completely represent the steps needed for our MVP scenarios, as defined in `internal/mvp_core_scenarios.md`? `dev-agent`, are there any feasibility concerns with these flows? Remember, these completed documents, not just concepts, are the required output for this phase."

---

## Phase 4 – Low-Fidelity Wireframes

**Goal:** Lay out screen skeletons for **all defined pages/views** and test basic layouts and navigation flows using simple HTML mockups.

**Checklist:**

*   **`ux-agent`**: 
    *   [ ] Sketch **all core screens** (Dashboard overview; Client Detail; Client Onboarding Wizard (all steps); Linguist Sandbox; Logs & Traces; Templates Library & Editor; Settings pages etc.) on paper or in Balsamiq, covering all elements from the user flows.
*   **`dev-agent`**: 
    *   [ ] Create simple HTML pages in `ui/low-fi/` with placeholder content for **all sketched screens**. Ensure `dev-agent` task `create_low_fi_html_skeletons` includes this full list ***and placeholders are specific enough to guide hi-fi implementation (e.g., using `data-cy` attributes where possible)***.
    *   [ ] Implement basic click-through navigation between **all related HTML pages**. ***Verify all linked pages exist.***
*   **`ux-agent` (Content) & `dev-agent` (Structure Sync)**:
    *   [ ] **NEW:** Create/Update detailed textual descriptions for **each low-fidelity wireframe** in `internal/design-specs/low_fidelity_wireframe_descriptions.md`, ensuring descriptions match the created HTML structure and placeholders.
*   **`test-agent`**:
    *   [ ] Conduct a 5-user guerrilla test (in-office or remote) walking through **at least 3-5 key tasks** covering different areas of the application using the HTML wireframes.
    *   [ ] Collect **all feedback**: note any navigation or labeling confusion, and missing placeholders for any screen. Document in `internal/issues.md` (or similar).
*   **`dev-agent` & `ux-agent`**: 
    *   [ ] **Update all relevant low-fidelity HTML files and the descriptions document (`internal/design-specs/low_fidelity_wireframe_descriptions.md`)** based on guerrilla test results and all subsequent feedback rounds **before phase completion**.

**Team Prompt:**

> "Use these HTML wireframes to complete Scenario X (e.g., Admin configures parsing settings for a new client from start to finish). What's missing or unclear on **any of the screens involved in this full task**? **NEW:** Does the textual description in `internal/design-specs/low_fidelity_wireframe_descriptions.md` accurately reflect this wireframe?"

---

## Phase 5 – High-Fidelity Design & Component Library

**Goal:**
*   **`ux-agent`** creates detailed high-fidelity design mockups for all pages and UI components, adhering to the Gemini Style. This involves:
    *   Starting each high-fidelity mockup from the corresponding `ui/low-fi/*.html` file to ensure continuity.
    *   Detailing the transformation from low-fidelity to high-fidelity in `internal/design-specs/*.md` for each page, referencing the source low-fi file, specifying components, styles, and content changes.
    *   Systematically designing components based on `ProductRequirements` (User Stories, Functional Requirements) and `internal/personas.md` to ensure they meet real user needs and technical comfort levels.
    *   Analyzing all `ui/low-fi/*.html` screens to compile a comprehensive list of necessary UI elements for the component library.
    *   Applying a "Content-First" approach, using `ProductRequirements` and `internal/personas.md` to inform realistic content for mockups.
    *   Ensuring `internal/design-specs/*.md` for each component explicitly describes all states (default, hover, focus, active, disabled, loading, error/validation for forms, empty states for tables/lists, etc.).
    *   Creating and maintaining (with `pm-agent`) a "Gemini Style" checklist based on `internal/design_trends_gemini_style.md` and existing HTML references, to be used by all relevant agents.
    *   **NEW:** Synthesizing the design principles, tokens, and component inventory into the **Design System Overview** document (`internal/design_system_overview.md`).
*   **`pm-agent`** reviews these designs for style compliance (using the "Gemini Style" checklist), alignment with requirements, and provides feedback. Collaborates on the "Gemini Style" checklist.
*   **`ux-agent`** incorporates feedback into final designs and conducts early iterative reviews of complex/new component designs with `dev-agent` for technical feasibility.
*   **`dev-agent`** implements all specified UI components as reusable HTML/CSS snippets in `ui/components/` and assembles all pages in high-fidelity HTML in `ui/high-fi/`, ***based strictly on `ux-agent`'s final, updated design specifications (`internal/design-specs/*.md`)*** and using the "Gemini Style" checklist. ***Verify existence and correct usage of all referenced components from `ui/components/`.*** Participates in early component design reviews. Provides input for `internal/design_system_overview.md`.
*   **`test-agent`** and **`user-agents`** (e.g., Client) test components and pages using structured scenarios derived from `internal/sitemap.mmd`, `ProductRequirements` (User Stories, Key Tasks), and `internal/personas.md`. Feedback covers bugs, Gemini Style adherence (using the checklist), and persona-specific usability. `test-agent` specifically verifies all documented component states.
*   **`pm-agent`** analyzes all feedback and ensures necessary iterations by `ux-agent` and `dev-agent`.
*   **(New) `test-agent` / `pm-agent`:**
    *   [ ] **Perform Static High-Fidelity Verification:** Compare all built `ui/high-fi/*.html` against low-fi, specs, and issues. Document new issues if found.
*   The outcome is a complete set of ***verified*** high-fidelity page mockups, a comprehensive, reusable UI component library, and a finalized **Design System Overview document**, all consistently applying the Gemini Style, ready for interactive prototyping.

**Checklist:**

*   **`ux-agent`**:
    *   [ ] Create detailed high-fidelity design specifications/mockups for **all application pages**, starting from corresponding `ui/low-fi/*.html` files and adhering to Gemini Style.
    *   [ ] For each page, update/create `internal/design-specs/*.md` to detail its transformation from low-fi, link to the low-fi source, and list components used.
    *   [ ] Design **all identified reusable UI components** based on `ProductRequirements`, `internal/personas.md`, and analysis of `ui/low-fi/*.html`.
    *   [ ] For each component, create/update `internal/design-specs/*.md` to include all states (default, hover, focus, active, disabled, loading, error/validation, empty states).
    *   [ ] Conduct early iterative reviews of complex/new component designs with `dev-agent`.
    *   [ ] Apply "Content-First" approach using `ProductRequirements` and `internal/personas.md` for page mockups.
    *   [ ] Create and maintain a "Gemini Style" checklist with `pm-agent`, derived from `internal/design_trends_gemini_style.md` and HTML references.
    *   [ ] **NEW:** Create/Finalize the **Design System Overview** document (`internal/design_system_overview.md`).
*   **`pm-agent`**:
    *   [ ] Review **all design mockups and component designs** from `ux-agent` for adherence to Gemini Style (using the "Gemini Style" checklist), `ProductRequirements`, and overall quality. Provide consolidated feedback.
    *   [ ] Collaborate with `ux-agent` on developing and maintaining the "Gemini Style" checklist.
*   **`ux-agent`**:
    *   [ ] Incorporate **all feedback** from `pm-agent` and `dev-agent` (from early reviews) into final design specifications and component designs.
*   **`dev-agent`**:
    *   [ ] Participate in early reviews of complex/new component designs.
    *   [ ] Implement **all specified UI components** as atomic HTML/CSS snippets in `ui/components/`, ensuring they are reusable, accurately match `ux-agent`'s final designs, and adhere to the "Gemini Style" checklist.
    *   [ ] Assemble **all final pages** in High-Fidelity HTML in `ui/high-fi/` using the created components, realistic or finalized copy (guided by `ux-agent`'s "Content-First" mockups), ensuring layouts accurately match `ux-agent`'s mockups and "Gemini Style" checklist.
    *   [ ] **NEW:** Provide input/review for the **Design System Overview** document (`internal/design_system_overview.md`).
*   **`test-agent`**:
    *   [ ] Finalize and detail manual test cases (created in Phase 3), linking them to high-fidelity elements, components, and states from `internal/design-specs/*.md`. Adhere to testing principles (Appendix X). **(Translate to English: Finalize and detail manual test cases (created in Phase 3), linking them to high-fidelity elements, components, and states from `internal/design-specs/*.md`. Adhere to testing principles (Appendix X).)**
    *   [ ] Conduct thorough testing of **each UI component**, verifying all documented states (from `internal/design-specs/*.md`) and adherence to the "Gemini Style" checklist.
    *   [ ] Test **all high-fidelity pages** for layout consistency, correct component usage, basic interactivity placeholders, and adherence to the "Gemini Style" checklist, using defined scenarios.
    *   [ ] Document all issues and feedback in `internal/issues.md`, including persona-specific usability insights.
*   **`user-client-agent` (and other relevant `user-agents` like `user-linguist-agent`, `user-admin-agent`)**:
    *   [ ] Review and test key components and high-fidelity page mockups using scenarios relevant to their persona (derived from `ProductRequirements` and `internal/personas.md`).
    *   [ ] Provide feedback on usability, clarity, visual appeal, and adherence to Gemini Style (using the checklist).
*   **`pm-agent`**:
    *   [ ] Audit full coverage of all MVP Core scenarios from `internal/mvp_core_scenarios.md` by approved and finalized test cases in `internal/test_cases/` before starting active manual testing. **(Translate to English: Audit full coverage of all MVP Core scenarios from `internal/mvp_core_scenarios.md` by approved and finalized test cases in `internal/test_cases/` before starting active manual testing.)**
    *   [ ] Consolidate **all feedback** from `test-agent` and `user-agents`.
    *   [ ] Prioritize issues and facilitate discussions to ensure `ux-agent` and/or `dev-agent` make necessary revisions. All critical issues must be addressed.
*   **(New) `test-agent` / `pm-agent`:**
    *   [ ] **Perform Static High-Fidelity Verification:** Compare all built `ui/high-fi/*.html` against low-fi, specs, and issues. Document new issues if found.
*   **Orchestrator/`entrepreneur-agent`**:
    *   [ ] Review **the entire design system** (tokens, "Gemini Style" checklist, components, page layouts, **NEW: Design System Overview document**) with `pm-agent` and `dev-agent` (lead) for completeness, consistency, reusability, and adherence to style guides before approving phase completion. All checklist items must be verifiably complete.

#### Процесс Действий при Обнаружении Нереализованных Элементов/Функциональности в High-Fidelity Прототипе (Procedure for Handling Missing Elements/Functionality in High-Fidelity Prototypes)

*(This subsection remains the same, detailing the process for handling blocked tests)*

**Team Prompt:**

> "`ux-agent`, present your Gemini Style design mockups for all pages (showing evolution from low-fi), the component library (detailing all states and basis in requirements/personas), **and the synthesized Design System Overview**. Showcase the 'Gemini Style' checklist. `pm-agent`, assess for style compliance (using the checklist) and requirement coverage. `dev-agent`, how will you translate these detailed designs and component states into robust, reusable code, and what are your thoughts from early component reviews and the Design System Overview? `test-agent` and `user-agents`, prepare to scrutinize these deliverables using persona-based scenarios and the style checklist. Does our **complete component library** cover **all UI patterns** and **all states** for **all screens**? Is the Gemini Style consistently and correctly applied everywhere, verified against the checklist? ***Are the final HTML pages structurally aligned with low-fi placeholders and detailed specs?*** Are all elements from `ProductRequirements` and user flows represented with appropriate content?"

---

## Phase 6 – Interactive Prototype

**Goal:** Link **all verified high-fi screens** into a comprehensive, clickable HTML prototype that simulates **all core user flows** and feels like the real product, adhering to Gemini Style interactions.

**Checklist:**

*   [ ] In HTML/CSS/JS (or Figma/InVision if preferred, though HTML is per playbook), prototype **all main and critical secondary user flows** as defined in `sitemap.md`, including:
    1.  Onboarding "Add Client" (all wizard steps)
    2.  Configuring client parsing parameters & schedules
    3.  Running sandbox evaluations & managing results
    4.  Viewing all analytics dashboards & generating reports
    5.  Searching and reviewing logs & traces
    6.  Managing prompt templates (create, edit, version, bulk apply)
    7.  Configuring system and user profile settings
*   [ ] Add simple, consistent transitions and micro-interactions (hover, click, loading states) for realism, following Gemini Style principles.
*   [ ] Ensure **all interactive elements** on **all prototyped pages** are clickable and lead to the correct next state or page.
*   [ ] Share prototype link with **all stakeholders** for initial feedback.

**Team Prompt:**

> "Click through **every user flow and every screen** as if you were the relevant persona. Note any broken links, missing states, unexpected behavior, or deviations from Gemini Style interactions on **any part of the prototype**.

---

## Phase 7 – Usability Testing & Iteration

**Goal:** Validate that real users can successfully complete **all key scenarios** across the **entire HTML prototype** without frustration, and iterate on the design based on findings.

**Checklist:**

*   [ ] Recruit 5–8 participants matching **all primary personas**.
*   [ ] Prepare a comprehensive test script covering **all critical tasks and flows** across the prototype.
*   [ ] Run moderated sessions (think-aloud) and record via Lookback or Zoom.
*   [ ] Score task success (0/1/2) for **each task** and collect SUS + key verbatim quotes.
*   [ ] Synthesize **all findings** in Miro: group by severity and frequency across **all tested areas**.
*   [ ] Prioritize top 5-10 pain-points (or as many as needed for a stable UX) and update Figma designs / HTML prototype **comprehensively**.

**Team Prompt:**

> "When you attempted Task X (e.g., to export the top-N queries, or configure a new client fully), what did you expect to happen at each step? What actually happened? Were there any points of confusion on **any screen**?

---

## Phase 8 – Developer Handoff & Storybook Setup

**Goal:** Equip engineering with **all necessary assets and documentation** to implement the **complete UI** accurately and efficiently.

**Checklist:**

*   [ ] Finalize **all component specifications** in Figma Inspect (if used) and link to Jira stories for **every component and page**.
*   [ ] Publish a Storybook instance containing **all React/Vue components** matching the Figma/HTML component library, with **all states and props documented**. *(Replace "المختلفة" with "all states")*
*   [ ] For **each Jira ticket** (for features, pages, components), attach:
    *   Figma frame link (if used)
    *   Path to relevant HTML prototype page(s) (`ui/prototype.html`? Needs verification)

---
## Приложение X: Принципы Разработки Эффективных Тест-Кейсов (Appendix X: Principles for Developing Effective Test Cases)

#### Принципы Разработки Эффективных Тест-Кейсов (Principles for Developing Effective Test Cases):

*   **Полнота покрытия (Coverage Completeness):**
    *   **Требования и User Stories (Requirements & User Stories):** Each test case must explicitly or implicitly verify one or more requirements from `ProductRequirements` or User Story acceptance criteria. Strive for 100% coverage of critical requirements.
    *   **Позитивные и негативные пути (Positive & Negative Paths):** Test not only the expected behavior ("happy path") but also the system's reaction to incorrect actions, invalid data, and user errors (negative scenarios).
    *   **Граничные значения (Boundary Value Analysis):** Pay special attention to checks at the boundaries of permissible ranges (minimum/maximum values, empty values, values slightly above/below the boundary).
    *   **Классы эквивалентности (Equivalence Partitioning):** Group input data to test one representative from each class of similar data, instead of redundant checks.
*   **Качество самих Тест-Кейсов (Test Case Quality):**
    *   **Ясность и однозначность (Clarity & Unambiguity):** Steps should be written so that any team member can execute them and obtain the expected result without additional clarification.
    *   **Конкретные шаги (Action-oriented):** Instead of "Check the form," write "1. Enter 'X' in field 'Y'. 2. Click button 'Z'."
    *   **Четкие ожидаемые результаты (Clear Expected Results):** For each step or group of steps, the expected result must be clearly described – what should happen in the interface, what data should change, what message should appear.
    *   **Независимость (по возможности) (Independence - where possible):** Try to make test cases independent of each other so that the failure of one does not block the execution of others. If there is a dependency, it must be explicitly stated in the preconditions.
    *   **Воспроизводимость (Reproducibility):** The test should produce the same result each time it is run on an unchanged version of the system.
    *   **Предусловия и постусловия (Preconditions & Postconditions):** Clearly describe what must be configured in the system *before* the test starts, and the state the system should be in *after* its successful completion.
*   **Фокус не только на функциональности (Focus Beyond Functionality):**
    *   **Юзабилити (Usability):** Pay attention to ease of use, interface clarity, and flow logic. Note points that might cause user difficulty, even if the function works correctly formally. (This overlaps with `user-agents` tasks).
    *   **Соответствие Gemini Style (Gemini Style Adherence):** Check interface elements against the approved style guide and checklist.
    *   **Проверка всех состояний компонентов (Check All Component States):** As indicated in the Phase 5 checklist, ensure all declared component states (hover, focus, disabled, error, empty, etc.) are verified.
    *   **Доступность (Accessibility):** Consider basic accessibility principles (contrast, keyboard navigation) where possible, even if full accessibility testing is a separate stage.
*   **Дополнительные подходы (Additional Approaches):**
    *   **Исследовательское тестирование (Exploratory Testing):** Besides formal test cases, allocate time for free exploration to find problems, where the tester uses their experience and intuition to uncover non-obvious bugs.
    *   **Тестирование на основе рисков (Risk-based Testing):** Dedicate more attention to areas with a high risk of failure or a high cost of error. 