# BS Detector — Roadmap

Functional spec for the multi-agent legal-brief verification pipeline. This document describes **what** we are building, not **how** it is implemented.

---

## Goal

Build a pipeline that audits a legal Motion for Summary Judgment (`Rivera v. Harmon Construction Group`) and flags three categories of "BS":

1. **Citations to cases that don't say what the brief claims** (or don't exist at all)
2. **Direct quotes with words quietly removed or altered**
3. **Facts in the brief that contradict the case-file documents sitting next to it**

Output: a structured JSON verification report — not prose.

---

## Stack & Key Decisions (locked)

| Decision                         | Choice                                                                                                           | Why                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Application stack                | **Next.js 16 full-stack** (App Router + API Routes + same app for UI)                                            | Single deployable, no Docker, fastest path in 6h                                                                       |
| LLM provider                     | **OpenAI**                                                                                                       | Per SPEC convention; specific model selected at implementation time                                                    |
| Jurisprudence source             | **CourtListener API** (primary)                                                                                  | Returns primary-source opinion text; deterministic; free; absence is diagnostic of fabrication                         |
| Schema layer                     | Strongly typed, structured data passed between agents (no raw text blobs)                                        | Required by Tier 2                                                                                                     |
| Initial input                    | **Hardcoded** to the 4 docs in `documents/`                                                                      | Upload UX is out of scope for MVP                                                                                      |
| Response mode                    | **Single response** (no streaming)                                                                               | Streaming has no value for JSON outputs; will reconsider only for the prose-output `JudicialMemoAgent` if time permits |
| Eval scoring                     | Programmatic (precision / recall / hallucination rate) for Tier 1; LLM-as-judge optional for Tier 3 memo quality | Honest mechanical metrics first, qualitative second                                                                    |
| Verification source for case law | CourtListener only — **no LLM knowledge, no curated KB, no native LLM web search**                               | See REFLECTION.md for full rationale                                                                                   |

---

## Tier 1 — Core (must work end-to-end)

### Agent: `CitationExtractor`

- **Input:** raw text of the Motion for Summary Judgment.
- **Output:** structured list of citations, each with:
  - case name, reporter citation, year
  - the proposition the brief says the case supports
  - the direct quote (if any), separated from paraphrase
  - pincite (e.g., "at 702") if present
  - location in the MSJ (section / paragraph)
- **Analysis performed:** Bluebook-style citation parsing, separation of literal quotations from paraphrase, identification of which proposition each citation backs.

### Agent: `AuthorityVerifier`

- **Input:** one citation + access to CourtListener.
- **Output:** verdict per citation
  - `SUPPORTS` — the cited case actually stands for the proposition
  - `MISREPRESENTS` — the case exists but does not support the proposition as stated
  - `LIKELY_FABRICATED` — the case is not found in primary-source databases
  - `UNVERIFIABLE` — lookup failed for technical reasons (rate limit, network, ambiguous match)
  - plus evidence (excerpt from the opinion) and reasoning
- **Analysis performed:** lookup by citation; if found, semantic comparison between cited proposition and actual holding; if not found, flag as likely fabricated with appropriate confidence.

### Agent: `QuoteVerifier`

- **Input:** literal quote + source opinion text retrieved from CourtListener.
- **Output:** per quote — accurate (yes/no), original text, omitted text (if any), altered text (if any).
- **Analysis performed:** exact textual diff, detection of suspicious ellipses, detection of word substitutions that change meaning.

### Endpoint: `POST /analyze`

- **Input:** none for MVP (case is hardcoded).
- **Output:** complete structured JSON report containing all findings from the agents above.

### Infrastructure: CourtListener client

- Wraps the CourtListener API.
- Caches responses locally on disk so evals are deterministic and re-runnable for free.

---

## Tier 2 — Expected

### Agent: `ClaimExtractor`

- **Input:** raw text of the Motion for Summary Judgment.
- **Output:** structured list of factual claims — verifiable assertions about events, dates, conditions, quantities, and responsibilities (e.g., "Rivera was not wearing PPE", "Harmon passed all OSHA inspections", "8 years of experience").
- **Analysis performed:** identify every factual assertion in the MSJ that is checkable against the lateral case-file documents. Excludes legal conclusions and propositions backed by case law (those belong to `CitationExtractor`).
- **Relationship:** mirrors the `CitationExtractor` → `AuthorityVerifier` pattern. `ClaimExtractor` extracts, `CrossDocConsistencyChecker` verifies.

### Agent: `CrossDocConsistencyChecker`

- **Input:** factual claims from `ClaimExtractor` + the police report + medical records + witness statement.
- **Output:** list of discrepancies
  - the MSJ claim, the contradicting source document, the contradicting excerpt
  - severity (`MINOR` / `MATERIAL`)
  - type (`DATE` / `FACT` / `OMISSION` / `MISCHARACTERIZATION`)
- **Analysis performed:** for each factual claim, check it against the three lateral documents. Flag contradictions, omissions, and mischaracterizations.

### Eval harness

- Single command runs the full eval (e.g., `pnpm eval`).
- Inputs: a hand-annotated **golden dataset** of known flaws in the Rivera case (citations, quotes, facts) — to be authored later.
- Metrics:
  - **Precision** — of the flags raised, how many are real?
  - **Recall** — of the known flaws, how many did the pipeline catch?
  - **Hallucination rate** — how many flags point to something that doesn't exist?
- Output: console report + machine-readable JSON breakdown per agent.

### Schemas between agents

- All agent inputs and outputs are typed structured objects.
- No raw text blobs passed across boundaries.

### Behavior: honest abstention

- `UNVERIFIABLE` is a first-class verdict, not a failure mode.
- The eval rewards honest abstention over fabricated findings.

---

## Tier 3 — Stretch

### Agent: `JudicialMemoAgent`

- **Input:** top findings filtered by severity × confidence.
- **Output:** a single sober paragraph in judicial register, prose form.
- **Analysis performed:** synthesizes only what matters for a judge — not everything.

### Resilient orchestrator

- Per-agent timeouts and bounded retries.
- If one agent fails, the section is marked `UNAVAILABLE` instead of crashing the whole report.

### UI (Next.js)

- Renders the report as cards per finding.
- Color-codes by severity, exposes evidence in expandable sections, links findings back to the MSJ location.

### `REFLECTION.md`

- Trade-offs made, limitations honestly stated, what would be cut/changed with more time.
- See `REFLECTION.md` (separate file).

---

## Out of scope (deliberately)

- Streaming for JSON-output agents (no value)
- Use of LLM general knowledge as a fact source
- Hand-curated jurisprudence KB
- Native LLM web search tools (see REFLECTION.md)
- Multi-jurisdiction support beyond CA + federal
- Authentication / multi-user
