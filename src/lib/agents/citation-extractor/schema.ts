import { z } from "zod"

export const citationSchema = z.object({
  id: z
    .string()
    .describe(
      'Sequential identifier assigned in document order: "cite-1", "cite-2", "cite-3", etc.'
    ),
  case_name: z
    .string()
    .describe(
      'The full case name (e.g., "Privette v. Superior Court"). For back-references like "Id." or "supra", resolve this to the most recently named case in surrounding context — never leave it as "Id."'
    ),
  reporter_citation: z
    .string()
    .describe(
      'The reporter citation portion only — volume, reporter, first page. Examples: "5 Cal.4th 689", "887 F.2d 1204", "334 F. Supp. 2d 1189". Do not include the year or pincite here.'
    ),
  year: z
    .number()
    .describe(
      "The four-digit year of the decision, parsed from the parenthetical at the end of the citation."
    ),
  pincite: z
    .string()
    .nullable()
    .describe(
      'The specific page being cited within the opinion (e.g., "702", "1209"). Null when the citation has no pincite.'
    ),
  proposition: z
    .string()
    .describe(
      'The assertion the brief claims the cited case supports. Copy this verbatim from the brief (exact sentence or clause near the citation). Do not paraphrase, summarize, or strengthen the wording. Example: "Under California law, a hirer of an independent contractor is presumptively not liable for injuries sustained by the contractor\'s employees while performing the contracted work."'
    ),
  direct_quote: z
    .string()
    .nullable()
    .describe(
      'The literal quoted text from the cited opinion — ONLY text that appears inside actual quotation marks ("...") AND is syntactically attached to THIS specific citation. Critical: if the quote appears in a separate sentence — even one discussing the same case — it belongs to the citation in THAT sentence (typically the Id. back-reference), NOT to the original named citation. Never duplicate a quote across two citation entries. Null if there is no quote attached to this citation.'
    ),
  parenthetical: z
    .string()
    .nullable()
    .describe(
      'Prose description in parentheses immediately following the citation, NOT enclosed in quotation marks. Captures the brief\'s paraphrased explanation of what the case stands for. Example: for "Whitmore v. Delgado, 334 F. Supp. 2d 1189 (C.D. Cal. 2004) (granting summary judgment to hirer where subcontractor controlled scaffolding)", parenthetical is "granting summary judgment to hirer where subcontractor controlled scaffolding". A parenthetical wrapping a quoted string like \'("Where an employer demonstrates...")\' is a quote, not a parenthetical — populate direct_quote in that case and leave parenthetical null. Null when no such parenthetical description exists.'
    ),
  signal: z
    .string()
    .nullable()
    .describe(
      'The Bluebook introductory signal directly preceding the citation, if any: "See", "See also", "Cf.", "But see", "But cf.", "Accord", "Contra", "E.g.", "See, e.g.", etc. Null when the citation has no introductory signal (direct support).'
    ),
  is_back_reference: z
    .boolean()
    .describe(
      'True when this citation appears as "Id.", "Id. at X", or "supra" in the brief — i.e., it points back to a previously named case rather than naming the case itself.'
    ),
  location: z
    .object({
      section: z
        .string()
        .describe(
          'The brief\'s own section identifier where the citation appears: "III.A", "III.B", "III.C", "III.D", etc. For citations inside footnotes, use "Footnote N" where N is the footnote number.'
        ),
      paragraph_index: z
        .number()
        .describe(
          "1-based index of the paragraph within the section that contains the citation."
        ),
    })
    .describe("Where the citation appears in the brief, for traceability."),
  raw_text: z
    .string()
    .describe(
      "The exact substring from the brief containing the citation, copied verbatim. Used downstream to locate and highlight the citation in the source document."
    ),
})

export const citationListSchema = z.object({
  citations: z
    .array(citationSchema)
    .describe(
      "Every case-law citation in the brief, in the order they appear. Include citations from both the body and any footnotes."
    ),
})

export type Citation = z.infer<typeof citationSchema>
