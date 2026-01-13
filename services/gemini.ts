
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CausalGraphData, RAGSource, SimulationResult, Source, ChatMessage, StructuredReport, VerificationCheck } from "../types";

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const chatWithNotebook = async (
  message: string, 
  sources: Source[], 
  history: ChatMessage[],
  thinking: boolean = false
): Promise<ChatMessage> => {
  const ai = getClient();
  const model = thinking ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
  
  const sourceContext = sources.map(s => `SOURCE TITLE: ${s.title}\nCONTENT: ${s.content}`).join('\n\n---\n\n');
  
  const systemInstruction = `
    You are ProofSmith-R, an expert causal scientist within a mechanistic notebook environment.
    Your primary goal is to answer research questions GROUNDED STRICTLY in the following sources:
    
    ${sourceContext}
    
    GUIDELINES:
    1. Focus on mechanisms: How do variables interact? What are the causal links?
    2. Be rigorous: If the sources don't contain the answer, say so.
    3. Citations: When possible, mention which source provided the information.
    4. Format: Use clear, academic language.
    ${thinking ? "5. Reasoning: Perform a multi-step causal analysis with your deep thinking budget." : ""}
  `;

  // Filter history to fit API constraints if necessary, keeping last 10 turns
  const conversationHistory = history.slice(-10).map(m => ({ 
    role: m.role, 
    parts: [{ text: m.text }] 
  }));

  const contents = [
    ...conversationHistory,
    { 
      role: 'user', 
      parts: [{ text: message }] 
    }
  ];

  const config: any = {
    systemInstruction,
    tools: [{ googleSearch: {} }] // External grounding for scientific context
  };

  if (thinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config
  });

  return {
    role: 'model',
    text: response.text || "I was unable to synthesize a response from the current sources.",
    citations: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web?.uri).filter(Boolean) || []
  };
};

export const generateNotebookSummary = async (sources: Source[]): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Identify the core mechanistic variables and their interactions across these scientific sources: ${sources.map(s => s.content).join('\n')}`,
    config: { systemInstruction: "Provide a concise, academic summary of the mechanistic landscape. Focus on what is being measured and what is causing the effects." }
  });
  return response.text || "";
};

export const extractCausalScaffold = async (input: string): Promise<CausalGraphData> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract a mechanistic causal graph (nodes and edges) from this research text. Focus on interventions, variables, and outcomes. RESEARCH: "${input}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                id: { type: Type.STRING }, 
                label: { type: Type.STRING }, 
                type: { type: Type.STRING, enum: ['variable', 'outcome', 'intervention'] } 
              },
              required: ['id', 'label', 'type']
            } 
          },
          edges: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                source: { type: Type.STRING }, 
                target: { type: Type.STRING }, 
                relationship: { type: Type.STRING, enum: ['positive', 'negative', 'correlative'] } 
              },
              required: ['source', 'target', 'relationship']
            } 
          }
        },
        required: ['nodes', 'edges']
      }
    }
  });
  return JSON.parse(response.text);
};

export const mergeGraphs = (base: CausalGraphData, newGraph: CausalGraphData): CausalGraphData => {
  const result: CausalGraphData = { nodes: [...base.nodes], edges: [...base.edges] };
  newGraph.nodes.forEach(n => { if (!result.nodes.find(rn => rn.id === n.id)) result.nodes.push(n); });
  newGraph.edges.forEach(e => {
    const exists = result.edges.find(re => re.source === e.source && re.target === e.target);
    if (!exists) result.edges.push(e);
  });
  return result;
};

export const expandCausalNode = async (nodeId: string, context: CausalGraphData): Promise<CausalGraphData> => {
  const ai = getClient();
  const node = context.nodes.find(n => n.id === nodeId);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Propose deeper mechanistic sub-steps for the causal node "${node?.label}" within this larger scientific context: ${JSON.stringify(context)}`,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: { 
        type: Type.OBJECT, 
        properties: { 
          nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, label: { type: Type.STRING }, type: { type: Type.STRING, enum: ['variable', 'outcome', 'intervention'] } }, required: ['id', 'label', 'type'] } }, 
          edges: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: { type: Type.STRING }, target: { type: Type.STRING }, relationship: { type: Type.STRING, enum: ['positive', 'negative', 'correlative'] } }, required: ['source', 'target', 'relationship'] } } 
        },
        required: ['nodes', 'edges']
      } 
    }
  });
  return mergeGraphs(context, JSON.parse(response.text));
};

export const runSynthesis = async (scaffold: CausalGraphData): Promise<SimulationResult> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Perform an in-silico synthesis of data based on this causal structure. Generate observed points, synthetic trends, and robustness scores. STRUCTURE: ${JSON.stringify(scaffold)}`,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: { 
        type: Type.OBJECT, 
        properties: { 
          variableName: { type: Type.STRING }, 
          statistics: { type: Type.OBJECT, properties: { pValue: { type: Type.NUMBER }, effectSize: { type: Type.NUMBER }, sampleSize: { type: Type.NUMBER } }, required: ['pValue', 'effectSize', 'sampleSize'] }, 
          doseResponseData: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, type: { type: Type.STRING } }, required: ['x', 'y', 'type'] } }, 
          bands: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, lower: { type: Type.NUMBER }, upper: { type: Type.NUMBER } }, required: ['x', 'lower', 'upper'] } }, 
          timeCourseData: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { t: { type: Type.NUMBER }, control: { type: Type.NUMBER }, treatment: { type: Type.NUMBER } }, required: ['t', 'control', 'treatment'] } }, 
          heatmapData: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { row: { type: Type.STRING }, col: { type: Type.NUMBER }, value: { type: Type.NUMBER } }, required: ['row', 'col', 'value'] } }, 
          robustness: { type: Type.OBJECT, properties: { bootstrapStability: { type: Type.NUMBER }, domainShiftResilience: { type: Type.NUMBER } }, required: ['bootstrapStability', 'domainShiftResilience'] }, 
          robustnessNarrative: { type: Type.STRING } 
        },
        required: ['variableName', 'statistics', 'doseResponseData', 'bands', 'timeCourseData', 'heatmapData', 'robustness', 'robustnessNarrative']
      } 
    }
  });
  return JSON.parse(response.text);
};

export const runVerificationGates = async (scaffold: CausalGraphData): Promise<VerificationCheck[]> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Perform a technical audit on this mechanistic model for logical inconsistencies or scientific red flags. MODEL: ${JSON.stringify(scaffold)}`,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: { 
            id: { type: Type.STRING }, 
            name: { type: Type.STRING }, 
            status: { type: Type.STRING, enum: ['Pass', 'Fail', 'Warn'] }, 
            message: { type: Type.STRING } 
          }, 
          required: ['id', 'name', 'status', 'message']
        } 
      } 
    }
  });
  return JSON.parse(response.text);
};

export const generateReviewerReport = async (scaffold: CausalGraphData, rag: any[], sim: SimulationResult): Promise<StructuredReport> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Compile a final Reviewer Mode evidence report based on this model and simulation data. MODEL: ${JSON.stringify(scaffold)}, SIM: ${JSON.stringify(sim)}`,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: { 
        type: Type.OBJECT, 
        properties: { 
          scores: { type: Type.OBJECT, properties: { validity: { type: Type.NUMBER }, reproducibility: { type: Type.NUMBER }, robustness: { type: Type.NUMBER } }, required: ['validity', 'reproducibility', 'robustness'] }, 
          summary: { type: Type.STRING }, 
          claims: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { claim: { type: Type.STRING }, verdict: { type: Type.STRING, enum: ['Supported', 'Disputed', 'Pending'] }, citation: { type: Type.STRING } }, required: ['claim', 'verdict', 'citation'] } }, 
          protocolDiffs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stepId: { type: Type.STRING }, original: { type: Type.STRING }, corrected: { type: Type.STRING }, rationale: { type: Type.STRING } }, required: ['stepId', 'original', 'corrected', 'rationale'] } }, 
          artifacts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING, enum: ['code', 'dataset', 'report'] }, size: { type: Type.STRING } }, required: ['name', 'type', 'size'] } } 
        },
        required: ['scores', 'summary', 'claims', 'protocolDiffs', 'artifacts']
      } 
    }
  });
  return JSON.parse(response.text);
};

export const speakText = async (text: string): Promise<Uint8Array> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Narrate concisely: ${text}` }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
  });
  const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("Audio synthesis failed.");
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const editScientificImage = async (base64: string, prompt: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ inlineData: { data: base64, mimeType: 'image/png' } }, { text: prompt }] }
  });
  const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  return `data:image/png;base64,${data}`;
};
