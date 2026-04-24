/**
 * Console and JSON report formatting for the eval harness.
 */

import type {
  EvalReport,
  CitationExtractionResult,
  AgentResult,
  CrossDocResult,
  Metrics,
} from "./scoring"

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pct(value: number | null): string {
  if (value === null) return "N/A"
  return `${(value * 100).toFixed(1)}%`
}

function line(char: string, width = 60): string {
  return char.repeat(width)
}

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------

export function printConsoleReport(report: EvalReport): void {
  const log = console.log.bind(console)

  log()
  log(line("="))
  log("  BS Detector — Eval Report")
  log(line("="))
  log()
  log(`  Timestamp:    ${report.timestamp}`)
  log(`  Pipeline:     ${(report.pipeline_elapsed_ms / 1000).toFixed(1)}s`)
  log(`  Eval scoring: ${report.eval_elapsed_ms}ms`)
  log()

  printCitationExtraction(report.agents.citation_extraction, log)
  printAgentSection(
    "Authority Verification",
    report.agents.authority_verification,
    log
  )
  printAgentSection(
    "Quote Verification",
    report.agents.quote_verification,
    log
  )
  printCrossDocSection(report.agents.cross_doc_consistency, log)
  printSummary(report, log)

  log()
}

function printCitationExtraction(
  result: CitationExtractionResult,
  log: (...args: unknown[]) => void
): void {
  log(line("-"))
  log("  Citation Extraction")
  log(line("-"))
  log(
    `  Expected: ${result.expected}  Found: ${result.found}  Extra: ${result.extra}`
  )
  log(`  Recall: ${pct(result.recall)}  Precision: ${pct(result.precision)}`)
  log()

  for (const m of result.matched) log(`  + ${m}`)
  for (const m of result.missed) log(`  - ${m}  [MISSED]`)
  for (const u of result.unexpected) log(`  ? ${u}  [UNEXPECTED]`)

  log()
}

function printMetricsRow(metrics: Metrics, log: (...args: unknown[]) => void) {
  log(
    `  Precision: ${pct(metrics.precision)}  ` +
      `Recall: ${pct(metrics.recall)}  ` +
      `F1: ${pct(metrics.f1)}  ` +
      `Hallucination: ${pct(metrics.hallucination_rate)}`
  )
  log(`  (TP: ${metrics.tp}  FP: ${metrics.fp}  FN: ${metrics.fn})`)
}

function printAgentSection(
  title: string,
  result: AgentResult,
  log: (...args: unknown[]) => void
): void {
  log(line("-"))
  log(`  ${title}`)
  log(line("-"))
  printMetricsRow(result.metrics, log)
  log()

  for (const d of result.details) {
    const mark = d.correct ? "+" : "-"
    const actual = d.actual_verdict ?? "N/A"
    const conf = d.confidence === "MEDIUM" ? " ~" : ""
    log(
      `  ${mark} ${d.case_name}` +
        `  expected: ${d.expected_verdict}  actual: ${actual}${conf}`
    )
  }

  log()
}

function printCrossDocSection(
  result: CrossDocResult,
  log: (...args: unknown[]) => void
): void {
  log(line("-"))
  log("  Cross-Document Consistency")
  log(line("-"))
  printMetricsRow(result.metrics, log)
  log()

  for (const d of result.details) {
    const mark = d.matched ? "+" : "-"
    const actual = d.actual_verdict ?? "NOT FOUND"
    const conf = d.confidence === "MEDIUM" ? " ~" : ""
    log(`  ${mark} [${d.id}] ${d.description.slice(0, 70)}...`)
    log(`    expected: ${d.expected_verdict}  actual: ${actual}${conf}`)
    if (d.matched_claim) {
      log(`    matched claim: "${d.matched_claim.slice(0, 60)}..."`)
    }
  }

  if (result.false_positives.length > 0) {
    log()
    log("  False positives (pipeline flagged, no matching golden flaw):")
    for (const fp of result.false_positives) {
      log(`  ? "${fp.claim.slice(0, 70)}..." -> ${fp.verdict}`)
    }
  }

  log()
}

function printSummary(
  report: EvalReport,
  log: (...args: unknown[]) => void
): void {
  log(line("="))
  log("  Summary")
  log(line("="))
  log()
  log(`  Overall Precision:    ${pct(report.summary.overall_precision)}`)
  log(`  Overall Recall:       ${pct(report.summary.overall_recall)}`)
  log(`  Overall F1:           ${pct(report.summary.overall_f1)}`)
  log(`  Hallucination Rate:   ${pct(report.summary.overall_hallucination_rate)}`)
  log()
  log(
    `  (TP: ${report.summary.total_tp}  ` +
      `FP: ${report.summary.total_fp}  ` +
      `FN: ${report.summary.total_fn})`
  )
}

// ---------------------------------------------------------------------------
// JSON report (machine-readable)
// ---------------------------------------------------------------------------

export function buildJsonReport(report: EvalReport): string {
  return JSON.stringify(report, null, 2)
}
