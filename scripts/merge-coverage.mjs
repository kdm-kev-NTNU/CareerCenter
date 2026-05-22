import fs from "node:fs";
import path from "node:path";
import coverage from "istanbul-lib-coverage";
import report from "istanbul-lib-report";
import reports from "istanbul-reports";

const { createCoverageMap } = coverage;
const { createContext } = report;

const root = process.cwd();
const outputDir = path.join(root, "coverage");
const outputFile = path.join(outputDir, "coverage-final.json");
const thresholds = {
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 80
};

function sourceLineCount(filePath) {
  if (!fs.existsSync(filePath)) return Number.MAX_SAFE_INTEGER;
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

function stripGeneratedMappings(filePath, coverageData) {
  const lineCount = sourceLineCount(filePath);
  const next = structuredClone(coverageData);

  for (const [id, fn] of Object.entries(next.fnMap)) {
    const line = fn.loc?.start?.line ?? fn.line;
    if (line > lineCount) {
      delete next.fnMap[id];
      delete next.f[id];
    }
  }
  for (const [id, statement] of Object.entries(next.statementMap)) {
    const line = statement.start?.line ?? statement.line;
    if (line > lineCount) {
      delete next.statementMap[id];
      delete next.s[id];
    }
  }
  for (const [id, branch] of Object.entries(next.branchMap)) {
    const line = branch.loc?.start?.line ?? branch.line;
    if (line > lineCount) {
      delete next.branchMap[id];
      delete next.b[id];
    }
  }

  return next;
}

function findCoverageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findCoverageFiles(fullPath);
    if (!entry.isFile() || !entry.name.endsWith(".json")) return [];
    if (path.resolve(fullPath) === path.resolve(outputFile)) return [];
    return [fullPath];
  });
}

const coverageFiles = [
  ...findCoverageFiles(path.join(root, "coverage")),
  ...findCoverageFiles(path.join(root, "frontend", ".nyc_output"))
];

if (coverageFiles.length === 0) {
  throw new Error("No coverage JSON files found. Run unit and e2e coverage first.");
}

const map = createCoverageMap({});
for (const file of coverageFiles) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = Object.values(parsed);
  const isCoverageMap = entries.length > 0 && entries.every((entry) => entry && typeof entry === "object" && "statementMap" in entry);
  if (isCoverageMap) {
    const normalized = Object.fromEntries(Object.entries(parsed).map(([coveragePath, coverageData]) => {
      const normalizedPath = path.normalize(coveragePath);
      return [normalizedPath, stripGeneratedMappings(normalizedPath, { ...coverageData, path: normalizedPath })];
    }));
    map.merge(normalized);
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(map, null, 2));

const context = createContext({ dir: outputDir, coverageMap: map });
reports.create("text").execute(context);
reports.create("lcov").execute(context);
reports.create("json-summary").execute(context);

const summary = map.getCoverageSummary().toJSON();
const failures = Object.entries(thresholds)
  .filter(([metric, minimum]) => summary[metric].pct < minimum)
  .map(([metric, minimum]) => `${metric}: ${summary[metric].pct}% < ${minimum}%`);

if (failures.length > 0) {
  throw new Error(`Coverage threshold failed:\n${failures.join("\n")}`);
}

console.log(`Coverage threshold passed: ${Object.entries(thresholds).map(([metric, minimum]) => `${metric} >= ${minimum}%`).join(", ")}`);
