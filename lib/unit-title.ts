/**
 * The course tree prints `Unit N:` in front of the stored title.
 * A title that already starts with that prefix would read twice.
 */
const UNIT_PREFIX = /^(?:unit|module|chapter)\s+(\d+)\s*[:.\-–—]\s*/i;

export function stripUnitPrefix(title: string, unitNumber?: number): string {
  let current = title.trim();
  for (let pass = 0; pass < 4; pass += 1) {
    const match = current.match(UNIT_PREFIX);
    if (!match) break;
    const numbered = Number(match[1]);
    if (unitNumber != null && numbered !== unitNumber) break;
    const rest = current.slice(match[0].length).trim();
    if (!rest) break;
    current = rest;
  }
  return current;
}
