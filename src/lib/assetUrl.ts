// Paths in the data (e.g. impact icons, "icons/impact/x.png") are relative to
// the map's own site. Resolve them against the app's base so they still load
// when the map is mounted inside another site's page (src/embed.tsx), where
// the base is the map's absolute address.
export function assetUrl(path: string): string {
  if (/^(https?:|data:|blob:|\/\/)/.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`;
}
