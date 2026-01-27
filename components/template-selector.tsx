"use client"

import { FileText, LayoutTemplate } from "lucide-react"
import { type Company, type Template, templates, companyConfigs } from "@/lib/types"

interface TemplateSelectorProps {
  company: Company
  onSelect: (template: Template) => void
  onBack: () => void
}

export function TemplateSelector({ company, onSelect, onBack }: TemplateSelectorProps) {
  const companyTemplates = templates.filter((t) => t.company === company)
  const config = companyConfigs[company]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <button
          onClick={onBack}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to company selection
        </button>
        <h2 className="text-xl font-semibold text-foreground">
          Select {config.name} Template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a template format for your document
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {companyTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="group relative flex flex-col items-center gap-4 rounded-lg border-2 border-border bg-card p-6 transition-all hover:border-accent hover:shadow-lg"
          >
            <div
              className="flex h-24 w-full items-center justify-center rounded-md"
              style={{ backgroundColor: `${config.primaryColor}10` }}
            >
              {template.type === "portrait" ? (
                <div
                  className="flex h-16 w-12 items-center justify-center rounded border-2"
                  style={{ borderColor: config.primaryColor }}
                >
                  <FileText className="h-6 w-6" style={{ color: config.primaryColor }} />
                </div>
              ) : (
                <div
                  className="flex h-12 w-16 items-center justify-center rounded border-2"
                  style={{ borderColor: config.primaryColor }}
                >
                  <LayoutTemplate className="h-6 w-6" style={{ color: config.primaryColor }} />
                </div>
              )}
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">{template.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {template.type} orientation
              </p>
            </div>
            <div
              className="absolute inset-x-0 bottom-0 h-1 rounded-b-lg opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                background: `linear-gradient(90deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
