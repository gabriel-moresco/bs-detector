import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import { generateText } from "ai"

import type { VerificationResult } from "@/lib/agents/authority-verifier"
import type { QuoteVerificationResult } from "@/lib/agents/quote-verifier"
import type { ClaimCheckResult } from "@/lib/agents/cross-doc-checker"
import { logger } from "@/lib/logger"
import { SYSTEM_PROMPT } from "./prompt"

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "medium"

const TAG = "judicial-memo"

export type MemoInput = {
  verifications?: VerificationResult[]
  quoteVerifications?: QuoteVerificationResult[]
  crossDocResults?: ClaimCheckResult[]
}

export type MemoResult = {
  memo: string
  findingsUsed: number
}

type Finding = { category: string; summary: string }

function collectFindings(input: MemoInput): Finding[] {
  const findings: Finding[] = []

  if (input.verifications) {
    for (const v of input.verifications) {
      if (v.verdict === "MISREPRESENTS") {
        findings.push({
          category: "Misrepresented authority",
          summary: `Citation ${v.citation_id}: ${v.reasoning}`,
        })
      }
      if (v.verdict === "LIKELY_FABRICATED") {
        findings.push({
          category: "Likely fabricated citation",
          summary: `Citation ${v.citation_id}: ${v.reasoning}`,
        })
      }
    }
  }

  if (input.quoteVerifications) {
    for (const q of input.quoteVerifications) {
      if (q.verdict === "ALTERED") {
        const meaningfulAlterations = q.alterations.filter(
          (a) => a.changes_meaning
        )
        if (meaningfulAlterations.length > 0) {
          findings.push({
            category: "Altered quote",
            summary: `Citation ${q.citation_id}: quote "${q.quote.slice(0, 80)}..." — ${q.reasoning}`,
          })
        }
      }
    }
  }

  if (input.crossDocResults) {
    for (const c of input.crossDocResults) {
      if (c.verdict === "CONTRADICTED") {
        const materialDiscrepancies = c.discrepancies.filter(
          (d) => d.severity === "MATERIAL"
        )
        if (materialDiscrepancies.length > 0) {
          findings.push({
            category: "Contradicted fact",
            summary: `Claim "${c.claim}" — ${c.reasoning}`,
          })
        }
      }
    }
  }

  return findings
}

function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return "No credibility concerns were identified by the automated verification pipeline."
  }

  return findings
    .map((f, i) => `${i + 1}. [${f.category}] ${f.summary}`)
    .join("\n")
}

export async function generateJudicialMemo(
  input: MemoInput
): Promise<MemoResult> {
  logger.stageStart(TAG)
  const startedAt = Date.now()

  const findings = collectFindings(input)
  logger.step(TAG, `${findings.length} findings to synthesize`)

  if (findings.length === 0) {
    const memo =
      "The automated verification pipeline identified no credibility concerns in the movant's brief."
    logger.stageEnd(TAG, Date.now() - startedAt, "no findings")
    return { memo, findingsUsed: 0 }
  }

  const result = await generateText({
    model: openai.responses(MODEL),
    system: SYSTEM_PROMPT,
    prompt:
      `Synthesize the following verified findings into a single bench-memo paragraph for the judge.\n\n` +
      `Findings:\n${formatFindings(findings)}`,
    providerOptions: {
      openai: {
        reasoningEffort: REASONING_EFFORT,
      } satisfies OpenAIResponsesProviderOptions,
    },
  })

  if (result.warnings && result.warnings.length > 0) {
    logger.warn(TAG, `warnings: ${JSON.stringify(result.warnings)}`)
  }

  if (result.finishReason !== "stop") {
    logger.warn(TAG, `non-stop finishReason: ${result.finishReason}`)
  }

  logger.stageEnd(TAG, Date.now() - startedAt, `${findings.length} findings`)

  return { memo: result.text, findingsUsed: findings.length }
}
