// Shared release-date gate for IDIA Pay-dependent features
export const IDIA_PAY_RELEASE_DATE = new Date("2026-08-31T00:00:00Z");

export const isPayReady = (): boolean => new Date() >= IDIA_PAY_RELEASE_DATE;
