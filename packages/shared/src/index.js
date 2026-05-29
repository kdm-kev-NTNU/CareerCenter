export const careerTracks = [
    "ENERGY_QUANT",
    "AI_CONSULTING",
    "VENTURE_PE_AI_OPS",
    "INVESTMENT_TECH",
    "INDUSTRIAL_AI"
];
export const trackLabels = {
    ENERGY_QUANT: "Energy, Power Trading & Quant",
    AI_CONSULTING: "Tech Consulting / AI Strategy",
    VENTURE_PE_AI_OPS: "Tech Venture, PE, Growth Equity, AI Ops",
    INVESTMENT_TECH: "Investment Technology",
    INDUSTRIAL_AI: "Industrial AI"
};
export const careerTrackDefaults = careerTracks.map((track, index) => ({
    id: track,
    label: trackLabels[track],
    sortOrder: index
}));
export const courseStatuses = ["planned", "considering", "confirmed", "completed"];
export const learningStatuses = ["planned", "in_progress", "completed"];
export function assertSemester(value) {
    if ([7, 8, 9, 10].includes(value)) {
        return value;
    }
    throw new Error("Semester må være 7, 8, 9 eller 10.");
}
export const competitionTypes = ["hackathon", "competition", "case_competition", "datathon", "other"];
export const competitionScopes = ["NORWAY", "NORDICS", "EUROPE", "GLOBAL"];
export const competitionFormats = ["online", "onsite", "hybrid"];
export const competitionStatuses = [
    "watching",
    "considering",
    "registered",
    "participating",
    "completed",
    "won",
    "dropped"
];
export const competitionTypeLabels = {
    hackathon: "Hackathon",
    competition: "Konkurranse",
    case_competition: "Case-konkurranse",
    datathon: "Datathon",
    other: "Annet"
};
export const competitionScopeLabels = {
    NORWAY: "Norge",
    NORDICS: "Norden",
    EUROPE: "Europa",
    GLOBAL: "Globalt"
};
export const competitionFormatLabels = {
    online: "Online",
    onsite: "Fysisk",
    hybrid: "Hybrid"
};
export const competitionStatusLabels = {
    watching: "Følger med",
    considering: "Vurderer",
    registered: "Påmeldt",
    participating: "Deltar",
    completed: "Fullført",
    won: "Vant / plassering",
    dropped: "Avsluttet"
};
