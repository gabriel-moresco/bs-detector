<p align="center">
  <img alt="BS Detector platform preview" src="https://github.com/gabriel-moresco/bs-detector/blob/main/readme.png" />
</p>

<h2 align="center">BS Detector</h2>

A multi-agent AI pipeline that audits a legal Motion for Summary Judgment and flags three categories of problems:

1. **Fabricated or misrepresented citations** — cases that don't exist or don't say what the brief claims
2. **Altered quotes** — direct quotes with words quietly removed or changed
3. **Contradicted facts** — assertions in the brief that conflict with the police report, medical records, or witness statement

The pipeline produces a structured JSON verification report and a judicial memo summarizing the findings.

See [ROADMAP.md](ROADMAP.md) for the implementation plan I followed — not everything planned was executed due to time constraints. See [REFLECTION.md](REFLECTION.md) for the rationale behind the design choices made throughout the project.

## Architecture

Six agents with distinct roles, orchestrated through a single `POST /analyze` endpoint:

| Agent                        | Tier | Role                                                                                           |
| ---------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `CitationExtractor`          | 1    | Parses every case-law citation from the MSJ (Bluebook format, back-references, string cites)   |
| `AuthorityVerifier`          | 1    | Looks up each citation in CourtListener and checks if the case supports the stated proposition |
| `QuoteVerifier`              | 1    | Compares direct quotes against the actual opinion text for omissions, substitutions, additions |
| `ClaimExtractor`             | 2    | Extracts verifiable factual assertions (dates, injuries, events, conditions, credentials)      |
| `CrossDocConsistencyChecker` | 2    | Checks each factual claim against the police report, medical records, and witness statement    |
| `JudicialMemoAgent`          | 3    | Synthesizes material findings into a single paragraph in judicial register                     |

Agents run in parallel where possible. All inter-agent data is strongly typed (Zod schemas), with no raw text blobs passed between stages.

## Setup

### Prerequisites

- Node.js >= 22
- pnpm
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [CourtListener API token](https://www.courtlistener.com/register) (free — create an account to get your API key)

### Install and run

```bash
pnpm install
cp .env.example .env   # then fill in your keys
pnpm dev
```

The app runs at `http://localhost:3000`.

### Environment variables

| Variable                  | Required | Default        | Description                                                                                  |
| ------------------------- | -------- | -------------- | -------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Yes      | —              | OpenAI API key                                                                               |
| `COURTLISTENER_API_TOKEN` | Yes      | —              | CourtListener API token for case-law lookups                                                 |
| `OPENAI_MODEL`            | No       | `gpt-5.4-mini` | Model identifier passed to `openai.responses()`. Falls back to `gpt-5.4-mini` if not set     |
| `OPENAI_REASONING_EFFORT` | No       | `high`         | Reasoning effort for OpenAI calls (`low`, `medium`, `high`). Falls back to `high` if not set |

## Usage

### Analyze

```bash
curl -X POST http://localhost:3000/analyze
```

The endpoint reads the Rivera v. Harmon case files from `documents/` and returns a JSON report containing:

- `citations` — extracted case-law citations
- `verifications` — authority verification verdicts per citation
- `quoteVerifications` — quote accuracy verdicts
- `claims` — extracted factual assertions
- `crossDocResults` — cross-document consistency verdicts per claim
- `judicialMemo` — synthesized bench memo for the judge
- `errors` — any stage failures (partial degradation, not a crash)

### Verdict types

**Authority verification:** `SUPPORTS`, `MISREPRESENTS`, `LIKELY_FABRICATED`, `UNVERIFIABLE`

**Quote verification:** `ACCURATE`, `ALTERED`, `NOT_FOUND`, `UNVERIFIABLE`

**Cross-document consistency:** `CONSISTENT`, `CONTRADICTED`, `UNSUPPORTED`, `UNVERIFIABLE`

## Evals

The eval harness measures pipeline output quality against a hand-annotated golden dataset of known flaws in the Rivera case.

### Run evals

```bash
# Full run (requires dev server running + API keys)
pnpm eval

# Re-evaluate a saved snapshot without calling the API
pnpm eval -- --snapshot eval-results/latest-snapshot.json
```

### Metrics

- **Precision** — of the flags raised, how many are real?
- **Recall** — of the known flaws, how many did the pipeline catch?
- **Hallucination rate** — how many flags point to something that doesn't exist?

Results are printed to the console and saved as machine-readable JSON in `eval-results/`.

## Project structure

```
documents/                    Case-file fixtures (MSJ, police report, medical records, witness statement)
src/
  app/analyze/route.ts        POST /analyze — pipeline orchestrator
  lib/
    agents/
      citation-extractor/     Tier 1: Bluebook citation parsing
      authority-verifier/     Tier 1: CourtListener lookup + proposition verification
      quote-verifier/         Tier 1: Quote accuracy checking
      claim-extractor/        Tier 2: Factual claim extraction
      cross-doc-checker/      Tier 2: Cross-document consistency
      judicial-memo/          Tier 3: Bench memo synthesis
    courtlistener/            CourtListener API client with disk cache
    logger.ts                 Structured logging ([tag] message)
    retry.ts                  Exponential backoff for pipeline stages
    documents.ts              Fixture loaders
  eval/                       Eval harness (golden dataset, scoring, reporter)
ROADMAP.md                    Functional spec
REFLECTION.md                 Design trade-offs and decisions
```

Each agent follows the same structure: `index.ts` (logic), `prompt.ts` (system prompt with rules + few-shot examples), `schema.ts` (Zod schema for LLM structured output, where applicable).
