import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import { generateText, Output } from "ai"

import type { Citation } from "@/lib/agents/citation-extractor/schema"
import { lookupCitation, type LookupResult } from "@/lib/courtlistener"
import { logger } from "@/lib/logger"
import { SYSTEM_PROMPT } from "./prompt"
import { llmVerdictWrapperSchema } from "./schema"

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "high"

export type Verdict =
  | "SUPPORTS"
  | "MISREPRESENTS"
  | "LIKELY_FABRICATED"
  | "UNVERIFIABLE"

export type VerificationResult = {
  citation_id: string
  verdict: Verdict
  reasoning: string
  evidence_excerpt: string | null
  courtlistener_url: string | null
}

const TAG = "authority-verifier"
const OPINION_TEXT_MAX_CHARS = 30_000

function truncateOpinion(text: string): string {
  if (text.length <= OPINION_TEXT_MAX_CHARS) return text
  return (
    text.slice(0, OPINION_TEXT_MAX_CHARS) +
    "\n\n[... opinion text truncated for length ...]"
  )
}

async function verifySingleCitation(
  citation: Citation,
  opinionText: string,
  courtlistenerUrl: string
): Promise<VerificationResult> {
  logger.step(TAG, `verifying ${citation.id}: ${citation.case_name}`)
  const startedAt = Date.now()

  const pinciteHint = citation.pincite
    ? `Pincite: at ${citation.pincite}\n`
    : ""

  const result = await generateText({
    model: openai.responses(MODEL),
    system: SYSTEM_PROMPT,
    prompt:
      `The brief claims the following proposition is supported by ${citation.case_name}:\n\n` +
      `Proposition: "${citation.proposition}"\n` +
      pinciteHint +
      `\nBelow is the opinion text from the cited case:\n\n${truncateOpinion(opinionText)}`,
    output: Output.object({ schema: llmVerdictWrapperSchema }),
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
    verdict: result.output.analysis.verdict,
    reasoning: result.output.analysis.reasoning,
    evidence_excerpt: result.output.analysis.evidence_excerpt,
    courtlistener_url: courtlistenerUrl,
  }
}

function buildProgrammaticResult(
  citationId: string,
  verdict: "LIKELY_FABRICATED" | "UNVERIFIABLE",
  reasoning: string
): VerificationResult {
  return {
    citation_id: citationId,
    verdict,
    reasoning,
    evidence_excerpt: null,
    courtlistener_url: null,
  }
}

export async function verifyAuthorities(
  citations: Citation[]
): Promise<VerificationResult[]> {
  logger.stageStart(TAG)
  const startedAt = Date.now()

  const primaries = citations.filter((c) => !c.is_back_reference)
  const backRefs = citations.filter((c) => c.is_back_reference)

  logger.step(
    TAG,
    `${primaries.length} primary, ${backRefs.length} back-references`
  )

  const uniqueReporters = [
    ...new Set(primaries.map((c) => c.reporter_citation)),
  ]
  const lookupResults = new Map<string, LookupResult>()

  logger.step(
    TAG,
    `looking up ${uniqueReporters.length} unique citations in CourtListener...`
  )
  const lookupPromises = uniqueReporters.map(async (reporter) => {
    const result = await lookupCitation(reporter)
    lookupResults.set(reporter, result)
  })
  await Promise.allSettled(lookupPromises)

  const found = [...lookupResults.values()].filter((r) => r.found).length
  logger.step(
    TAG,
    `lookups complete: ${found} found, ${uniqueReporters.length - found} not found`
  )

  const verificationPromises = primaries.map(
    async (citation): Promise<VerificationResult> => {
      const lookup = lookupResults.get(citation.reporter_citation)

      if (!lookup) {
        return buildProgrammaticResult(
          citation.id,
          "UNVERIFIABLE",
          "CourtListener lookup did not complete."
        )
      }

      if (!lookup.found) {
        if (lookup.reason === "not_found") {
          return buildProgrammaticResult(
            citation.id,
            "LIKELY_FABRICATED",
            `Citation "${citation.reporter_citation}" not found in CourtListener. ${lookup.details || ""}`.trim()
          )
        }
        return buildProgrammaticResult(
          citation.id,
          "UNVERIFIABLE",
          `CourtListener lookup failed: ${lookup.details || lookup.reason}`
        )
      }

      return verifySingleCitation(
        citation,
        lookup.opinion_text,
        lookup.courtlistener_url
      )
    }
  )

  const primaryResults = await Promise.allSettled(verificationPromises)

  const resultsMap = new Map<string, VerificationResult>()
  const reporterToResult = new Map<string, VerificationResult>()

  for (let i = 0; i < primaries.length; i++) {
    const settled = primaryResults[i]
    const citation = primaries[i]

    const result: VerificationResult =
      settled.status === "fulfilled"
        ? settled.value
        : buildProgrammaticResult(
            citation.id,
            "UNVERIFIABLE",
            `Verification failed: ${settled.reason}`
          )

    resultsMap.set(citation.id, result)
    reporterToResult.set(citation.reporter_citation, result)
  }

  for (const backRef of backRefs) {
    const parent = reporterToResult.get(backRef.reporter_citation)
    if (parent) {
      resultsMap.set(backRef.id, {
        ...parent,
        citation_id: backRef.id,
        reasoning: `Back-reference to ${backRef.case_name} — inherits verdict from primary citation. ${parent.reasoning}`,
      })
    } else {
      resultsMap.set(
        backRef.id,
        buildProgrammaticResult(
          backRef.id,
          "UNVERIFIABLE",
          `Back-reference to ${backRef.case_name} but no primary citation was verified for ${backRef.reporter_citation}.`
        )
      )
    }
  }

  const results = citations.map((c) => resultsMap.get(c.id)!)

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
