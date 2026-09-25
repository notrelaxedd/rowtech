// What only RowTech's owners can say: who runs it, legally, and where to write.
// Until they fill these in, each is a visible OWNER placeholder; pages
// import them, so each is filled in here, once. Never use these in metadata,
// titles, structured data or alt text: crawlers and share previews read those.

/** The legal name of whoever runs RowTech. */
export const legalEntity = "[OWNER: legal name of the company or person that runs RowTech]";

/** Where that entity is registered, or based. */
export const legalCountry = "[OWNER: country (and state) where it is registered]";

/** Where people write about their data, the beta or these terms. */
export const contactEmail = "[OWNER: contact email address for privacy requests and questions]";

/** Whether the contact above has been filled in with something mailable. */
export const contactIsEmail = /^[^@\s[\]]+@[^@\s[\]]+\.[^@\s[\]]+$/.test(contactEmail);
