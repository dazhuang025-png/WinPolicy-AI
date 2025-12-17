import React, { useState, useRef, useEffect } from 'react';
import { analyzeChat } from './services/geminiService';
import { AnalysisResult, LoadingState } from './types';
import Dashboard from './components/Dashboard';
import { Send, Upload, X, Bot, Sparkles, Trash2, History, ChevronRight, Clock, Lock, KeyRound, ShieldCheck, LogOut } from 'lucide-react';

// Wrapper type for history items
interface HistoryItem {
  id: string;
  timestamp: number;
  preview: string;
  result: AnalysisResult;
}

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // App State
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history and auth state
  useEffect(() => {
    // Check Auth
    const isUnlocked = localStorage.getItem('neo_app_unlocked');
    if (isUnlocked === 'true') {
      setIsAuthenticated(true);
    }

    // Check History
    const saved = localStorage.getItem('sales_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === 'xiuxiu') {
      setIsAuthenticated(true);
      setAuthError(false);
      localStorage.setItem('neo_app_unlocked', 'true');
    } else {
      setAuthError(true);
      // Reset error animation after a bit
      setTimeout(() => setAuthError(false), 500);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('neo_app_unlocked');
    setPasswordInput('');
    setShowHistory(false);
  };

  const saveToHistory = (data: AnalysisResult, textPreview: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      preview: textPreview.slice(0, 30) || "图片分析案例",
      result: data
    };
    const newHistory = [newItem, ...history].slice(0, 20); // Keep last 20
    setHistory(newHistory);
    localStorage.setItem('sales_history', JSON.stringify(newHistory));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText && !selectedImage) return;

    setLoadingState(LoadingState.ANALYZING);
    setError(null);
    setResult(null);
    setShowHistory(false); // Close history if open

    try {
      const data = await analyzeChat(inputText, selectedImage || undefined);
      setResult(data);
      saveToHistory(data, inputText);
      setLoadingState(LoadingState.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "分析对话失败，请重试。");
      setLoadingState(LoadingState.ERROR);
    }
  };

  const clearAll = () => {
    setInputText('');
    setSelectedImage(null);
    setResult(null);
    setError(null);
    setLoadingState(LoadingState.IDLE);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setResult(item.result);
    setLoadingState(LoadingState.SUCCESS);
    setShowHistory(false);
    setInputText(''); 
    setSelectedImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('sales_history', JSON.stringify(newHistory));
  };

  // --- LOCK SCREEN RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 via-slate-900 to-slate-900"></div>
             <div className="relative z-10 flex justify-center mb-4">
               <div className="bg-slate-800 p-3 rounded-full border-2 border-slate-700 shadow-lg">
                 <ShieldCheck className="w-8 h-8 text-blue-400" />
               </div>
             </div>
             <h2 className="text-xl font-bold text-white relative z-10">AI 展业大脑</h2>
             <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest relative z-10">Internal Access Only</p>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">
                  身份验证密码
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none transition-all
                      ${authError 
                        ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 animate-pulse text-red-600' 
                        : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800'
                      }`}
                    placeholder="请输入访问口令"
                  />
                </div>
                {authError && (
                  <p className="text-red-500 text-xs mt-2 ml-1 animate-in slide-in-from-left-2">
                    口令错误，请重试
                  </p>
                )}
              </div>
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                解锁系统 <ChevronRight className="w-4 h-4" />
              </button>
            </form>
            <p className="text-center text-[10px] text-slate-300 mt-6">
              Powered by Gemini 2.5 • 平安精英实战版
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 pb-safe">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 safe-top shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => {setResult(null); setLoadingState(LoadingState.IDLE);}} role="button">
            <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">AI 展业大脑</h1>
              <p className="text-[10px] text-slate-500 font-medium leading-none">一键成交系统</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <span className="bg-orange-50 text-orange-700 text-xs px-3 py-1 rounded-full font-semibold border border-orange-100 shadow-sm">
                平安精英实战版
              </span>
            </div>
            
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors relative ${showHistory ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
              title="历史战绩"
            >
              <History className="w-5 h-5" />
              {history.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              )}
            </button>

            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
              title="锁定屏幕"
            >
              <Lock className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* History Slide-over/Drawer - Mobile Optimized */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
           
           {/* Drawer */}
           <div className="relative w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 pt-safe-top">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4" /> 历史战绩
                </h3>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-200 rounded-full -mr-2">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                {history.length === 0 ? (
                  <div className="text-center text-slate-400 py-10">
                    <p>暂无历史记录</p>
                    <p className="text-xs mt-1">快去分析第一单吧！</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadHistoryItem(item)}
                      className="bg-white border border-slate-200 rounded-xl p-3 active:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer group relative shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                           item.result.trust.resistance === 'Green' ? 'bg-green-100 text-green-700' :
                           item.result.trust.resistance === 'Yellow' ? 'bg-yellow-100 text-yellow-700' :
                           'bg-red-100 text-red-700'
                        }`}>
                          信任分: {item.result.trust.score}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium line-clamp-2 mb-2">
                        "{item.preview}"
                      </p>
                      <div className="flex justify-between items-center border-t border-slate-50 pt-2 mt-2">
                         <span className="text-xs text-blue-600 flex items-center">
                            查看策略 <ChevronRight className="w-3 h-3 ml-1" />
                         </span>
                         <button 
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded -mb-1 -mr-1"
                            title="删除"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-20">
        
        {/* Intro Text - Hide on mobile if result exists to save space */}
        {loadingState === LoadingState.IDLE && !result && (
          <div className="mb-6 text-center max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
              洞察人性 · 锁定保单
            </h2>
            <p className="text-slate-600 text-sm sm:text-lg px-4">
              上传聊天记录，深度解码客户心理，定制<b>平安销冠</b>话术。
            </p>
          </div>
        )}

        {/* Input Section - Mobile Optimized */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1 mb-6 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 relative group">
          <textarea
            className="w-full p-4 min-h-[140px] outline-none text-slate-700 text-base resize-y rounded-t-xl bg-transparent placeholder:text-slate-400"
            placeholder="在此粘贴微信聊天记录..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ fontSize: '16px' }} // Prevent iOS zoom
          />

           {/* Clear Button */}
           {(inputText || selectedImage) && (
            <button 
              onClick={clearAll}
              className="absolute top-2 right-2 p-2 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
              title="一键清空"
            >
              <Trash2 className="w-4 h-4" />
            </button>
           )}
          
          {selectedImage && (
            <div className="px-4 pb-4">
              <div className="relative inline-block">
                <img 
                  src={selectedImage} 
                  alt="Chat Screenshot" 
                  className="h-32 w-auto rounded-lg border border-slate-200 object-cover"
                />
                <button 
                  onClick={() => {setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value='';}}
                  className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1.5 shadow-md z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium active:bg-slate-200"
              >
                <Upload className="w-5 h-5" />
                <span className="hidden sm:inline">上传截图</span>
              </button>
            </div>
            
            <button
              onClick={handleAnalyze}
              disabled={loadingState === LoadingState.ANALYZING || (!inputText && !selectedImage)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all active:scale-95
                ${loadingState === LoadingState.ANALYZING || (!inputText && !selectedImage)
                  ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
                }`}
            >
              {loadingState === LoadingState.ANALYZING ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">AI 运算中...</span>
                  <span className="sm:hidden">分析中...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">一键生成策略</span>
                  <span className="sm:hidden">生成策略</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 mb-8 flex items-center gap-3 animate-in fade-in">
             <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
             <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Dashboard Results */}
        {result && (
          <div className="mb-20 animate-in slide-in-from-bottom-2 duration-500">
            <Dashboard data={result} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;