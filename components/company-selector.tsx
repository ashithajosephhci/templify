"use client"

import { Building2 } from "lucide-react"
import { type Company, companyConfigs } from "@/lib/types"

interface CompanySelectorProps {
  onSelect: (company: Company) => void
}

export function CompanySelector({ onSelect }: CompanySelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">Select Company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the company template you want to use
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(companyConfigs) as Company[]).map((key) => {
          const config = companyConfigs[key]
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="group relative flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-card p-6 text-left transition-all hover:border-accent hover:shadow-lg"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
                }}
              >
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">{config.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{config.fullName}</p>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 h-1 rounded-b-lg opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  background: `linear-gradient(90deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
