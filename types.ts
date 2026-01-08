export enum AppStage {
  INGEST = 'INGEST',
  SCAFFOLD = 'SCAFFOLD',
  RAG = 'RAG',
  SYNTHESIS = 'SYNTHESIS',
  VERIFICATION = 'VERIFICATION',
  REPORT = 'REPORT'
}

export interface CausalNode {
  id: string;
  label: string;
  type: 'variable' | 'outcome' | 'intervention';
  // Simulation props
  value?: number; 
  equation?: string; // e.g. "0.5 * x + 0.2"
  currentValue?: number; // 0-1 normalized for UI
  min?: number;
  max?: number;
  unit?: string;
}

export interface CausalEdge {
  source: string;
  target: string;
  relationship: 'positive' | 'negative' | 'correlative';
  strength?: number;
  weight?: number; // Coefficient for simulation
}

export interface CausalGraphData {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export interface RAGSource {
  title: string;
  url: string;
  snippet: string;
  confidenceScore: number; // 0-100 Calibrated score
  confidenceReason: string;
  methodQuality: 'High' | 'Medium' | 'Low';
}

export interface SyntheticPoint {
  x: number;
  y: number;
  type: 'Observed' | 'Synthetic' | 'Counterfactual';
}

export interface TimePoint {
  t: number;
  control: number;
  treatment: number;
}

export interface HeatmapCell {
  row: string;
  col: number;
  value: number; // 0-1 intensity
}

export interface ConfidenceBandPoint {
  x: number;
  lower: number;
  upper: number;
}

export interface RobustnessMetrics {
  bootstrapStability: number; // 0-100
  domainShiftResilience: number; // 0-100
  leaveOneOutScore: number; // 0-100
  identifiability: 'Strong' | 'Weak' | 'None';
}

export interface SimulationResult {
  variableName: string;
  // Panel A: Dose Response
  doseResponseData: SyntheticPoint[];
  bands: ConfidenceBandPoint[];
  // Panel B: Time Course
  timeCourseData: TimePoint[];
  // Panel C: Imaging/Heatmap
  heatmapData: HeatmapCell[];
  // Stats
  statistics: {
    pValue: number;
    effectSize: number;
    sampleSize: number;
  };
  robustness: RobustnessMetrics;
  robustnessNarrative?: string; 
}

export interface VerificationCheck {
  id: string;
  name: string;
  status: 'Pass' | 'Fail' | 'Warn';
  message: string;
}

export interface ProtocolDiff {
  stepId: string;
  original: string;
  corrected: string;
  rationale: string;
}

export interface ClaimCard {
  id: string;
  claim: string;
  verdict: 'Supported' | 'Disputed' | 'Pending';
  confidence: number;
  citation: string;
}

export interface Artifact {
  name: string;
  type: 'code' | 'dataset' | 'json' | 'figure';
  size: string;
  url?: string;
  content?: string; 
}

export interface StructuredReport {
  scores: {
    validity: number;
    reproducibility: number;
    robustness: number;
  };
  protocolDiffs: ProtocolDiff[];
  claims: ClaimCard[];
  artifacts: Artifact[];
  summary: string;
}