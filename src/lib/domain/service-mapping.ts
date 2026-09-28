// Manual problem → BharatCoder service recommendations (rule-based, no AI).
// Add or edit rules here; each rule lists the phrases that trigger it.

import type { ProjectType } from "./constants";

export type ServiceMappingRule = {
  id: string;
  problem: string;
  keywords: string[];
  solutions: string[];
  projectTypes: ProjectType[];
  services: string[]; // service slugs
};

export const SERVICE_MAPPING_RULES: ServiceMappingRule[] = [
  {
    id: "course-material-whatsapp",
    problem: "Students receive course material through WhatsApp / Drive",
    keywords: ["student", "course", "batch", "class", "coaching", "study material", "notes", "institute", "tuition", "lecture"],
    solutions: ["LMS", "Student Portal", "Admin Dashboard", "Payment Integration"],
    projectTypes: ["lms", "dashboard"],
    services: ["lms_management", "custom_business_applications"],
  },
  {
    id: "leads-in-spreadsheets",
    problem: "Staff manually manage leads using spreadsheets",
    keywords: ["lead", "spreadsheet", "excel", "google sheet", "enquiries", "follow-up", "follow up", "sales team", "pipeline", "crm"],
    solutions: ["CRM", "Lead Management System", "Admin Dashboard", "Automation"],
    projectTypes: ["crm", "dashboard", "automation"],
    services: ["custom_business_applications"],
  },
  {
    id: "no-online-booking",
    problem: "Customers cannot book appointments online",
    keywords: ["appointment", "booking", "book", "slot", "clinic", "patient", "salon", "consultation", "calendar", "schedule"],
    solutions: ["Website with Online Booking", "Appointment Management", "WhatsApp/Email Reminders", "Admin Dashboard"],
    projectTypes: ["website", "web_application", "automation"],
    services: ["web_development", "custom_business_applications"],
  },
  {
    id: "no-or-weak-website",
    problem: "No website, or the website is outdated / not generating enquiries",
    keywords: ["no website", "outdated", "old website", "website", "not mobile", "slow", "seo", "landing page", "enquiry form", "google"],
    solutions: ["Business Website", "Landing Pages", "Lead / Enquiry Forms", "SEO-ready Structure"],
    projectTypes: ["website"],
    services: ["web_development"],
  },
  {
    id: "orders-over-dm",
    problem: "Orders are taken manually over Instagram DM / WhatsApp",
    keywords: ["order", "dm", "instagram", "sell", "product", "catalogue", "catalog", "cart", "payment", "cod", "inventory", "shop", "store"],
    solutions: ["E-commerce Store", "Payment Gateway Integration", "Order Management Dashboard", "Inventory Tracking"],
    projectTypes: ["ecommerce", "dashboard"],
    services: ["web_development", "backend_api"],
  },
  {
    id: "manual-operations",
    problem: "Operations run on paper, spreadsheets and disconnected tools",
    keywords: ["manual", "paper", "register", "inventory", "billing", "invoice", "attendance", "staff", "branch", "stock", "operations"],
    solutions: ["Management System", "Admin Dashboard", "Workflow System", "Reports"],
    projectTypes: ["web_application", "erp", "dashboard"],
    services: ["custom_business_applications"],
  },
  {
    id: "repetitive-queries",
    problem: "Team spends hours answering repetitive questions or processing documents",
    keywords: ["repetitive", "same questions", "faq", "support", "documents", "pdf", "resume", "invoice processing", "data entry", "chatbot", "ai"],
    solutions: ["AI Assistant", "Document Processing", "AI-powered Workflow", "AI Integration"],
    projectTypes: ["ai_genai", "automation"],
    services: ["ai_genai"],
  },
  {
    id: "tools-not-connected",
    problem: "Systems don't talk to each other / data copied between tools",
    keywords: ["integrate", "integration", "api", "sync", "copy paste", "copy-paste", "multiple tools", "zapier", "webhook", "tally", "backend"],
    solutions: ["API Development", "Third-party Integrations", "Backend System", "Automation"],
    projectTypes: ["api_backend", "automation"],
    services: ["backend_api"],
  },
  {
    id: "agency-overflow",
    problem: "Agency has client development work it can't deliver in-house",
    keywords: ["agency", "white label", "white-label", "clients need", "outsourc", "developer", "dev team", "overflow", "freelancer"],
    solutions: ["White-label Development Partnership", "Websites for Agency Clients", "Web Apps & Dashboards", "APIs & Integrations"],
    projectTypes: ["website", "web_application", "api_backend"],
    services: ["web_development", "custom_business_applications", "backend_api"],
  },
  {
    id: "customer-self-service",
    problem: "Customers keep calling for status updates / documents",
    keywords: ["status", "track", "portal", "customer login", "client login", "download", "self-service", "self service", "updates"],
    solutions: ["Customer Portal", "Admin Panel", "Notifications", "Reports"],
    projectTypes: ["web_application", "dashboard"],
    services: ["custom_business_applications"],
  },
  {
    id: "product-idea",
    problem: "Founder has a product idea / MVP that needs building",
    keywords: ["mvp", "startup", "saas", "subscription", "product idea", "platform", "app idea", "founder", "launch"],
    solutions: ["SaaS MVP", "Custom Web Application", "Backend & APIs", "Admin Panel"],
    projectTypes: ["saas", "web_application", "api_backend"],
    services: ["custom_business_applications", "backend_api"],
  },
];

export type ServiceRecommendation = {
  rule: ServiceMappingRule;
  matched: string[];
  score: number;
};

export function recommendServices(
  problemText: string | null | undefined,
  rules: ServiceMappingRule[] = SERVICE_MAPPING_RULES,
  limit = 3,
): ServiceRecommendation[] {
  const text = ` ${(problemText ?? "").toLowerCase().replace(/\s+/g, " ")} `;
  if (!text.trim()) return [];
  const results: ServiceRecommendation[] = [];
  for (const rule of rules) {
    const matched = rule.keywords.filter((k) => text.includes(k));
    if (matched.length) {
      // longer phrases are more specific → weigh them higher
      const score = matched.reduce((s, k) => s + (k.includes(" ") ? 2 : 1), 0);
      results.push({ rule, matched, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
