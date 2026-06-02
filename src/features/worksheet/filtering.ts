import type { WorksheetFormat } from "@/types/worksheet";

import type { ExactGradeId, GradeBandId, Strand, WorksheetType } from "./catalog";

export interface WorksheetTypeFilters {
  query?: string;
  exactGrade?: ExactGradeId | "";
  gradeBand?: GradeBandId | "";
  strand?: Strand | "";
  format?: WorksheetFormat | "";
}

export function filterWorksheetTypes(types: readonly WorksheetType[], filters: WorksheetTypeFilters) {
  const query = (filters.query || "").trim().toLowerCase();

  return types.filter((type) => {
    const haystack = [
      type.title,
      type.strand,
      type.summary,
      type.controls.join(" "),
      type.formats.join(" "),
      type.validationRules.join(" "),
      type.solution.method
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (!filters.exactGrade || type.grades.includes(filters.exactGrade))
      && (!filters.gradeBand || type.gradeBands.includes(filters.gradeBand))
      && (!filters.strand || type.strand === filters.strand)
      && (!filters.format || type.formats.includes(filters.format));
  });
}

export function countByStrand(types: readonly WorksheetType[]) {
  return types.reduce<Record<string, number>>((counts, type) => {
    counts[type.strand] = (counts[type.strand] || 0) + 1;
    return counts;
  }, {});
}
