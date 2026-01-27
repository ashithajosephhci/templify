export type Company = "IHM" | "IHNA"

export interface Template {
  id: string
  name: string
  company: Company
  type: "portrait" | "landscape"
  previewUrl: string
  pdfUrl: string
  docxUrl?: string
}

export interface CompanyConfig {
  name: string
  fullName: string
  legalEntity: string
  category: string
  cricos: string
  providerId: string
  abn: string
  acn: string
  website: string
  email: string
  primaryColor: string
  secondaryColor: string
}

export const companyConfigs: Record<Company, CompanyConfig> = {
  IHM: {
    name: "IHM",
    fullName: "Institute of Health & Management",
    legalEntity: "INSTITUTE OF HEALTH & MANAGEMENT PTY LTD.",
    category: "Institute of Higher Education",
    cricos: "03407G",
    providerId: "PRV14040",
    abn: "19 155 760 437",
    acn: "155 760 437",
    website: "www.ihm.edu.au",
    email: "enquiry@ihm.edu.au",
    primaryColor: "#F15C4E",
    secondaryColor: "#EDAB37",
  },
  IHNA: {
    name: "IHNA",
    fullName: "Institute of Health and Nursing Australia",
    legalEntity: "HEALTH CAREERS INTERNATIONAL PTY LTD.",
    category: "Registered Training Organisation",
    cricos: "03386G",
    providerId: "RTO ID: 21985",
    abn: "59 106 800 944",
    acn: "106 800 944",
    website: "www.ihna.edu.au",
    email: "enquiry@ihna.edu.au",
    primaryColor: "#027060",
    secondaryColor: "#F7941D",
  },
}

export const templates: Template[] = [
  {
    id: "ihm-portrait",
    name: "Portrait Template",
    company: "IHM",
    type: "portrait",
    previewUrl: "/templates/IHM Potrait template.pdf",
    pdfUrl: "/templates/IHM Potrait template.pdf",
    docxUrl: "/templates/IHM_Potrait.docx",
  },
  {
    id: "ihm-landscape",
    name: "Landscape Template",
    company: "IHM",
    type: "landscape",
    previewUrl: "/templates/ihm landscape template.pdf",
    pdfUrl: "/templates/ihm landscape template.pdf",
    docxUrl: "/templates/IHM_Landscape.docx",
  },
  {
    id: "ihna-portrait",
    name: "Portrait Template",
    company: "IHNA",
    type: "portrait",
    previewUrl: "/templates/IHNA potrait template.pdf",
    pdfUrl: "/templates/IHNA potrait template.pdf",
    docxUrl: "/templates/IHNA Potrait.docx",
  },
  {
    id: "ihna-landscape",
    name: "Landscape Template",
    company: "IHNA",
    type: "landscape",
    previewUrl: "/templates/IHNA landscape template.pdf",
    pdfUrl: "/templates/IHNA landscape template.pdf",
    docxUrl: "/templates/IHNA Landscape.docx",
  },
]
