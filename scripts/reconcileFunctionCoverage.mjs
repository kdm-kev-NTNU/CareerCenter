function statementStartsInside(fnStart, fnEnd, statementStart) {
  if (statementStart.line < fnStart.line || statementStart.line > fnEnd.line) return false;
  if (statementStart.line === fnStart.line && statementStart.column < fnStart.column) return false;
  if (statementStart.line === fnEnd.line && statementStart.column > fnEnd.column) return false;
  return true;
}

/**
 * Istanbul function counters on Vue SFCs stay at 0 after the body runs.
 * A function is covered when its own hit counter moved or a statement that
 * starts inside its source range executed.
 */
export function reconcileFunctionHits(coverageData) {
  const statements = Object.entries(coverageData.statementMap ?? {});
  let repaired = 0;

  for (const [id, fn] of Object.entries(coverageData.fnMap ?? {})) {
    if ((coverageData.f?.[id] ?? 0) > 0) continue;
    const start = fn.loc?.start;
    const end = fn.loc?.end;
    if (!start || !end) continue;

    const executed = statements.some(([statementId, statement]) => {
      if ((coverageData.s?.[statementId] ?? 0) <= 0) return false;
      if (!statement.start) return false;
      return statementStartsInside(start, end, statement.start);
    });

    if (!executed) continue;
    coverageData.f[id] = 1;
    repaired += 1;
  }

  return repaired;
}

export function reconcileCoverageMap(map) {
  let repaired = 0;
  for (const file of map.files()) {
    repaired += reconcileFunctionHits(map.fileCoverageFor(file).data);
  }
  return repaired;
}
