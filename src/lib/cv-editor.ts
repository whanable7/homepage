import { cvSections, orderedSections } from "./cv";
export type CVRow = Record<string, string> & { id: string };
export type CVAbout = Record<string, unknown>;
export const exhibitionSections = ["solo", "group", "popup"];
export const cvFields: Record<string, [string, string][]> = {
  education: [["description", "학력"]],
  solo: [
    ["title", "전시명"],
    ["venue", "기관 · 갤러리"],
    ["location", "도시 · 국가"],
  ],
  group: [
    ["title", "전시명"],
    ["venue", "기관 · 갤러리"],
    ["location", "도시 · 국가"],
  ],
  popup: [
    ["title", "전시명"],
    ["venue", "기관 · 갤러리"],
    ["location", "도시 · 국가"],
  ],
  projects: [
    ["title", "프로젝트명"],
    ["role", "역할"],
    ["organization", "기관 · 협업자"],
    ["location", "장소"],
    ["description", "설명"],
  ],
  residencies: [
    ["program", "프로그램"],
    ["location", "장소"],
  ],
  fellowships: [
    ["name", "펠로십명"],
    ["organization", "기관"],
  ],
  awards: [
    ["name", "수상명"],
    ["organization", "기관"],
  ],
  publications: [
    ["title", "출판물명"],
    ["publisher", "출판사"],
  ],
};
export const cvAboutKeys = [
  ...cvSections.filter((k) => !exhibitionSections.includes(k)),
  "cv_section_order",
  "cv_exhibition_order",
  "cv_deleted",
];
export function aboutRows(about: CVAbout, section: string): CVRow[] {
  return ((about[section] || []) as CVRow[]).map((r, i) => ({
    ...r,
    id: r.id || `legacy-${section}-${i}`,
  }));
}
export function sectionRows(
  about: CVAbout,
  exhibitions: CVRow[],
  section: string,
) {
  if (!exhibitionSections.includes(section)) return aboutRows(about, section);
  const order = (about.cv_exhibition_order || []) as string[];
  return exhibitions
    .filter((r) => !r.deleted_at && r.type === section)
    .sort((a, b) => {
      const rank = (id: string) =>
        order.includes(id) ? order.indexOf(id) : Number.MAX_SAFE_INTEGER;
      return (
        rank(a.id) - rank(b.id) ||
        (parseInt(String(b.year), 10) || 0) -
          (parseInt(String(a.year), 10) || 0) ||
        Number(a.display_order || 0) - Number(b.display_order || 0)
      );
    });
}
export function cleanCVRow(
  section: string,
  input: Record<string, unknown>,
): Record<string, string> {
  if (!cvFields[section]) throw new Error("항목을 확인해 주세요.");
  const fields = [
    "year",
    ...cvFields[section].flatMap(([f]) => [f, `${f}_en`]),
  ];
  if (exhibitionSections.includes(section)) fields.push("external_url");
  if (section === "projects") fields.push("url");
  if (section === "publications") fields.push("type");
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = input[f] ?? "";
    if (typeof v !== "string" || v.length > 5000)
      throw new Error("입력 내용을 확인해 주세요.");
    out[f] = v.trim();
  }
  const main = cvFields[section][0][0];
  if (!out.year || !(out[main] || out[main + "_en"]))
    throw new Error("기간과 한글 또는 영문 내용을 입력해 주세요.");
  if (out.year.length > 80)
    throw new Error("기간은 80자 이내로 입력해 주세요.");
  for (const f of ["url", "external_url"])
    if (out[f] && !/^https?:\/\//i.test(out[f]))
      throw new Error("링크는 https:// 또는 http://로 시작해야 합니다.");
  if (
    section === "publications" &&
    out.type &&
    !["book", "catalog", "article", "other"].includes(out.type)
  )
    throw new Error("출판물 종류를 확인해 주세요.");
  return out;
}
export type CVCommand = {
  action: "save" | "delete" | "restore" | "reorder" | "sections";
  section?: string;
  id?: string;
  fields?: Record<string, unknown>;
  ids?: string[];
  revision: string;
};
export function applyCVCommand(
  about: CVAbout,
  exhibitions: CVRow[],
  command: CVCommand,
  now: string,
): CVAbout | CVRow[] {
  if (command.action === "sections") {
    if (
      !command.ids ||
      command.ids.length !== cvSections.length ||
      new Set(command.ids).size !== cvSections.length ||
      command.ids.some((k) => !cvSections.includes(k))
    )
      throw new Error("항목 순서를 확인해 주세요.");
    return { ...about, cv_section_order: command.ids };
  }
  const section = command.section || "";
  if (!cvSections.includes(section)) throw new Error("항목을 확인해 주세요.");
  const ex = exhibitionSections.includes(section),
    rows = sectionRows(about, exhibitions, section);
  if (command.action === "reorder") {
    const ids = command.ids || [];
    if (
      ids.length !== rows.length ||
      new Set(ids).size !== rows.length ||
      ids.some((id) => !rows.some((r) => r.id === id))
    )
      throw new Error("목록이 변경됐습니다. 새로 불러와 주세요.");
    if (ex)
      return {
        ...about,
        cv_exhibition_order: [
          ...ids,
          ...((about.cv_exhibition_order || []) as string[]).filter(
            (id) => !ids.includes(id),
          ),
        ],
      };
    return {
      ...about,
      [section]: ids.map((id) => rows.find((r) => r.id === id)!),
    };
  }
  if (!command.id || !/^[\w-]{1,100}$/.test(command.id))
    throw new Error("기록 번호를 확인해 주세요.");
  const id = command.id;
  if (command.action === "restore") {
    if (ex) {
      if (
        !exhibitions.some(
          (r) => r.id === id && r.deleted_at && r.type === section,
        )
      )
        throw new Error("복구할 기록이 없습니다.");
      return exhibitions.map((r) =>
        r.id === id ? { ...r, deleted_at: "", updated_at: now } : r,
      );
    }
    const deleted = (about.cv_deleted || []) as {
      section: string;
      row: CVRow;
    }[];
    const item = deleted.find((d) => d.section === section && d.row.id === id);
    if (!item) throw new Error("복구할 기록이 없습니다.");
    if (rows.some((r) => r.id === id))
      throw new Error("이미 복구된 기록입니다.");
    return {
      ...about,
      [section]: [...rows, item.row],
      cv_deleted: deleted.filter((d) => d !== item),
    };
  }
  const existing = rows.find((r) => r.id === id);
  if (command.action === "delete") {
    if (!existing) throw new Error("삭제할 기록이 없습니다.");
    if (ex)
      return exhibitions.map((r) =>
        r.id === id ? { ...r, deleted_at: now, updated_at: now } : r,
      );
    return {
      ...about,
      [section]: rows.filter((r) => r.id !== id),
      cv_deleted: [
        ...((about.cv_deleted || []) as unknown[]),
        { section, row: existing, deletedAt: now },
      ],
    };
  }
  if (command.action !== "save") throw new Error("작업을 확인해 주세요.");
  const fields = cleanCVRow(section, command.fields || {});
  if (ex) {
    if (exhibitions.some((r) => r.id === id && (!existing || r.deleted_at)))
      throw new Error("다른 항목에 같은 기록이 있습니다.");
    const row = {
      ...existing,
      ...fields,
      id,
      type: section,
      updated_at: now,
      created_at: existing?.created_at || now,
    };
    return existing
      ? exhibitions.map((r) => (r.id === id ? row : r))
      : [...exhibitions, row];
  }
  const row = { ...existing, ...fields, id };
  return {
    ...about,
    [section]: existing
      ? rows.map((r) => (r.id === id ? row : r))
      : [...rows, row],
  };
}
export function cvSnapshot(about: CVAbout, exhibitions: CVRow[]) {
  return {
    order: orderedSections(about.cv_section_order as string[]),
    sections: Object.fromEntries(
      cvSections.map((k) => [k, sectionRows(about, exhibitions, k)]),
    ),
    deleted: [
      ...((about.cv_deleted || []) as { section: string; row: CVRow }[]),
      ...exhibitions
        .filter((r) => r.deleted_at)
        .map((row) => ({ section: row.type, row })),
    ],
  };
}
