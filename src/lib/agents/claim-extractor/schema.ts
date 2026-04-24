import { z } from "zod"

export const claimSchema = z.object({
  id: z
    .string()
    .describe(
      'Sequential identifier in document order: "claim-1", "claim-2", etc.'
    ),
  claim: z
    .string()
    .describe(
      "The factual assertion stated clearly and concisely. " +
        'Example: "Rivera had 8 years of experience in commercial construction."'
    ),
  msj_excerpt: z
    .string()
    .describe(
      "The exact substring from the MSJ that contains this factual claim, copied verbatim."
    ),
  category: z
    .enum(["DATE", "INJURY", "EVENT", "CONDITION", "CREDENTIAL", "COMPLIANCE"])
    .describe(
      "DATE: dates or timelines. INJURY: injury descriptions or medical facts. " +
        "EVENT: what happened, actions taken or not taken. " +
        "CONDITION: site conditions, equipment state, weather. " +
        "CREDENTIAL: experience, qualifications, certifications. " +
        "COMPLIANCE: regulatory compliance, inspections, safety records."
    ),
  location: z
    .object({
      section: z
        .string()
        .describe(
          'The brief\'s own section identifier: "III.A", "III.B", etc. For footnotes, use "Footnote N".'
        ),
      paragraph_index: z
        .number()
        .describe(
          "1-based index of the paragraph within the section that contains the claim."
        ),
    })
    .describe("Where the claim appears in the MSJ."),
})

export const claimListSchema = z.object({
  claims: z
    .array(claimSchema)
    .describe(
      "Every verifiable factual claim in the MSJ, in the order they appear."
    ),
})

export type Claim = z.infer<typeof claimSchema>
