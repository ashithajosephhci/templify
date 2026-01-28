type LineLabel = "heading" | "body" | "blank"
const MAX_HEADING_CHARS = 60
const MAX_HEADING_WORDS = 8
const NUMBERED_HEADING = /^(\d+(\.\d+)*|[A-Z]|[IVXLC]+)[\).]?\s+/

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

    return Response.json({ labels: normalizeLabels(lines, localClassify(lines)) })
  } catch (error) {
    return Response.json({ labels: [], error: "classification_failed" }, { status: 500 })
  }
}
