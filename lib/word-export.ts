import PizZip from "pizzip"
import { type Template, companyConfigs } from "./types"
import { type PdfLayout } from "./pdf-export"
import { type TiptapDoc } from "./tiptap-utils"

interface ExportOptions {
  template: Template
  title: string
  subtitle?: string
  content: TiptapDoc
  alignment?: WordAlignment
  layout?: PdfLayout
}

type WordAlignment = "left" | "center" | "right" | "justify"

type AlignmentDefaults = {
  paragraph: WordAlignment
  heading: WordAlignment
  bullet: WordAlignment
  ordered: WordAlignment
  table: WordAlignment
  image: WordAlignment
}

const DEFAULT_ALIGNMENT: AlignmentDefaults = {
  paragraph: "justify",
  heading: "justify",
  bullet: "justify",
  ordered: "justify",
  table: "justify",
  image: "center",
}

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportToWord({
  template,
  title,
  subtitle,
  content,
  alignment = DEFAULT_ALIGNMENT.paragraph,
  layout,
}: ExportOptions) {
  const blob = await buildDocxBlobFromTemplateRich({
    template,
    title,
    subtitle,
    content,
    alignment,
    layout,
  })

  const config = companyConfigs[template.company]
  const filename = `${config.name}_${title.replace(/\s+/g, "_")}_${new Date()
    .toISOString()
    .split("T")[0]}.docx`
  saveAs(blob, filename)
}

type RichContext = {
  zip: PizZip
  relsXml: string
  contentTypesXml: string
  nextRelId: number
  nextImageId: number
  nextDocPrId: number
  alignmentDefaults: AlignmentDefaults
  headingColor: string
  contentStyle: { fontName: string; fontSize: number; color: string }
  headingStyle: { fontName: string; fontSize: number; color: string }
}

async function buildDocxBlobFromTemplateRich({
  template,
  title,
  subtitle,
  content,
  alignment,
  layout,
}: ExportOptions) {
  const response = await fetch(encodeURI(template.docxUrl as string))
  if (!response.ok) {
    throw new Error(`Template download failed: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const zip = new PizZip(arrayBuffer)
  const documentXml = zip.file("word/document.xml")?.asText()
  const relsXml = zip.file("word/_rels/document.xml.rels")?.asText()
  const contentTypesXml = zip.file("[Content_Types].xml")?.asText()

  if (!documentXml || !relsXml || !contentTypesXml) {
    throw new Error("Template is missing required DOCX parts.")
  }

  const detectedTitleColor = extractTitleColor(documentXml)
  const fallbackHeadingColor =
    template.company === "IHNA"
      ? "009690"
      : "F04D23"

  const headingColor =
    template.company === "IHNA" ? "009690" : detectedTitleColor ?? fallbackHeadingColor

  const contentFontName = layout?.bodyStyle.fontName ?? "Helvetica"
  const contentFontSize = layout?.body.fontSize ?? 11
  const contentColor = (layout?.bodyStyle.color ?? "#111827").replace("#", "")
  const headingFontName = layout?.headingStyle.fontName ?? contentFontName
  const headingFontSize = layout?.headingFontSize ?? Math.max(12, contentFontSize + 2)
  const headingColorOverride = layout?.headingStyle.color
    ? layout.headingStyle.color.replace("#", "")
    : headingColor

  const ctx: RichContext = {
    zip,
    relsXml,
    contentTypesXml,
    nextRelId: getNextRelId(relsXml),
    nextImageId: getNextImageId(zip),
    nextDocPrId: getNextDocPrId(documentXml),
    alignmentDefaults: {
      ...DEFAULT_ALIGNMENT,
    },
    headingColor: headingColorOverride,
    contentStyle: {
      fontName: contentFontName,
      fontSize: contentFontSize,
      color: contentColor,
    },
    headingStyle: {
      fontName: headingFontName,
      fontSize: headingFontSize,
      color: headingColorOverride,
    },
  }

  let updatedXml = ensureDocumentNamespace(
    documentXml,
    "pic",
    "http://schemas.openxmlformats.org/drawingml/2006/picture"
  )
  updatedXml = applyTemplatePlaceholders(updatedXml, title, subtitle ?? "")
  if (template.company === "IHNA") {
    const titleRuns = buildRunsWithLineBreaks(title, "009690", 42)
    const subtitleRuns = buildRunsWithLineBreaks(subtitle ?? "", "009690", 48)
    updatedXml = replacePlaceholderRuns(updatedXml, "title", titleRuns)
    updatedXml = replacePlaceholderRuns(updatedXml, "subtitle", subtitleRuns)
  }

  const blocks = await tiptapToOpenXmlBlocks(content, ctx)
  updatedXml = replaceParagraphContainingPlaceholder(updatedXml, "{{content}}", blocks)

  ctx.zip.file("word/document.xml", updatedXml)

  for (const name of Object.keys(ctx.zip.files)) {
    if (!/^word\/header\d+\.xml$/.test(name)) continue
    const headerXml = ctx.zip.file(name)?.asText()
    if (!headerXml) continue
    const updatedHeader = applyTemplatePlaceholders(headerXml, title, subtitle ?? "")
    ctx.zip.file(name, updatedHeader)
  }
  ctx.zip.file("word/_rels/document.xml.rels", ctx.relsXml)
  ctx.zip.file("[Content_Types].xml", ctx.contentTypesXml)

  return ctx.zip.generate({
    type: "blob",
    mimeType: DOCX_MIME,
  })
}

function ensureDocumentNamespace(xml: string, prefix: string, uri: string) {
  const attr = `xmlns:${prefix}="${uri}"`
  if (xml.includes(attr)) return xml
  return xml.replace("<w:document", `<w:document ${attr}`)
}

function applyTemplatePlaceholders(xml: string, title: string, subtitle: string) {
  let updated = replaceAll(xml, "{{title}}", xmlEscape(title))
  updated = replaceAll(updated, "{{subtitle}}", xmlEscape(subtitle))
  updated = replaceSplitPlaceholder(updated, "title", title)
  updated = replaceSplitPlaceholder(updated, "subtitle", subtitle)
  return updated
}

function replaceSplitPlaceholder(xml: string, key: string, value: string) {
  if (!value) return xml
  const escaped = xmlEscape(value)
  const pattern = new RegExp(
    `(<w:t[^>]*>)\\{\\{<\\/w:t>([\\s\\S]{0,1000}?)(<w:t[^>]*>)${key}\\}\\}<\\/w:t>`,
    "g"
  )
  return xml.replace(pattern, `$1${escaped}</w:t>$2$3</w:t>`)
}

function replacePlaceholderRuns(xml: string, key: string, replacementRuns: string) {
  if (!replacementRuns) return xml
  const direct = new RegExp(`<w:t[^>]*>\\{\\{${key}\\}\\}<\\/w:t>`, "g")
  let updated = xml.replace(direct, replacementRuns)
  const split = new RegExp(
    `<w:t[^>]*>\\{\\{<\\/w:t>[\\s\\S]{0,1000}?<w:t[^>]*>${key}\\}\\}<\\/w:t>`,
    "g"
  )
  updated = updated.replace(split, replacementRuns)
  return updated
}

function buildRunsWithLineBreaks(text: string, color: string, maxChars: number) {
  if (!text) return ""
  const lines = wrapByLength(text, maxChars)
  const rPr = color ? `<w:rPr><w:color w:val=\"${color}\"/></w:rPr>` : ""
  return lines
    .map((line, index) => {
      const spaceAttr = /^\s|\s$/.test(line) ? ` xml:space=\"preserve\"` : ""
      const run = `<w:r>${rPr}<w:t${spaceAttr}>${xmlEscape(line)}</w:t></w:r>`
      if (index === 0) return run
      return `<w:r><w:br/></w:r>${run}`
    })
    .join("")
}

function wrapByLength(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function extractTitleColor(documentXml: string) {
  const index = documentXml.indexOf("{{title}}")
  if (index === -1) return null
  const windowStart = Math.max(0, index - 5000)
  const snippet = documentXml.slice(windowStart, index + 50)
  const regex = /<w:color w:val="([0-9A-Fa-f]{6})"\/>/g
  let match: RegExpExecArray | null = null
  let lastColor: string | null = null
  while ((match = regex.exec(snippet)) !== null) {
    lastColor = match[1].toUpperCase()
  }
  return lastColor
}

function replaceAll(source: string, needle: string, replacement: string) {
  return source.split(needle).join(replacement)
}

function replaceParagraphContainingPlaceholder(
  documentXml: string,
  placeholder: string,
  blocks: string[]
) {
  const placeholderIndex = documentXml.indexOf(placeholder)
  if (placeholderIndex === -1) {
    throw new Error(`Placeholder ${placeholder} not found in template.`)
  }

  let start = -1
  const startTagRegex = /<w:p(?:\\s|>)/g
  for (const match of documentXml.matchAll(startTagRegex)) {
    const index = match.index ?? -1
    if (index !== -1 && index < placeholderIndex) {
      start = index
    } else if (index > placeholderIndex) {
      break
    }
  }

  const end = documentXml.indexOf("</w:p>", placeholderIndex)
  if (start === -1 || end === -1) {
    throw new Error(`Placeholder ${placeholder} is not inside a paragraph.`)
  }

  const before = documentXml.slice(0, start)
  const after = documentXml.slice(end + "</w:p>".length)
  return `${before}${blocks.join("")}${after}`
}

async function tiptapToOpenXmlBlocks(doc: TiptapDoc, ctx: RichContext) {
  const blocks: string[] = []
  const headingNumbers = [0, 0, 0, 0, 0, 0]
  let orderedCounter = 1
  let inOrderedList = false
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph") {
      const headingMatch = detectNumberedHeading(node)
      const inferredHeadingLevel = headingMatch?.level ?? null
      const plain = getNodeText(node).trim()
      if (!plain && !inferredHeadingLevel) {
        continue
      }
      inOrderedList = false
      orderedCounter = 1
      blocks.push(
        buildParagraphXml(node, {
          alignment: ctx.alignmentDefaults.paragraph,
          headingLevel: inferredHeadingLevel ?? undefined,
          headingText: inferredHeadingLevel
            ? applyHeadingNumbering(headingMatch, headingNumbers)
            : undefined,
          headingStyle: inferredHeadingLevel ? ctx.headingStyle : undefined,
          forceBold: inferredHeadingLevel ? true : undefined,
          runStyle: ctx.contentStyle,
        })
      )
      continue
    }

    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 1)
      inOrderedList = false
      orderedCounter = 1
      blocks.push(
        buildParagraphXml(node, {
          alignment: ctx.alignmentDefaults.heading,
          headingLevel: Number.isFinite(level) ? Math.min(6, Math.max(1, level)) : 1,
          headingStyle: ctx.headingStyle,
          forceBold: true,
          runStyle: ctx.contentStyle,
        })
      )
      continue
    }

    if (node.type === "bulletList") {
      const items = node.content ?? []
      for (const item of items) {
        if (item.type !== "listItem") continue
        const paragraphs = extractParagraphs(item)
        for (const paragraph of paragraphs) {
          const plain = getNodeText(paragraph).trim()
          if (!plain) continue
          blocks.push(
            buildListParagraphXml(paragraph, {
              alignment:
                ctx.alignmentDefaults.bullet === "justify"
                  ? "left"
                  : ctx.alignmentDefaults.bullet,
              marker: "• ",
              runStyle: ctx.contentStyle,
            })
          )
        }
      }
      continue
    }

    if (node.type === "orderedList") {
      if (!inOrderedList) {
        orderedCounter = 1
        inOrderedList = true
      }
      const items = node.content ?? []
      for (const item of items) {
        if (item.type !== "listItem") continue
        const paragraphs = extractParagraphs(item)
        for (const paragraph of paragraphs) {
          const plain = getNodeText(paragraph).trim()
          if (!plain) continue
          blocks.push(
            buildListParagraphXml(paragraph, {
              alignment:
                ctx.alignmentDefaults.ordered === "justify"
                  ? "left"
                  : ctx.alignmentDefaults.ordered,
              marker: `${orderedCounter}. `,
              runStyle: ctx.contentStyle,
            })
          )
          orderedCounter += 1
        }
      }
      continue
    }

    if (node.type === "image") {
      inOrderedList = false
      orderedCounter = 1
      const src = String(node.attrs?.src ?? "")
      if (!src) continue
      const imageXml = await buildImageBlock(src, ctx)
      if (imageXml) {
        blocks.push(
          wrapParagraphWithAlignment(imageXml, ctx.alignmentDefaults.image)
        )
      }
      continue
    }

    if (node.type === "table") {
      inOrderedList = false
      orderedCounter = 1
      const tableXml = buildTableXml(node, ctx)
      if (tableXml) {
        blocks.push(tableXml)
        blocks.push(emptyParagraphXml())
      }
      continue
    }
  }

  if (blocks.length === 0) {
    blocks.push(emptyParagraphXml())
  }

  return blocks
}

function extractParagraphs(listItem: any) {
  const paragraphs: any[] = []
  for (const child of listItem.content ?? []) {
    if (child.type === "paragraph") {
      paragraphs.push(child)
    }
    if (child.type === "bulletList" || child.type === "orderedList") {
      // Flatten nested lists into paragraphs with their own markers.
      for (const nestedItem of child.content ?? []) {
        if (nestedItem.type !== "listItem") continue
        for (const nestedParagraph of extractParagraphs(nestedItem)) {
          paragraphs.push(nestedParagraph)
        }
      }
    }
  }
  return paragraphs
}

type ParagraphOptions = {
  alignment: WordAlignment
  headingLevel?: number
  forceBold?: boolean
  headingText?: string
  headingStyle?: { fontName: string; fontSize: number; color: string }
  runStyle?: { fontName: string; fontSize: number; color: string }
}

function buildParagraphXml(node: any, options: ParagraphOptions) {
  const runs =
    options.headingText
      ? [
          textRunXml(options.headingText, {
            bold: true,
            color: options.headingStyle?.color,
            fontName: options.headingStyle?.fontName,
            fontSize: options.headingStyle?.fontSize,
            preserveSpace: true,
          }),
        ]
      : buildRunsFromInline(node, options.forceBold, options.runStyle)
  const styleXml = options.headingLevel
    ? `<w:pStyle w:val="Heading${options.headingLevel}"/>`
    : ""
  const pPr = `<w:pPr>${styleXml}${alignmentXml(options.alignment)}</w:pPr>`
  return `<w:p>${pPr}${runs.join("")}</w:p>`
}

type ListParagraphOptions = {
  alignment: WordAlignment
  marker: string
  runStyle?: { fontName: string; fontSize: number; color: string }
}

function buildListParagraphXml(node: any, options: ListParagraphOptions) {
  const markerRun = textRunXml(options.marker, {
    preserveSpace: true,
    fontName: options.runStyle?.fontName,
    fontSize: options.runStyle?.fontSize,
    color: options.runStyle?.color,
  })
  const runs = buildRunsFromInline(node, false, options.runStyle)
  const pPr = `<w:pPr>${alignmentXml(options.alignment)}</w:pPr>`
  return `<w:p>${pPr}${markerRun}${runs.join("")}</w:p>`
}

function emptyParagraphXml() {
  return "<w:p><w:pPr/></w:p>"
}

function wrapParagraphWithAlignment(content: string, alignment: WordAlignment) {
  return `<w:p><w:pPr>${alignmentXml(alignment)}</w:pPr>${content}</w:p>`
}

function buildRunsFromInline(
  node: any,
  forceBold = false,
  runStyle?: { fontName: string; fontSize: number; color: string }
) {
  const runs: string[] = []
  for (const child of node.content ?? []) {
    if (child.type === "text") {
      const marks = child.marks ?? []
      const runMarks = {
        bold: forceBold || marks.some((mark: any) => mark.type === "bold"),
        italics: marks.some((mark: any) => mark.type === "italic"),
        underline: marks.some((mark: any) => mark.type === "underline"),
        fontName: runStyle?.fontName,
        fontSize: runStyle?.fontSize,
        color: runStyle?.color,
      }
      runs.push(textRunXml(normalizeExportText(String(child.text ?? "")), runMarks))
      continue
    }

    if (child.type === "hardBreak") {
      runs.push("<w:r><w:br/></w:r>")
    }
  }

  if (runs.length === 0) {
    runs.push(textRunXml(""))
  }

  return runs
}

type NumberedHeadingMatch = {
  level: number
  title: string
}

function detectNumberedHeading(node: any): NumberedHeadingMatch | null {
  const text = getNodeText(node).trim()
  if (!text) return null
  const sectionMatch = /^section\s+(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/i.exec(text)
  if (sectionMatch) {
    const headingTitle = sectionMatch[2].trim()
    if (!headingTitle) return null
    if (/[.!?]$/.test(headingTitle)) return null
    if (/[.!?]\s/.test(headingTitle)) return null
    const wordCount = headingTitle.split(/\s+/).length
    if (headingTitle.length > 160 || wordCount > 20) return null
    const depth = sectionMatch[1].split(".").length
    return { level: Math.min(6, Math.max(1, depth)), title: headingTitle }
  }
  const match = /^(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/.exec(text)
  if (!match) return null
  const headingTitle = match[2].trim()
  if (!headingTitle) return null
  if (/[.!?]$/.test(headingTitle)) return null
  if (/[.!?]\s/.test(headingTitle)) return null
  const wordCount = headingTitle.split(/\s+/).length
  if (headingTitle.length > 160 || wordCount > 20) return null
  const depth = match[1].split(".").length
  return { level: Math.min(6, Math.max(1, depth)), title: headingTitle }
}

function applyHeadingNumbering(
  match: NumberedHeadingMatch | null,
  counters: number[]
) {
  if (!match) return ""
  const levelIndex = match.level - 1
  counters[levelIndex] += 1
  for (let i = levelIndex + 1; i < counters.length; i += 1) {
    counters[i] = 0
  }
  const prefix = counters.slice(0, match.level).join(".")
  return `${prefix} ${match.title}`
}

function getNodeText(node: any) {
  const parts: string[] = []
  for (const child of node.content ?? []) {
    if (child.type === "text") {
      parts.push(String(child.text ?? ""))
    }
  }
  return parts.join("")
}

function textRunXml(
  text: string,
  marks: {
    bold?: boolean
    italics?: boolean
    underline?: boolean
    preserveSpace?: boolean
    color?: string
    fontName?: string
    fontSize?: number
  } = {}
) {
  const rPr = buildRunProperties(marks)
  const escaped = xmlEscape(text)
  const spaceAttr = marks.preserveSpace || /^\s|\s$/.test(text) ? " xml:space=\"preserve\"" : ""
  return `<w:r>${rPr}<w:t${spaceAttr}>${escaped}</w:t></w:r>`
}

function normalizeExportText(value: string) {
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trimEnd()
}

function buildRunProperties(marks: {
  bold?: boolean
  italics?: boolean
  underline?: boolean
  color?: string
  fontName?: string
  fontSize?: number
}) {
  const props: string[] = []
  if (marks.bold) props.push("<w:b/>")
  if (marks.italics) props.push("<w:i/>")
  if (marks.underline) props.push("<w:u w:val=\"single\"/>")
  if (marks.color) props.push(`<w:color w:val=\"${marks.color}\"/>`)
  if (marks.fontName) {
    props.push(
      `<w:rFonts w:ascii=\"${xmlEscape(marks.fontName)}\" w:hAnsi=\"${xmlEscape(
        marks.fontName
      )}\"/>`
    )
  }
  if (marks.fontSize) {
    const size = Math.max(1, Math.round(marks.fontSize * 2))
    props.push(`<w:sz w:val=\"${size}\"/>`)
    props.push(`<w:szCs w:val=\"${size}\"/>`)
  }
  if (props.length === 0) return ""
  return `<w:rPr>${props.join("")}</w:rPr>`
}

function alignmentXml(alignment: WordAlignment) {
  switch (alignment) {
    case "center":
      return "<w:jc w:val=\"center\"/>"
    case "right":
      return "<w:jc w:val=\"right\"/>"
    case "justify":
      return "<w:jc w:val=\"both\"/>"
    default:
      return "<w:jc w:val=\"left\"/>"
  }
}

function buildTableXml(node: any, ctx: RichContext) {
  const rows = node.content ?? []
  if (rows.length === 0) return ""

  const maxCols = rows.reduce((max: number, row: any) => {
    const count = (row.content ?? []).length
    return Math.max(max, count)
  }, 0)

  const gridCols = maxCols
    ? `<w:tblGrid>${Array.from({ length: maxCols })
        .map(() => "<w:gridCol w:w=\"1\"/>")
        .join("")}</w:tblGrid>`
    : ""

  const tblPr =
    "<w:tblPr><w:tblW w:type=\"pct\" w:w=\"5000\"/><w:tblLayout w:type=\"fixed\"/><w:tblBorders>" +
    "<w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"DDDDDD\"/>" +
    "<w:left w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"DDDDDD\"/>" +
    "<w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"DDDDDD\"/>" +
    "<w:right w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"DDDDDD\"/>" +
    "<w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"DDDDDD\"/>" +
    "<w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"DDDDDD\"/>" +
    "</w:tblBorders></w:tblPr>"

  const rowXml = rows
    .map((row: any) => buildTableRowXml(row, ctx))
    .join("")

  return `<w:tbl>${tblPr}${gridCols}${rowXml}</w:tbl>`
}

function buildTableRowXml(row: any, ctx: RichContext) {
  const cells = row.content ?? []
  const cellXml = cells.map((cell: any) => buildTableCellXml(cell, ctx)).join("")
  return `<w:tr>${cellXml}</w:tr>`
}

function buildTableCellXml(cell: any, ctx: RichContext) {
  const paragraphs: string[] = []
  for (const child of cell.content ?? []) {
      if (child.type === "paragraph") {
        paragraphs.push(
          buildParagraphXml(child, {
            alignment: ctx.alignmentDefaults.table,
            runStyle: ctx.contentStyle,
          })
        )
      }
  }
  if (paragraphs.length === 0) {
    paragraphs.push(emptyParagraphXml())
  }

  const colspan = Number(cell.attrs?.colspan ?? 1)
  const colSpanXml = colspan > 1 ? `<w:gridSpan w:val=\"${colspan}\"/>` : ""
  const tcPr = `<w:tcPr>${colSpanXml}<w:vAlign w:val=\"top\"/></w:tcPr>`
  return `<w:tc>${tcPr}${paragraphs.join("")}</w:tc>`
}

async function buildImageBlock(src: string, ctx: RichContext) {
  const data = parseDataUrl(src)
  if (!data) return ""

  const { bytes, mime, extension } = data
  const filename = `image${ctx.nextImageId}.${extension}`
  ctx.nextImageId += 1

  ctx.zip.file(`word/media/${filename}`, bytes)
  const relId = addImageRelationship(ctx, filename)
  ensureContentType(ctx, extension, mime)

  const { width, height } = await getImageSize(src)
  const maxWidthPx = 520
  const scale = width > 0 ? Math.min(1, maxWidthPx / width) : 1
  const widthPx = Math.max(1, Math.round(width * scale))
  const heightPx = Math.max(1, Math.round(height * scale))

  const cx = pxToEmu(widthPx)
  const cy = pxToEmu(heightPx)
  const docPrId = ctx.nextDocPrId
  ctx.nextDocPrId += 1

  return buildImageXml({
    relId,
    cx,
    cy,
    docPrId,
    name: `Picture ${docPrId}`,
  })
}

function buildImageXml({
  relId,
  cx,
  cy,
  docPrId,
  name,
}: {
  relId: string
  cx: number
  cy: number
  docPrId: number
  name: string
}) {
  return (
    `<w:r><w:drawing>` +
    `<wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">` +
    `<wp:extent cx=\"${cx}\" cy=\"${cy}\"/>` +
    `<wp:docPr id=\"${docPrId}\" name=\"${xmlEscape(name)}\"/>` +
    `<a:graphic xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">` +
    `<a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">` +
    `<pic:pic xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">` +
    `<pic:nvPicPr><pic:cNvPr id=\"0\" name=\"${xmlEscape(name)}\"/>` +
    `<pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed=\"${relId}\"/>` +
    `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/>` +
    `<a:ext cx=\"${cx}\" cy=\"${cy}\"/></a:xfrm>` +
    `<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic>` +
    `</wp:inline></w:drawing></w:r>`
  )
}

function parseDataUrl(src: string) {
  const match = /^data:(.+?);base64,(.+)$/.exec(src)
  if (!match) return null
  const mime = match[1]
  const base64 = match[2]
  const bytes = decodeDataUrl(base64)
  const extension = mimeToExtension(mime)
  if (!extension) return null
  return { bytes, mime, extension }
}

function mimeToExtension(mime: string) {
  switch (mime) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpeg"
    case "image/jpg":
      return "jpg"
    case "image/gif":
      return "gif"
    case "image/webp":
      return "webp"
    default:
      return null
  }
}

function decodeDataUrl(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.width, height: image.height })
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = src
  })
}

function pxToEmu(px: number) {
  return Math.max(1, Math.round(px * 9525))
}

function addImageRelationship(ctx: RichContext, filename: string) {
  const relId = `rId${ctx.nextRelId}`
  ctx.nextRelId += 1
  const relationship = `<Relationship Id=\"${relId}\" Type=\"${IMAGE_REL_TYPE}\" Target=\"media/${filename}\"/>`
  ctx.relsXml = ctx.relsXml.replace(
    /<\/Relationships>/,
    `${relationship}</Relationships>`
  )
  return relId
}

function ensureContentType(ctx: RichContext, extension: string, mime: string) {
  const needle = `Extension=\"${extension}\"`
  if (ctx.contentTypesXml.includes(needle)) return
  const entry = `<Default Extension=\"${extension}\" ContentType=\"${mime}\"/>`
  ctx.contentTypesXml = ctx.contentTypesXml.replace(
    /<\/Types>/,
    `${entry}</Types>`
  )
}

function getNextRelId(relsXml: string) {
  const matches = relsXml.match(/rId(\d+)/g) ?? []
  const max = matches.reduce((acc, item) => {
    const value = Number(item.replace("rId", ""))
    return Number.isFinite(value) ? Math.max(acc, value) : acc
  }, 0)
  return max + 1
}

function getNextImageId(zip: PizZip) {
  const files = Object.keys(zip.files)
  const max = files.reduce((acc, name) => {
    const match = name.match(/^word\/media\/image(\d+)\./)
    if (!match) return acc
    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(acc, value) : acc
  }, 0)
  return max + 1
}

function getNextDocPrId(documentXml: string) {
  const matches = documentXml.match(/<wp:docPr[^>]*id=\"(\d+)\"/g) ?? []
  const max = matches.reduce((acc, snippet) => {
    const match = snippet.match(/id=\"(\d+)\"/)
    if (!match) return acc
    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(acc, value) : acc
  }, 0)
  return max + 1
}

function xmlEscape(value: string) {
  const sanitized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  return sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
