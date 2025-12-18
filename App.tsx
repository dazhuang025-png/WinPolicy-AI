import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { analyzeChat, askNeo, getApiKey, encodeAudio, decodeAudio, decodeAudioData } from './services/geminiService';
import { AnalysisResult, LoadingState, ChatMessage } from './types';
import Dashboard from './components/Dashboard';
import { 
  Send, 
  Upload, 
  X, 
  Bot, 
  History, 
  Lock, 
  ShieldCheck, 
  User, 
  Loader2, 
  Sword, 
  Users,
  MessageSquareText,
  Trash2,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Info
} from 'lucide-react';

interface HistoryItem {
  id: string;
  timestamp: number;
  preview: string;
  result: AnalysisResult;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [activeTab, setActiveTab] = useState<'COMBAT' | 'PARTNER'>('COMBAT');

  // Voice State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Analysis State
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Chat State
  const [mentorMessages, setMentorMessages] = useState<ChatMessage[]>([{
    id: 'partner-welcome',
    role: 'neo',
    content: '嫂夫人好，我是 Neo。今天在外面跑业务辛苦了，请问我有什么可以帮您，随时为您效劳。'
  }]);
  const [combatMessages, setCombatMessages] = useState<ChatMessage[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isUnlocked = localStorage.getItem('neo_app_unlocked');
    if (isUnlocked === 'true') setIsAuthenticated(true);
    const saved = localStorage.getItem('sales_history');
    if (saved) { try { setHistory(JSON.parse(saved)); } catch (e) {} }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mentorMessages, combatMessages, isAsking, activeTab]);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === 'xiuxiu') {
      setIsAuthenticated(true);
      localStorage.setItem('neo_app_unlocked', 'true');
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 500);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('neo_app_unlocked');
  };

  // --- Voice Connection Logic ---
  const startVoiceCall = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("API Key 未配置");
      return;
    }

    try {
      setIsVoiceActive(true);
      const ai = new GoogleGenAI({ apiKey });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encodeAudio(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: any) => {
            if (message.serverContent?.outputTranscription) {
              setMentorMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'neo' && last.id.startsWith('live-')) {
                   return [...prev.slice(0, -1), { ...last, content: last.content + message.serverContent.outputTranscription.text }];
                }
                return [...prev, { id: 'live-' + Date.now(), role: 'neo', content: message.serverContent.outputTranscription.text }];
              });
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), outputAudioContextRef.current, 24000, 1);
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContextRef.current.destination);
              source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => console.error("Live Error:", e),
          onclose: () => stopVoiceCall()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          outputAudioTranscription: {},
          systemInstruction: "你是 Neo，一位非常敬重、绅士且专业的展业伙伴。你正在和嫂夫人（保险业务员）进行通话。语气要极其得体、恭敬且专业，直接给出实用的建议和鼓励。你是她的得力助手，随时听候调遣。"
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsVoiceActive(false);
    }
  };

  const stopVoiceCall = () => {
    if (liveSessionRef.current) {
      try { liveSessionRef.current.close(); } catch (e) {}
      liveSessionRef.current = null;
    }
    audioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    setIsVoiceActive(false);
  };

  const handleAnalyze = async () => {
    if (!inputText && !selectedImage) return;
    setLoadingState(LoadingState.ANALYZING);
    setError(null);
    setResult(null);
    setCombatMessages([]);
    try {
      const data = await analyzeChat(inputText, selectedImage || undefined);
      setResult(data);
      saveToHistory(data, inputText);
      setLoadingState(LoadingState.SUCCESS);
      setCombatMessages([{
        id: 'welcome',
        role: 'neo',
        content: `分析完了。阻力：${data.trust.resistance}，潜台词：${data.decoding[0]?.deep}。试试我的话术。`
      }]);
    } catch (err: any) {
      setError(err.message || "分析失败");
      setLoadingState(LoadingState.ERROR);
    }
  };

  const handleAskNeo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userQuestion.trim() || isAsking) return;
    const question = userQuestion;
    setUserQuestion('');
    const newMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: question };
    if (activeTab === 'COMBAT') setCombatMessages(prev => [...prev, newMessage]);
    else setMentorMessages(prev => [...prev, newMessage]);
    setIsAsking(true);
    try {
      const context = activeTab === 'COMBAT' ? (result || undefined) : undefined;
      const historyToUse = activeTab === 'COMBAT' ? combatMessages : mentorMessages;
      const answer = await askNeo(question, historyToUse, context);
      const newNeoMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'neo', content: answer };
      if (activeTab === 'COMBAT') setCombatMessages(prev => [...prev, newNeoMsg]);
      else setMentorMessages(prev => [...prev, newNeoMsg]);
    } catch (err: any) { setError("伙伴 Neo 掉线了，稍后再试。"); } finally { setIsAsking(false); }
  };

  const saveToHistory = (data: AnalysisResult, textPreview: string) => {
    const newItem = { id: Date.now().toString(), timestamp: Date.now(), preview: textPreview.slice(0, 30) || "案例分析", result: data };
    const newHistory = [newItem, ...history].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem('sales_history', JSON.stringify(newHistory));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setResult(item.result);
    setLoadingState(LoadingState.SUCCESS);
    setActiveTab('COMBAT');
    setShowHistory(false);
    setCombatMessages([{ id: 'history-welcome', role: 'neo', content: `这是之前的案例，有什么新动态吗？` }]);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-8 text-center">
             <ShieldCheck className="w-8 h-8 text-blue-400 mx-auto mb-4" />
             <h2 className="text-xl font-bold text-white tracking-tight">AI 展业大脑</h2>
          </div>
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none transition-all ${authError ? 'border-red-500 animate-shake' : 'border-slate-200 focus:border-blue-500'}`} placeholder="请输入口令" />
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">解锁展业助手</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 safe-top shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-slate-900 p-1 rounded-lg">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-900">AI 展业大脑</h1>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowHistory(true)} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><History className="w-5 h-5" /></button>
              <button onClick={handleLogout} className="p-2 text-slate-400 rounded-lg hover:bg-slate-100"><Lock className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button onClick={() => { stopVoiceCall(); setActiveTab('COMBAT'); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'COMBAT' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}><Sword className="w-4 h-4" /> 案例实战</button>
             <button onClick={() => setActiveTab('PARTNER')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'PARTNER' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}><Users className="w-4 h-4" /> 展业伙伴</button>
          </div>
        </div>
      </header>

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
           <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
           <div className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-right duration-300">
              <h3 className="font-bold mb-6 text-slate-900">历史战绩</h3>
              <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                {history.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-sm">暂无记录</div>
                ) : history.map(h => (
                  <div key={h.id} onClick={() => loadHistoryItem(h)} className="p-3 border rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                    <p className="text-sm font-medium line-clamp-2 text-slate-700 group-hover:text-blue-600">"{h.preview}"</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{new Date(h.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { setHistory([]); localStorage.removeItem('sales_history'); }} className="mt-4 text-red-500 text-sm py-3 border border-red-100 rounded-xl hover:bg-red-50 transition-colors">清空历史</button>
           </div>
        </div>
      )}

      {/* Voice Call Overlay */}
      {isVoiceActive && (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col items-center justify-center p-8 transition-all">
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl animate-pulse rounded-full"></div>
            <div className="relative w-48 h-48 rounded-full bg-slate-800 flex items-center justify-center border-4 border-slate-700 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="w-full h-full bg-gradient-to-t from-blue-500 to-transparent animate-pulse"></div>
              </div>
              <Bot className="w-16 h-16 text-blue-400 relative z-10" />
            </div>
          </div>
          
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-2">正在为嫂夫人连线 Neo</h2>
            <div className="flex items-center justify-center gap-1.5 text-blue-400 text-sm">
               <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
               实时对谈中...
            </div>
            <p className="mt-8 text-slate-500 text-xs flex items-center justify-center gap-1">
              <Info className="w-3 h-3" /> 语音模式消耗额度较多，建议按需使用
            </p>
          </div>

          <div className="flex gap-6">
            <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
               {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button onClick={stopVoiceCall} className="p-5 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700 active:scale-90 transition-all">
               <PhoneOff className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {activeTab === 'COMBAT' ? (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1">
                <textarea className="w-full p-4 min-h-[120px] outline-none text-slate-700 text-base resize-none" placeholder="粘贴聊天记录或上传截图，Neo 帮你拆解..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
                {selectedImage && <div className="px-4 pb-2"><img src={selectedImage} className="h-24 rounded-lg border shadow-sm" /></div>}
                <div className="flex justify-between items-center p-3 border-t bg-slate-50/50 rounded-b-2xl">
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"><Upload className="w-5 h-5" />上传</button>
                  <button onClick={handleAnalyze} disabled={loadingState === LoadingState.ANALYZING || (!inputText && !selectedImage)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all">
                    {loadingState === LoadingState.ANALYZING ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sword className="w-4 h-4" />}
                    开始攻单
                  </button>
                  <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = () => setSelectedImage(r.result as string); r.readAsDataURL(f); }
                  }} />
                </div>
              </div>
              {result && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                  <Dashboard data={result} />
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-900 px-6 py-4 flex items-center gap-3"><Bot className="w-6 h-6 text-blue-400" /><h3 className="text-white font-bold text-sm">针对本案咨询</h3></div>
                    <div className="p-6 max-h-[400px] overflow-y-auto space-y-6 bg-slate-50/50">
                        {combatMessages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none shadow-sm'}`}>{msg.content}</div>
                          </div>
                        ))}
                        {isAsking && <div className="flex items-center gap-2 text-slate-400 text-xs px-2"><Loader2 className="w-3 h-3 animate-spin" /> Neo 正在打字...</div>}
                        <div ref={chatEndRef} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full pb-12">
               <div className="flex items-center justify-between mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-2xl shadow-lg text-white">
                 <div>
                   <h3 className="font-bold flex items-center gap-2 text-lg"><Users className="w-5 h-5" /> 展业伙伴</h3>
                   <p className="text-[10px] text-blue-100 opacity-80 uppercase tracking-[0.2em]">Sales Partner Engine</p>
                 </div>
                 <button onClick={startVoiceCall} className="bg-white/20 hover:bg-white/30 p-3 rounded-full transition-all active:scale-90 shadow-inner">
                    <Phone className="w-6 h-6" />
                 </button>
               </div>

               <div className="flex-1 overflow-y-auto space-y-6 pb-6 no-scrollbar min-h-[400px]">
                  {mentorMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-900' : 'bg-white border border-slate-100'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-slate-700" />}
                          </div>
                          <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-100 rounded-tl-none text-slate-700'}`}>{msg.content}</div>
                       </div>
                    </div>
                  ))}
                  {isAsking && <div className="flex items-center gap-2 text-slate-400 text-xs px-12"><Loader2 className="w-3 h-3 animate-spin" /> Neo 正在组织语言...</div>}
                  <div ref={chatEndRef} />
               </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 p-4 pb-safe sticky bottom-0 z-40">
        <div className="max-w-4xl mx-auto">
           <form onSubmit={handleAskNeo} className="relative flex items-center gap-2">
              <input type="text" className="w-full pl-5 pr-12 py-3.5 bg-slate-100 border-none rounded-2xl outline-none text-sm placeholder:text-slate-400" 
                placeholder={activeTab === 'COMBAT' && !result ? "请先上传分析案例..." : "跟伙伴 Neo 聊聊..."} 
                disabled={activeTab === 'COMBAT' && !result} value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} />
              <button type="submit" disabled={!userQuestion.trim() || isAsking} className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg hover:bg-slate-800 disabled:bg-slate-200 transition-all">
                <Send className="w-5 h-5" />
              </button>
           </form>
           <p className="text-[10px] text-center text-slate-400 mt-2">文字聊天更节省 API 额度哦</p>
        </div>
      </footer>

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default App;