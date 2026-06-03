import fs from "node:fs";
import path from "node:path";
import coverage from "istanbul-lib-coverage";
import report from "istanbul-lib-report";
import reports from "istanbul-reports";

const { createCoverageMap } = coverage;
const { createContext } = report;

const root = process.cwd();
const mode = process.argv[2] === "full" ? "full" : "unit";
const outputDir = path.join(root, "coverage");
const outputFile = path.join(outputDir, mode === "unit" ? "coverage-unit-final.json" : "coverage-final.json");

// Merged unit (Vitest) + e2e (Cypress Istanbul) coverage gates.
// Branches run slightly lower in headless CI than locally because Vue SFC instrumentation varies.
// Unit gate excludes repository implementations (integration tested) and seed data.
const thresholds = {
  lines: 75,
  statements: 75,
  functions: 75,
  branches: 75
};

const unitDirs = [
  path.join(root, "coverage", "backend"),
  path.join(root, "coverage", "frontend"),
  path.join(root, "coverage", "packages")
];

const fullDirs = [...unitDirs, path.join(root, "frontend", ".nyc_output")];

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

function shouldIncludeSourcePath(coveragePath, coverageMode) {
  const normalized = path.normalize(coveragePath).replaceAll("\\", "/");
  if (coverageMode === "unit" && normalized.endsWith(".vue")) return false;
  if (normalized.includes("/apps/")) return false;
  if (normalized.endsWith(".d.ts")) return false;
  if (normalized.includes("/types/")) return false;
  if (/\/[^/]*RepositoryImpl\.ts$/.test(normalized)) return false;
  if (/\/[^/]*MemoryRepositoryImpl\.ts$/.test(normalized)) return false;
  if (normalized.endsWith("/memoryRepository.ts")) return false;
  if (normalized.endsWith("/prismaRepository.ts")) return false;
  if (/\/[^/]*(graduateProgram|internship)Catalog\.ts$/.test(normalized)) return false;
  if (normalized.endsWith("/auth/bootstrapUser.ts")) return false;
  if (/\/(seedData|boardGraphSeed|internshipSeedData|graduateProgramSeedData|bachelorFileStorage)\.ts$/.test(normalized)) {
    return false;
  }
  return normalized.includes("/backend/src/") || normalized.includes("/frontend/src/");
}

function loadCoverageMap(dirs, coverageMode) {
  const coverageFiles = dirs.flatMap((dir) => findCoverageFiles(dir));

  if (coverageFiles.length === 0) {
    throw new Error(`No coverage JSON files found for ${coverageMode} gate. Run tests first.`);
  }

  const map = createCoverageMap({});
  for (const file of coverageFiles) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const entries = Object.values(parsed);
    const isCoverageMap =
      entries.length > 0 && entries.every((entry) => entry && typeof entry === "object" && "statementMap" in entry);
    if (isCoverageMap) {
      const normalized = Object.fromEntries(
        Object.entries(parsed)
          .filter(([coveragePath]) => shouldIncludeSourcePath(coveragePath, coverageMode))
          .map(([coveragePath, coverageData]) => {
            const normalizedPath = path.normalize(coveragePath);
            return [normalizedPath, stripGeneratedMappings(normalizedPath, { ...coverageData, path: normalizedPath })];
          })
      );
      if (Object.keys(normalized).length > 0) {
        map.merge(normalized);
      }
    }
  }

  return map;
}

function enforceThresholds(map, label, coverageMode, unitMapForBranches) {
  const summary = map.getCoverageSummary().toJSON();
  const failures = [];

  for (const [metric, minimum] of Object.entries(thresholds)) {
    if (metric === "branches" && coverageMode === "full") {
      const branchPct = unitMapForBranches.getCoverageSummary().toJSON().branches.pct;
      if (branchPct < minimum) {
        failures.push(`branches (unit gate): ${branchPct}% < ${minimum}%`);
      }
      continue;
    }

    if (summary[metric].pct < minimum) {
      failures.push(`${metric}: ${summary[metric].pct}% < ${minimum}%`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} coverage threshold failed:\n${failures.join("\n")}`);
  }

  const branchNote = coverageMode === "full" ? ", branches (unit gate)" : "";
  console.log(
    `${label} coverage threshold passed: ${Object.entries(thresholds)
      .map(([metric, minimum]) => `${metric} >= ${minimum}%`)
      .join(", ")}${branchNote}`
  );
}

function printWorstFiles(map, limit = 10) {
  const files = map.files().map((file) => {
    const summary = map.fileCoverageFor(file).toSummary();
    return { file, lines: summary.lines.pct };
  });
  files.sort((a, b) => a.lines - b.lines);
  const worst = files.slice(0, limit).filter((entry) => entry.lines < thresholds.lines);
  if (worst.length === 0) return;
  console.log(`\nLowest line coverage (top ${worst.length}):`);
  for (const entry of worst) {
    console.log(`  ${entry.lines.toFixed(1)}%  ${entry.file}`);
  }
}

function writeReports(map) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(map, null, 2));

  const context = createContext({ dir: outputDir, coverageMap: map });
  reports.create("text").execute(context);
  reports.create("lcov").execute(context);
  reports.create("json-summary").execute(context);
}

const dirs = mode === "full" ? fullDirs : unitDirs;
const label = mode === "full" ? "Full (unit + e2e)" : "Unit";
const unitMap = loadCoverageMap(unitDirs, "unit");
const map = loadCoverageMap(dirs, mode);
writeReports(map);
printWorstFiles(map);
enforceThresholds(map, label, mode, unitMap);
