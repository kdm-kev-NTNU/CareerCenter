import type { CareerTrackSetting } from "@careercenter/shared";
import type { CareerMapNode } from "@careercenter/shared";
import { careerTrackDefaults } from "@careercenter/shared";
import type { Company } from "@careercenter/shared";

export type CareerMapNodeSeed = CareerMapNode & {
  defaultTitle: string;
  defaultItems: string[];
  sortOrder: number;
};

export const careerTrackSeeds: CareerTrackSetting[] = careerTrackDefaults;

function seedNode(node: CareerMapNode, sortOrder: number): CareerMapNodeSeed {
  return {
    ...node,
    defaultTitle: node.title,
    defaultItems: [...node.items],
    sortOrder
  };
}

export const careerMapNodeSeeds: CareerMapNodeSeed[] = [
  seedNode({
    id: "now",
    title: "NÅ: KI-master / Dataingeniør / NTNU",
    level: 0,
    items: ["Tidsserier og forecasting", "RAG / LLM systems / MLOps", "Cloud og produksjonssystemer", "Forretningsforståelse innen energi, finans og marked"]
  }, 0),
  seedNode({
    id: "energy-1",
    title: "Spor A nivå 1: Norge, 0-3 år",
    level: 1,
    track: "ENERGY_QUANT",
    items: ["Statkraft", "Equinor", "Volue", "Nord Pool", "Cognite", "Rystad Energy", "DNV"]
  }, 1),
  seedNode({
    id: "energy-2",
    title: "Spor A nivå 2: Norden/Europa, 2-4 år",
    level: 2,
    track: "ENERGY_QUANT",
    items: ["Vattenfall Energy Trading", "Ørsted Trading", "InCommodities", "Danske Commodities", "Axpo", "RWE Supply & Trading"]
  }, 2),
  seedNode({
    id: "energy-3",
    title: "Spor A nivå 3: Global elite, 5+ år",
    level: 3,
    track: "ENERGY_QUANT",
    items: ["Vitol", "Glencore", "Trafigura", "Mercuria", "Citadel commodities", "Man AHL"]
  }, 3),
  seedNode({
    id: "consulting-1",
    title: "Spor B nivå 1: Norge, 0-3 år",
    level: 1,
    track: "AI_CONSULTING",
    items: ["McKinsey QuantumBlack", "BCG X", "Bain", "Deloitte AI & Data", "EY Data & AI", "PwC Deals/Data", "KPMG Lighthouse"]
  }, 4),
  seedNode({
    id: "consulting-2",
    title: "Spor B nivå 2: Europa, 2-4 år",
    level: 2,
    track: "AI_CONSULTING",
    items: ["Deloitte M&A Technology", "EY-Parthenon", "Accenture Strategy", "Oliver Wyman Digital", "Altman Solon", "Alvarez & Marsal"]
  }, 5),
  seedNode({
    id: "consulting-3",
    title: "Spor B nivå 3: Global elite, 5+ år",
    level: 3,
    track: "AI_CONSULTING",
    items: ["PE Portfolio Operations", "Operating Partner AI", "Blackstone Tech & Innovations", "Insight Onsite", "Hg AI Transformation", "EQT Motherbrain"]
  }, 6),
  seedNode({
    id: "venture-1",
    title: "Spor C nivå 1: Norge/Norden, 0-3 år",
    level: 1,
    track: "VENTURE_PE_AI_OPS",
    items: ["Verdane", "EQT Ventures", "NBIM", "Investinor", "Nysnø", "Viking Venture", "Schibsted Ventures"]
  }, 7),
  seedNode({
    id: "venture-2",
    title: "Spor C nivå 2: Europa, 2-4 år",
    level: 2,
    track: "VENTURE_PE_AI_OPS",
    items: ["EQT Motherbrain", "Hg", "Insight Partners", "Verdane Elevate", "Northzone", "Creandum", "Atomico", "Index Ventures"]
  }, 8),
  seedNode({
    id: "venture-3",
    title: "Spor C nivå 3: Global elite, 5+ år",
    level: 3,
    track: "VENTURE_PE_AI_OPS",
    items: ["Blackstone", "KKR", "Vista Equity Partners", "Thoma Bravo", "Silver Lake", "General Atlantic", "Sequoia", "Andreessen Horowitz"]
  }, 9)
];

export const companies: Company[] = [
  { id: "statkraft", name: "Statkraft", description: "Norsk startpunkt for kraft, trading, algoritmer og analyse.", tracks: ["ENERGY_QUANT"], tier: 1, geography: "Oslo / Norge", roleTypes: ["Data Scientist", "Quantitative Analyst", "Market Analyst"], difficulty: "High", upside: "Very high", relevanceScore: 98, websiteUrl: "https://www.statkraft.com" },
  { id: "equinor", name: "Equinor", description: "Global energiaktør med commodity exposure, market analysis og trading.", tracks: ["ENERGY_QUANT", "INDUSTRIAL_AI"], tier: 1, geography: "Norge / globalt", roleTypes: ["Market Analyst", "ML Engineer", "Risk Analyst"], difficulty: "High", upside: "Very high", relevanceScore: 94, websiteUrl: "https://www.equinor.com" },
  { id: "nbim", name: "NBIM", description: "Investment tech, data analytics og risiko i en av verdens største investeringsorganisasjoner.", tracks: ["INVESTMENT_TECH", "VENTURE_PE_AI_OPS"], tier: 1, geography: "Oslo / London / New York", roleTypes: ["Technology Graduate", "Data Analyst", "Investment Analytics"], difficulty: "Very high", upside: "Very high", relevanceScore: 96, websiteUrl: "https://www.nbim.no" },
  { id: "bcg-x", name: "BCG X", description: "AI consulting, data science, venture building og digital strategi.", tracks: ["AI_CONSULTING"], tier: 1, geography: "Oslo / Norden / globalt", roleTypes: ["AI Engineer Consultant", "Data Scientist", "Tech Strategy Consultant"], difficulty: "Very high", upside: "Very high", relevanceScore: 95, websiteUrl: "https://www.bcg.com/x" },
  { id: "mckinsey-quantumblack", name: "McKinsey QuantumBlack", description: "AI- og analytics-miljø med sterk kobling til strategi og toppledelse.", tracks: ["AI_CONSULTING"], tier: 1, geography: "Oslo / Stockholm / London", roleTypes: ["Data Scientist", "AI Consultant", "Analytics Translator"], difficulty: "Very high", upside: "Very high", relevanceScore: 95, websiteUrl: "https://www.mckinsey.com/capabilities/quantumblack" },
  { id: "cognite", name: "Cognite", description: "Industriell data/AI-plattform som gir sterk teknisk plattformkompetanse.", tracks: ["INDUSTRIAL_AI", "ENERGY_QUANT"], tier: 1, geography: "Oslo / globalt", roleTypes: ["Software Engineer", "ML Engineer", "Solutions Architect"], difficulty: "High", upside: "High", relevanceScore: 90, websiteUrl: "https://www.cognite.com" },
  { id: "volue", name: "Volue", description: "Energi, kraftmarked, trading software og forecasting.", tracks: ["ENERGY_QUANT", "INDUSTRIAL_AI"], tier: 1, geography: "Oslo / Europa", roleTypes: ["Forecasting Analyst", "Data Scientist", "Software Engineer"], difficulty: "Medium/high", upside: "High", relevanceScore: 88, websiteUrl: "https://www.volue.com" },
  { id: "nord-pool", name: "Nord Pool", description: "Kraftmarked, markedsdata og børsinfrastruktur.", tracks: ["ENERGY_QUANT"], tier: 1, geography: "Oslo / Europa", roleTypes: ["Market Analyst", "Data Engineer", "Product Analyst"], difficulty: "High", upside: "High", relevanceScore: 87, websiteUrl: "https://www.nordpoolgroup.com" },
  { id: "rystad", name: "Rystad Energy", description: "Energidata, kommersiell analyse og markedsmodeller.", tracks: ["ENERGY_QUANT", "AI_CONSULTING"], tier: 1, geography: "Oslo / globalt", roleTypes: ["Energy Analyst", "Data Scientist", "Consultant"], difficulty: "Medium/high", upside: "High", relevanceScore: 84, websiteUrl: "https://www.rystadenergy.com" },
  { id: "dnv", name: "DNV", description: "Energi, risiko, digitale modeller og industriell analyse.", tracks: ["INDUSTRIAL_AI", "ENERGY_QUANT"], tier: 1, geography: "Norge / globalt", roleTypes: ["Risk Analyst", "Data Scientist", "Consultant"], difficulty: "Medium/high", upside: "High", relevanceScore: 82, websiteUrl: "https://www.dnv.com" },
  { id: "verdane", name: "Verdane", description: "Nordisk growth equity med digital/tech-portefølje og portfolio value creation.", tracks: ["VENTURE_PE_AI_OPS"], tier: 1, geography: "Oslo / Stockholm / Berlin", roleTypes: ["Portfolio Analyst", "Data/AI Analyst", "Growth Analyst"], difficulty: "High", upside: "Very high", relevanceScore: 91, websiteUrl: "https://verdane.com" },
  { id: "viking", name: "Viking Venture", description: "Trondheim-nært B2B software growth-miljø.", tracks: ["VENTURE_PE_AI_OPS"], tier: 1, geography: "Trondheim / Norge", roleTypes: ["Investment Analyst", "Portfolio Operations", "Data Analyst"], difficulty: "High", upside: "High", relevanceScore: 83, websiteUrl: "https://vikingventure.com" },
  { id: "vattenfall", name: "Vattenfall Energy Trading", description: "Europeisk tradingmiljø for kraft, analyse og algoritmiske strategier.", tracks: ["ENERGY_QUANT"], tier: 2, geography: "Sverige / Tyskland / Nederland / UK", roleTypes: ["Quantitative Researcher", "Algo Trader", "Forecasting Lead"], difficulty: "Very high", upside: "Very high", relevanceScore: 93, websiteUrl: "https://group.vattenfall.com" },
  { id: "orsted", name: "Ørsted", description: "Offshore wind, digital trading, portfolio analysis og advanced analytics.", tracks: ["ENERGY_QUANT"], tier: 2, geography: "Danmark / Europa", roleTypes: ["Portfolio Analyst", "Energy Trader", "Data Scientist"], difficulty: "High", upside: "Very high", relevanceScore: 89, websiteUrl: "https://orsted.com" },
  { id: "incommodities", name: "InCommodities", description: "Dansk algo energy trading-miljø med høy relevans for quant power.", tracks: ["ENERGY_QUANT"], tier: 2, geography: "Aarhus / Danmark", roleTypes: ["Algo Trader", "Quant Developer", "Data Scientist"], difficulty: "Very high", upside: "Very high", relevanceScore: 97, websiteUrl: "https://incommodities.com" },
  { id: "eqt-motherbrain", name: "EQT Motherbrain", description: "AI/data-driven investing brukt til sourcing, investering og porteføljeverdi.", tracks: ["VENTURE_PE_AI_OPS", "INVESTMENT_TECH"], tier: 2, geography: "Stockholm / London / globalt", roleTypes: ["Data Scientist", "AI Engineer", "Investment Data Analyst"], difficulty: "Very high", upside: "Very high", relevanceScore: 96, websiteUrl: "https://eqtgroup.com" },
  { id: "hg", name: "Hg", description: "Software/tech PE med tydelig AI transformation-vinkel i porteføljeselskaper.", tracks: ["VENTURE_PE_AI_OPS"], tier: 2, geography: "London / Europa", roleTypes: ["Portfolio Operations", "AI Transformation", "Tech Due Diligence"], difficulty: "Very high", upside: "Very high", relevanceScore: 92, websiteUrl: "https://hgcapital.com" },
  { id: "insight", name: "Insight Partners", description: "Growth equity og Insight Onsite for skalering av software-selskaper.", tracks: ["VENTURE_PE_AI_OPS"], tier: 2, geography: "New York / London / globalt", roleTypes: ["Onsite Analyst", "AI/ML Specialist", "Growth Analyst"], difficulty: "Very high", upside: "Very high", relevanceScore: 90, websiteUrl: "https://www.insightpartners.com" },
  { id: "vitol", name: "Vitol", description: "Global commodity trading elite.", tracks: ["ENERGY_QUANT"], tier: 3, geography: "Geneva / London / globalt", roleTypes: ["Commodity Trader", "Quant Analyst", "Risk Analyst"], difficulty: "Very high", upside: "Very high", relevanceScore: 92, websiteUrl: "https://www.vitol.com" },
  { id: "blackstone", name: "Blackstone", description: "Global PE med Technology & Innovations, Data Science og portfolio operations.", tracks: ["VENTURE_PE_AI_OPS", "INVESTMENT_TECH"], tier: 3, geography: "New York / London / globalt", roleTypes: ["Data Science", "Portfolio Operations", "Technology Strategy"], difficulty: "Very high", upside: "Very high", relevanceScore: 93, websiteUrl: "https://www.blackstone.com" }
];
