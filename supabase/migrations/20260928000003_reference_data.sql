-- Reference data.
--
-- This migration originally seeded a vendor-specific service sheet, project types,
-- commission tiers and outreach templates. LeadOS is now vendor-neutral: services,
-- lead sources, industries, pipelines and commission terms are configured per user,
-- and generic outreach templates are created by 20260929000004_generic_crm.sql.
--
-- Existing databases that already ran the original version are cleaned up by
-- migration 0004. Intentionally empty for new installs.
select 1;
