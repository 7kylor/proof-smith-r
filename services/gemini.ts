
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CausalGraphData, RAGSource, SimulationResult, CausalNode, VerificationCheck, StructuredReport } from "../types";

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const mergeGraphs = (base: CausalGraphData, newGraph: CausalGraphData): CausalGraphData => {
  const result: CausalGraphData = { 
    nodes: (base.nodes || []).map(n => ({...n})), 
    edges: (base.edges || []).map(e => ({...e})) 
  };

  const findNode = (label: string) => result.nodes.find(n => n.label.toLowerCase() === label.toLowerCase());
  const idMap = new Map<string, string>();

  (newGraph.nodes || []).forEach(n => {
    const existing = findNode(n.label);
    if (existing) {
      idMap.set(n.id, existing.id);
    } else {
      const newId = `merged_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap.set(n.id, newId);
      result.nodes.push({ ...n, id: newId });
    }
  });

  (newGraph.edges || []).forEach(e => {
    const sourceId = idMap.get(e.source);
    const targetId = idMap.get(e.target);
    
    if (sourceId && targetId) {
      const exists = result.edges.some(edge => 
        edge.source === sourceId && edge.target === targetId
      );
      if (!exists) {
        result.edges.push({ ...e, source: sourceId, target: targetId });
      }
    }
  });

  return result;
};

export const extractCausalScaffold = async (input: string): Promise<CausalGraphData> => {
  const ai = getClient();
  const prompt = `Analyze text and construct a Causal Structural Model. Text: "${input.substring(0, 4000)}"`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
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
                }
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
                }
              }
            }
          }
        }
      }
    });
    const parsed = JSON.parse(response.text);
    return {
      nodes: parsed.nodes || [],
      edges: parsed.edges || []
    } as CausalGraphData;
  } catch (e) {
    console.error("Extraction failed", e);
    throw e;
  }
};

/**
 * DEEP THINKING MODE
 * Uses gemini-3-pro-preview with max thinking budget for complex causal reasoning.
 */
export const deepReasonMechanism = async (nodeLabel: string, context: CausalGraphData): Promise<string> => {
  const ai = getClient();
  const prompt = `Perform a deep mechanistic analysis of the causal role of "${nodeLabel}" within this system: ${JSON.stringify(context)}. 
  Explore non-linearities, hidden confounders, and feedback loops. Provide a rigorous scientific explanation.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    return response.text || "Could not generate deep reasoning.";
  } catch (e) {
    console.error("Deep Thinking failed", e);
    return "Error during deep reasoning session.";
  }
};

/**
 * NODE EXPANSION
 * Uses gemini-3-flash-preview to discover and add related causal variables.
 */
export const expandCausalNode = async (nodeId: string, context: CausalGraphData): Promise<CausalGraphData> => {
  const node = context.nodes.find(n => n.id === nodeId);
  if (!node) return context;

  const ai = getClient();
  const prompt = `Given the current causal model: ${JSON.stringify(context)}, expand the scientific understanding around the variable "${node.label}". 
  Identify 2-3 additional upstream or downstream biological/physical variables and their relationship types. 
  Output as JSON representing the sub-graph.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
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
                }
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
                }
              }
            }
          }
        }
      }
    });
    const parsed = JSON.parse(response.text) as CausalGraphData;
    return mergeGraphs(context, parsed);
  } catch (e) {
    console.error("Node expansion failed", e);
    return context;
  }
};

/**
 * SEARCH GROUNDING
 * Uses gemini-3-flash-preview with googleSearch tool.
 */
export const performCalibratedRAG = async (query: string): Promise<RAGSource[]> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Retrieve and evaluate the latest scientific evidence for: ${query}. Focus on peer-reviewed literature and recent news.`,
      config: { tools: [{ googleSearch: {} }] }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources = chunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, url: c.web.uri }));
    
    if (webSources.length === 0) return [];

    const calib = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Calibrate these sources for rigorous scientific research: ${JSON.stringify(webSources)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              url: { type: Type.STRING },
              snippet: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
              confidenceReason: { type: Type.STRING },
              methodQuality: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
            }
          }
        }
      }
    });
    return JSON.parse(calib.text) || [];
  } catch (e) {
    return [];
  }
};

/**
 * TEXT TO SPEECH
 * Uses gemini-2.5-flash-preview-tts for scientific narration.
 */
export const speakText = async (text: string): Promise<Uint8Array> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this scientific summary clearly and authoritatively: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");
  
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * NANO BANANA IMAGE EDITING
 * Uses gemini-2.5-flash-image for scientific visualization editing.
 */
export const editScientificImage = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/png' } },
        { text: prompt },
      ],
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part?.inlineData?.data) throw new Error("Image generation failed");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const runSynthesis = async (scaffold: CausalGraphData): Promise<SimulationResult> => {
  const ai = getClient();
  const prompt = `Synthesize mechanistic validation data and counterfactuals for the following causal model: ${JSON.stringify(scaffold)}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { variableName: { type: Type.STRING }, robustness: { type: Type.OBJECT, properties: { bootstrapStability: { type: Type.NUMBER }, domainShiftResilience: { type: Type.NUMBER }, leaveOneOutScore: { type: Type.NUMBER }, identifiability: { type: Type.STRING, enum: ['Strong', 'Weak', 'None'] } } }, robustnessNarrative: { type: Type.STRING }, doseResponseData: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, type: { type: Type.STRING, enum: ["Observed", "Synthetic", "Counterfactual"] } } } }, bands: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, lower: { type: Type.NUMBER }, upper: { type: Type.NUMBER } } } }, timeCourseData: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { t: { type: Type.NUMBER }, control: { type: Type.NUMBER }, treatment: { type: Type.NUMBER } } } }, heatmapData: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { row: { type: Type.STRING }, col: { type: Type.NUMBER }, value: { type: Type.NUMBER } } } }, statistics: { type: Type.OBJECT, properties: { pValue: { type: Type.NUMBER }, effectSize: { type: Type.NUMBER }, sampleSize: { type: Type.NUMBER } } } } } }
    });
    return JSON.parse(response.text) as SimulationResult;
  } catch (e) {
    throw e;
  }
};

export const runVerificationGates = async (scaffold: CausalGraphData): Promise<VerificationCheck[]> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Audit this model for logical consistency and scientific plausibility: ${JSON.stringify(scaffold)}`,
    config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, status: { type: Type.STRING, enum: ['Pass', 'Fail', 'Warn'] }, message: { type: Type.STRING } } } } }
  });
  return JSON.parse(response.text) || [];
};

export const generateReviewerReport = async (scaffold: CausalGraphData, ragSources: RAGSource[], simulation: SimulationResult): Promise<StructuredReport> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Compile a final evidence-bound report for the following scientific model. Model: ${JSON.stringify(scaffold)}, Literature: ${JSON.stringify(ragSources)}, Sim: ${JSON.stringify(simulation)}`,
    config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { scores: { type: Type.OBJECT, properties: { validity: { type: Type.NUMBER }, reproducibility: { type: Type.NUMBER }, robustness: { type: Type.NUMBER } } }, protocolDiffs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stepId: { type: Type.STRING }, original: { type: Type.STRING }, corrected: { type: Type.STRING }, rationale: { type: Type.STRING } } } }, claims: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, claim: { type: Type.STRING }, verdict: { type: Type.STRING, enum: ['Supported', 'Disputed', 'Pending'] }, confidence: { type: Type.NUMBER }, citation: { type: Type.STRING } } } }, artifacts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING, enum: ['code', 'dataset', 'json', 'figure'] }, size: { type: Type.STRING }, url: { type: Type.STRING }, content: { type: Type.STRING } } } }, summary: { type: Type.STRING } } } }
  });
  return JSON.parse(response.text);
};
