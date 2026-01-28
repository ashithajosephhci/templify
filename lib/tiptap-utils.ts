export type TiptapMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}

export type TiptapDoc = {
  type: "doc"
  content: TiptapNode[]
}

export type NumberedHeading = {
  text: string
  isHeading: boolean
}

const numberedHeadingPattern = /^(\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/

export function createNumberingNormalizer() {
  let currentNumbers: number[] = []
  return (text: string): NumberedHeading => {
    const trimmed = text.trim()
    const match = numberedHeadingPattern.exec(trimmed)
    if (!match) {
      return { text, isHeading: false }
    }

    const level = match[1].split(".").length
    if (level === 1) {
      const next = (currentNumbers[0] ?? 0) + 1
      currentNumbers = [next]
    } else {
      while (currentNumbers.length < level - 1) {
        currentNumbers.push(1)
      }
      if (currentNumbers.length === level) {
        currentNumbers[level - 1] += 1
      } else {
        currentNumbers[level - 1] = 1
      }
      currentNumbers = currentNumbers.slice(0, level)
    }

    return { text: `${currentNumbers.join(".")} ${match[2]}`, isHeading: true }
  }
}

export function plainTextToTiptapDoc(text: string): TiptapDoc {
  const lines = text.split("\n")
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line
        ? [
            {
              type: "text",
              text: line,
            },
          ]
        : [],
    })),
  }
}

export function tiptapDocToPlainText(doc: TiptapDoc): string {
  const lines: string[] = []
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph" || node.type === "heading") {
      lines.push(extractText(node))
    } else if (node.type === "image") {
      lines.push("[image]")
    } else if (node.type === "table") {
      lines.push("[table]")
    }
  }
  return lines.join("\n")
}

export function extractParagraphTexts(doc: TiptapDoc): string[] {
  const lines: string[] = []
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph" || node.type === "heading") {
      lines.push(extractText(node))
    } else if (node.type === "table") {
      const rows = node.content ?? []
      for (const row of rows) {
        const cells = row.content ?? []
        const cellTexts = cells.map((cell) => extractText(cell)).join(" | ")
        lines.push(cellTexts)
      }
    } else if (node.type === "image") {
      lines.push("")
    }
  }
  return lines
}

export function isDocEmpty(doc: TiptapDoc): boolean {
  if (!doc.content || doc.content.length === 0) return true
  return doc.content.every((node) => {
    if (node.type === "paragraph") {
      return !extractText(node).trim()
    }
    return false
  })
}

function extractText(node: TiptapNode): string {
  if (node.type === "text") {
    return node.text ?? ""
  }
  const parts: string[] = []
  for (const child of node.content ?? []) {
    parts.push(extractText(child))
  }
  return parts.join("")
}
