export const cvSections = [
  "education",
  "solo",
  "group",
  "popup",
  "projects",
  "residencies",
  "fellowships",
  "awards",
  "publications",
];
export const cvLabels: Record<string, [string, string]> = {
  education: ["학력", "Education"],
  solo: ["개인전", "Solo Exhibitions"],
  group: ["단체전", "Group Exhibitions"],
  popup: ["팝업 전시", "Pop-up Exhibitions"],
  projects: ["프로젝트", "Projects"],
  residencies: ["레지던시", "Residencies"],
  fellowships: ["펠로십", "Fellowships"],
  awards: ["수상", "Awards"],
  publications: ["출판", "Publications"],
};
export function orderedSections(order?: string[]) {
  return [
    ...new Set([
      ...(order || []).filter((s) => cvSections.includes(s)),
      ...cvSections,
    ]),
  ];
}
