"use client"

import { useEffect, useMemo, useState } from "react"
import { type Template, companyConfigs } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, ArrowLeft, FileText, FileDown } from "lucide-react"
import { buildPdfBytes, exportToPdf, type PdfLayout, type TextBoxLayout } from "@/lib/pdf-export"
import { exportToWord } from "@/lib/word-export"

interface TextEditorProps {
  template: Template
  onBack: () => void
  onReset: () => void
}

export function TextEditor({ template, onBack, onReset }: TextEditorProps) {
  type LayoutSection =
    | "title"
    | "subtitle"
    | "headerTitle"
    | "headerSubtitle"
    | "body"
    | "pageNumber"
  const [documentTitle, setDocumentTitle] = useState("")
  const [documentSubtitle, setDocumentSubtitle] = useState("")
  const [content, setContent] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingDoc, setIsExportingDoc] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [layout, setLayout] = useState<PdfLayout>(() => getDefaultLayout(template.type))
  const [showLayoutEditor, setShowLayoutEditor] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const config = companyConfigs[template.company]
  const previewSrc = useMemo(() => encodeURI(template.previewUrl), [template.previewUrl])
  const storageKey = useMemo(
    () => `templify:layout:orientation:${template.type}`,
    [template.type]
  )
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<PdfLayout>
        const defaults = getDefaultLayout(template.type)
        setLayout({
          ...defaults,
          ...parsed,
          title: { ...defaults.title, ...parsed.title },
          subtitle: { ...defaults.subtitle, ...parsed.subtitle },
          headerTitle: { ...defaults.headerTitle, ...parsed.headerTitle },
          headerSubtitle: { ...defaults.headerSubtitle, ...parsed.headerSubtitle },
          body: { ...defaults.body, ...parsed.body },
          pageNumber: { ...defaults.pageNumber, ...parsed.pageNumber },
          titleStyle: { ...defaults.titleStyle, ...parsed.titleStyle },
          subtitleStyle: { ...defaults.subtitleStyle, ...parsed.subtitleStyle },
          bodyStyle: { ...defaults.bodyStyle, ...parsed.bodyStyle },
          bodyAlign: parsed.bodyAlign ?? defaults.bodyAlign,
        })
        setHasUnsavedLayout(false)
        return
      } catch {
        // Fall through to defaults.
      }
    }
    setLayout(getDefaultLayout(template.type))
    setHasUnsavedLayout(false)
  }, [storageKey, template.type])

  const handleSaveLayout = () => {
    if (typeof window === "undefined") return
    if (!hasUnsavedLayout) return
    const ok = window.confirm(
      `Save these layout values as the default for ${template.type} templates? This will affect future documents.`
    )
    if (!ok) return
    window.localStorage.setItem(storageKey, JSON.stringify(layout))
    setHasUnsavedLayout(false)
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    let isActive = true
    let timeoutId: number | null = null

    const updatePreview = async () => {
      if (!content.trim() && !documentTitle.trim() && !documentSubtitle.trim()) {
        if (isActive) {
          setPreviewUrl(null)
        }
        return
      }

      try {
        const labels = await fetchHeadingLabels()
        const pdfBytes = await buildPdfBytes({
          template,
          title: documentTitle || "Document",
          subtitle: documentSubtitle,
          content: content || "",
          layout,
          labels: labels ?? undefined,
        })
        if (!isActive) return
        const blobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }))
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return blobUrl
        })
      } catch {
        if (isActive) {
          setPreviewUrl(null)
        }
      }
    }

    timeoutId = window.setTimeout(() => {
      void updatePreview()
    }, 500)

    return () => {
      isActive = false
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [content, documentTitle, documentSubtitle, layout, template])


  const fetchHeadingLabels = async () => {
    if (!content.trim()) return null
    const response = await fetch("/api/heading-classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: content.split("\n") }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      labels?: Array<"heading" | "body" | "blank">
    }
    return data.labels ?? null
  }

  const handleExport = async () => {
    if (!content.trim()) return

    setIsExporting(true)
    setExportError(null)
    try {
      const labels = await fetchHeadingLabels()
      await exportToPdf({
        template,
        title: documentTitle || "Document",
        subtitle: documentSubtitle,
        content,
        layout,
        labels: labels ?? undefined,
      })
    } catch (error) {
      console.error("Export failed:", error)
      setExportError(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportDoc = async () => {
    if (!content.trim()) return
    setIsExportingDoc(true)
    setExportError(null)
    try {
      await exportToWord({
        template,
        title: documentTitle || "Document",
        subtitle: documentSubtitle,
        content,
      })
    } catch (error) {
      console.error("DOCX export failed:", error)
      setExportError("DOCX export failed.")
    } finally {
      setIsExportingDoc(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setExportError(null)
    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          title: documentTitle,
          subtitle: documentSubtitle,
        }),
      })
      if (!response.ok) {
        throw new Error("Generation failed")
      }
      const data = (await response.json()) as { content?: string }
      if (data.content) {
        setContent(data.content)
      }
    } catch (error) {
      console.error("Generation failed:", error)
      setExportError("AI generation failed.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLayoutChange = (
    section: LayoutSection,
    field: keyof TextBoxLayout,
    value: string
  ) => {
    const numeric = Number.parseFloat(value)
    if (Number.isNaN(numeric)) return
    setLayout((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: numeric,
      },
    }))
    setHasUnsavedLayout(true)
  }

  const handleStyleChange = (
    section: "titleStyle" | "subtitleStyle" | "bodyStyle",
    field: "fontName" | "color",
    value: string
  ) => {
    setLayout((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
    setHasUnsavedLayout(true)
  }

  const resetLayout = () => {
    setLayout(getDefaultLayout(template.type))
    setHasUnsavedLayout(true)
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to templates
        </button>
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Start over
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_1.3fr]">
        {/* Editor Panel */}
        <div className="space-y-4">
          <div
            className="rounded-lg border-2 p-4"
            style={{ borderColor: config.primaryColor }}
          >
            <div className="mb-4 flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded"
                style={{
                  background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
                }}
              >
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{config.name} - {template.name}</p>
                <p className="text-xs text-muted-foreground">{template.type} orientation</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  placeholder="Enter document title..."
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle (optional)</Label>
                <Input
                  id="subtitle"
                  placeholder="Enter subtitle..."
                  value={documentSubtitle}
                  onChange={(e) => setDocumentSubtitle(e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Paste or type your content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[360px] resize-none font-mono text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">AI prompt (optional)</Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe the report you want the AI to generate..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[160px] resize-none text-base"
                />
              </div>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full"
                variant="secondary"
              >
                {isGenerating ? "Generating..." : "Generate Content with AI"}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={!content.trim() || isExporting}
            className="w-full"
            style={{
              background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Generating..." : "Download PDF"}
          </Button>
          <Button
            onClick={handleExportDoc}
            disabled={!content.trim() || isExportingDoc}
            className="w-full"
            variant="secondary"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {isExportingDoc ? "Generating..." : "Download Word (.docx)"}
          </Button>
          {exportError && (
            <p className="text-sm text-destructive">{exportError}</p>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Layout settings</p>
              <button
                onClick={() => setShowLayoutEditor((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showLayoutEditor ? "Hide" : "Edit"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Units are points (72 points = 1 inch). Y is measured from the top.
            </p>

            {showLayoutEditor && (
              <>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={resetLayout}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset defaults
                  </button>
                </div>

                {(["title", "subtitle", "body"] as const).map((section) => (
                  <div key={section} className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Font size</Label>
                        <Input
                          type="number"
                          step="1"
                          value={layout[section].fontSize}
                          onChange={(e) =>
                            handleLayoutChange(section, "fontSize", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Line height</Label>
                        <Input
                          type="number"
                          step="1"
                          value={layout[section].lineHeight}
                          onChange={(e) =>
                            handleLayoutChange(section, "lineHeight", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-6 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Styles
                  </p>

                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Label className="text-xs">Title color</Label>
                      <Input
                        type="color"
                        value={layout.titleStyle.color}
                        onChange={(e) =>
                          handleStyleChange("titleStyle", "color", e.target.value)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Label className="text-xs">Subtitle color</Label>
                      <Input
                        type="color"
                        value={layout.subtitleStyle.color}
                        onChange={(e) =>
                          handleStyleChange("subtitleStyle", "color", e.target.value)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Label className="text-xs">Body color</Label>
                      <Input
                        type="color"
                        value={layout.bodyStyle.color}
                        onChange={(e) =>
                          handleStyleChange("bodyStyle", "color", e.target.value)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Label className="text-xs">Body alignment</Label>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={layout.bodyAlign}
                        onChange={(e) => {
                          setLayout((prev) => ({
                            ...prev,
                            bodyAlign: e.target.value as PdfLayout["bodyAlign"],
                          }))
                          setHasUnsavedLayout(true)
                        }}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                      <div className="flex items-center justify-end">
                        <button
                          onClick={handleSaveLayout}
                          className={`rounded-full px-3 py-1 text-xs ${
                            hasUnsavedLayout
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Save for {template.type}
                        </button>
                      </div>
                    </div>
                    {hasUnsavedLayout && (
                      <p className="text-xs text-muted-foreground">
                        Changes apply only to this document until you save.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="hidden lg:block">
          <div className="sticky top-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Preview</p>
            <div className="rounded-lg border bg-white shadow-lg overflow-hidden">
              <div className="max-h-[820px] overflow-auto p-4">
                <div
                  className="relative w-full"
                  style={{
                    aspectRatio: template.type === "portrait" ? "8.5/11" : "11/8.5",
                  }}
                >
                  <iframe
                    title="Template preview"
                    src={previewUrl ?? previewSrc}
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getDefaultLayout(type: Template["type"]): PdfLayout {
  if (type === "landscape") {
    return {
      title: { x: 38, y: 380, width: 648, height: 48, fontSize: 36, lineHeight: 40 },
      subtitle: { x: 37, y: 424, width: 648, height: 32, fontSize: 24, lineHeight: 28 },
      headerTitle: { x: 520, y: 42, width: 200, height: 18, fontSize: 12, lineHeight: 14 },
      headerSubtitle: { x: 520, y: 62, width: 200, height: 16, fontSize: 10, lineHeight: 12 },
      pageNumber: { x: 0, y: 560, width: 792, height: 16, fontSize: 10, lineHeight: 12 },
      body: { x: 72, y: 120, width: 648, height: 440, fontSize: 11, lineHeight: 16 },
      titleStyle: { fontName: "Helvetica", color: "#F04D23" },
      subtitleStyle: { fontName: "Helvetica", color: "#414042" },
      bodyStyle: { fontName: "Helvetica", color: "#111827" },
      bodyAlign: "left",
    }
  }

  return {
    title: { x: 38, y: 250, width: 468, height: 48, fontSize: 36, lineHeight: 40 },
    subtitle: { x: 37, y: 424, width: 468, height: 32, fontSize: 24, lineHeight: 28 },
    headerTitle: { x: 360, y: 46, width: 200, height: 18, fontSize: 12, lineHeight: 14 },
    headerSubtitle: { x: 360, y: 64, width: 200, height: 16, fontSize: 10, lineHeight: 12 },
    pageNumber: { x: 0, y: 760, width: 612, height: 16, fontSize: 10, lineHeight: 12 },
    body: { x: 72, y: 100, width: 468, height: 600, fontSize: 11, lineHeight: 16 },
    titleStyle: { fontName: "Helvetica", color: "#F04D23" },
    subtitleStyle: { fontName: "Helvetica", color: "#414042" },
    bodyStyle: { fontName: "Helvetica", color: "#111827" },
    bodyAlign: "left",
  }
}
