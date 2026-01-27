import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  Footer,
  PageOrientation,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  convertInchesToTwip,
  PageNumber,
} from "docx"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import { type Template, companyConfigs } from "./types"

interface ExportOptions {
  template: Template
  title: string
  subtitle?: string
  content: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
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

export async function exportToWord({ template, title, subtitle, content }: ExportOptions) {
  if (template.docxUrl) {
    try {
      await exportFromTemplate({ template, title, subtitle, content })
      return
    } catch (error) {
      console.error("Template export failed, falling back to generated DOCX:", error)
    }
  }

  const config = companyConfigs[template.company]
  const isLandscape = template.type === "landscape"

  // Create header with colored bar only (matching PDF template)
  const header = new Header({
    children: [
      // Colored header bar using a table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: config.primaryColor.replace("#", "") },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [new Paragraph({ text: " " })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: config.secondaryColor.replace("#", "") },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [new Paragraph({ text: " " })],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: "" }),
    ],
  })

  // Create footer - using a table layout to match PDF template
  // Left side: company details, Right side: empty spacer
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          // Left cell - Company details
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children:
              template.company === "IHM"
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `Legal entity: ${config.legalEntity}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `Category: ${config.category}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `CRICOS Provider: ${config.cricos}| Provider ID: ${config.providerId}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `ABN: ${config.abn} | ACN: ${config.acn}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: config.website,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: config.email,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                  ]
                : [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `Legal entity: ${config.legalEntity}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `ACN: ${config.acn} | ABN: ${config.abn}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${config.providerId} | CRICOS Provider Code: ${config.cricos}`,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({ text: "" }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: config.website,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: config.email,
                          size: 16,
                          color: "666666",
                          font: "Arial",
                        }),
                      ],
                    }),
                  ],
          }),
          // Right cell - spacer (page numbers are added to body)
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ text: "" })],
          }),
        ],
      }),
    ],
  })

  // Colored footer bar
  const footerBar = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: config.primaryColor.replace("#", "") },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ text: " " })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: config.secondaryColor.replace("#", "") },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ text: " " })],
          }),
        ],
      }),
    ],
  })

  const footer = new Footer({
    children: [footerTable, new Paragraph({ text: "" }), footerBar],
  })

  // Build content paragraphs
  const contentParagraphs: Paragraph[] = []

  const titleColor = template.company === "IHNA" ? "009690" : config.primaryColor.replace("#", "")
  const subtitleColor =
    template.company === "IHNA" ? "009690" : config.secondaryColor.replace("#", "")

  // Title
  contentParagraphs.push(
    new Paragraph({
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 36,
          color: titleColor,
          font: "Arial",
        }),
      ],
    })
  )

  // Subtitle
  if (subtitle) {
    contentParagraphs.push(
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: subtitle,
            size: 24,
            color: subtitleColor,
            font: "Arial",
          }),
        ],
      })
    )
  }

  // Main content - preserve exact formatting line by line
  const lines = content.split("\n")
  for (const line of lines) {
    contentParagraphs.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: line,
            size: 22,
            font: "Arial",
          }),
        ],
      })
    )
  }

  // Page numbers at end of content (centered)
  contentParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
      children: [
        new TextRun({
          text: "Page ",
          size: 22,
          color: "666666",
          font: "Arial",
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 22,
          color: "666666",
          font: "Arial",
        }),
        new TextRun({
          text: " of ",
          size: 22,
          color: "666666",
          font: "Arial",
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          size: 22,
          color: "666666",
          font: "Arial",
        }),
      ],
    })
  )

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: header,
        },
        footers: {
          default: footer,
        },
        children: contentParagraphs,
      },
    ],
  })

  // Generate and download
  const blob = await Packer.toBlob(doc)
  const filename = `${config.name}_${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.docx`
  saveAs(blob, filename)
}

export async function buildDocxBlobFromTemplate({
  template,
  title,
  subtitle,
  content,
}: ExportOptions) {
  const response = await fetch(encodeURI(template.docxUrl as string))
  if (!response.ok) {
    throw new Error(`Template download failed: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const zip = new PizZip(arrayBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  })

  doc.setData({
    title,
    subtitle: subtitle ?? "",
    content,
  })

  doc.render()
  return doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

async function exportFromTemplate({ template, title, subtitle, content }: ExportOptions) {
  const blob = await buildDocxBlobFromTemplate({ template, title, subtitle, content })

  const config = companyConfigs[template.company]
  const filename = `${config.name}_${title.replace(/\s+/g, "_")}_${new Date()
    .toISOString()
    .split("T")[0]}.docx`
  saveAs(blob, filename)
}
