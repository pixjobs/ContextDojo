import { GoogleGenAI, Type } from "@google/genai";
import { BrainResponse, ChatMessage, ConversationMode, GraphUpdate } from "../types";

let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (aiClient) return aiClient;
  
  aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return aiClient;
}

const SYSTEM_INSTRUCTION = `
You are ContextDojo, a professional conversational skills coach.

LANGUAGE PROTOCOLS:
1. **Response Generation**: Respond in the SAME language the User is speaking.
2. **Translation (CRITICAL)**: You must provide a strict ENGLISH translation for the transcript fields in the JSON output.

If the input/output is already English, copy it exactly.
If the input/output is German (or other), TRANSLATE IT.

Output strictly valid JSON.
`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reply_text: {
      type: Type.STRING,
      description: "The spoken response by the roleplay character (in User's language).",
    },
    english_user_translation: {
      type: Type.STRING,
      description: "STRICT ENGLISH TRANSLATION of the User's input.",
    },
    english_agent_translation: {
      type: Type.STRING,
      description: "STRICT ENGLISH TRANSLATION of the Agent's response.",
    },
    coach_guidance: {
      type: Type.STRING,
      description: "Brief meta-feedback on communication style (in English).",
      nullable: true,
    },
    key_concept: {
      type: Type.STRING,
      description: "Key topic/noun discussed (max 3 words, in English).",
      nullable: true,
    },
  },
  required: ["english_user_translation", "english_agent_translation"],
};

export const generateDojoResponse = async (
  userText: string,
  history: ChatMessage[],
  mode: ConversationMode
): Promise<BrainResponse> => {
  try {
    const ai = getAiClient();
    const context = history.map(h => `${h.role === 'user' ? 'User' : 'Roleplay Persona'}: ${h.text}`).join('\n');
    
    const modePrompt = mode === 'adaptive' 
        ? "Determine the mode automatically based on context." 
        : `CURRENT MODE: ${mode?.toUpperCase()}`;

    const prompt = `
    ${modePrompt}
    
    Conversation History:
    ${context}
    
    User's Latest Input: "${userText}"
    
    Task:
    1. Translate the User's input to English (english_user_translation).
    2. Generate a response in the User's language (reply_text).
    3. Translate your response to English (english_agent_translation).
    4. Extract key concept and guidance.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini Interaction Failed:", error);
    return getFallbackResponse(userText, "");
  }
};

export const analyzeInteraction = async (
  userText: string,
  agentText: string,
  history: ChatMessage[],
  mode: ConversationMode
): Promise<BrainResponse> => {
  try {
     const ai = getAiClient();
     
     const prompt = `
     The user and the roleplay agent have just exchanged the following:
     User: "${userText}"
     Agent: "${agentText}"
     
     Task:
     1. Translate User's text to English (english_user_translation).
     2. Translate Agent's text to English (english_agent_translation).
     3. Provide 'coach_guidance' (IN ENGLISH).
     4. Extract 'key_concept' (IN ENGLISH).
     
     NOTE: Leave 'reply_text' empty.
     `;
 
     const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: prompt,
       config: {
         systemInstruction: SYSTEM_INSTRUCTION,
         responseMimeType: "application/json",
         responseSchema: responseSchema,
         temperature: 0.1,
       }
     });
 
     const text = response.text;
     if (!text) throw new Error("Empty response from Gemini");
 
     return JSON.parse(text);
 
   } catch (error) {
     console.error("Gemini Analysis Failed:", error);
     return getFallbackResponse(userText, agentText);
   }
};

// --- NEW SMART GRAPH SERVICE ---

export const generateGraphUpdates = async (
    latestExchange: string,
    existingNodeLabels: string[]
): Promise<GraphUpdate> => {
    try {
        const ai = getAiClient();
        // Limit context to strictly the last few nodes to avoid token confusion and focus relevance
        const recentNodes = existingNodeLabels.slice(-10).join(', ');

        const prompt = `
        You are a Conversation Mapper.
        
        CONTEXT (Recent Nodes): [${recentNodes}]
        LATEST EXCHANGE: "${latestExchange}"
        
        TASK:
        1. Identify the **Primary Topic** actually discussed in the exchange (Status: 'active').
        2. Identify 2-3 **Potential Avenues** or tangent topics derived from this Primary Topic that would be interesting to explore next (Status: 'potential').
        
        RULES:
        - Labels must be concise (1-3 words).
        - 'parent': Match strictly to one of the [Recent Nodes]. If no good match, use 'Context'.
        - 'type': 'concept', 'entity', 'action', 'emotion'.
        - 'description': A short, 1-sentence hint on what to discuss or why this topic is relevant.
        
        OUTPUT JSON ONLY.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
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
                                    label: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['concept', 'entity', 'action', 'emotion'] },
                                    status: { type: Type.STRING, enum: ['active', 'potential'] },
                                    parent: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ['label', 'type', 'status', 'parent', 'description']
                            }
                        }
                    }
                },
                temperature: 0.3, 
            }
        });
        
        return JSON.parse(response.text || "{ \"nodes\": [] }");
    } catch (e) {
        console.warn("Graph Gen Failed", e);
        return { nodes: [] };
    }
}

// Deprecated
export const extractKeyConceptFast = async (userText: string): Promise<string | null> => {
    return null; 
}

function getFallbackResponse(userText: string, agentText: string): BrainResponse {
    return {
        reply_text: "",
        english_user_translation: userText,
        english_agent_translation: agentText,
        coach_guidance: null,
        key_concept: null
    };
}