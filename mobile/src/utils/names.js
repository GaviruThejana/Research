const TITLES = /^(dr|prof|mr|mrs|ms|miss)\.?$/i;

/**
 * Short name for greetings: the first name, or "title + surname" when the
 * name starts with a title ("Dr. Nimal Perera" -> "Dr. Perera").
 * Keep in sync with web/src/utils/names.js.
 */
export function greetingName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "there";
  if (TITLES.test(parts[0])) {
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
  }
  return parts[0];
}
