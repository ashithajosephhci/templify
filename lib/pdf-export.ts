import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { type Template, companyConfigs } from "./types"

export interface TextBoxLayout {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  lineHeight: number
}

export interface TextStyle {
  fontName: "Helvetica" | "Times-Roman" | "Courier"
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
  bodyStyle: TextStyle
  bodyAlign: "left" | "center" | "right" | "justify"
}

interface ExportOptions {
  template: Template
  title: string
  subtitle?: string
  content: string
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
  const bodyFont = await outputDoc.embedFont(getStandardFont(layout.bodyStyle.fontName))
  const bodyFontBold = await outputDoc.embedFont(
    getStandardFontBold(layout.bodyStyle.fontName)
  )

  const titleFontSize = layout.title.fontSize
  const subtitleFontSize = layout.subtitle.fontSize
  const bodyFontSize = 11
  const bodyLineHeight = layout.body.lineHeight
  const titleColor = hexToRgb(layout.titleStyle.color)
  const subtitleColor = hexToRgb(layout.subtitleStyle.color)
  const bodyColor = hexToRgb(layout.bodyStyle.color)

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

  const bodyLines = buildBodyLines(content, layout.body.width, bodyFont, bodyFontBold, {
    bodyFontSize,
    bodyLineHeight,
    bodyColor,
    labels,
  })
  let remainingLines = bodyLines
  const contentPages: any[] = []

  const overflowPageIndex = templateDoc.getPageCount() > 1 ? 1 : 0
  while (remainingLines.length) {
    const [background] = await outputDoc.copyPages(templateDoc, [overflowPageIndex])
    const page = outputDoc.addPage(background)
    contentPages.push(page)
    drawAlignedLineInBox(
      page,
      {
        text: title,
        font: bodyFont,
        fontSize: layout.headerTitle.fontSize,
        color: bodyColor,
      },
      layout.headerTitle,
      "right"
    )
    if (subtitle) {
      drawAlignedLineInBox(
        page,
        {
          text: subtitle,
          font: bodyFont,
          fontSize: layout.headerSubtitle.fontSize,
          color: subtitleColor,
        },
        layout.headerSubtitle,
        "right"
      )
    }
    remainingLines = drawStyledLinesInBox(page, remainingLines, layout.body, layout.bodyAlign)
  }

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
  saveAs(new Blob([pdfBytes], { type: "application/pdf" }), filename)
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
    case "Helvetica":
    default:
      return StandardFonts.HelveticaBold
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
