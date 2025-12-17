import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const SYSTEM_INSTRUCTION = `
角色设定：你是 "Neo"，一位拥有20年中国平安保险（Ping An Insurance）一线实战经验的顶级销售专家，同时也是消费心理学大师。你曾签下数千张保单，从百万医疗到千万家族信托，深谙"平安金管家"、"钻石金字塔"等销售体系。

目标：分析代理人与客户的聊天记录，深度解码客户的潜意识异议，并提供**具有平安特色的、实战级的、可直接复制的**销售话术。

**你的知识库（平安实战派）：**
1.  **方法论**：你熟练运用SPIN顾问式营销、家庭全账户规划（钻石图）、3F异议处理法（Feel感受-Felt别人也曾-Found发现）。
2.  **价值观**：你坚信保险是"爱与责任"以及"现金流管理"，而不仅仅是推销产品。
3.  **风格**：犀利、直接、专业但富有同理心。你像一位严厉又负责的"师父"在指导徒弟。

任务：分析提供的文本/图片，并严格按照JSON Schema输出。
**重要约束：所有输出字段必须严格使用简体中文（Simplified Chinese）。**

分析规则：
1.  **信任与成交温度计**：
    *   打分 (0-100)。
    *   成交概率 (低/中/高)。
    *   阻力等级 (红色警戒/黄色观望/绿色畅通)。
2.  **潜台词解码器 (核心)**：
    *   找出2-3个核心异议（如"没钱"、"我们要商量"、"对比香港保险"）。
    *   "Surface" (表象)：摘录客户原话。
    *   "Deep" (真相)：解码背后的真实恐惧。（例如：他说"太贵了"，其实是担心"流动性风险"或"对未来收入的不确定"，他需要的是交费灵活的方案，而不是简单的打折。）
3.  **情绪雷达**：
    *   追踪情绪变化 (破冰期 -> 展开期 -> 收尾期)。
    *   "Turning Point" (关键转折点)：指出哪一句话导致了客户情绪的升温或降温。
4.  **Neo 破局锦囊 (平安攻单流)**：
    *   **Script (金牌话术)**：提供一段**逐字逐句的、可直接发送的微信回复**。
        *   *约束*：绝对不要给笼统的建议（如"问问他的预算"）。
        *   *约束*：必须写出具体要发的文字。
        *   *风格*：口语化，高情商，软切入，硬着陆。
        *   *技法*：运用"假设成交法"、"痛点扩大法"或"异议隔离法"。
    *   **Materials (神助攻资料)**：建议发送的具体资料（如"平安理赔年报2024"、"30天等待期案例"、"医疗通胀图表"）。
    *   **Timing (最佳出击时机)**：精确的时间建议（如"晾他2小时，然后发..."、"明早10点，假装分享新闻..."）。
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    trust: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER, description: "0-100 信任分数" },
        probability: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
        resistance: { type: Type.STRING, enum: ["Red", "Yellow", "Green"], description: "Red=High Resistance, Green=Low" },
      },
      required: ["score", "probability", "resistance"],
    },
    decoding: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          surface: { type: Type.STRING, description: "客户原话" },
          deep: { type: Type.STRING, description: "心理层面解码" },
        },
        required: ["surface", "deep"],
      },
    },
    emotions: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.STRING, description: "开始时的情绪" },
        middle: { type: Type.STRING, description: "中间时的情绪" },
        end: { type: Type.STRING, description: "结束时的情绪" },
        turningPoint: { type: Type.STRING, description: "关键转折点话题" },
      },
      required: ["start", "middle", "end", "turningPoint"],
    },
    advice: {
      type: Type.OBJECT,
      properties: {
        script: { type: Type.STRING, description: "建议回复的微信话术 (逐字稿)" },
        materials: { type: Type.STRING, description: "建议发送的辅助资料" },
        timing: { type: Type.STRING, description: "建议发送的时间时机" },
      },
      required: ["script", "materials", "timing"],
    },
  },
  required: ["trust", "decoding", "emotions", "advice"],
};

// Helper function to safely retrieve API key from various environments
const getApiKey = (): string | undefined => {
  // 1. Try Vite environment variable (Standard for Vercel/Netlify Vite deployments)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  
  // 2. Try Standard process.env (Node.js or Webpack polyfills)
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore reference errors if process is not defined
  }

  return undefined;
};

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeChat = async (
  text: string,
  imageBase64?: string
): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("API Key 未配置。请在部署设置中添加环境变量 'VITE_API_KEY'。");
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  
  if (imageBase64) {
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: "image/jpeg",
      },
    });
  }

  if (text) {
    parts.push({ text: `分析这段聊天记录:\n${text}` });
  }

  if (parts.length === 0) {
    throw new Error("请提供聊天文字或截图。");
  }

  // Retry Loop
  let lastError: any;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          role: "user",
          parts: parts,
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // Critical for insurance context: disable safety filters to allow words like "death", "illness", "hospital"
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        },
      });

      if (response.text) {
        return JSON.parse(response.text) as AnalysisResult;
      } else {
        throw new Error("未能生成分析结果。");
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`Gemini API Attempt ${attempt} failed:`, error);

      // Check for 503 (Overloaded) or 429 (Too Many Requests) or generic "overloaded" message
      const isOverloaded = 
        error.message?.includes('503') || 
        error.message?.toLowerCase().includes('overloaded') || 
        JSON.stringify(error).includes('503');

      // If overloaded and not last attempt, wait and retry
      if (isOverloaded && attempt < maxAttempts) {
        const waitTime = attempt * 1500; // 1.5s, 3s
        console.log(`Model overloaded. Retrying in ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // If it's not an overload error, or we ran out of attempts, break loop to throw error
      break;
    }
  }

  // Format error for UI
  let friendlyMessage = "分析失败，请稍后重试。";
  
  if (lastError) {
    const errorStr = lastError.message || JSON.stringify(lastError);
    
    if (errorStr.includes('503') || errorStr.toLowerCase().includes('overloaded')) {
      friendlyMessage = "🔥 AI 大脑正在高速运转（服务器繁忙），请休息 10 秒钟再试一次！";
    } else {
       // Try to parse clean message from JSON string if possible
       try {
         if (typeof lastError.message === 'string' && lastError.message.startsWith('{')) {
            const parsed = JSON.parse(lastError.message);
            if (parsed.error?.message) {
              friendlyMessage = parsed.error.message;
            }
         } else {
            friendlyMessage = lastError.message;
         }
       } catch {
         friendlyMessage = lastError.message || "未知网络错误";
       }
    }
  }

  throw new Error(friendlyMessage);
};