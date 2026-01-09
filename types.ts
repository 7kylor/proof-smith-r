
export enum AppStage {
  DESIGN = 'DESIGN', // Ingest + Scaffold
  VALIDATE = 'VALIDATE', // Calibrate + Synthesize
  PROVE = 'PROVE', // Report
  VERIFYING = 'VERIFYING' // Intermediate gating state
}

export interface CausalNode {
  id: string;
  label: string;
  type: 'variable' | 'outcome' | 'intervention';
  value?: number; 
  equation?: string;
  currentValue?: number;
  min?: number;
  max?: number;
  unit?: string;
}

export interface CausalEdge {
  source: string;
  target: string;
  relationship: 'positive' | 'negative' | 'correlative';
  strength?: number;
  weight?: number;
}

export interface CausalGraphData {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export interface RAGSource {
  title: string;
  url: string;
  snippet: string;
  confidenceScore: number;
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
  value: number;
}

export interface ConfidenceBandPoint {
  x: number;
  lower: number;
  upper: number;
}

export interface RobustnessMetrics {
  bootstrapStability: number;
  domainShiftResilience: number;
  leaveOneOutScore: number;
  identifiability: 'Strong' | 'Weak' | 'None';
}

export interface SimulationResult {
  variableName: string;
  doseResponseData: SyntheticPoint[];
  bands: ConfidenceBandPoint[];
  timeCourseData: TimePoint[];
  heatmapData: HeatmapCell[];
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
