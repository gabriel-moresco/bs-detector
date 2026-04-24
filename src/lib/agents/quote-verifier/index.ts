import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import { generateText, Output } from "ai"

import type { Citation } from "@/lib/agents/citation-extractor/schema"
import { lookupCitation } from "@/lib/courtlistener"
import { logger } from "@/lib/logger"
import { SYSTEM_PROMPT } from "./prompt"
import { llmQuoteAnalysisSchema } from "./schema"

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "medium"

const TAG = "quote-verifier"
const OPINION_TEXT_MAX_CHARS = 30_000

export type QuoteVerdict = "ACCURATE" | "ALTERED" | "NOT_FOUND" | "UNVERIFIABLE"

export type Alteration = {
  type: "omission" | "substitution" | "addition"
  brief_version: string
  original_version: string
  changes_meaning: boolean
}

export type QuoteVerificationResult = {
  citation_id: string
  quote: string
  verdict: QuoteVerdict
  original_text: string | null
  alterations: Alteration[]
  reasoning: string
}

function truncateOpinion(text: string): string {
  if (text.length <= OPINION_TEXT_MAX_CHARS) return text
  return (
    text.slice(0, OPINION_TEXT_MAX_CHARS) +
    "\n\n[... opinion text truncated for length ...]"
  )
}

async function verifySingleQuote(
  citation: Citation,
  opinionText: string
): Promise<QuoteVerificationResult> {
  logger.step(
    TAG,
    `verifying ${citation.id}: "${citation.direct_quote!.slice(0, 60)}..."`
  )
  const startedAt = Date.now()

  const result = await generateText({
    model: openai.responses(MODEL),
    system: SYSTEM_PROMPT,
    prompt:
      `The brief quotes ${citation.case_name} as follows:\n\n` +
      `Quote: "${citation.direct_quote}"\n\n` +
      `Below is the full opinion text. Find the passage that matches this quote and assess its accuracy.\n\n` +
      truncateOpinion(opinionText),
    output: Output.object({ schema: llmQuoteAnalysisSchema }),
    providerOptions: {
      openai: {
        reasoningEffort: REASONING_EFFORT,
      } satisfies OpenAIResponsesProviderOptions,
    },
  })

  if (result.warnings && result.warnings.length > 0) {
    logger.warn(TAG, `${citation.id}: ${JSON.stringify(result.warnings)}`)
  }

  if (result.finishReason !== "stop") {
    logger.warn(
      TAG,
      `${citation.id}: non-stop finishReason: ${result.finishReason}`
    )
  }

  const elapsedMs = Date.now() - startedAt
  logger.step(
    TAG,
    `${citation.id} -> ${result.output.analysis.verdict} (${(elapsedMs / 1000).toFixed(2)}s)`
  )

  return {
    citation_id: citation.id,
    quote: citation.direct_quote!,
    verdict: result.output.analysis.verdict,
    original_text: result.output.analysis.original_text,
    alterations: result.output.analysis.alterations,
    reasoning: result.output.analysis.reasoning,
  }
}

export async function verifyQuotes(
  citations: Citation[]
): Promise<QuoteVerificationResult[]> {
  const withQuotes = citations.filter((c) => c.direct_quote !== null)

  if (withQuotes.length === 0) {
    logger.step(TAG, "no direct quotes to verify, skipping")
    return []
  }

  logger.stageStart(TAG)
  const startedAt = Date.now()
  logger.step(TAG, `${withQuotes.length} citations with direct quotes`)

  const results: QuoteVerificationResult[] = []

  const verificationPromises = withQuotes.map(
    async (citation): Promise<QuoteVerificationResult> => {
      const lookup = await lookupCitation(citation.reporter_citation)

      if (!lookup.found) {
        logger.step(TAG, `${citation.id}: skipped (opinion not available)`)
        return {
          citation_id: citation.id,
          quote: citation.direct_quote!,
          verdict: "UNVERIFIABLE",
          original_text: null,
          alterations: [],
          reasoning: `Cannot verify quote — opinion text for "${citation.reporter_citation}" is not available.`,
        }
      }

      return verifySingleQuote(citation, lookup.opinion_text)
    }
  )

  const settled = await Promise.allSettled(verificationPromises)

  for (let i = 0; i < withQuotes.length; i++) {
    const outcome = settled[i]
    if (outcome.status === "fulfilled") {
      results.push(outcome.value)
    } else {
      results.push({
        citation_id: withQuotes[i].id,
        quote: withQuotes[i].direct_quote!,
        verdict: "UNVERIFIABLE",
        original_text: null,
        alterations: [],
        reasoning: `Verification failed: ${outcome.reason}`,
      })
    }
  }

  const elapsedMs = Date.now() - startedAt
  const verdictCounts = results.reduce(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const summary = Object.entries(verdictCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ")
  logger.stageEnd(TAG, elapsedMs, summary)

  return results
}
