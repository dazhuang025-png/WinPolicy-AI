import React from 'react';
import { AnalysisResult } from '../types';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Shield, 
  BrainCircuit, 
  Activity, 
  Lightbulb, 
  Copy,
  TrendingUp
} from 'lucide-react';

interface DashboardProps {
  data: AnalysisResult;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const getResistanceColor = (level: string) => {
    switch (level) {
      case 'Red': return 'text-red-600 bg-red-100 border-red-200';
      case 'Yellow': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Green': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 40) return 'bg-red-500';
    if (score < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Helper to translate probability if API returns English
  const translateProb = (prob: string) => {
    const map: Record<string, string> = { 'Low': '低', 'Medium': '中', 'High': '高' };
    return map[prob] || prob;
  };

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto animate-in fade-in duration-700">
      
      {/* Section 1: Trust Thermometer */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="flex items-center text-lg font-bold text-slate-800 mb-4">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          信任与成交温度计
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="col-span-2">
            <div className="flex justify-between text-sm font-medium text-slate-500 mb-1">
              <span>信任指数</span>
              <span>{data.trust.score} 分</span>
            </div>
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${getScoreColor(data.trust.score)}`} 
                style={{ width: `${data.trust.score}%` }}
              ></div>
            </div>
          </div>
          <div className="flex flex-col space-y-2">
             <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
                <span className="text-xs text-slate-500 uppercase tracking-wider">成交概率</span>
                <span className="font-bold text-slate-700">{translateProb(data.trust.probability)}</span>
             </div>
             <div className={`flex justify-between items-center px-3 py-2 rounded-lg border ${getResistanceColor(data.trust.resistance)}`}>
                <span className="text-xs uppercase tracking-wider font-semibold">阻力等级</span>
                <div className="flex items-center gap-1 font-bold">
                  {data.trust.resistance === 'Red' && <ShieldAlert className="w-4 h-4" />}
                  {data.trust.resistance === 'Yellow' && <Shield className="w-4 h-4" />}
                  {data.trust.resistance === 'Green' && <ShieldCheck className="w-4 h-4" />}
                  {data.trust.resistance === 'Red' ? '红色警戒' : data.trust.resistance === 'Yellow' ? '黄色观望' : '绿色畅通'}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Section 2: Deep Decoder */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="flex items-center text-lg font-bold text-slate-800 mb-6">
          <BrainCircuit className="w-5 h-5 mr-2 text-purple-600" />
          潜台词解码器
        </h3>
        <div className="space-y-4">
          {data.decoding.map((item, idx) => (
            <div key={idx} className="relative group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-blue-400 rounded-l-lg"></div>
              <div className="ml-1 bg-slate-50 p-4 rounded-r-lg border border-slate-100">
                <div className="mb-3">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-1">客户原话 (表象)</p>
                  <p className="text-slate-700 italic">"{item.surface}"</p>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-purple-600 uppercase font-bold tracking-wide mb-1 flex items-center">
                    <span className="mr-1">🚩</span> 潜台词 (真相)
                  </p>
                  <p className="text-slate-800 font-medium">{item.deep}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Emotional Radar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="flex items-center text-lg font-bold text-slate-800 mb-6">
          <TrendingUp className="w-5 h-5 mr-2 text-orange-500" />
          情绪波动雷达
        </h3>
        <div className="relative">
            {/* Timeline Line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 hidden md:block"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
              {['Start', 'Middle', 'End'].map((phase, i) => {
                const emotion = phase === 'Start' ? data.emotions.start : phase === 'Middle' ? data.emotions.middle : data.emotions.end;
                return (
                  <div key={phase} className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                        {phase === 'Start' ? '破冰期' : phase === 'Middle' ? '展开期' : '收尾期'}
                    </div>
                    <div className="text-lg font-bold text-slate-700">{emotion}</div>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-6 bg-orange-50 p-4 rounded-lg border border-orange-100 flex items-start gap-3">
              <div className="mt-1 bg-orange-200 p-1 rounded text-orange-700">
                 <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-orange-800 uppercase">关键转折点</span>
                <p className="text-orange-900 mt-1">{data.emotions.turningPoint}</p>
              </div>
            </div>
        </div>
      </div>

      {/* Section 4: Actionable Advice */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-lg text-white">
         <h3 className="flex items-center text-lg font-bold text-white mb-6">
          <Lightbulb className="w-5 h-5 mr-2 text-yellow-400" />
          Neo · 破局锦囊
        </h3>
        
        <div className="space-y-6">
          {/* Script */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-bold text-slate-400 uppercase">金牌话术 (直接复制)</h4>
              <button 
                onClick={() => navigator.clipboard.writeText(data.advice.script)}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-600 rounded px-2 py-1"
              >
                <Copy className="w-3 h-3" /> 复制
              </button>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-yellow-50 font-medium leading-relaxed">
              "{data.advice.script}"
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">神助攻资料</h4>
              <p className="text-slate-200 bg-slate-800/30 p-3 rounded border border-slate-700/50 text-sm">
                {data.advice.materials}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">最佳出击时机</h4>
              <p className="text-slate-200 bg-slate-800/30 p-3 rounded border border-slate-700/50 text-sm">
                {data.advice.timing}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;