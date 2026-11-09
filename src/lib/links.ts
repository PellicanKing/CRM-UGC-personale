// Helpers to build public links (no scraping, links only).

/**
 * Facebook Ad Library link. If the page URL contains a numeric page id we
 * filter on it directly, otherwise we fall back to a keyword search on the name.
 */
export function adLibraryUrl(name: string, facebookPage?: string | null): string {
  const base = "https://www.facebook.com/ads/library/";
  const params = new URLSearchParams({
    active_status: "all",
    ad_type: "all",
    country: "IT",
    media_type: "all",
  });
  const pageId = facebookPage?.match(/(?:id=|\/)(\d{6,})/)?.[1];
  if (pageId) {
    params.set("view_all_page_id", pageId);
    params.set("search_type", "page");
  } else {
    const handle = facebookPage
      ?.replace(/\/+$/, "")
      .split("/")
      .pop();
    params.set("q", handle && !handle.includes("facebook.com") ? handle : name);
    params.set("search_type", "keyword_unordered");
  }
  return `${base}?${params.toString()}`;
}

export function stepLabel(step: number): string {
  return step === 0 ? "Primo messaggio" : `Follow-up ${step}`;
}
