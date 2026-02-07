/**
 * Formats a raw ID string (e.g., 'biology-of-the-cell') into a human-readable name.
 */
export const formatDisplayName = (rawName: string | undefined): string => {
  if (!rawName) return "";
  return rawName
    .replace(/[-_]/g, " ")
    .replace(/\.json$/i, "")
    .replace(/^\d+\s*/, "")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Formats a raw filename into a URL-friendly ID.
 * Example: 'mitosis_and_meiosis' -> 'mitosis-and-meiosis'
 */
export const formatId = (rawName: string | undefined): string => {
  if (!rawName) return "";
  const baseName = rawName.replace(/\.json$/i, "");
  return baseName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9-_]+/g, "")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");
};

/**
 * Extracts a numeric sort order from a filename.
 * Returns Infinity if no number is found.
 */
export const getSortOrder = (fileName: string): number => {
  const matchTest = fileName.match(/^(?:Test_)?(\d+)/i);
  if (matchTest) return parseInt(matchTest[1], 10);

  const generalNumberMatch = fileName.match(/^(\d+)/);
  if (generalNumberMatch) return parseInt(generalNumberMatch[1], 10);

  return Infinity;
};