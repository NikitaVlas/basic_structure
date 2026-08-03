const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const COMPARATOR_PATTERN = /^(>=|<=|>|<)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseSemver(value) {
  const match = VERSION_PATTERN.exec(value ?? "");
  if (!match) throw new Error(`Invalid semantic version: ${JSON.stringify(value)}.`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), value };
}

export function compareSemver(left, right) {
  const a = typeof left === "string" ? parseSemver(left) : left;
  const b = typeof right === "string" ? parseSemver(right) : right;
  return Math.sign(a.major - b.major || a.minor - b.minor || a.patch - b.patch);
}

function upperBound(version, kind) {
  if (kind === "~") return { major: version.major, minor: version.minor + 1, patch: 0 };
  if (version.major > 0) return { major: version.major + 1, minor: 0, patch: 0 };
  if (version.minor > 0) return { major: 0, minor: version.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: version.patch + 1 };
}

function testComparator(version, operator, target) {
  const comparison = compareSemver(version, target);
  if (operator === ">") return comparison > 0;
  if (operator === ">=") return comparison >= 0;
  if (operator === "<") return comparison < 0;
  if (operator === "<=") return comparison <= 0;
  return comparison === 0;
}

export function parseSemverRange(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid semantic version range: ${JSON.stringify(value)}.`);
  const range = value.trim();
  if (VERSION_PATTERN.test(range)) return [{ operator: "=", version: parseSemver(range) }];
  if (range.startsWith("^") || range.startsWith("~")) {
    const kind = range[0];
    const lower = parseSemver(range.slice(1));
    return [{ operator: ">=", version: lower }, { operator: "<", version: upperBound(lower, kind) }];
  }
  const tokens = range.split(/\s+/);
  return tokens.map((token) => {
    const match = COMPARATOR_PATTERN.exec(token);
    if (!match) throw new Error(`Invalid semantic version range: ${JSON.stringify(value)}.`);
    return { operator: match[1], version: parseSemver(`${match[2]}.${match[3]}.${match[4]}`) };
  });
}

export function satisfiesSemver(versionValue, rangeValue) {
  const version = parseSemver(versionValue);
  return parseSemverRange(rangeValue).every(({ operator, version: target }) => testComparator(version, operator, target));
}

