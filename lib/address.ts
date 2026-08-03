/**
 * Extract "City, State" from a full address string.
 * Handles common formats: "Street, City, State, Zip, Country"
 */
export const getCityState = (address?: string): string | null => {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const zipRegex = /\b\d{5}(-\d{4})?\b/;

  if (parts.length >= 4) {
    const city = parts[1];
    const state = parts[2].replace(zipRegex, "").trim();
    return `${city}${state ? `, ${state}` : ""}`;
  }
  if (parts.length === 3) {
    const city = parts[0];
    const state = parts[1].replace(zipRegex, "").trim();
    return `${city}${state ? `, ${state}` : ""}`;
  }
  if (parts.length === 2) {
    const city = parts[0];
    const state = parts[1].replace(zipRegex, "").trim();
    return `${city}${state ? `, ${state}` : ""}`;
  }
  return parts[0] || null;
};
