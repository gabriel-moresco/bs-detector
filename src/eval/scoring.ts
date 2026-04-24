/**
 * Matching and scoring logic for the eval harness.
 *
 * Each scorer takes the pipeline's output + the golden dataset and produces
 * structured results with TP/FP/FN counts for precision, recall, and
 * hallucination-rate computation.
 */

import type {
  ExpectedCitation,
  ExpectedAuthorityVerdict,
  ExpectedQuoteVerdict,
  ExpectedCrossDocFlaw,
  Confidence,
} from "./golden-dataset"

// ---------------------------------------------------------------------------
// Pipeline output types (mirrors the API response — standalone, no @/ deps)
// ---------------------------------------------------------------------------

export type PipelineCitation = {
  id: string
  case_name: string
  reporter_citation: string
  year: number
  pincite: string | null
  proposition: string
  direct_quote: string | null
  parenthetical: string | null
  signal: string | null
  is_back_reference: boolean
  location: { section: string; paragraph_index: number }
  raw_text: string
}

export type PipelineVerification = {
  citation_id: string
  verdict: "SUPPORTS" | "MISREPRESENTS" | "LIKELY_FABRICATED" | "UNVERIFIABLE"
  reasoning: string
  evidence_excerpt: string | null
  courtlistener_url: string | null
}

export type PipelineQuoteVerification = {
  citation_id: string
  quote: string
  verdict: "ACCURATE" | "ALTERED" | "NOT_FOUND" | "UNVERIFIABLE"
  original_text: string | null
  alterations: {
    type: "omission" | "substitution" | "addition"
    brief_version: string
    original_version: string
    changes_meaning: boolean
  }[]
  reasoning: string
}

export type PipelineClaimCheck = {
  claim_id: string
  claim: string
  verdict: "CONSISTENT" | "CONTRADICTED" | "UNSUPPORTED" | "UNVERIFIABLE"
  discrepancies: {
    source_document: string
    source_excerpt: string
    type: "DATE" | "FACT" | "OMISSION" | "MISCHARACTERIZATION"
    severity: "MINOR" | "MATERIAL"
    explanation: string
  }[]
  reasoning: string
}

export type PipelineReport = {
  citations?: PipelineCitation[]
  verifications?: PipelineVerification[]
  quoteVerifications?: PipelineQuoteVerification[]
  claims?: unknown[]
  crossDocResults?: PipelineClaimCheck[]
  errors?: { stage: string; error: string }[]
}

// ---------------------------------------------------------------------------
// Eval result types
// ---------------------------------------------------------------------------

export type Metrics = {
  precision: number | null
  recall: number | null
  f1: number | null
  hallucination_rate: number | null
  tp: number
  fp: number
  fn: number
}

export type CitationExtractionResult = {
  expected: number
  found: number
  extra: number
  recall: number
  precision: number
  matched: string[]
  missed: string[]
  unexpected: string[]
}

export type VerdictDetail = {
  reporter_citation: string
  case_name: string
  expected_verdict: string
  actual_verdict: string | null
  correct: boolean
  confidence: Confidence
  notes: string
}

export type AgentResult = {
  metrics: Metrics
  details: VerdictDetail[]
}

export type CrossDocDetail = {
  id: string
  description: string
  expected_verdict: string
  matched: boolean
  matched_claim?: string
  actual_verdict?: string
  confidence: Confidence
}

export type CrossDocResult = {
  metrics: Metrics
  details: CrossDocDetail[]
  false_positives: { claim: string; verdict: string; reasoning: string }[]
}

export type EvalReport = {
  timestamp: string
  pipeline_elapsed_ms: number
  eval_elapsed_ms: number
  summary: {
    overall_precision: number | null
    overall_recall: number | null
    overall_f1: number | null
    overall_hallucination_rate: number | null
    total_tp: number
    total_fp: number
    total_fn: number
  }
  agents: {
    citation_extraction: CitationExtractionResult
    authority_verification: AgentResult
    quote_verification: AgentResult
    cross_doc_consistency: CrossDocResult
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeReporter(citation: string): string {
  return citation.toLowerCase().replace(/\s+/g, " ").trim()
}

export function computeMetrics(tp: number, fp: number, fn: number): Metrics {
  const totalFlags = tp + fp
  const totalExpected = tp + fn

  const precision = totalFlags > 0 ? tp / totalFlags : null
  const recall = totalExpected > 0 ? tp / totalExpected : null
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null
  const hallucination_rate = totalFlags > 0 ? fp / totalFlags : null

  return { precision, recall, f1, hallucination_rate, tp, fp, fn }
}

// ---------------------------------------------------------------------------
// Citation Extraction Scoring
// ---------------------------------------------------------------------------

const AUTHORITY_FLAG_VERDICTS = new Set(["MISREPRESENTS", "LIKELY_FABRICATED"])
const QUOTE_FLAG_VERDICTS = new Set(["ALTERED", "NOT_FOUND"])
const CROSSDOC_FLAG_VERDICTS = new Set(["CONTRADICTED"])

export function scoreCitationExtraction(
  report: PipelineReport,
  goldenCitations: ExpectedCitation[]
): CitationExtractionResult {
  const pipelineCitations = report.citations ?? []

  const goldenPrimaries = goldenCitations.filter((c) => !c.is_back_reference)
  const goldenBackRefs = goldenCitations.filter((c) => c.is_back_reference)

  const pipelinePrimaries = pipelineCitations.filter(
    (c) => !c.is_back_reference
  )
  const pipelineBackRefs = pipelineCitations.filter((c) => c.is_back_reference)

  const matched: string[] = []
  const missed: string[] = []
  const unexpected: string[] = []

  const pipelinePrimarySet = new Set(
    pipelinePrimaries.map((c) => normalizeReporter(c.reporter_citation))
  )
  const pipelineBackRefSet = new Set(
    pipelineBackRefs.map((c) => normalizeReporter(c.reporter_citation))
  )

  for (const golden of goldenPrimaries) {
    const norm = normalizeReporter(golden.reporter_citation)
    if (pipelinePrimarySet.has(norm)) {
      matched.push(`${golden.case_name} (${golden.reporter_citation})`)
    } else {
      missed.push(`${golden.case_name} (${golden.reporter_citation})`)
    }
  }

  for (const golden of goldenBackRefs) {
    const norm = normalizeReporter(golden.reporter_citation)
    if (pipelineBackRefSet.has(norm)) {
      matched.push(
        `${golden.case_name} [back-ref] (${golden.reporter_citation})`
      )
    } else {
      missed.push(
        `${golden.case_name} [back-ref] (${golden.reporter_citation})`
      )
    }
  }

  const goldenPrimarySet = new Set(
    goldenPrimaries.map((c) => normalizeReporter(c.reporter_citation))
  )
  const goldenBackRefSet = new Set(
    goldenBackRefs.map((c) => normalizeReporter(c.reporter_citation))
  )

  for (const p of pipelinePrimaries) {
    const norm = normalizeReporter(p.reporter_citation)
    if (!goldenPrimarySet.has(norm)) {
      unexpected.push(`${p.case_name} (${p.reporter_citation})`)
    }
  }
  for (const p of pipelineBackRefs) {
    const norm = normalizeReporter(p.reporter_citation)
    if (!goldenBackRefSet.has(norm)) {
      unexpected.push(`${p.case_name} [back-ref] (${p.reporter_citation})`)
    }
  }

  const totalGolden = goldenCitations.length
  const totalPipeline = pipelineCitations.length

  return {
    expected: totalGolden,
    found: matched.length,
    extra: unexpected.length,
    recall: totalGolden > 0 ? matched.length / totalGolden : 1,
    precision: totalPipeline > 0 ? matched.length / totalPipeline : 1,
    matched,
    missed,
    unexpected,
  }
}

// ---------------------------------------------------------------------------
// Authority Verification Scoring
// ---------------------------------------------------------------------------

export function scoreAuthorityVerification(
  report: PipelineReport,
  goldenVerdicts: ExpectedAuthorityVerdict[]
): AgentResult {
  const pipelineCitations = report.citations ?? []
  const pipelineVerifications = report.verifications ?? []
  const details: VerdictDetail[] = []
  let tp = 0,
    fp = 0,
    fn = 0

  for (const golden of goldenVerdicts) {
    const goldenNorm = normalizeReporter(golden.reporter_citation)

    const pCitation = pipelineCitations.find(
      (c) =>
        normalizeReporter(c.reporter_citation) === goldenNorm &&
        !c.is_back_reference
    )

    if (!pCitation) {
      if (AUTHORITY_FLAG_VERDICTS.has(golden.expected_verdict)) fn++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: null,
        correct: false,
        confidence: golden.confidence,
        notes: `${golden.notes} [citation not extracted by pipeline]`,
      })
      continue
    }

    const verification = pipelineVerifications.find(
      (v) => v.citation_id === pCitation.id
    )

    if (!verification) {
      if (AUTHORITY_FLAG_VERDICTS.has(golden.expected_verdict)) fn++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: null,
        correct: false,
        confidence: golden.confidence,
        notes: `${golden.notes} [no verification result for this citation]`,
      })
      continue
    }

    const actualIsFlag = AUTHORITY_FLAG_VERDICTS.has(verification.verdict)
    const expectedIsFlag = AUTHORITY_FLAG_VERDICTS.has(golden.expected_verdict)
    const actualIsAbstention = verification.verdict === "UNVERIFIABLE"

    if (actualIsAbstention) {
      if (expectedIsFlag) fn++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: verification.verdict,
        correct: !expectedIsFlag,
        confidence: golden.confidence,
        notes: golden.notes,
      })
      continue
    }

    if (actualIsFlag && expectedIsFlag) {
      tp++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: verification.verdict,
        correct: true,
        confidence: golden.confidence,
        notes: golden.notes,
      })
    } else if (actualIsFlag && !expectedIsFlag) {
      fp++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: verification.verdict,
        correct: false,
        confidence: golden.confidence,
        notes: golden.notes,
      })
    } else if (!actualIsFlag && expectedIsFlag) {
      fn++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: verification.verdict,
        correct: false,
        confidence: golden.confidence,
        notes: golden.notes,
      })
    } else {
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.case_name,
        expected_verdict: golden.expected_verdict,
        actual_verdict: verification.verdict,
        correct: true,
        confidence: golden.confidence,
        notes: golden.notes,
      })
    }
  }

  return { metrics: computeMetrics(tp, fp, fn), details }
}

// ---------------------------------------------------------------------------
// Quote Verification Scoring
// ---------------------------------------------------------------------------

export function scoreQuoteVerification(
  report: PipelineReport,
  goldenQuotes: ExpectedQuoteVerdict[]
): AgentResult {
  const pipelineQuotes = report.quoteVerifications ?? []
  const pipelineCitations = report.citations ?? []
  const details: VerdictDetail[] = []
  let tp = 0,
    fp = 0,
    fn = 0

  for (const golden of goldenQuotes) {
    const goldenNorm = normalizeReporter(golden.reporter_citation)

    const matchingCitation = pipelineCitations.find(
      (c) => normalizeReporter(c.reporter_citation) === goldenNorm
    )

    let pQuote: PipelineQuoteVerification | undefined
    if (matchingCitation) {
      pQuote = pipelineQuotes.find(
        (q) =>
          q.citation_id === matchingCitation.id &&
          q.quote.toLowerCase().includes(golden.quote_snippet.toLowerCase())
      )
    }

    if (!pQuote) {
      pQuote = pipelineQuotes.find((q) =>
        q.quote.toLowerCase().includes(golden.quote_snippet.toLowerCase())
      )
    }

    if (!pQuote) {
      if (QUOTE_FLAG_VERDICTS.has(golden.expected_verdict)) fn++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.quote_snippet,
        expected_verdict: golden.expected_verdict,
        actual_verdict: null,
        correct: false,
        confidence: golden.confidence,
        notes: `${golden.notes} [quote not found in pipeline output]`,
      })
      continue
    }

    const actualIsFlag = QUOTE_FLAG_VERDICTS.has(pQuote.verdict)
    const expectedIsFlag = QUOTE_FLAG_VERDICTS.has(golden.expected_verdict)
    const actualIsAbstention = pQuote.verdict === "UNVERIFIABLE"
    const expectedIsAbstention = golden.expected_verdict === "UNVERIFIABLE"

    if (expectedIsAbstention) {
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.quote_snippet,
        expected_verdict: golden.expected_verdict,
        actual_verdict: pQuote.verdict,
        correct: actualIsAbstention,
        confidence: golden.confidence,
        notes: `${golden.notes} [excluded from flag scoring — expected abstention]`,
      })
      continue
    }

    if (actualIsAbstention) {
      if (expectedIsFlag) fn++
      details.push({
        reporter_citation: golden.reporter_citation,
        case_name: golden.quote_snippet,
        expected_verdict: golden.expected_verdict,
        actual_verdict: pQuote.verdict,
        correct: false,
        confidence: golden.confidence,
        notes: golden.notes,
      })
      continue
    }

    if (actualIsFlag && expectedIsFlag) tp++
    else if (actualIsFlag && !expectedIsFlag) fp++
    else if (!actualIsFlag && expectedIsFlag) fn++

    details.push({
      reporter_citation: golden.reporter_citation,
      case_name: golden.quote_snippet,
      expected_verdict: golden.expected_verdict,
      actual_verdict: pQuote.verdict,
      correct:
        (actualIsFlag && expectedIsFlag) ||
        (!actualIsFlag && !expectedIsFlag),
      confidence: golden.confidence,
      notes: golden.notes,
    })
  }

  return { metrics: computeMetrics(tp, fp, fn), details }
}

// ---------------------------------------------------------------------------
// Cross-Document Consistency Scoring
// ---------------------------------------------------------------------------

function textMatchesPatterns(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase()
  return patterns.some((p) => {
    if (p.includes(".*")) {
      try {
        return new RegExp(p, "i").test(text)
      } catch {
        return lower.includes(p.toLowerCase())
      }
    }
    return lower.includes(p.toLowerCase())
  })
}

function claimCheckMatchesFlaw(
  check: PipelineClaimCheck,
  flaw: ExpectedCrossDocFlaw
): boolean {
  const searchable = [
    check.claim,
    check.reasoning,
    ...check.discrepancies.map((d) => d.explanation),
    ...check.discrepancies.map((d) => d.source_excerpt),
  ].join(" ")

  return textMatchesPatterns(searchable, flaw.claim_patterns)
}

export function scoreCrossDocConsistency(
  report: PipelineReport,
  goldenFlaws: ExpectedCrossDocFlaw[]
): CrossDocResult {
  const pipelineChecks = report.crossDocResults ?? []
  const details: CrossDocDetail[] = []
  const matchedPipelineIds = new Set<string>()
  let tp = 0,
    fp = 0,
    fn = 0

  for (const flaw of goldenFlaws) {
    const expectedIsFlag = CROSSDOC_FLAG_VERDICTS.has(flaw.expected_verdict)

    const matchingCheck = pipelineChecks.find(
      (check) =>
        !matchedPipelineIds.has(check.claim_id) &&
        claimCheckMatchesFlaw(check, flaw)
    )

    if (!matchingCheck) {
      if (expectedIsFlag) fn++
      details.push({
        id: flaw.id,
        description: flaw.description,
        expected_verdict: flaw.expected_verdict,
        matched: false,
        confidence: flaw.confidence,
      })
      continue
    }

    matchedPipelineIds.add(matchingCheck.claim_id)

    const actualIsFlag = CROSSDOC_FLAG_VERDICTS.has(matchingCheck.verdict)

    if (actualIsFlag && expectedIsFlag) tp++
    else if (actualIsFlag && !expectedIsFlag) fp++
    else if (!actualIsFlag && expectedIsFlag) fn++

    details.push({
      id: flaw.id,
      description: flaw.description,
      expected_verdict: flaw.expected_verdict,
      matched: true,
      matched_claim: matchingCheck.claim,
      actual_verdict: matchingCheck.verdict,
      confidence: flaw.confidence,
    })
  }

  const false_positives: CrossDocResult["false_positives"] = []
  for (const check of pipelineChecks) {
    if (matchedPipelineIds.has(check.claim_id)) continue
    if (!CROSSDOC_FLAG_VERDICTS.has(check.verdict)) continue

    const matchesAnyFlaw = goldenFlaws.some((flaw) =>
      claimCheckMatchesFlaw(check, flaw)
    )
    if (!matchesAnyFlaw) {
      fp++
      false_positives.push({
        claim: check.claim,
        verdict: check.verdict,
        reasoning: check.reasoning,
      })
    }
  }

  return {
    metrics: computeMetrics(tp, fp, fn),
    details,
    false_positives,
  }
}

// ---------------------------------------------------------------------------
// Overall summary
// ---------------------------------------------------------------------------

export function computeOverallSummary(agents: EvalReport["agents"]) {
  const tp =
    agents.authority_verification.metrics.tp +
    agents.quote_verification.metrics.tp +
    agents.cross_doc_consistency.metrics.tp
  const fp =
    agents.authority_verification.metrics.fp +
    agents.quote_verification.metrics.fp +
    agents.cross_doc_consistency.metrics.fp
  const fn =
    agents.authority_verification.metrics.fn +
    agents.quote_verification.metrics.fn +
    agents.cross_doc_consistency.metrics.fn

  const metrics = computeMetrics(tp, fp, fn)

  return {
    overall_precision: metrics.precision,
    overall_recall: metrics.recall,
    overall_f1: metrics.f1,
    overall_hallucination_rate: metrics.hallucination_rate,
    total_tp: tp,
    total_fp: fp,
    total_fn: fn,
  }
}
