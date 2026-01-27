import OpenAI from "openai"

type LineLabel = "heading" | "body" | "blank"
const MAX_HEADING_CHARS = 60
const MAX_HEADING_WORDS = 8
const NUMBERED_HEADING = /^(\d+(\.\d+)*|[A-Z]|[IVXLC]+)[\).]?\s+/

const MODEL = "gpt-4o-mini"

function isHeadingCandidate(line: string, prevBlank: boolean) {
  const trimmed = line.trim()
  if (!trimmed) return false
  const wordCount = trimmed.split(/\s+/).length
  if (trimmed.length > MAX_HEADING_CHARS || wordCount > MAX_HEADING_WORDS) return false
  if (/[.!?]$/.test(trimmed)) return false
  return NUMBERED_HEADING.test(trimmed)
}

function localClassify(lines: string[]): LineLabel[] {
  const labels: LineLabel[] = []
  let prevBlank = true

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      labels.push("blank")
      prevBlank = true
      continue
    }

    labels.push(isHeadingCandidate(line, prevBlank) ? "heading" : "body")
    prevBlank = false
  }

  return labels
}

function normalizeLabels(lines: string[], labels: LineLabel[]) {
  const normalized: LineLabel[] = []
  let prevBlank = true

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      normalized.push("blank")
      prevBlank = true
      continue
    }

    const candidate = isHeadingCandidate(trimmed, prevBlank)
    if (candidate) {
      normalized.push("heading")
    } else {
      normalized.push("body")
    }
    prevBlank = false
  }

  return normalized
}

export async function POST(req: Request) {
  try {
    const { lines } = (await req.json()) as { lines?: string[] }
    if (!lines || !Array.isArray(lines)) {
      return Response.json({ error: "lines must be an array" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured", labels: localClassify(lines) },
        { status: 200 }
      )
    }

    const client = new OpenAI({ apiKey })
    const prompt = [
      "Classify each line as: heading, body, or blank.",
      "Be STRICT: paragraphs must be labeled body.",
      `Headings must be short (<= ${MAX_HEADING_CHARS} chars and <= ${MAX_HEADING_WORDS} words).`,
      "Heading rules:",
      "- Numbered headings only, like '1. Introduction' or '2.3 Scope'",
      "If a line is long, has multiple sentences, or reads like a paragraph, label it body.",
      "Return JSON only in this exact shape:",
      '{"labels":["heading","body","blank",...]}',
      "The labels array MUST match the input lines length exactly.",
    ].join("\n")

    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify({ lines }) },
      ],
    })

    const text = response.output_text?.trim() ?? ""
    let parsed: { labels?: LineLabel[] } | null = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }

    if (!parsed?.labels || parsed.labels.length !== lines.length) {
      return Response.json({ labels: localClassify(lines), warning: "fallback" })
    }

    return Response.json({ labels: normalizeLabels(lines, parsed.labels) })
  } catch (error) {
    return Response.json({ labels: [], error: "classification_failed" }, { status: 500 })
  }
}
