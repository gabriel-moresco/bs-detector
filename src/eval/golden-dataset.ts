/**
 * Hand-annotated golden dataset for the Rivera v. Harmon Construction Group
 * Motion for Summary Judgment.
 *
 * Every annotation below was derived by reading the four documents in
 * documents/ and cross-referencing facts, dates, and claims. Citation
 * verdicts are based on legal knowledge of the cited cases and reporters;
 * where uncertainty exists the confidence is marked MEDIUM.
 *
 * This file IS the ground truth for the eval. If the pipeline disagrees
 * with these labels, the eval reports a miss — not the other way around.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Confidence = "HIGH" | "MEDIUM"

export type ExpectedCitation = {
  reporter_citation: string
  case_name: string
  year: number
  section: string
  is_back_reference: boolean
}

export type ExpectedAuthorityVerdict = {
  reporter_citation: string
  case_name: string
  expected_verdict: "SUPPORTS" | "MISREPRESENTS" | "LIKELY_FABRICATED"
  confidence: Confidence
  notes: string
}

export type ExpectedQuoteVerdict = {
  reporter_citation: string
  quote_snippet: string
  expected_verdict: "ACCURATE" | "ALTERED" | "NOT_FOUND" | "UNVERIFIABLE"
  confidence: Confidence
  notes: string
}

export type ExpectedCrossDocFlaw = {
  id: string
  description: string
  claim_patterns: string[]
  expected_verdict: "CONTRADICTED" | "UNSUPPORTED"
  expected_severity: "MINOR" | "MATERIAL"
  expected_type: "DATE" | "FACT" | "OMISSION" | "MISCHARACTERIZATION"
  confidence: Confidence
  notes: string
}

// ---------------------------------------------------------------------------
// Citation Extraction — every case-law citation in the MSJ
// ---------------------------------------------------------------------------

export const EXPECTED_CITATIONS: ExpectedCitation[] = [
  {
    reporter_citation: "5 Cal.4th 689",
    case_name: "Privette v. Superior Court",
    year: 1993,
    section: "III.A",
    is_back_reference: false,
  },
  {
    reporter_citation: "5 Cal.4th 689",
    case_name: "Privette v. Superior Court",
    year: 1993,
    section: "III.A",
    is_back_reference: true,
  },
  {
    reporter_citation: "334 F. Supp. 2d 1189",
    case_name: "Whitmore v. Delgado Scaffolding Co.",
    year: 2004,
    section: "III.A",
    is_back_reference: false,
  },
  {
    reporter_citation: "887 F.2d 1204",
    case_name: "Kellerman v. Pacific Coast Construction, Inc.",
    year: 1991,
    section: "III.B",
    is_back_reference: false,
  },
  {
    reporter_citation: "52 Cal.4th 590",
    case_name: "Seabright Insurance Co. v. US Airways, Inc.",
    year: 2011,
    section: "III.B",
    is_back_reference: false,
  },
  {
    reporter_citation: "198 Cal.App.4th 223",
    case_name: "Torres v. Granite Falls Dev. Corp.",
    year: 2011,
    section: "Footnote 1",
    is_back_reference: false,
  },
  {
    reporter_citation: "45 Cal.App.4th 1012",
    case_name: "Blackwell v. Sunrise Contractors, Inc.",
    year: 1996,
    section: "Footnote 1",
    is_back_reference: false,
  },
  {
    reporter_citation: "387 S.W.3d 154",
    case_name: "Dixon v. Lone Star Structural, LLC",
    year: 2012,
    section: "Footnote 1",
    is_back_reference: false,
  },
  {
    reporter_citation: "291 So.3d 614",
    case_name: "Okafor v. Brightline Builders, Inc.",
    year: 2019,
    section: "Footnote 1",
    is_back_reference: false,
  },
  {
    reporter_citation: "112 Cal.App.4th 845",
    case_name: "Nguyen v. Allied Pacific Construction Co.",
    year: 2003,
    section: "Footnote 1",
    is_back_reference: false,
  },
  {
    reporter_citation: "78 Cal.App.4th 531",
    case_name: "Reeves v. Summit Engineering Group",
    year: 2000,
    section: "Footnote 1",
    is_back_reference: false,
  },
]

// ---------------------------------------------------------------------------
// Authority Verification — expected verdicts for primary citations only
// (back-references inherit from the parent and are excluded here)
// ---------------------------------------------------------------------------

export const EXPECTED_AUTHORITY_VERDICTS: ExpectedAuthorityVerdict[] = [
  {
    reporter_citation: "5 Cal.4th 689",
    case_name: "Privette v. Superior Court",
    expected_verdict: "SUPPORTS",
    confidence: "HIGH",
    notes:
      "Real CA Supreme Court case. The proposition ('presumptively not liable') " +
      "accurately states the Privette doctrine.",
  },
  {
    reporter_citation: "334 F. Supp. 2d 1189",
    case_name: "Whitmore v. Delgado Scaffolding Co.",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes:
      "Case name is suspiciously tailored to the facts (scaffolding defendant " +
      "in a scaffolding case). No known C.D. Cal. opinion at this reporter cite.",
  },
  {
    reporter_citation: "887 F.2d 1204",
    case_name: "Kellerman v. Pacific Coast Construction, Inc.",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes:
      "The 9th Circuit case at 887 F.2d 1204 is Kruso v. International " +
      "Telephone & Telegraph Corp. (1989), not Kellerman. Citation is fabricated.",
  },
  {
    reporter_citation: "52 Cal.4th 590",
    case_name: "Seabright Insurance Co. v. US Airways, Inc.",
    expected_verdict: "MISREPRESENTS",
    confidence: "MEDIUM",
    notes:
      "Real CA Supreme Court case, but it addresses the Privette retained-control " +
      "exception — not OSHA compliance creating a presumption of due care as the " +
      "MSJ claims. The brief mischaracterizes the holding.",
  },
  {
    reporter_citation: "198 Cal.App.4th 223",
    case_name: "Torres v. Granite Falls Dev. Corp.",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes: "No known Cal.App. opinion at this reporter cite.",
  },
  {
    reporter_citation: "45 Cal.App.4th 1012",
    case_name: "Blackwell v. Sunrise Contractors, Inc.",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes: "No known Cal.App. opinion at this reporter cite.",
  },
  {
    reporter_citation: "387 S.W.3d 154",
    case_name: "Dixon v. Lone Star Structural, LLC",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes: "No known Texas appellate opinion at this reporter cite.",
  },
  {
    reporter_citation: "291 So.3d 614",
    case_name: "Okafor v. Brightline Builders, Inc.",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes: "No known Florida DCA opinion at this reporter cite.",
  },
  {
    reporter_citation: "112 Cal.App.4th 845",
    case_name: "Nguyen v. Allied Pacific Construction Co.",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes: "No known Cal.App. opinion at this reporter cite.",
  },
  {
    reporter_citation: "78 Cal.App.4th 531",
    case_name: "Reeves v. Summit Engineering Group",
    expected_verdict: "LIKELY_FABRICATED",
    confidence: "MEDIUM",
    notes: "No known Cal.App. opinion at this reporter cite.",
  },
]

// ---------------------------------------------------------------------------
// Quote Verification — expected verdicts for direct quotes in the MSJ
// ---------------------------------------------------------------------------

export const EXPECTED_QUOTE_VERDICTS: ExpectedQuoteVerdict[] = [
  {
    reporter_citation: "5 Cal.4th 689",
    quote_snippet: "A hirer is never liable",
    expected_verdict: "ALTERED",
    confidence: "MEDIUM",
    notes:
      "The word 'never' overstates Privette's actual holding, which establishes " +
      "a presumption of non-liability with recognized exceptions (Hooker, McKown, " +
      "Kinsman). The original language does not use 'never'.",
  },
  {
    reporter_citation: "887 F.2d 1204",
    quote_snippet: "Where an employer demonstrates full compliance",
    expected_verdict: "UNVERIFIABLE",
    confidence: "MEDIUM",
    notes:
      "Source case (Kellerman) is likely fabricated, so the quote cannot be " +
      "verified against an actual opinion. Pipeline should return UNVERIFIABLE " +
      "since CourtListener won't find the case.",
  },
]

// ---------------------------------------------------------------------------
// Cross-Document Consistency — known flaws in the MSJ
//
// These were identified by comparing the MSJ text against the police report,
// medical records, and witness statement. Each flaw includes keyword patterns
// that the eval uses to match against dynamically-extracted pipeline claims.
// ---------------------------------------------------------------------------

export const EXPECTED_CROSS_DOC_FLAWS: ExpectedCrossDocFlaw[] = [
  {
    id: "flaw-date",
    description:
      "MSJ states incident date as March 14, 2021. Police report, medical " +
      "records, and witness statement all say March 12, 2021.",
    claim_patterns: [
      "march 14",
      "march 12",
      "date of the incident",
      "date of incident",
      "incident occurred",
      "incident date",
      "on or about march",
    ],
    expected_verdict: "CONTRADICTED",
    expected_severity: "MATERIAL",
    expected_type: "DATE",
    confidence: "HIGH",
    notes:
      "The MSJ consistently uses March 14 (facts 3, 5, and section D). Every " +
      "other document uses March 12. This is an unambiguous factual error.",
  },
  {
    id: "flaw-ppe",
    description:
      "MSJ states Rivera was not wearing required PPE including fall-arrest " +
      "equipment. Police report says he was wearing hard hat and harness; " +
      "witness confirms hard hat, safety harness, and high-visibility vest.",
    claim_patterns: [
      "not wearing",
      "personal protective equipment",
      "ppe",
      "fall-arrest",
      "fall arrest",
      "harness",
      "safety gear",
      "protective equipment",
    ],
    expected_verdict: "CONTRADICTED",
    expected_severity: "MATERIAL",
    expected_type: "FACT",
    confidence: "HIGH",
    notes:
      "The police report (Ellison's statement) and witness (Tran's statement) " +
      "both confirm Rivera was wearing a harness. The MSJ's claim that he was " +
      "not wearing PPE directly contradicts two independent sources.",
  },
  {
    id: "flaw-donner-direction",
    description:
      "MSJ frames Apex as solely responsible for scaffolding operations, " +
      "omitting that Harmon's foreman Ray Donner directed Rivera's crew to " +
      "work on the specific east-side scaffolding section that collapsed.",
    claim_patterns: [
      "donner",
      "directed",
      "general contractor",
      "retained control",
      "apex.*responsible",
      "responsible.*scaffolding",
      "controlled.*scaffolding",
    ],
    expected_verdict: "CONTRADICTED",
    expected_severity: "MATERIAL",
    expected_type: "OMISSION",
    confidence: "HIGH",
    notes:
      "The police report records Donner directing the crew. The witness statement " +
      "confirms Donner told them where to work and pressured them on the schedule. " +
      "The MSJ's framing that 'Apex — not Harmon — was the employer responsible' " +
      "omits Harmon's operational control through Donner.",
  },
  {
    id: "flaw-safety-concerns",
    description:
      "MSJ omits that safety concerns about the east-side scaffolding were " +
      "raised to Harmon's foreman Donner before the collapse, and that " +
      "Donner dismissed them.",
    claim_patterns: [
      "safety concern",
      "raised concern",
      "cross-brace",
      "base plate",
      "plywood",
      "dismissed",
      "not in safe condition",
      "condition of.*scaffolding",
    ],
    expected_verdict: "CONTRADICTED",
    expected_severity: "MATERIAL",
    expected_type: "OMISSION",
    confidence: "HIGH",
    notes:
      "Witness Tran states she raised concerns about rust, base plate on plywood, " +
      "and bent coupling pins — directly to Donner, who said 'We don't have time " +
      "to re-do the base.' This is a material omission from the MSJ.",
  },
  {
    id: "flaw-osha-date",
    description:
      "MSJ claims the most recent OSHA inspection was February 26, 2021. " +
      "No supporting document mentions this inspection or date.",
    claim_patterns: [
      "february 26",
      "osha inspection",
      "passed all osha",
      "osha.*inspection",
      "inspection.*february",
    ],
    expected_verdict: "UNSUPPORTED",
    expected_severity: "MINOR",
    expected_type: "FACT",
    confidence: "MEDIUM",
    notes:
      "The Feb 26 date is not corroborated by the police report, medical records, " +
      "or witness statement. The police report only mentions Cal/OSHA being " +
      "notified after the incident. Not necessarily false, but unsupported.",
  },
  {
    id: "flaw-experience",
    description:
      "MSJ states Rivera had 'over eight years of experience in commercial " +
      "construction.' No supporting document confirms this.",
    claim_patterns: [
      "eight years",
      "8 years",
      "years of experience",
      "experience.*construction",
    ],
    expected_verdict: "UNSUPPORTED",
    expected_severity: "MINOR",
    expected_type: "FACT",
    confidence: "MEDIUM",
    notes:
      "The police report lists Rivera as 'Journeyman Scaffolder' without " +
      "experience details. Tran's statement says she has worked for Apex for " +
      "three years but says nothing about Rivera's tenure. Not contradicted, " +
      "but not confirmed by available documents.",
  },
]
