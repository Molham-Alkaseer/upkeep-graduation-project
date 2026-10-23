/** City + neighborhood (district) for compact request cards and summaries. */
export function requestCityDistrictLine(item: {
  city?: string | null;
  district?: string | null;
}): string | null {
  const parts = [item.city?.trim(), item.district?.trim()].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(' — ');
}
