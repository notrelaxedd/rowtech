const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** For ids that arrive from a request: server action arguments are unchecked at runtime. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
