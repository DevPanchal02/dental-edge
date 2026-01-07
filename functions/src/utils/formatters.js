// FILE: functions/src/utils/formatters.js

/**
 * Formats a raw ID string (e.g., 'biology-of-the-cell') into a human-readable name.
 * @param {string} rawName The input string.
 * @returns {string} The formatted display name (e.g., 'Biology Of The Cell').
 */
const formatDisplayName = (rawName) => {
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
 * @param {string} rawName The input string.
 * @returns {string} The sanitized ID (e.g., 'mitosis_and_meiosis' -> 'mitosis-and-meiosis').
 */
const formatId = (rawName) => {
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
 * @param {string} fileName The name of the file.
 * @returns {number} The extracted number, or Infinity if no number is found.
 */
const getSortOrder = (fileName) => {
  const matchTest = fileName.match(/^(?:Test_)?(\d+)/i);
  if (matchTest) return parseInt(matchTest[1], 10);

  const generalNumberMatch = fileName.match(/^(\d+)/);
  if (generalNumberMatch) return parseInt(generalNumberMatch[1], 10);

  return Infinity;
};

module.exports = {
  formatDisplayName,
  formatId,
  getSortOrder,
};