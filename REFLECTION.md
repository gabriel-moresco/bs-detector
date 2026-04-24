# Reflection

Notes on the design choices behind this pipeline.

## Tech Stack

Spec says Python + FastAPI + Vite + Docker. I went Next.js full-stack instead — it's my main tech stack and I'm most comfortable building in it, which matters for a 6-hour budget. The evaluation criteria don't care about runtime, so I think this is a fair trade.

## Verifying citations

The hard call. The 4 docs in `documents/` are the litigation file — no jurisprudence in there. So citation verification needs an external source.

Things I rejected, briefly:

- **LLM general knowledge.** A "BS detector" that trusts a fabricator is a contradiction.
- **Native LLM web search (OpenAI/Anthropic).** Returns paraphrased synthesis, not primary text — kills exact quote checking. Also non-deterministic, which makes the eval flaky.
- **Hand-curated KB.** Manual research per case, and absence in my KB ≠ case doesn't exist — so I'd lose the strongest fabrication signal.
- **Scraping Justia/Scholar.** Too fragile for the time budget.

Went with **CourtListener API**. Full opinion text, deterministic, free. The real win: when a citation isn't found there, that's strong evidence of fabrication — not a coverage gap. The thing that looks like a weakness becomes the most useful signal in the pipeline.

## Coverage caveat

CourtListener is strong on federal and California, weaker elsewhere. For Rivera v. Harmon, every cited case is one or the other, so this is fine. In a multi-jurisdiction brief it would be a real limit. Tier 3 has a CAP fallback planned for that reason.

## Opinion text truncation

CourtListener opinions can run 50k+ characters. Sending the full text to the LLM for every citation would blow context and cost. I truncate to 30k chars (~7.5k tokens) — enough for the model to find the holding and assess the proposition. The downside: if the relevant passage sits past the cutoff, the verdict degrades. A smarter approach would extract the section around the pincite, but that requires reliable page-number mapping that CourtListener text doesn't have. Truncation is the honest trade-off for now.

## Prompt calibration

To reduce extraction ambiguity without overloading context, I decided to keep two few-shot examples in the system prompt and use micro-examples in each JSON schema field description. The few-shots teach cross-field behavior (like back-references and signal handling), while schema descriptions constrain each field locally. This split keeps the prompt lean and lowers example leakage risk.

## Synchronous endpoint vs. async workers

Ideally this pipeline would run asynchronously via a worker platform (e.g. BullMQ + Redis, Inngest, Trigger.dev). I went with a single synchronous endpoint instead to stay within the time budget and to keep the dev setup simple — no extra accounts, services, or environment variables. One `pnpm dev` and it runs.

The trade-off: depending on how long the agent pipeline takes, serverless platforms like Vercel may hit their function execution time limit before it finishes. A long-running compute environment avoids this, but adds complexity that didn't fit the constraint.
