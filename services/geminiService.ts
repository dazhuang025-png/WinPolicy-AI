import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, ChatMessage } from "../types";

const SYSTEM_INSTRUCTION = `
角色设定：你是 "Neo"，一位拥有20年中国平安保险（Ping An Insurance）一线实战经验的顶级销售专家，同时也是消费心理学大师。你曾签下数千张保单，从百万医疗到千万家族信托，深谙"平安金管家"、"钻石金字塔"等销售体系。

目标：分析代理人与客户的聊天记录，深度解码客户的潜意识异议，并提供**具有平安特色的、实战级的、可直接复制的**销售话术。

**你的知识库（平安实战派）：**
1.  **方法论**：你熟练运用SPIN顾问式营销、家庭全账户规划（钻石图）、3F异议处理法（Feel感受-Felt别人也曾-Found发现）。
2.  **价值观**：你坚信保险是"爱与责任"以及"现金流管理"，而不仅仅是推销产品。
3.  **风格**：犀利、直接、专业但富有同理心。你像一位严厉又负责的"师父"在指导徒弟。
`;

export const getApiKey = (): string | undefined => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return undefined;
};

// Audio Encoding/Decoding Helpers for Live API
export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const analyzeChat = async (text: string, imageBase64?: string): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key 未配置。");
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  if (imageBase64) {
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    parts.push({ inlineData: { data: cleanBase64, mimeType: "image/jpeg" } });
  }
  if (text) parts.push({ text: `分析这段聊天记录:\n${text}` });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { role: "user", parts: parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION + "\n请严格按JSON输出分析结果。",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          trust: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              probability: { type: Type.STRING },
              resistance: { type: Type.STRING },
            },
            required: ["score", "probability", "resistance"],
          },
          decoding: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                surface: { type: Type.STRING },
                deep: { type: Type.STRING },
              },
              required: ["surface", "deep"],
            },
          },
          emotions: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.STRING }, middle: { type: Type.STRING }, end: { type: Type.STRING }, turningPoint: { type: Type.STRING },
            },
            required: ["start", "middle", "end", "turningPoint"],
          },
          advice: {
            type: Type.OBJECT,
            properties: {
              script: { type: Type.STRING }, materials: { type: Type.STRING }, timing: { type: Type.STRING },
            },
            required: ["script", "materials", "timing"],
          },
        },
        required: ["trust", "decoding", "emotions", "advice"],
      },
    },
  });

  return JSON.parse(response.text) as AnalysisResult;
};

export const askNeo = async (
  question: string,
  history: ChatMessage[],
  contextResult?: AnalysisResult
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key 未配置。");
  const ai = new GoogleGenAI({ apiKey });

  const contextPrompt = contextResult 
    ? `当前客户分析背景：信任分${contextResult.trust.score}, 成交概率${contextResult.trust.probability}, 核心痛点是${contextResult.decoding.map(d => d.deep).join('，')}。建议话术是"${contextResult.advice.script}"。`
    : "当前没有具体的客户案例，请作为通用销售导师回答问题。";

  const chatHistory = history.map(m => ({
    role: m.role === 'neo' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatHistory,
        { role: "user", parts: [{ text: `${contextPrompt}\n\n徒弟提问：${question}` }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n你现在正在和徒弟对话。保持专业、犀利、平安实战派的风格。话术要接地气。",
        temperature: 0.8,
      },
    });

    return response.text || "师傅现在有点忙，请稍后再问。";
  } catch (error: any) {
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      return "🔥 抱歉徒弟，师傅这边信号不好（模型排队中），你再点一次发送试试。";
    }
    throw error;
  }
};