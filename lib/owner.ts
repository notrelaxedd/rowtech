// What only RowTech's owners can say: who runs it, legally, and where to write.
// Pages import these, so each is set here, once. One still unfilled shows as a
// visible OWNER placeholder. Never use a placeholder in metadata, titles,
// structured data or alt text: crawlers and share previews read those.

/** The legal name of whoever runs RowTech. */
export const legalEntity = "Caden Polk";

/** Where that entity is registered, or based. */
export const legalCountry = "Ohio, United States";

/**
 * The one address the site gives for writing to RowTech: the footer on every
 * page, beta applicants, dashboard access, failed units, accessibility,
 * privacy and the terms.
 */
export const contactEmail =
  "[OWNER: the one contact email for the whole site: general questions, the beta, dashboard access, failed units, accessibility and privacy]";

/** When /privacy and /terms last changed. Update it with every change to either. */
export const policiesUpdated = "September 25, 2026";

/** Whether the contact above has been filled in with something mailable. */
export const contactIsEmail = /^[^@\s[\]]+@[^@\s[\]]+\.[^@\s[\]]+$/.test(contactEmail);
