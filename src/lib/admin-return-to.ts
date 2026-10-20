/** Only return to known admin pages; never navigate to an external URL after login. */
export function adminReturnTo(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return "/admin";
  const url = new URL(value, "https://admin.local");
  if (
    url.origin !== "https://admin.local" ||
    !["/admin", "/admin/details", "/admin/preview"].includes(url.pathname)
  )
    return "/admin";
  const view = url.searchParams.get("view");
  return (
    url.pathname +
    (url.pathname === "/admin/preview" &&
    [
      "cosmos",
      "ecosystem",
      "strata",
      "sequences",
      "years",
      "slideshow",
    ].includes(view || "")
      ? `?view=${view}`
      : "")
  );
}
