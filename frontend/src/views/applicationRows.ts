export type ApplicationKind = "internship" | "graduate";
export type ApplicationKindFilter = "all" | ApplicationKind;

export function applicationKindFromQuery(value: unknown): ApplicationKindFilter {
  return value === "internship" || value === "graduate" ? value : "all";
}

export function sortApplications<T extends { deadline?: string; companyName: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftDeadline = left.deadline?.trim() || "";
    const rightDeadline = right.deadline?.trim() || "";
    if (leftDeadline && rightDeadline) {
      return leftDeadline.localeCompare(rightDeadline) || left.companyName.localeCompare(right.companyName, "nb");
    }
    if (leftDeadline) return -1;
    if (rightDeadline) return 1;
    return left.companyName.localeCompare(right.companyName, "nb");
  });
}
