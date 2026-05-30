import { useState, useEffect } from 'react';
import { useStore, type LlmApiConfig } from '../store/useStore';
import { X, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const PROVIDER_PRESETS: Record<string, Partial<LlmApiConfig>> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
  custom: { baseUrl: '', model: '' },
};

export default function ApiSettingsModal({ onClose }: { onClose: () => void }) {
  const { llmConfig, setLlmConfig } = useStore();
  const [form, setForm] = useState<LlmApiConfig>({ ...llmConfig });
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // Auto-fill baseUrl/model from provider presets
  useEffect(() => {
    const presets = PROVIDER_PRESETS[form.provider];
    if (presets) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional preset auto-fill on provider change
      setForm(f => ({
        ...f,
        baseUrl: f.baseUrl || presets.baseUrl || '',
        model: f.model || presets.model || '',
      }));
    }
  }, [form.provider]);

  const handleSave = () => {
    setLlmConfig(form);
    onClose();
  };

  const handleTest = async () => {
    // CAIAO 化：无 API Key 时仍可测试（服务端可能配了 LLM_API_KEY 环境变量）
    setTestStatus('testing'); setTestMsg('');
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(form.provider === 'deepseek' ? { Authorization: `Bearer ${form.apiKey}` } : {}),
        ...(form.provider === 'anthropic' ? { 'x-api-key': form.apiKey, 'anthropic-version': '2023-06-01' } : {}),
        ...(form.provider === 'custom' ? { Authorization: `Bearer ${form.apiKey}` } : {}),
      };
      const body = form.provider === 'anthropic'
        ? { model: form.model || 'claude-sonnet-4-20250514', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }
        : { model: form.model || 'deepseek-v4-flash', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] };

      const res = await fetch(`${form.baseUrl}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 120));
      }
      setTestStatus('success'); setTestMsg('连接成功');
    } catch (err) {
      setTestStatus('error'); setTestMsg(err instanceof Error ? err.message : '连接失败');
    }
  };

  const isConfigured = !!form.apiKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-sm font-semibold text-white">大模型 API 配置</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">覆盖服务端 LLM_API_KEY 环境变量（可选）</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Provider */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">服务商</label>
            <div className="flex gap-2">
              {([
                { key: 'deepseek', label: 'DeepSeek', icon: '🧊' },
                { key: 'anthropic', label: 'Anthropic', icon: '🧠' },
                { key: 'custom', label: '自定义', icon: '🔧' },
              ] as const).map(p => (
                <button key={p.key} onClick={() => setForm(f => ({ ...f, provider: p.key, apiKey: '', baseUrl: '', model: '' }))}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all border ${form.provider === p.key ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder={form.provider === 'deepseek' ? 'sk-...' : form.provider === 'anthropic' ? 'sk-ant-...' : '输入您的 API Key'}
                className="input-field w-full pr-20 text-xs font-mono" />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">API 地址</label>
            <input value={form.baseUrl}
              onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.deepseek.com"
              className="input-field w-full text-xs font-mono" />
          </div>

          {/* Model */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">模型名称</label>
            <input value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              placeholder={form.provider === 'deepseek' ? 'deepseek-v4-flash' : form.provider === 'anthropic' ? 'claude-sonnet-4-20250514' : '输入模型名称'}
              className="input-field w-full text-xs font-mono" />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(form.provider === 'deepseek'
                ? ['deepseek-v4-flash', 'deepseek-v4-pro']
                : form.provider === 'anthropic'
                  ? ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
                  : []
              ).map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, model: m }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${form.model === m ? 'bg-cyan/20 text-cyan' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Test result */}
          {testStatus !== 'idle' && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${testStatus === 'testing' ? 'text-gray-400 bg-white/5' : testStatus === 'success' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
              {testStatus === 'testing' ? <Loader size={14} className="animate-spin" /> :
               testStatus === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {testMsg || '正在测试连接...'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[11px]">
            {isConfigured
              ? <><CheckCircle size={12} className="text-green-400" /><span className="text-green-400">前端覆盖已配置</span></>
              : <><AlertCircle size={12} className="text-yellow-400" /><span className="text-yellow-400">未配置（使用服务端 LLM_API_KEY）</span></>
            }
          </div>
          <div className="flex gap-2">
            <button onClick={handleTest} disabled={testStatus === 'testing'}
              className="px-4 py-2 rounded-lg text-xs border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all disabled:opacity-50">
              测试连接
            </button>
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-all">
              取消
            </button>
            <button onClick={handleSave}
              className="btn-primary !py-2 !px-5 text-xs">
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
