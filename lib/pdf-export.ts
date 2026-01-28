import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { type Template, companyConfigs } from "./types"
import { type TiptapDoc, createNumberingNormalizer } from "./tiptap-utils"

export interface TextBoxLayout {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  lineHeight: number
}

export interface TextStyle {
  fontName: "Helvetica" | "Times-Roman" | "Courier" | "Calibri"
  color: string
}

export interface PdfLayout {
  title: TextBoxLayout
  subtitle: TextBoxLayout
  headerTitle: TextBoxLayout
  headerSubtitle: TextBoxLayout
  body: TextBoxLayout
  pageNumber: TextBoxLayout
  titleStyle: TextStyle
  subtitleStyle: TextStyle
  headerTitleStyle: TextStyle
  headerSubtitleStyle: TextStyle
  bodyStyle: TextStyle
  headingStyle: TextStyle
  headingFontSize: number
  bodyAlign: "left" | "center" | "right" | "justify"
}

interface ExportOptions {
  template: Template
  title: string
  subtitle?: string
  content: TiptapDoc
  layout: PdfLayout
}

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

function wrapText(text: string, maxWidth: number, font: any, fontSize: number) {
  const lines: string[] = []
  const paragraphs = text.split("\n")

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("")
      continue
    }

    const words = paragraph.split(/\s+/)
    let currentLine = ""

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (testWidth <= maxWidth) {
        currentLine = testLine
        continue
      }

      if (currentLine) {
        lines.push(currentLine)
        currentLine = ""
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        currentLine = word
        continue
      }

      let chunk = ""
      for (const char of word) {
        const testChunk = `${chunk}${char}`
        if (font.widthOfTextAtSize(testChunk, fontSize) > maxWidth && chunk) {
          lines.push(chunk)
          chunk = char
        } else {
          chunk = testChunk
        }
      }
      currentLine = chunk
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

export async function buildPdfBytes({
  template,
  title,
  subtitle,
  content,
  layout,
  labels,
}: ExportOptions & { labels?: Array<"heading" | "body" | "blank"> }) {
  const response = await fetch(encodeURI(template.pdfUrl))
  if (!response.ok) {
    throw new Error(`Template download failed: ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  const templateDoc = await PDFDocument.load(buffer)
  const outputDoc = await PDFDocument.create()

  const [firstPage] = await outputDoc.copyPages(templateDoc, [0])
  outputDoc.addPage(firstPage)

  const titleFont = await outputDoc.embedFont(getStandardFont(layout.titleStyle.fontName))
  const subtitleFont = await outputDoc.embedFont(
    getStandardFont(layout.subtitleStyle.fontName)
  )
  const headerTitleFont = await outputDoc.embedFont(
    getStandardFont(layout.headerTitleStyle.fontName)
  )
  const headerSubtitleFont = await outputDoc.embedFont(
    getStandardFont(layout.headerSubtitleStyle.fontName)
  )
  const bodyFont = await outputDoc.embedFont(getStandardFont(layout.bodyStyle.fontName))
  const bodyFontBold = await outputDoc.embedFont(
    getStandardFontBold(layout.bodyStyle.fontName)
  )
  const bodyFontItalic = await outputDoc.embedFont(
    getStandardFontItalic(layout.bodyStyle.fontName)
  )
  const bodyFontBoldItalic = await outputDoc.embedFont(
    getStandardFontBoldItalic(layout.bodyStyle.fontName)
  )
  const headingFont = await outputDoc.embedFont(getStandardFont(layout.headingStyle.fontName))
  const headingFontBold = await outputDoc.embedFont(
    getStandardFontBold(layout.headingStyle.fontName)
  )
  const headingFontItalic = await outputDoc.embedFont(
    getStandardFontItalic(layout.headingStyle.fontName)
  )
  const headingFontBoldItalic = await outputDoc.embedFont(
    getStandardFontBoldItalic(layout.headingStyle.fontName)
  )

  const titleFontSize = layout.title.fontSize
  const subtitleFontSize = layout.subtitle.fontSize
  const bodyFontSize = layout.body.fontSize
  const bodyLineHeight = layout.body.lineHeight
  const titleColor = hexToRgb(
    template.company === "IHNA" ? "#009690" : layout.titleStyle.color
  )
  const subtitleColor = hexToRgb(
    template.company === "IHNA" ? "#009690" : layout.subtitleStyle.color
  )
  const bodyColor = hexToRgb(layout.bodyStyle.color)
  const headingColor = hexToRgb(layout.headingStyle.color)
  const headerTitleColor = hexToRgb(layout.headerTitleStyle.color)
  const headerSubtitleColor = hexToRgb(layout.headerSubtitleStyle.color)

  const firstPageWidth = firstPage.getWidth()
  const usableTitleWidth = Math.max(0, firstPageWidth - layout.title.x * 2)
  const titleLines = wrapText(title, usableTitleWidth, titleFont, titleFontSize)
  drawStyledLinesInBox(
    firstPage,
    titleLines.map((line) => ({
      text: line,
      font: titleFont,
      fontSize: titleFontSize,
      lineHeight: layout.title.lineHeight,
      color: titleColor,
    })),
    {
      ...layout.title,
      width: usableTitleWidth,
      height: Math.max(layout.title.height, titleLines.length * layout.title.lineHeight),
    }
  )

  if (subtitle) {
    const subtitleGap = 6
    const subtitleY = layout.title.y + titleLines.length * layout.title.lineHeight + subtitleGap
    const usableSubtitleWidth = Math.max(0, firstPageWidth - layout.subtitle.x * 2)
    const subtitleLines = wrapText(
      subtitle,
      usableSubtitleWidth,
      subtitleFont,
      subtitleFontSize
    )
    drawStyledLinesInBox(
      firstPage,
      subtitleLines.map((line) => ({
        text: line,
        font: subtitleFont,
        fontSize: subtitleFontSize,
        lineHeight: layout.subtitle.lineHeight,
        color: subtitleColor,
      })),
      {
        ...layout.subtitle,
        y: subtitleY,
        width: usableSubtitleWidth,
        height: Math.max(layout.subtitle.height, subtitleLines.length * layout.subtitle.lineHeight),
      }
    )
  }

  const contentPages: any[] = []
  const overflowPageIndex = templateDoc.getPageCount() > 1 ? 1 : 0
  const numbering = createNumberingNormalizer()

  const renderContext = {
    templateDoc,
    outputDoc,
    overflowPageIndex,
    layout,
    title,
    subtitle,
    headerSubtitleFontSize:
      template.company === "IHM" ? 12 : layout.headerSubtitle.fontSize,
    colors: { bodyColor, subtitleColor, headingColor, headerTitleColor, headerSubtitleColor },
    fonts: {
      regular: bodyFont,
      bold: bodyFontBold,
      italic: bodyFontItalic,
      boldItalic: bodyFontBoldItalic,
    },
    headingFonts: {
      regular: headingFont,
      bold: headingFontBold,
      italic: headingFontItalic,
      boldItalic: headingFontBoldItalic,
    },
    headerTitleFont,
    headerSubtitleFont,
    bodyFontSize,
    bodyLineHeight,
    headingFontSize: layout.headingFontSize,
    headingLineHeight: Math.max(layout.body.lineHeight, layout.headingFontSize + 4),
    numbering,
  }

  await renderRichContent(content, renderContext, contentPages)

  const totalPages = contentPages.length + 1
  for (let i = 0; i < contentPages.length; i += 1) {
    const page = contentPages[i]
    const label = `Page ${i + 2} of ${totalPages}`
    page.drawRectangle({
      x: layout.pageNumber.x,
      y: page.getHeight() - layout.pageNumber.y - layout.pageNumber.height,
      width: layout.pageNumber.width,
      height: layout.pageNumber.height,
      color: rgb(1, 1, 1),
    })
    drawAlignedLineInBox(
      page,
      {
        text: label,
        font: bodyFont,
        fontSize: layout.pageNumber.fontSize,
        color: bodyColor,
      },
      layout.pageNumber,
      "center"
    )
  }

  return await outputDoc.save()
}

export async function exportToPdf({
  template,
  title,
  subtitle,
  content,
  layout,
  labels,
}: ExportOptions & { labels?: Array<"heading" | "body" | "blank"> }) {
  const pdfBytes = await buildPdfBytes({
    template,
    title,
    subtitle,
    content,
    layout,
    labels,
  })
  const config = companyConfigs[template.company]
  const filename = `${config.name}_${title.replace(/\s+/g, "_")}_${new Date()
    .toISOString()
    .split("T")[0]}.pdf`
  const pdfArray = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  saveAs(new Blob([pdfArray.slice().buffer], { type: "application/pdf" }), filename)
}

interface StyledLine {
  text: string
  font: any
  fontSize: number
  lineHeight: number
  color: { red: number; green: number; blue: number }
}

function drawStyledLinesInBox(
  page: any,
  lines: StyledLine[],
  box: TextBoxLayout,
  align: "left" | "center" | "right" | "justify" = "left"
) {
  const pageHeight = page.getHeight()
  const startY = pageHeight - box.y - (lines[0]?.fontSize ?? 12)
  const bottomY = pageHeight - (box.y + box.height)
  let cursorY = startY
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (cursorY < bottomY) break
    if (line.text) {
      if (align === "justify") {
        drawJustifiedText(page, line.text, box, cursorY, line)
      } else {
        const textWidth = line.font.widthOfTextAtSize(line.text, line.fontSize)
        let x = box.x
        if (align === "right") {
          x = box.x + box.width - textWidth
        } else if (align === "center") {
          x = box.x + (box.width - textWidth) / 2
        }
        page.drawText(line.text, {
          x,
          y: cursorY,
          size: line.fontSize,
          font: line.font,
          color: line.color,
        })
      }
    }
    cursorY -= line.lineHeight
    index += 1
  }

  return lines.slice(index)
}

function drawJustifiedText(
  page: any,
  text: string,
  box: TextBoxLayout,
  y: number,
  line: StyledLine
) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) {
    page.drawText(text, {
      x: box.x,
      y,
      size: line.fontSize,
      font: line.font,
      color: line.color,
    })
    return
  }

  const spaceWidth = line.font.widthOfTextAtSize(" ", line.fontSize)
  const wordsWidth = words.reduce(
    (sum, word) => sum + line.font.widthOfTextAtSize(word, line.fontSize),
    0
  )
  const totalBaseWidth = wordsWidth + spaceWidth * (words.length - 1)
  const extra = box.width - totalBaseWidth
  const extraPerSpace = extra > 0 ? extra / (words.length - 1) : 0

  let cursorX = box.x
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]
    page.drawText(word, {
      x: cursorX,
      y,
      size: line.fontSize,
      font: line.font,
      color: line.color,
    })
    cursorX += line.font.widthOfTextAtSize(word, line.fontSize)
    if (i < words.length - 1) {
      cursorX += spaceWidth + extraPerSpace
    }
  }
}

function drawAlignedLineInBox(
  page: any,
  line: { text: string; font: any; fontSize: number; color: any },
  box: TextBoxLayout,
  align: "left" | "center" | "right"
) {
  const pageHeight = page.getHeight()
  const y = pageHeight - box.y - line.fontSize
  const textWidth = line.font.widthOfTextAtSize(line.text, line.fontSize)
  let x = box.x
  if (align === "right") {
    x = box.x + box.width - textWidth
  } else if (align === "center") {
    x = box.x + (box.width - textWidth) / 2
  }
  page.drawText(line.text, {
    x,
    y,
    size: line.fontSize,
    font: line.font,
    color: line.color,
  })
}

type PdfRun = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

type PdfParagraph = {
  type: "paragraph"
  runs: PdfRun[]
  align: "left" | "center" | "right" | "justify"
  isHeading?: boolean
}

type PdfImage = {
  type: "image"
  src: string
}

type PdfTableCell = {
  content: PdfParagraph[]
  colspan: number
  rowspan: number
}

type PdfTableRow = {
  cells: PdfTableCell[]
}

type PdfTable = {
  type: "table"
  rows: PdfTableRow[]
}

type PdfBlock = PdfParagraph | PdfImage | PdfTable

type PdfRenderContext = {
  templateDoc: PDFDocument
  outputDoc: PDFDocument
  overflowPageIndex: number
  layout: PdfLayout
  title: string
  subtitle?: string
  headerSubtitleFontSize: number
  colors: { bodyColor: any; subtitleColor: any; headingColor: any; headerTitleColor: any; headerSubtitleColor: any }
  fonts: { regular: any; bold: any; italic: any; boldItalic: any }
  headingFonts: { regular: any; bold: any; italic: any; boldItalic: any }
  headerTitleFont: any
  headerSubtitleFont: any
  bodyFontSize: number
  bodyLineHeight: number
  headingFontSize: number
  headingLineHeight: number
  numbering: ReturnType<typeof createNumberingNormalizer>
}

async function renderRichContent(
  doc: TiptapDoc,
  ctx: PdfRenderContext,
  pages: any[]
) {
  const blocks = tiptapToPdfBlocks(doc, ctx.numbering, ctx.layout.bodyAlign)
  let currentPage = await createContentPage(ctx, pages)
  let cursorY = ctx.layout.body.y
  const maxY = ctx.layout.body.y + ctx.layout.body.height

  for (const block of blocks) {
    const blockHeight = await measureBlockHeight(block, ctx)
    if (cursorY + blockHeight > maxY) {
      currentPage = await createContentPage(ctx, pages)
      cursorY = ctx.layout.body.y
    }

    if (block.type === "paragraph") {
      cursorY = drawParagraphBlock(currentPage, block, cursorY, ctx)
    } else if (block.type === "image") {
      cursorY = await drawImageBlock(currentPage, block, cursorY, ctx)
    } else if (block.type === "table") {
      cursorY = drawTableBlock(currentPage, block, cursorY, ctx)
    }
  }
}

function tiptapToPdfBlocks(
  doc: TiptapDoc,
  normalizeNumbering: ReturnType<typeof createNumberingNormalizer>,
  defaultAlign: PdfParagraph["align"]
): PdfBlock[] {
  const blocks: PdfBlock[] = []
  for (const node of doc.content ?? []) {
    if (node.type === "paragraph" || node.type === "heading") {
      const paragraph = tiptapParagraphToPdf(node, defaultAlign)
      if (paragraph.runs.length === 0) {
        blocks.push({
          type: "paragraph",
          runs: [{ text: "" }],
          align: paragraph.align,
        })
        continue
      }
      const fullText = paragraph.runs.map((run) => run.text).join("")
      const normalized = normalizeNumbering(fullText)
      if (normalized.isHeading) {
        blocks.push({
          type: "paragraph",
          runs: [{ text: normalized.text, bold: true }],
          align: paragraph.align,
          isHeading: true,
        })
      } else {
        blocks.push(paragraph)
      }
      continue
    }

    if (node.type === "bulletList") {
      const items = node.content ?? []
      for (const item of items) {
        if (item.type !== "listItem") continue
        const paragraphs = extractListParagraphs(item)
        for (const paragraph of paragraphs) {
          const base = tiptapParagraphToPdf(paragraph, defaultAlign)
          blocks.push({
            type: "paragraph",
            runs: [{ text: "• " }, ...base.runs],
            align: base.align,
          })
        }
      }
      continue
    }

    if (node.type === "orderedList") {
      let index = 1
      const items = node.content ?? []
      for (const item of items) {
        if (item.type !== "listItem") continue
        const paragraphs = extractListParagraphs(item)
        for (const paragraph of paragraphs) {
          const base = tiptapParagraphToPdf(paragraph, defaultAlign)
          blocks.push({
            type: "paragraph",
            runs: [{ text: `${index}. ` }, ...base.runs],
            align: base.align,
          })
          index += 1
        }
      }
      continue
    }

    if (node.type === "image") {
      const src = String(node.attrs?.src ?? "")
      if (src) {
        blocks.push({ type: "image", src })
      }
      continue
    }

    if (node.type === "table") {
      const rows: PdfTableRow[] = []
      for (const row of node.content ?? []) {
        const cells: PdfTableCell[] = []
        for (const cell of row.content ?? []) {
          const cellParagraphs: PdfParagraph[] = []
          for (const child of cell.content ?? []) {
            if (child.type === "paragraph") {
              cellParagraphs.push(tiptapParagraphToPdf(child, defaultAlign))
            }
          }
          const colspan = Number(cell.attrs?.colspan ?? 1)
          const rowspan = Number(cell.attrs?.rowspan ?? 1)
          cells.push({
            content: cellParagraphs.length ? cellParagraphs : [{ type: "paragraph", runs: [{ text: "" }], align: "left" }],
            colspan,
            rowspan,
          })
        }
        rows.push({ cells })
      }
      blocks.push({ type: "table", rows })
      continue
    }
  }
  return blocks
}

function extractListParagraphs(listItem: any) {
  const paragraphs: any[] = []
  for (const child of listItem.content ?? []) {
    if (child.type === "paragraph") {
      paragraphs.push(child)
    }
    if (child.type === "bulletList" || child.type === "orderedList") {
      for (const nestedItem of child.content ?? []) {
        if (nestedItem.type !== "listItem") continue
        for (const nestedParagraph of extractListParagraphs(nestedItem)) {
          paragraphs.push(nestedParagraph)
        }
      }
    }
  }
  return paragraphs
}

function tiptapParagraphToPdf(node: any, defaultAlign: PdfParagraph["align"]): PdfParagraph {
  const runs: PdfRun[] = []
  for (const child of node.content ?? []) {
    if (child.type !== "text") continue
    const marks = child.marks ?? []
    const styles = {
      bold: marks.some((mark: any) => mark.type === "bold"),
      italic: marks.some((mark: any) => mark.type === "italic"),
      underline: marks.some((mark: any) => mark.type === "underline"),
    }
    runs.push({
      text: child.text ?? "",
      ...styles,
    })
  }

  const align = (node.attrs?.textAlign as PdfParagraph["align"]) ?? defaultAlign
  return { type: "paragraph", runs, align }
}

async function createContentPage(ctx: PdfRenderContext, pages: any[]) {
  const [background] = await ctx.outputDoc.copyPages(ctx.templateDoc, [ctx.overflowPageIndex])
  const page = ctx.outputDoc.addPage(background)
  pages.push(page)

  drawAlignedLineInBox(
    page,
    {
      text: ctx.title,
      font: ctx.headerTitleFont,
      fontSize: ctx.layout.headerTitle.fontSize,
      color: ctx.colors.headerTitleColor,
    },
    ctx.layout.headerTitle,
    "right"
  )
  if (ctx.subtitle) {
    drawAlignedLineInBox(
      page,
      {
        text: ctx.subtitle,
        font: ctx.headerSubtitleFont,
        fontSize: ctx.headerSubtitleFontSize,
        color: ctx.colors.headerSubtitleColor,
      },
      ctx.layout.headerSubtitle,
      "right"
    )
  }

  return page
}

async function measureBlockHeight(block: PdfBlock, ctx: PdfRenderContext): Promise<number> {
  if (block.type === "paragraph") {
    const fontSize = block.isHeading ? ctx.headingFontSize : ctx.bodyFontSize
    const lineHeight = block.isHeading ? ctx.headingLineHeight : ctx.bodyLineHeight
    const lines = wrapRuns(
      block.runs,
      ctx.layout.body.width,
      ctx,
      fontSize,
      Boolean(block.isHeading)
    )
    return Math.max(lines.length * lineHeight, lineHeight)
  }
  if (block.type === "image") {
    const size = await getImageSize(block.src)
    const maxWidth = ctx.layout.body.width
    const scale = size.width > 0 ? Math.min(1, maxWidth / size.width) : 1
    return size.height * scale + ctx.bodyLineHeight
  }
  if (block.type === "table") {
    return measureTableHeight(block, ctx)
  }
  return ctx.bodyLineHeight
}

function drawParagraphBlock(page: any, block: PdfParagraph, cursorY: number, ctx: PdfRenderContext) {
  const fontSize = block.isHeading ? ctx.headingFontSize : ctx.bodyFontSize
  const lineHeight = block.isHeading ? ctx.headingLineHeight : ctx.bodyLineHeight
  const lines = wrapRuns(
    block.runs,
    ctx.layout.body.width,
    ctx,
    fontSize,
    Boolean(block.isHeading)
  )
  let y = cursorY
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const isLastLine = i === lines.length - 1
    drawLineSegments(
      page,
      line,
      ctx.layout.body,
      y,
      ctx,
      block.align,
      fontSize,
      block.isHeading,
      isLastLine
    )
    y += lineHeight
  }
  return y + lineHeight * 0.25
}

async function drawImageBlock(page: any, block: PdfImage, cursorY: number, ctx: PdfRenderContext) {
  const size = await getImageSize(block.src)
  if (size.width === 0 || size.height === 0) {
    return cursorY + ctx.bodyLineHeight
  }
  const maxWidth = ctx.layout.body.width
  const scale = Math.min(1, maxWidth / size.width)
  const width = size.width * scale
  const height = size.height * scale

  const image = await embedImage(ctx.outputDoc, block.src)
  const x = ctx.layout.body.x
  const y = page.getHeight() - cursorY - height
  page.drawImage(image, { x, y, width, height })
  return cursorY + height + ctx.bodyLineHeight * 0.5
}

function drawTableBlock(page: any, block: PdfTable, cursorY: number, ctx: PdfRenderContext) {
  const tableWidth = ctx.layout.body.width
  const columnCount = Math.max(
    1,
    block.rows.reduce((max, row) => {
      const count = row.cells.reduce((sum, cell) => sum + cell.colspan, 0)
      return Math.max(max, count)
    }, 0)
  )
  const columnWidth = tableWidth / columnCount

  const rowHeights = computeRowHeights(block, ctx, columnWidth)
  let y = cursorY
  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
    const row = block.rows[rowIndex]
    let x = ctx.layout.body.x
    let colIndex = 0
    for (const cell of row.cells) {
      const cellWidth = columnWidth * cell.colspan
      const cellHeight = rowHeights
        .slice(rowIndex, rowIndex + cell.rowspan)
        .reduce((sum, value) => sum + value, 0)

      page.drawRectangle({
        x,
        y: page.getHeight() - y - cellHeight,
        width: cellWidth,
        height: cellHeight,
        borderColor: rgb(0.75, 0.75, 0.75),
        borderWidth: 0.5,
      })

      let cellCursor = y + 6
      for (const paragraph of cell.content) {
        const fontSize = paragraph.isHeading ? ctx.headingFontSize : ctx.bodyFontSize
        const lineHeight = paragraph.isHeading ? ctx.headingLineHeight : ctx.bodyLineHeight
        const lines = wrapRuns(
          paragraph.runs,
          cellWidth - 12,
          ctx,
          fontSize,
          Boolean(paragraph.isHeading)
        )
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i]
          const isLastLine = i === lines.length - 1
          drawLineSegments(
            page,
            line,
            { ...ctx.layout.body, x: x + 6, width: cellWidth - 12 },
            cellCursor,
            ctx,
            paragraph.align,
            fontSize,
            paragraph.isHeading,
            isLastLine
          )
          cellCursor += lineHeight
        }
      }

      x += cellWidth
      colIndex += cell.colspan
    }
    y += rowHeights[rowIndex]
  }
  return y + ctx.bodyLineHeight * 0.5
}

function measureTableHeight(block: PdfTable, ctx: PdfRenderContext): number {
  const columnCount = Math.max(
    1,
    block.rows.reduce((max, row) => {
      const count = row.cells.reduce((sum, cell) => sum + cell.colspan, 0)
      return Math.max(max, count)
    }, 0)
  )
  const columnWidth = ctx.layout.body.width / columnCount
  const rowHeights = computeRowHeights(block, ctx, columnWidth)
  return rowHeights.reduce((sum, value) => sum + value, 0) + ctx.bodyLineHeight * 0.5
}

function computeRowHeights(block: PdfTable, ctx: PdfRenderContext, columnWidth: number) {
  const rowHeights = Array(block.rows.length).fill(ctx.bodyLineHeight + 6)
  block.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell) => {
      const cellWidth = columnWidth * cell.colspan - 12
      let height = 0
      for (const paragraph of cell.content) {
        const fontSize = paragraph.isHeading ? ctx.headingFontSize : ctx.bodyFontSize
        const lineHeight = paragraph.isHeading ? ctx.headingLineHeight : ctx.bodyLineHeight
        const lines = wrapRuns(paragraph.runs, cellWidth, ctx, fontSize, paragraph.isHeading)
        height += Math.max(lines.length * lineHeight, lineHeight)
      }
      const perRow = Math.max(ctx.bodyLineHeight + 6, height / cell.rowspan)
      for (let r = rowIndex; r < rowIndex + cell.rowspan; r += 1) {
        rowHeights[r] = Math.max(rowHeights[r], perRow + 6)
      }
    })
  })
  return rowHeights
}

function wrapRuns(
  runs: PdfRun[],
  maxWidth: number,
  ctx: PdfRenderContext,
  fontSize: number,
  useHeadingFonts = false
) {
  const safeFontSize = Number.isFinite(fontSize) ? fontSize : ctx.bodyFontSize
  const lines: PdfRun[][] = []
  let currentLine: PdfRun[] = []
  let currentWidth = 0

  const pushLine = () => {
    lines.push(currentLine)
    currentLine = []
    currentWidth = 0
  }

  for (const run of runs) {
    const tokens = run.text.split(/(\s+)/)
    for (const token of tokens) {
      if (!token) continue
      const isSpace = /^\s+$/.test(token)
      const font = pickFont(run, ctx, useHeadingFonts)
      const tokenWidth = font.widthOfTextAtSize(token, safeFontSize)

      if (currentWidth + tokenWidth > maxWidth && currentLine.length > 0 && !isSpace) {
        pushLine()
      }

      if (tokenWidth > maxWidth) {
        for (const char of token) {
          const charWidth = font.widthOfTextAtSize(char, safeFontSize)
          if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
            pushLine()
          }
          currentLine.push({ ...run, text: char })
          currentWidth += charWidth
        }
        continue
      }

      currentLine.push({ ...run, text: token })
      currentWidth += tokenWidth
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  if (lines.length === 0) {
    return [[{ text: "" }]]
  }

  return lines
}

function drawLineSegments(
  page: any,
  segments: PdfRun[],
  box: TextBoxLayout,
  cursorY: number,
  ctx: PdfRenderContext,
  align: "left" | "center" | "right" | "justify",
  fontSize: number,
  useHeadingFonts = false,
  isLastLine = false
) {
  const safeFontSize = Number.isFinite(fontSize) ? fontSize : ctx.bodyFontSize
  const lineWidth = segments.reduce((sum, segment) => {
    const font = pickFont(segment, ctx, useHeadingFonts)
    return sum + font.widthOfTextAtSize(segment.text, safeFontSize)
  }, 0)
  let x = box.x
  if (segments.length && align === "center") {
    x = box.x + (box.width - lineWidth) / 2
  } else if (segments.length && align === "right") {
    x = box.x + box.width - lineWidth
  }
  const canJustify =
    align === "justify" &&
    !isLastLine &&
    segments.some((segment) => /^\s+$/.test(segment.text))
  const extraSpace = canJustify ? Math.max(0, box.width - lineWidth) : 0
  const spaceCount = canJustify
    ? segments.reduce((count, segment) => {
        if (!/^\s+$/.test(segment.text)) return count
        return count + segment.text.length
      }, 0)
    : 0
  const extraPerSpace = spaceCount > 0 ? extraSpace / spaceCount : 0

  const y = page.getHeight() - cursorY - safeFontSize
  for (const segment of segments) {
    const font = pickFont(segment, ctx, useHeadingFonts)
    page.drawText(segment.text, {
      x,
      y,
      size: safeFontSize,
      font,
      color: useHeadingFonts ? ctx.colors.headingColor : ctx.colors.bodyColor,
    })
    if (segment.underline && segment.text.trim()) {
      const underlineWidth = font.widthOfTextAtSize(segment.text, safeFontSize)
      page.drawLine({
        start: { x, y: y - 1 },
        end: { x: x + underlineWidth, y: y - 1 },
        thickness: 0.5,
        color: useHeadingFonts ? ctx.colors.headingColor : ctx.colors.bodyColor,
      })
    }
    x += font.widthOfTextAtSize(segment.text, safeFontSize)
    if (canJustify && /^\s+$/.test(segment.text)) {
      x += extraPerSpace * segment.text.length
    }
  }
}

function pickFont(run: PdfRun, ctx: PdfRenderContext, useHeadingFonts = false) {
  const fonts = useHeadingFonts ? ctx.headingFonts : ctx.fonts
  if (run.bold && run.italic) return fonts.boldItalic
  if (run.bold) return fonts.bold
  if (run.italic) return fonts.italic
  return fonts.regular
}

async function embedImage(doc: PDFDocument, src: string) {
  if (src.startsWith("data:image/png")) {
    const bytes = decodeDataUrl(src)
    return doc.embedPng(bytes)
  }
  if (src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")) {
    const bytes = decodeDataUrl(src)
    return doc.embedJpg(bytes)
  }
  const bytes = decodeDataUrl(src)
  return doc.embedPng(bytes)
}

function decodeDataUrl(src: string) {
  const base64 = src.split(",")[1] ?? ""
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

function buildBodyLines(
  content: string,
  maxWidth: number,
  font: any,
  fontBold: any,
  options: {
    bodyFontSize: number
    bodyLineHeight: number
    bodyColor: any
    labels?: Array<"heading" | "body" | "blank">
  }
) {
  const { bodyFontSize, bodyLineHeight, bodyColor, labels } = options
  const lines: StyledLine[] = []
  const rawLines = content.split("\n")
  let lineIndex = 0
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()
    const label = labels?.[lineIndex]
    lineIndex += 1
    if (!trimmed) {
      lines.push({
        text: "",
        font,
        fontSize: bodyFontSize,
        lineHeight: bodyLineHeight,
        color: bodyColor,
      })
      continue
    }

    const isHeading = label === "heading"
    const activeFont = isHeading ? fontBold : font
    const wrapped = wrapText(trimmed, maxWidth, activeFont, bodyFontSize)
    for (const line of wrapped) {
      lines.push({
        text: line,
        font: activeFont,
        fontSize: bodyFontSize,
        lineHeight: bodyLineHeight,
        color: bodyColor,
      })
    }
  }

  return lines
}

function getStandardFont(name: TextStyle["fontName"]) {
  switch (name) {
    case "Times-Roman":
      return StandardFonts.TimesRoman
    case "Courier":
      return StandardFonts.Courier
    case "Calibri":
    case "Helvetica":
    default:
      return StandardFonts.Helvetica
  }
}

function getStandardFontBold(name: TextStyle["fontName"]) {
  switch (name) {
    case "Times-Roman":
      return StandardFonts.TimesRomanBold
    case "Courier":
      return StandardFonts.CourierBold
    case "Calibri":
    case "Helvetica":
    default:
      return StandardFonts.HelveticaBold
  }
}

function getStandardFontItalic(name: TextStyle["fontName"]) {
  switch (name) {
    case "Times-Roman":
      return StandardFonts.TimesRomanItalic
    case "Courier":
      return StandardFonts.CourierOblique
    case "Calibri":
    case "Helvetica":
    default:
      return StandardFonts.HelveticaOblique
  }
}

function getStandardFontBoldItalic(name: TextStyle["fontName"]) {
  switch (name) {
    case "Times-Roman":
      return StandardFonts.TimesRomanBoldItalic
    case "Courier":
      return StandardFonts.CourierBoldOblique
    case "Calibri":
    case "Helvetica":
    default:
      return StandardFonts.HelveticaBoldOblique
  }
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "")
  const value =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : sanitized
  const r = Number.parseInt(value.slice(0, 2), 16) / 255
  const g = Number.parseInt(value.slice(2, 4), 16) / 255
  const b = Number.parseInt(value.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}
