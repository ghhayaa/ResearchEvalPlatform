// geminiService.js — Calls Google Gemini to evaluate a proposal against
// structured compliance criteria.
//
// KU INSTITUTIONAL CONTEXT: This platform is used by Khalifa University's
// Research Office to pre-screen proposals before formal submission in FIBI.
// The RIG-2024 grant call uses five official reviewer criteria (RG2401–RG2405)
// plus eligibility/budget/attachment compliance checks drawn from the
// RIG-2024 Call for Proposals and Decision Matrix documents.
//
// IMPORTANT (FR-01.7): if your institution's confidentiality policy forbids
// sending proposal text to external AI services, point GEMINI_API_BASE at an
// approved private/VPC endpoint (e.g. Vertex AI within your tenant).

const GEMINI_API_KEY  = process.env.GEMINI_API_KEY;
const GEMINI_MODEL    = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_API_BASE = process.env.GEMINI_API_BASE ||
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured (.env)");

  const response = await fetch(`${GEMINI_API_BASE}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
  try {
    return JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch (e) {
    throw new Error("Failed to parse AI response as JSON: " + e.message);
  }
}

// ─── Proposal Evaluation ─────────────────────────────────────────────────────
// Evaluates a proposal against each compliance criterion with the same scoring
// scale used by RIG-2024 external reviewers (Poor 0-2 / Fair 3-4 / Good 5-6 /
// Very Good 7-8 / Excellent 9-10), mapped to Pass/Partial/Not Met for the
// readiness report.
function buildEvalPrompt(proposalText, criteria) {
  return `You are an expert research grants compliance reviewer working for Khalifa University's Research Office. You have been assigned to pre-screen this proposal using the same criteria and scoring scale as KU's official external reviewer panels.

KU OFFICIAL SCORING SCALE (RIG-2024):
- 9–10 Excellent: Proposal successfully addresses ALL aspects of the criterion → status: "Pass"
- 7–8 Very Good: Full criterion addressed very well, only a small number of shortcomings → status: "Pass"
- 5–6 Good: Criterion addressed well but a number of shortcomings present → status: "Partial"
- 3–4 Fair: Proposal broadly addresses elements but significant weaknesses present → status: "Partial"
- 0–2 Poor: Numerous components inadequately addressed or serious inherent weaknesses → status: "Not Met"

IMPORTANT: For criteria that list reviewer sub-questions (e.g. RG2401–RG2405), you MUST evaluate the proposal against EACH sub-question individually. Your score and explanation must reflect how well ALL sub-questions are answered — not just some. If even one sub-question is poorly addressed, the score cannot be 9–10. Be specific and quote or paraphrase short phrases from the proposal as evidence.

For EVERY criterion, return:
- status: exactly "Pass", "Partial", or "Not Met"
- score: numeric 0–10 per the KU scale above
- explanation: 2–4 sentences covering each sub-question with specific evidence from the proposal text
- evidence: a specific phrase or fact from the proposal supporting your verdict (or "Not found in proposal")
- guidance: concrete actionable steps referencing the specific sub-question or clause that is weak (e.g. "Sub-question 3 of RG2403 requires a Gantt chart which is absent from the proposal")

Also return:
- strengths: 2–5 specific strengths with evidence from the proposal text
- weaknesses: 2–5 specific gaps with guidance referencing the exact sub-question or call requirement
- overall_summary: 3–4 sentence plain-language summary of overall readiness
- readiness_recommendation: exactly one of: "Ready to submit", "Minor revisions needed", "Major revisions needed", "Not ready for submission"

Respond ONLY with valid JSON, no markdown fences, matching exactly:
{
  "criteria_results": [
    { "id": "...", "label": "...", "status": "Pass|Partial|Not Met", "score": 0, "explanation": "...", "evidence": "...", "guidance": "..." }
  ],
  "strengths":  [ { "point": "...", "evidence": "..." } ],
  "weaknesses": [ { "point": "...", "guidance": "..." } ],
  "overall_summary": "...",
  "readiness_recommendation": "..."
}

COMPLIANCE CRITERIA (including exact reviewer sub-questions where shown):
${JSON.stringify(criteria, null, 2)}

PROPOSAL TEXT (truncated to 30,000 characters):
${proposalText.slice(0, 30000)}
`;
}

export async function evaluateProposal(proposalText, criteria) {
  return callGemini(buildEvalPrompt(proposalText, criteria));
}

// ─── Criteria Extraction ─────────────────────────────────────────────────────
// Parses a grant call / RFP document and extracts structured compliance criteria
// (FR-01.2) plus a researcher-facing summary.
export async function extractCriteria(grantCallText) {
  const prompt = `You are a research grants compliance analyst working for Khalifa University's Research Office.

Read the GRANT CALL / RFP TEXT below and extract:

1. "summary": a 3-4 sentence plain-language summary of what this grant call funds, the award amount/duration if stated, and who should apply (for a researcher browsing available grants on the KU Proposal Compliance Platform).

2. "criteria": the distinct compliance and quality criteria a submitted proposal will be evaluated against. Include both:
   - Formal scoring criteria (e.g. scientific merit, team composition, impact)
   - Eligibility and compliance requirements (budget rules, required attachments, ethics requirements, eligibility conditions)
   Extract between 5 and 12 criteria. Use the actual criterion codes (e.g. RG2401) if present in the document.

For each criterion return:
- id: a short snake_case identifier (use the official code if given, e.g. "RG2401_situation_innovation")
- label: a short human-readable name matching the official criterion label where possible (2-5 words)
- description: one precise sentence describing exactly what is required, referencing the specific section/clause where applicable

Respond ONLY with valid JSON, no markdown fences:
{ "summary": "...", "criteria": [ { "id": "...", "label": "...", "description": "..." } ] }

GRANT CALL TEXT:
${grantCallText.slice(0, 30000)}
`;

  const result = await callGemini(prompt);
  if (!result.criteria || !Array.isArray(result.criteria)) {
    throw new Error("AI did not return a valid criteria list");
  }
  return result;
}
