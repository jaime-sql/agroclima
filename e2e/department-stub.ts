import { departmentMapFromWeeks } from "../src/lib/risk/department-catalog.ts";

/** Coffee departments stay Sin datos until a test assigns scored weeks. */
export function sinDatosDepartments() {
  return departmentMapFromWeeks(new Map(), Date.UTC(2026, 9, 23, 21, 45));
}
