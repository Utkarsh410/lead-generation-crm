// Demo data. Every demo prospect has is_demo = true; all related rows (messages,
// tasks, activities, qualifications, opportunities, handoffs) cascade-delete with
// it, so "Remove demo data" in Settings cleanly removes everything.
// Dates are relative to "today" so the dashboard always has something to show.

import { computeDuplicateKeys } from "@/lib/domain/duplicates";
import { calculateOpportunityScore, type ScoreFactors } from "@/lib/domain/opportunity-score";
import { assessQualification } from "@/lib/domain/qualification";
import { addDays } from "@/lib/domain/dates";
import { generateHandoff } from "@/lib/domain/handoff";
import {
  FUNNEL_ORDER,
  OUTREACH_CHANNELS,
  OUTREACH_STAGES,
  PIPELINE_STAGES,
  RESPONSE_STATUSES,
  type OutreachChannel,
  type OutreachStage,
  type PipelineStage,
  type ResponseStatus,
  type TaskPriority,
  type TaskType,
} from "@/lib/domain/constants";
import { AppError, check, must } from "./errors";
import type { Db, Json, TablesInsert } from "./types";

type DemoMessage = {
  stage: OutreachStage;
  channel: OutreachChannel;
  daysAgo: number;
  body: string;
  response?: ResponseStatus;
  responseDaysAgo?: number;
  responseNotes?: string;
};

type DemoTask = {
  type: TaskType;
  title: string;
  dueInDays: number;
  priority: TaskPriority;
  automated?: boolean;
  step?: "follow_up_1" | "follow_up_2";
  time?: string;
};

type DemoProspect = {
  prospect: Omit<TablesInsert<"prospects">, "owner_id" | "score_factors"> & { score_factors: ScoreFactors };
  addedDaysAgo: number;
  furthest?: PipelineStage;
  messages?: DemoMessage[];
  tasks?: DemoTask[];
  qualification?: Omit<TablesInsert<"qualification_assessments">, "prospect_id" | "owner_id" | "score" | "suggested_classification" | "classification"> & { classification?: TablesInsert<"qualification_assessments">["classification"] };
  opportunity?: Partial<TablesInsert<"opportunities">>;
  handoff?: boolean;
};

const agencyFirst = (name: string, company: string, area: string) =>
  `Hi ${name},\n\nI came across ${company} and noticed that your team works with businesses on ${area}.\n\nI’m working with BharatCoder.com, a development team handling websites, custom web applications, AI solutions, APIs and business management systems.\n\nWe’re currently looking to partner with agencies that may occasionally need a reliable technical development partner or white-label development support.\n\nWould you be open to discussing a potential development partnership?\n\nBest,\nUtkarsh`;

const DEMO: DemoProspect[] = [
  // ---- Prospect (3) --------------------------------------------------------
  {
    addedDaysAgo: 1,
    prospect: {
      business_name: "Pixelcraft Digital",
      contact_name: "Rohan Kulkarni",
      job_title: "Founder",
      email: "rohan@pixelcraftdigital.in",
      website: "https://pixelcraftdigital.in",
      linkedin_url: "https://www.linkedin.com/company/pixelcraft-digital",
      location: "Pune",
      country: "India",
      industry: "Digital marketing",
      company_size: "11-50",
      lead_source: "linkedin",
      prospect_type: "marketing_agency",
      stage: "prospect",
      business_description: "Performance marketing agency for D2C and real-estate clients.",
      observed_problem: "Portfolio shows landing pages built on page builders; no custom development listed in services.",
      potential_need: "White-label partner for client websites and landing pages.",
      suggested_solution: "White-label development partnership",
      has_website: true,
      potential_project: "website",
      estimated_value: "80000",
      score_factors: { clear_problem: 2, dev_requirement: 2, business_active: 3, decision_maker: 3, contact_info: 2, tech_gap: 1, urgency: 1, project_value: 2 },
    },
    tasks: [{ type: "first_outreach", title: "First outreach — Pixelcraft Digital", dueInDays: 0, priority: "medium" }],
  },
  {
    addedDaysAgo: 2,
    prospect: {
      business_name: "Scrollstop Social",
      contact_name: "Aisha Khan",
      job_title: "Co-founder",
      instagram_url: "https://instagram.com/scrollstopsocial",
      location: "Hyderabad",
      country: "India",
      industry: "Social media marketing",
      company_size: "2-10",
      lead_source: "instagram",
      prospect_type: "social_media_agency",
      stage: "prospect",
      observed_problem: "Clients in their reels are restaurants and cafés with no ordering websites.",
      potential_need: "Websites/ordering pages for their F&B clients.",
      suggested_solution: "Landing pages with WhatsApp ordering for agency clients",
      has_website: false,
      score_factors: { clear_problem: 1, dev_requirement: 2, business_active: 3, decision_maker: 2, contact_info: 1, tech_gap: 2, urgency: 0, project_value: 1 },
    },
  },
  {
    addedDaysAgo: 0,
    prospect: {
      business_name: "BrightPath Coaching Centre",
      contact_name: "Sanjay Verma",
      job_title: "Director",
      phone: "+91 94150 22331",
      whatsapp: "+91 94150 22331",
      location: "Lucknow",
      country: "India",
      industry: "Education / coaching",
      company_size: "11-50",
      lead_source: "google_maps",
      source_url: "https://maps.google.com/?cid=demo-brightpath",
      prospect_type: "direct_business",
      stage: "prospect",
      business_description: "Coaching for classes 9–12 and NEET foundation, ~400 students.",
      observed_problem: "Google reviews mention notes and test schedules shared only in WhatsApp groups.",
      potential_need: "Student portal for material, tests and fee reminders.",
      suggested_solution: "LMS with student portal and admin dashboard",
      has_website: false,
      has_lms: false,
      has_whatsapp: true,
      potential_project: "lms",
      estimated_value: "250000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 1, project_value: 2 },
    },
    tasks: [{ type: "first_outreach", title: "First outreach — BrightPath Coaching Centre", dueInDays: 0, priority: "high" }],
  },

  // ---- Contacted (3) -------------------------------------------------------
  {
    addedDaysAgo: 6,
    prospect: {
      business_name: "GrowthLoop Marketing",
      contact_name: "Neha Iyer",
      job_title: "Managing Partner",
      email: "neha@growthloop.co.in",
      website: "https://growthloop.co.in",
      location: "Bengaluru",
      country: "India",
      industry: "Digital marketing",
      company_size: "11-50",
      lead_source: "linkedin",
      prospect_type: "marketing_agency",
      stage: "contacted",
      observed_problem: "Case studies mention 'dashboards for clients' but team page lists no developers.",
      suggested_solution: "White-label dashboards and web apps",
      has_website: true,
      potential_project: "dashboard",
      estimated_value: "150000",
      score_factors: { clear_problem: 2, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 2, urgency: 1, project_value: 2 },
    },
    messages: [{ stage: "first_contact", channel: "email", daysAgo: 3, body: agencyFirst("Neha", "GrowthLoop Marketing", "performance marketing and reporting dashboards") }],
    tasks: [{ type: "follow_up", title: "Follow-up #1 — GrowthLoop Marketing", dueInDays: 0, priority: "medium", automated: true, step: "follow_up_1" }],
  },
  {
    addedDaysAgo: 9,
    prospect: {
      business_name: "RankRise SEO",
      contact_name: "Vikram Shekhawat",
      job_title: "Founder",
      email: "vikram@rankrise.in",
      website: "https://rankrise.in",
      location: "Jaipur",
      country: "India",
      industry: "SEO",
      company_size: "2-10",
      lead_source: "cold_email",
      prospect_type: "seo_agency",
      stage: "contacted",
      observed_problem: "Audits they publish repeatedly flag slow WordPress sites they can't fix themselves.",
      suggested_solution: "Site rebuilds and speed fixes for their SEO clients",
      potential_project: "website",
      estimated_value: "60000",
      score_factors: { clear_problem: 3, dev_requirement: 2, business_active: 2, decision_maker: 3, contact_info: 3, tech_gap: 2, urgency: 1, project_value: 1 },
    },
    messages: [{ stage: "first_contact", channel: "email", daysAgo: 5, body: "Hi Vikram,\n\nI came across RankRise SEO and noticed your audits often flag slow WordPress sites.\n\nSEO clients often need site rebuilds or speed fixes before rankings can improve. I work with BharatCoder.com — we could handle that technical work white-label while your team keeps the client relationship.\n\nWould it be worth a short conversation?\n\nBest,\nUtkarsh" }],
    tasks: [{ type: "follow_up", title: "Follow-up #1 — RankRise SEO", dueInDays: -2, priority: "medium", automated: true, step: "follow_up_1" }],
  },
  {
    addedDaysAgo: 3,
    prospect: {
      business_name: "Mehta & Associates",
      contact_name: "CA Kunal Mehta",
      job_title: "Partner",
      email: "kunal@mehta-associates.in",
      phone: "+91 98200 44556",
      website: "https://mehta-associates.in",
      location: "Mumbai",
      country: "India",
      industry: "Chartered accountancy",
      company_size: "11-50",
      lead_source: "networking",
      prospect_type: "direct_business",
      stage: "contacted",
      observed_problem: "Clients email documents; staff chase them manually every GST cycle.",
      suggested_solution: "Client portal for document uploads with reminders",
      has_customer_portal: false,
      potential_project: "web_application",
      estimated_value: "300000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 3 },
    },
    messages: [{ stage: "first_contact", channel: "whatsapp", daysAgo: 1, body: "Hi Kunal, this is Utkarsh from BharatCoder.com — we met at the BNI meet on Tuesday. You mentioned your team chases client documents every GST cycle. We build client portals that handle uploads and reminders automatically. Would you be open to a quick 10-minute call this week?" }],
    tasks: [{ type: "follow_up", title: "Follow-up #1 — Mehta & Associates", dueInDays: 2, priority: "medium", automated: true, step: "follow_up_1" }],
  },

  // ---- Replied (2) ---------------------------------------------------------
  {
    addedDaysAgo: 10,
    prospect: {
      business_name: "Brandwave Media",
      contact_name: "Karan Malhotra",
      job_title: "CEO",
      email: "karan@brandwavemedia.in",
      website: "https://brandwavemedia.in",
      location: "Mumbai",
      country: "India",
      industry: "Branding & advertising",
      company_size: "51-200",
      lead_source: "agency_prospecting",
      prospect_type: "marketing_agency",
      stage: "replied",
      observed_problem: "Outsourcing dev to freelancers; two client launches delayed last quarter (per their blog).",
      suggested_solution: "Reliable white-label development partner",
      potential_project: "web_application",
      estimated_value: "400000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 2, urgency: 2, project_value: 3 },
    },
    messages: [
      { stage: "first_contact", channel: "email", daysAgo: 7, body: agencyFirst("Karan", "Brandwave Media", "branding, campaigns and launch websites") },
      { stage: "follow_up_1", channel: "email", daysAgo: 4, body: "Hi Karan,\n\nJust following up on my previous message regarding development support for Brandwave Media.\n\nIf your team ever has clients who need websites, web applications, dashboards, APIs or custom software, we'd be happy to explore supporting the technical side.\n\nBest,\nUtkarsh", response: "interested", responseDaysAgo: 1, responseNotes: "Has 2 client projects starting next month — wants to see portfolio and discuss rates." },
    ],
    tasks: [{ type: "qualification", title: "Reply to Brandwave Media and qualify", dueInDays: -1, priority: "urgent", automated: true }],
  },
  {
    addedDaysAgo: 8,
    prospect: {
      business_name: "CarePlus Physiotherapy Clinic",
      contact_name: "Dr. Meera Joshi",
      job_title: "Owner",
      phone: "+91 98220 11223",
      whatsapp: "+91 98220 11223",
      website: "https://careplusphysio.in",
      instagram_url: "https://instagram.com/careplusphysio",
      location: "Pune",
      country: "India",
      industry: "Healthcare",
      company_size: "2-10",
      lead_source: "instagram",
      prospect_type: "direct_business",
      stage: "replied",
      website_quality: "poor",
      observed_problem: "Website has no online appointment booking; Instagram comments ask for timings.",
      potential_need: "Online booking and enquiry management.",
      suggested_solution: "New website with appointment booking and WhatsApp reminders",
      has_website: true,
      website_needs_improvement: true,
      has_online_booking: false,
      has_whatsapp: true,
      potential_project: "website",
      estimated_value: "120000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 2 },
    },
    messages: [
      { stage: "first_contact", channel: "instagram", daysAgo: 4, body: "Hi Dr. Meera! Loved your posture-correction reels. I noticed patients keep asking for timings in the comments — CarePlus doesn't have online booking yet. I work with BharatCoder.com and we build clinic websites with booking + WhatsApp reminders. Open to a quick chat?", response: "replied", responseDaysAgo: 2, responseNotes: "Asked for examples and rough cost." },
    ],
    tasks: [{ type: "qualification", title: "Reply to CarePlus Physiotherapy Clinic and qualify", dueInDays: 0, priority: "high", automated: true }],
  },

  // ---- Qualified (2) -------------------------------------------------------
  {
    addedDaysAgo: 14,
    prospect: {
      business_name: "SearchSprout",
      contact_name: "Pooja Nair",
      job_title: "Founder",
      email: "pooja@searchsprout.in",
      website: "https://searchsprout.in",
      location: "Indore",
      country: "India",
      industry: "SEO",
      company_size: "2-10",
      lead_source: "linkedin",
      prospect_type: "seo_agency",
      stage: "qualified",
      observed_problem: "Needs programmatic SEO landing pages for a real-estate client (posted on LinkedIn).",
      suggested_solution: "Programmatic landing page system with CMS",
      potential_project: "web_application",
      estimated_value: "180000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 3, project_value: 2 },
    },
    messages: [
      { stage: "first_contact", channel: "linkedin", daysAgo: 10, body: "Hi Pooja, saw your post about programmatic SEO pages for real-estate. I work with BharatCoder.com — we act as a white-label dev partner for agencies. Would be glad to connect.", response: "interested", responseDaysAgo: 8, responseNotes: "Client needs 500+ location pages in 6 weeks." },
    ],
    qualification: {
      business_model: "SEO agency (retainers)",
      current_technology: "WordPress",
      problem_description: "Client needs 500+ location landing pages generated from data, WordPress can't handle it.",
      whats_not_working: "Manual page creation too slow.",
      cost_of_inaction: "Risk losing the client retainer.",
      project_type: "web_application",
      required_features: "Page templates, CSV import, CMS, sitemap",
      estimated_complexity: "medium",
      timeline_notes: "6 weeks",
      budget_min: "150000",
      budget_max: "200000",
      decision_maker_identified: true,
      decision_maker_name: "Pooja Nair (Founder)",
      need_clarity: 5,
      budget_fit: 4,
      timeline_fit: 3,
      decision_maker_access: 5,
      urgency: 4,
      notes: "Agency will manage the client; BharatCoder builds white-label.",
    },
    tasks: [{ type: "handoff", title: "Prepare BharatCoder handoff — SearchSprout", dueInDays: 0, priority: "high", automated: true }],
  },
  {
    addedDaysAgo: 16,
    prospect: {
      business_name: "Apex JEE Academy",
      contact_name: "Ramesh Gupta",
      job_title: "Director",
      email: "director@apexjee.in",
      phone: "+91 94140 55667",
      website: "https://apexjee.in",
      location: "Kota",
      country: "India",
      industry: "Education / coaching",
      company_size: "51-200",
      lead_source: "cold_email",
      prospect_type: "direct_business",
      stage: "qualified",
      observed_problem: "Students currently receive course material and test results through WhatsApp.",
      suggested_solution: "LMS with student portal, online tests and admin dashboard",
      has_lms: false,
      potential_project: "lms",
      estimated_value: "450000",
      recommended_services: ["LMS", "Student Portal", "Admin Dashboard", "Payment Integration"],
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 3 },
    },
    messages: [
      { stage: "first_contact", channel: "email", daysAgo: 12, body: "Hi Ramesh,\n\nI came across Apex JEE Academy and noticed your toppers' results page — impressive.\n\nI work with BharatCoder.com — we build learning platforms and student portals so course material, tests and fee tracking live in one place instead of WhatsApp groups.\n\nWould you be open to a short call?\n\nBest,\nUtkarsh", response: "interested", responseDaysAgo: 9 },
    ],
    qualification: {
      business_model: "Offline coaching, 1,200 students, 3 centres",
      current_technology: "WhatsApp groups + Google Drive",
      problem_description: "Students currently receive course material through WhatsApp; tests are on paper.",
      whats_not_working: "Material gets lost, no tracking of test performance.",
      cost_of_inaction: "Losing students to institutes with apps.",
      project_type: "lms",
      required_features: "Student login, course material, online tests, results, fee reminders",
      integrations: "Razorpay",
      number_of_users: "1,200 students, 40 staff",
      estimated_complexity: "high",
      desired_launch_date: null,
      timeline_notes: "Before the new batch in April",
      budget_min: "300000",
      budget_max: "500000",
      decision_maker_identified: true,
      decision_maker_name: "Ramesh Gupta (Director)",
      decision_process: "Director decides with centre heads' input",
      need_clarity: 4,
      budget_fit: 4,
      timeline_fit: 4,
      decision_maker_access: 5,
      urgency: 3,
    },
    handoff: true,
  },

  // ---- Discovery Call (2) --------------------------------------------------
  {
    addedDaysAgo: 18,
    prospect: {
      business_name: "Northstar Creative Co.",
      contact_name: "Ishaan Bose",
      job_title: "Director",
      email: "ishaan@northstarcreative.in",
      website: "https://northstarcreative.in",
      location: "New Delhi",
      country: "India",
      industry: "Marketing & creative",
      company_size: "11-50",
      lead_source: "referral",
      source_notes: "Referred by Brandwave's Karan",
      prospect_type: "marketing_agency",
      stage: "discovery_call",
      observed_problem: "Wants to offer 'AI chat assistants' to clients but has no dev team.",
      suggested_solution: "White-label AI assistants for their clients",
      potential_project: "ai_genai",
      estimated_value: "350000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 3 },
    },
    messages: [
      { stage: "first_contact", channel: "email", daysAgo: 12, body: agencyFirst("Ishaan", "Northstar Creative Co.", "brand campaigns and digital products"), response: "interested", responseDaysAgo: 10 },
      { stage: "discovery_call_invitation", channel: "email", daysAgo: 9, body: "Hi Ishaan,\n\nWould you be available for a 20–30 minute discovery call to understand your requirements for AI/GenAI assistants?\n\nBest,\nUtkarsh" },
    ],
    qualification: {
      business_model: "Creative agency, retainers",
      problem_description: "Clients asking for AI assistants; agency can't build them.",
      project_type: "ai_genai",
      required_features: "Website chat assistant trained on client FAQs, lead capture",
      estimated_complexity: "medium",
      timeline_notes: "First client pilot in November",
      budget_min: "200000",
      budget_max: "400000",
      decision_maker_identified: true,
      decision_maker_name: "Ishaan Bose",
      need_clarity: 4,
      budget_fit: 3,
      timeline_fit: 4,
      decision_maker_access: 5,
      urgency: 4,
    },
    tasks: [{ type: "discovery_call", title: "Discovery call — Northstar Creative Co.", dueInDays: 1, priority: "high", time: "11:30" }],
  },
  {
    addedDaysAgo: 20,
    prospect: {
      business_name: "FleetMint",
      contact_name: "Arjun Rao",
      job_title: "Co-founder & CEO",
      email: "arjun@fleetmint.io",
      website: "https://fleetmint.io",
      linkedin_url: "https://www.linkedin.com/in/demo-arjun-rao",
      location: "Bengaluru",
      country: "India",
      industry: "Logistics tech",
      company_size: "2-10",
      lead_source: "linkedin",
      prospect_type: "startup",
      stage: "discovery_call",
      observed_problem: "Pre-seed startup running fleet ops on spreadsheets; hiring a CTO for months.",
      suggested_solution: "SaaS MVP for fleet tracking with admin dashboard",
      potential_project: "saas",
      estimated_value: "600000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 2, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 3, project_value: 3 },
    },
    messages: [
      { stage: "first_contact", channel: "linkedin", daysAgo: 15, body: "Hi Arjun, saw FleetMint is hiring a founding engineer. While you search, BharatCoder.com could help ship the MVP. Happy to share how we'd approach it.", response: "interested", responseDaysAgo: 13 },
    ],
    qualification: {
      business_model: "B2B SaaS for fleet operators",
      current_technology: "Google Sheets",
      problem_description: "Needs an MVP to onboard 3 pilot customers.",
      project_type: "saas",
      required_features: "Vehicle tracking, driver app (web), trip logs, admin dashboard",
      integrations: "GPS provider API",
      estimated_complexity: "high",
      timeline_notes: "MVP in 10–12 weeks",
      budget_min: "500000",
      budget_max: "800000",
      decision_maker_identified: true,
      decision_maker_name: "Arjun Rao",
      need_clarity: 4,
      budget_fit: 3,
      timeline_fit: 3,
      decision_maker_access: 5,
      urgency: 5,
    },
    tasks: [{ type: "discovery_call", title: "Discovery call — FleetMint", dueInDays: 3, priority: "high", time: "16:00" }],
  },

  // ---- Proposal (1) ---------------------------------------------------------
  {
    addedDaysAgo: 30,
    prospect: {
      business_name: "Smile Studio Dental",
      contact_name: "Dr. Priya Deshpande",
      job_title: "Founder",
      email: "hello@smilestudiodental.in",
      phone: "+91 97650 88990",
      website: "https://smilestudiodental.in",
      location: "Nagpur",
      country: "India",
      industry: "Healthcare",
      company_size: "11-50",
      lead_source: "google_maps",
      prospect_type: "direct_business",
      stage: "proposal_sent",
      observed_problem: "Three branches, appointments managed on paper registers.",
      suggested_solution: "Appointment management system with patient reminders",
      potential_project: "web_application",
      estimated_value: "220000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 3, tech_gap: 3, urgency: 2, project_value: 2 },
    },
    messages: [
      { stage: "first_contact", channel: "email", daysAgo: 25, body: "Hi Dr. Priya,\n\nI came across Smile Studio Dental and noticed your three branches in Nagpur.\n\nMany clinics lose appointments when patients can't book online. I work with BharatCoder.com — we build appointment booking and enquiry management systems.\n\nWould you be open to a quick conversation?\n\nBest,\nUtkarsh", response: "interested", responseDaysAgo: 22 },
    ],
    qualification: {
      business_model: "Dental clinics, 3 branches",
      current_technology: "Paper registers",
      problem_description: "Appointments on paper; frequent double-booking across branches.",
      project_type: "web_application",
      required_features: "Online booking, branch calendars, SMS/WhatsApp reminders, patient records",
      estimated_complexity: "medium",
      timeline_notes: "8 weeks",
      budget_min: "180000",
      budget_max: "250000",
      decision_maker_identified: true,
      decision_maker_name: "Dr. Priya Deshpande",
      need_clarity: 5,
      budget_fit: 4,
      timeline_fit: 4,
      decision_maker_access: 5,
      urgency: 3,
    },
    tasks: [{ type: "proposal_follow_up", title: "Follow up on proposal — Smile Studio Dental", dueInDays: -1, priority: "high", automated: true }],
  },

  // ---- Won (1) --------------------------------------------------------------
  {
    addedDaysAgo: 45,
    prospect: {
      business_name: "Kora Handloom",
      contact_name: "Anjali Rathore",
      job_title: "Owner",
      email: "anjali@korahandloom.in",
      instagram_url: "https://instagram.com/korahandloom",
      location: "Jaipur",
      country: "India",
      industry: "Fashion / handloom",
      company_size: "2-10",
      lead_source: "instagram",
      prospect_type: "direct_business",
      stage: "won",
      observed_problem: "Orders taken through Instagram DMs; payments via UPI screenshots.",
      suggested_solution: "E-commerce store with payment gateway and order dashboard",
      has_ecommerce: false,
      potential_project: "ecommerce",
      estimated_value: "140000",
      score_factors: { clear_problem: 3, dev_requirement: 3, business_active: 3, decision_maker: 3, contact_info: 2, tech_gap: 3, urgency: 2, project_value: 2 },
    },
    messages: [
      { stage: "first_contact", channel: "instagram", daysAgo: 40, body: "Hi Anjali! Your block-print sarees are beautiful. I noticed orders happen over DMs — BharatCoder.com builds online stores with payments and order tracking. Open to a quick chat?", response: "interested", responseDaysAgo: 38 },
    ],
    qualification: {
      business_model: "D2C handloom brand",
      current_technology: "Instagram + UPI",
      problem_description: "Orders over DM, manual payment confirmation.",
      project_type: "ecommerce",
      required_features: "Catalogue, cart, Razorpay, order dashboard, shipping integration",
      estimated_complexity: "medium",
      budget_min: "120000",
      budget_max: "150000",
      decision_maker_identified: true,
      decision_maker_name: "Anjali Rathore",
      need_clarity: 5,
      budget_fit: 4,
      timeline_fit: 4,
      decision_maker_access: 5,
      urgency: 4,
    },
    opportunity: {
      status: "won",
      eligible_project_amount: "140000",
      agreed_commission_pct: "12",
      eligible_amount_received: "70000",
      commission_paid: "0",
      pass_through_notes: "Hosting and Shopify-app fees billed separately (excluded).",
      notes: "50% advance received by BharatCoder.",
    },
  },

  // ---- Lost (1) -------------------------------------------------------------
  {
    addedDaysAgo: 21,
    furthest: "contacted",
    prospect: {
      business_name: "ViralNest Studio",
      contact_name: "Tanvi Shah",
      job_title: "Founder",
      email: "tanvi@viralnest.in",
      instagram_url: "https://instagram.com/viralnest.studio",
      location: "Ahmedabad",
      country: "India",
      industry: "Social media marketing",
      company_size: "2-10",
      lead_source: "instagram",
      prospect_type: "social_media_agency",
      stage: "lost",
      lost_reason: "Has an in-house developer; not looking for partners.",
      observed_problem: "Clients' link-in-bio pages are generic Linktree pages.",
      suggested_solution: "Custom landing pages for agency clients",
      potential_project: "website",
      score_factors: { clear_problem: 1, dev_requirement: 1, business_active: 3, decision_maker: 3, contact_info: 2, tech_gap: 1, urgency: 0, project_value: 1 },
    },
    messages: [
      { stage: "first_contact", channel: "instagram", daysAgo: 18, body: "Hi Tanvi! Love the reels you make for local brands. If your clients ever need proper landing pages instead of link-in-bio pages, BharatCoder.com can build them white-label. Happy to chat!", response: "not_interested", responseDaysAgo: 15, responseNotes: "They have an in-house developer." },
    ],
  },
];

const ts = (today: string, daysAgo: number, time = "05:00:00") => `${addDays(today, -daysAgo)}T${time}Z`;

export async function hasDemoData(db: Db): Promise<boolean> {
  const { count } = await db.from("prospects").select("id", { count: "exact", head: true }).eq("is_demo", true);
  return (count ?? 0) > 0;
}

export async function loadDemoData(db: Db, today: string) {
  if (await hasDemoData(db)) throw new AppError("Demo data is already loaded. Remove it first to reload.");

  for (const item of DEMO) {
    const p = item.prospect;
    const score = calculateOpportunityScore(p.score_factors);
    const finalStage = p.stage as PipelineStage;
    const furthest = item.furthest ?? (finalStage === "lost" ? "prospect" : finalStage);
    const created = must(
      await db
        .from("prospects")
        .insert({
          ...p,
          ...computeDuplicateKeys(p),
          score_factors: p.score_factors as Json,
          opportunity_score: score.score,
          lead_temperature: score.temperature,
          furthest_stage: furthest === "lost" ? "prospect" : (furthest as Exclude<PipelineStage, "lost">),
          is_demo: true,
          created_at: ts(today, item.addedDaysAgo, "04:30:00"),
          stage_changed_at: ts(today, Math.max(0, item.addedDaysAgo - 1)),
        })
        .select("id")
        .single(),
    );
    const id = created.id;
    const activities: TablesInsert<"activities">[] = [
      { prospect_id: id, activity_type: "prospect_created", title: "Prospect added", occurred_at: ts(today, item.addedDaysAgo, "04:30:00") },
    ];

    for (const m of item.messages ?? []) {
      const msg = must(
        await db
          .from("outreach_messages")
          .insert({
            prospect_id: id,
            channel: m.channel,
            outreach_stage: m.stage,
            subject: m.channel === "email" ? "Potential Development Partnership" : null,
            customized_message: m.body,
            sent_at: ts(today, m.daysAgo),
            response_status: m.response ?? (m.daysAgo > 6 ? "no_response" : "sent"),
            response_date: m.response ? ts(today, m.responseDaysAgo ?? m.daysAgo, "09:00:00") : null,
            response_notes: m.responseNotes ?? null,
          })
          .select("id")
          .single(),
      );
      activities.push({
        prospect_id: id,
        activity_type: "outreach_sent",
        title: `${OUTREACH_CHANNELS.label(m.channel)} — ${OUTREACH_STAGES.label(m.stage)} sent`,
        details: m.body.slice(0, 200),
        metadata: { message_id: msg.id },
        occurred_at: ts(today, m.daysAgo),
      });
      if (m.response) {
        activities.push({
          prospect_id: id,
          activity_type: "response_recorded",
          title: `Response: ${RESPONSE_STATUSES.label(m.response)}`,
          details: m.responseNotes ?? null,
          occurred_at: ts(today, m.responseDaysAgo ?? m.daysAgo, "09:00:00"),
        });
      }
    }

    // stage history up to the current stage
    const path = FUNNEL_ORDER.slice(0, FUNNEL_ORDER.indexOf(furthest as PipelineStage) + 1);
    if (finalStage === "lost") path.push("lost");
    for (let i = 1; i < path.length; i++) {
      const daysAgo = Math.max(0, Math.round(item.addedDaysAgo * (1 - i / path.length)));
      activities.push({
        prospect_id: id,
        activity_type: "stage_change",
        title: `Stage changed: ${path[i - 1]} → ${path[i]}`,
        metadata: { from: path[i - 1], to: path[i] },
        occurred_at: ts(today, daysAgo, "06:00:00"),
      });
    }

    let qualificationId: string | null = null;
    const qualifiedDaysAgo = Math.max(0, Math.round(item.addedDaysAgo / 3));
    if (item.qualification) {
      const { classification: override, ...q } = item.qualification;
      const r = assessQualification({
        need_clarity: q.need_clarity,
        budget_fit: q.budget_fit,
        timeline_fit: q.timeline_fit,
        decision_maker_access: q.decision_maker_access,
        urgency: q.urgency,
      });
      const row = must(
        await db
          .from("qualification_assessments")
          .insert({
            ...q,
            prospect_id: id,
            score: r.score,
            suggested_classification: r.suggested,
            classification: override ?? r.suggested,
            created_at: ts(today, qualifiedDaysAgo, "07:00:00"),
          })
          .select("id, score, classification")
          .single(),
      );
      qualificationId = row.id;
      activities.push({
        prospect_id: id,
        activity_type: "qualification",
        title: `Qualification: ${row.classification} (${row.score}/100)`,
        occurred_at: ts(today, qualifiedDaysAgo, "07:00:00"),
      });
    }

    if (FUNNEL_ORDER.indexOf(furthest as PipelineStage) >= FUNNEL_ORDER.indexOf("qualified")) {
      check(
        await db.from("opportunities").insert({
          prospect_id: id,
          title: `${p.business_name} — ${p.suggested_solution ?? "Project"}`.slice(0, 200),
          project_type: p.potential_project ?? null,
          estimated_value: p.estimated_value ?? null,
          status: finalStage === "won" ? "won" : "open",
          closed_at: finalStage === "won" ? ts(today, 5) : null,
          created_at: ts(today, qualifiedDaysAgo, "07:00:00"),
          ...item.opportunity,
        }),
      );
    }

    if (item.handoff) {
      const prospectRow = must(await db.from("prospects").select("*").eq("id", id).single());
      const qual = qualificationId
        ? must(await db.from("qualification_assessments").select("*").eq("id", qualificationId).single())
        : null;
      const h = generateHandoff({ prospect: prospectRow, qualification: qual, generatedBy: "Utkarsh", generatedOn: addDays(today, -1) });
      check(
        await db.from("handoffs").insert({
          prospect_id: id,
          qualification_id: qualificationId,
          summary_markdown: h.markdown,
          snapshot: { ...h.snapshot, _gaps: h.gaps } as unknown as Json,
          status: "sent",
          sent_at: ts(today, 1),
          created_at: ts(today, 1),
        }),
      );
      activities.push({ prospect_id: id, activity_type: "handoff", title: "Handoff prepared and sent to BharatCoder", occurred_at: ts(today, 1) });
    }

    for (const t of item.tasks ?? []) {
      check(
        await db.from("tasks").insert({
          prospect_id: id,
          task_type: t.type,
          title: t.title,
          due_date: addDays(today, t.dueInDays),
          due_time: t.time ?? null,
          priority: t.priority,
          is_automated: t.automated ?? false,
          sequence_step: t.step ?? null,
        }),
      );
    }

    if (activities.length) check(await db.from("activities").insert(activities, { defaultToNull: false }));
    // keep the stage stamp in sync with the seeded history
    const lastStage = activities.filter((a) => a.activity_type === "stage_change").at(-1);
    if (lastStage?.occurred_at) check(await db.from("prospects").update({ stage_changed_at: lastStage.occurred_at }).eq("id", id));
  }
  return { prospects: DEMO.length, stages: PIPELINE_STAGES.values.length };
}

export async function removeDemoData(db: Db): Promise<number> {
  const rows = must(await db.from("prospects").delete().eq("is_demo", true).select("id"));
  return rows.length;
}

/** Exposed for tests: the demo mix must match the Week 1 brief. */
export const DEMO_PROSPECTS = DEMO.map((d) => ({ type: d.prospect.prospect_type, industry: d.prospect.industry, stage: d.prospect.stage }));
