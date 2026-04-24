import { readFile } from "node:fs/promises"
import path from "node:path"

import type { SupportingDoc } from "@/lib/agents/cross-doc-checker"

const docsDir = path.join(process.cwd(), "documents")

export async function loadMSJ(): Promise<string> {
  return readFile(
    path.join(docsDir, "motion_for_summary_judgment.txt"),
    "utf-8"
  )
}

export async function loadPoliceReport(): Promise<string> {
  return readFile(path.join(docsDir, "police_report.txt"), "utf-8")
}

export async function loadMedicalRecords(): Promise<string> {
  return readFile(path.join(docsDir, "medical_records_excerpt.txt"), "utf-8")
}

export async function loadWitnessStatement(): Promise<string> {
  return readFile(path.join(docsDir, "witness_statement.txt"), "utf-8")
}

export async function loadSupportingDocs(): Promise<SupportingDoc[]> {
  const [policeReport, medicalRecords, witnessStatement] = await Promise.all([
    loadPoliceReport(),
    loadMedicalRecords(),
    loadWitnessStatement(),
  ])

  return [
    { name: "police_report", content: policeReport },
    { name: "medical_records", content: medicalRecords },
    { name: "witness_statement", content: witnessStatement },
  ]
}
