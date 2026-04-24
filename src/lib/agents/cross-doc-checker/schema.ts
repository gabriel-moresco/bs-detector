import { z } from "zod"

export const discrepancySchema = z.object({
  source_document: z
    .string()
    .describe(
      'The name of the supporting document that contradicts or qualifies the claim. ' +
        'Example: "police_report", "medical_records", "witness_statement".'
    ),
  source_excerpt: z
    .string()
    .describe(
      "The exact substring from the supporting document that contradicts or qualifies the claim, copied verbatim."
    ),
  type: z
    .enum(["DATE", "FACT", "OMISSION", "MISCHARACTERIZATION"])
    .describe(
      "DATE: the MSJ states a different date or timeline than the source document. " +
        "FACT: the MSJ states a fact that directly contradicts what the source document says. " +
        "OMISSION: the MSJ leaves out a material detail present in the source document that changes the picture. " +
        "MISCHARACTERIZATION: the MSJ describes something in a misleading way compared to the source document."
    ),
  severity: z
    .enum(["MINOR", "MATERIAL"])
    .describe(
      "MINOR: the discrepancy is unlikely to affect the legal analysis (e.g., trivial date rounding). " +
        "MATERIAL: the discrepancy could affect the outcome of the motion or a reasonable judge's assessment of the facts."
    ),
  explanation: z
    .string()
    .describe(
      "Brief explanation (1-3 sentences) of what the MSJ says vs. what the source document says."
    ),
})

export const llmClaimCheckSchema = z.object({
  analysis: z.object({
    verdict: z
      .enum(["CONSISTENT", "CONTRADICTED", "UNSUPPORTED", "UNVERIFIABLE"])
      .describe(
        "CONSISTENT: the claim is confirmed or not contradicted by at least one supporting document. " +
          "CONTRADICTED: at least one supporting document directly contradicts the claim. " +
          "UNSUPPORTED: the supporting documents address the relevant topic area but do not mention this specific claim. " +
          "UNVERIFIABLE: the claim concerns something none of the available documents would be expected to cover."
      ),
    discrepancies: z
      .array(discrepancySchema)
      .describe(
        "List of specific discrepancies found between the claim and the supporting documents. " +
          "Empty array when verdict is CONSISTENT, UNSUPPORTED, or UNVERIFIABLE."
      ),
    reasoning: z
      .string()
      .describe(
        "Brief explanation (2-4 sentences). For CONTRADICTED, explain what the MSJ claims vs. what the documents say. " +
          "For CONSISTENT, note which document(s) confirm the claim. " +
          "For UNSUPPORTED, explain why the documents don't cover this claim. " +
          "For UNVERIFIABLE, explain why these documents wouldn't contain this information."
      ),
  }),
})
