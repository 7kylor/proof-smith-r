
export enum AppStage {
  NOTEBOOK = 'NOTEBOOK',
  DESIGN = 'DESIGN', 
  VALIDATE = 'VALIDATE', 
  PROVE = 'PROVE', 
  JOINING = 'JOINING' 
}

export interface Source {
  id: string;
  type: 'text' | 'url' | 'image' | 'file';
  title: string;
  content: string; // base64 for image, raw text for others
  mimeType?: string;
  metadata?: any;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  citations?: string[];
  isThinking?: boolean;
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

// Fix: Added missing export for HeatmapCell
export interface HeatmapCell {
  row: string;
  col: number;
  value: number;
}

export interface SimulationResult {
  variableName: string;
  doseResponseData: any[];
  bands: any[];
  timeCourseData: any[];
  heatmapData: HeatmapCell[];
  statistics: {
    pValue: number;
    effectSize: number;
    sampleSize: number;
  };
  robustness: any;
  robustnessNarrative?: string; 
}

// Fix: Added missing export for ClaimCard
export interface ClaimCard {
  claim: string;
  verdict: 'Supported' | 'Disputed' | 'Pending';
  citation: string;
}

// Fix: Added missing export for Artifact
export interface Artifact {
  name: string;
  type: 'code' | 'dataset' | 'report';
  size: string;
  content?: string;
}

export interface StructuredReport {
  scores: {
    validity: number;
    reproducibility: number;
    robustness: number;
  };
  protocolDiffs: any[];
  claims: ClaimCard[];
  artifacts: Artifact[];
  summary: string;
}

export interface VerificationCheck {
  id: string;
  name: string;
  status: 'Pass' | 'Fail' | 'Warn';
  message: string;
}
