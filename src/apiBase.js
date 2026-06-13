/**
 * Use VITE_API_BASE_URL (e.g. http://localhost:5524) when the UI is not served by Vite dev/preview proxy.
 * Dev server proxies /api automatically; preview needs proxy in vite.config or this env.
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (base) return `${base}${p}`;
  return p;
}

/** Path or absolute URL to /api/outputs file. */
export function outputsAssetUrl(relativePath) {
  if (!relativePath) return '';

  let pathOnly = relativePath;
  // Strip domain if absolute URL was passed (common with old scan data)
  if (relativePath.includes('://')) {
    try {
      const u = new URL(relativePath);
      pathOnly = u.pathname;
    } catch {
      pathOnly = relativePath;
    }
  }

  // Ensure it starts with /api/outputs
  let slug = pathOnly.replace(/^\//, '');

  if (slug.startsWith('api/outputs/')) {
    return apiUrl(`/${slug}`);
  }

  if (slug.startsWith('outputs/')) {
    return apiUrl(`/api/${slug}`);
  }

  // Fallback for simple filenames or unexpected formats
  return apiUrl(`/api/outputs/${slug.replace(/^api\/outputs\//, '')}`);
}

/** Full URL for opening/downloading (browser + CSV). */
export function outputsPublicHref(relativePath) {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  const u = outputsAssetUrl(relativePath);
  if (u.startsWith('http')) return u;
  if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
  return u;
}
