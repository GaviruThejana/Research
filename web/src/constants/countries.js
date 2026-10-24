/**
 * Countries offered at registration. Patients and doctors pick from the same
 * list, so the stored values match exactly for the by-country doctor lookup.
 * Add countries here as the service expands.
 */
export const COUNTRIES = [
  "Sri Lanka",
  "India",
  "Maldives",
  "USA",
  "United Kingdom",
  "Australia",
  "Canada",
  "Singapore",
  "Malaysia",
  "United Arab Emirates",
  "Japan",
  "Germany",
];

export const DEFAULT_COUNTRY = "Sri Lanka";

// ISO 3166 codes for the flag emoji (web only; the country name is always
// shown as text too, since some Windows browsers render flags as letters).
const ISO_CODES = {
  "Sri Lanka": "LK",
  India: "IN",
  Maldives: "MV",
  USA: "US",
  "United Kingdom": "GB",
  Australia: "AU",
  Canada: "CA",
  Singapore: "SG",
  Malaysia: "MY",
  "United Arab Emirates": "AE",
  Japan: "JP",
  Germany: "DE",
};

/** Flag emoji for a country name, or "" when unknown. */
export function countryFlag(country) {
  const code = ISO_CODES[country];
  if (!code) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
