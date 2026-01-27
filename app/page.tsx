"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { type Company, type Template } from "@/lib/types"
import { CompanySelector } from "@/components/company-selector"
import { TemplateSelector } from "@/components/template-selector"
import { TextEditor } from "@/components/text-editor"

type Step = "company" | "template" | "editor"

export default function Home() {
  const [step, setStep] = useState<Step>("company")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company)
    setStep("template")
  }

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setStep("editor")
  }

  const handleBackToCompany = () => {
    setSelectedCompany(null)
    setStep("company")
  }

  const handleBackToTemplate = () => {
    setSelectedTemplate(null)
    setStep("template")
  }

  const handleReset = () => {
    setSelectedCompany(null)
    setSelectedTemplate(null)
    setStep("company")
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <FileText className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Templify</h1>
            <p className="text-xs text-muted-foreground">
              IHM & IHNA Document Templates
            </p>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`rounded-full px-3 py-1 ${
                step === "company"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              1. Company
            </span>
            <span className="text-muted-foreground">&rarr;</span>
            <span
              className={`rounded-full px-3 py-1 ${
                step === "template"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              2. Template
            </span>
            <span className="text-muted-foreground">&rarr;</span>
            <span
              className={`rounded-full px-3 py-1 ${
                step === "editor"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              3. Create Document
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm min-h-[calc(100vh-220px)]">
          {step === "company" && <CompanySelector onSelect={handleCompanySelect} />}

          {step === "template" && selectedCompany && (
            <TemplateSelector
              company={selectedCompany}
              onSelect={handleTemplateSelect}
              onBack={handleBackToCompany}
            />
          )}

          {step === "editor" && selectedTemplate && (
            <TextEditor
              template={selectedTemplate}
              onBack={handleBackToTemplate}
              onReset={handleReset}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground">
          Templify - Document Template System for IHM & IHNA
        </div>
      </footer>
    </main>
  )
}
