/**
 * Fetch every page of a Supabase query. Supabase returns at most ~1000 rows per request,
 * so a single .limit(500) silently drops older rows for a parent who logs often.
 * `build` must return a fresh query each call, e.g. () => db.from('care_logs').select(...).eq(...).order(...)
 */
export async function fetchAllPages(build, { pageSize = 1000, maxRows = 6000 } = {}) {
  const rows = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { data: rows, error: null, truncated: rows.length >= maxRows };
}
