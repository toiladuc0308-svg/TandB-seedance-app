import React from 'react';

export default function TokenSettings({ onTokenSaved }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [token, setToken] = React.useState('');
  const [domain, setDomain] = React.useState('79ai.net');
  const [showToken, setShowToken] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [status, setStatus] = React.useState({ type: '', msg: '' });
  const [savedToken, setSavedToken] = React.useState('');

  React.useEffect(() => {
    if (window.gommoMiniApp?.get79AIConfig) {
      const cfg = window.gommoMiniApp.get79AIConfig();
      setToken(cfg.token || '');
      setSavedToken(cfg.token || '');
      setDomain(cfg.domain || '79ai.net');
      if (cfg.token) {
        setStatus({ type: 'success', msg: `Đã liên kết với 79AI (${cfg.domain || '79ai.net'})` });
      }
    }
  }, []);

  const handleSaveAndTest = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setStatus({ type: 'error', msg: 'Vui lòng nhập Access Token từ 79ai.net' });
      return;
    }
    setTesting(true);
    setStatus({ type: 'info', msg: 'Đang kiểm tra kết nối với server 79AI...' });

    try {
      if (window.gommoMiniApp?.test79AIConnection) {
        const res = await window.gommoMiniApp.test79AIConnection(trimmed, domain);
        const count = Array.isArray(res?.data) ? res.data.length : 0;
        window.gommoMiniApp.set79AIConfig(trimmed, domain);
        setSavedToken(trimmed);
        setStatus({
          type: 'success',
          msg: `Kết nối 79AI thành công! Tìm thấy ${count} dự án. Đang làm mới dữ liệu...`,
        });
        if (onTokenSaved) onTokenSaved({ token: trimmed, domain });
        setTimeout(() => {
          setIsOpen(false);
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      setStatus({
        type: 'error',
        msg: err?.message || 'Không thể kết nối với 79AI. Kiểm tra lại token và domain.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    if (window.gommoMiniApp?.set79AIConfig) {
      window.gommoMiniApp.set79AIConfig('', '79ai.net');
      setToken('');
      setSavedToken('');
      setStatus({ type: 'info', msg: 'Đã xóa token. Ứng dụng chuyển về chế độ Demo.' });
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const isConnected = !!savedToken;

  return (
    <>
      {/* Nút bấm trên Header hoặc Sidebar */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
          isConnected
            ? 'bg-[#c7ff44]/10 text-[#c7ff44] border border-[#c7ff44]/30 hover:bg-[#c7ff44]/20'
            : 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/20 animate-pulse'
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isConnected ? 'bg-[#c7ff44]' : 'bg-[#f59e0b]'
          }`}
        />
        <i className="ph ph-key" aria-hidden="true" />
        <span>{isConnected ? '79AI: Đã kết nối' : 'Liên kết 79AI (Nhập Token)'}</span>
      </button>

      {/* Modal Cấu hình Token */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161616] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <i className="ph ph-key text-xl text-[#c7ff44]" aria-hidden="true" />
                <h2 className="text-base font-bold text-white">Cấu hình Access Token 79AI</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-[#777] hover:bg-white/10 hover:text-white"
              >
                <i className="ph ph-x text-lg" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-[#bbb]">
                  Access Token <span className="text-[#ef4444]">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Dán mã access_token từ tài khoản 79AI..."
                    className="w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2.5 pr-20 text-white placeholder-[#555] outline-none focus:border-[#c7ff44]"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="rounded p-1 text-[#777] hover:text-white"
                      title={showToken ? 'Ẩn' : 'Hiện'}
                    >
                      <i className={`ph ${showToken ? 'ph-eye-slash' : 'ph-eye'}`} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clip = await navigator.clipboard.readText();
                          if (clip) setToken(clip.trim());
                        } catch {}
                      }}
                      className="rounded bg-white/5 px-2 py-1 text-[10px] text-[#bbb] hover:bg-white/10"
                    >
                      Dán
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[#bbb]">Domain (Mặc định: 79ai.net)</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="79ai.net"
                  className="w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2 text-white placeholder-[#555] outline-none focus:border-[#c7ff44]"
                />
              </div>

              {status.msg ? (
                <div
                  className={`rounded-xl p-3 leading-relaxed ${
                    status.type === 'success'
                      ? 'bg-[#c7ff44]/10 text-[#c7ff44] border border-[#c7ff44]/20'
                      : status.type === 'error'
                      ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                      : 'bg-white/5 text-[#aaa]'
                  }`}
                >
                  <p className="flex items-start gap-2">
                    <i
                      className={`ph mt-0.5 ${
                        status.type === 'success'
                          ? 'ph-check-circle'
                          : status.type === 'error'
                          ? 'ph-warning-circle'
                          : 'ph-info'
                      }`}
                    />
                    <span className="flex-1">{status.msg}</span>
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl bg-white/5 p-3 text-[11px] text-[#777] space-y-1">
                <p className="font-semibold text-[#aaa]">
                  <i className="ph ph-lightbulb mr-1 text-[#f59e0b]" /> Hướng dẫn lấy Access Token:
                </p>
                <p>1. Mở trang <a href="https://79ai.net" target="_blank" rel="noreferrer" className="text-[#c7ff44] underline">79ai.net</a> và đăng nhập tài khoản của bạn.</p>
                <p>2. Nhấn phím <b>F12</b> để mở công cụ nhà phát triển (DevTools) → Chọn tab <b>Network</b>.</p>
                <p>3. Thao tác bất kỳ (như tải lại trang hoặc tạo video) → Tìm request gửi đến <b>api.gommo.net</b>.</p>
                <p>4. Xem phần <b>Payload / Body</b> hoặc Headers để copy chuỗi <b>access_token</b> và dán vào đây.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              {savedToken ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#ef4444] hover:bg-[#ef4444]/10"
                >
                  Xóa Token
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-white/5 px-4 py-2 text-xs text-[#bbb] hover:bg-white/10"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndTest}
                  disabled={testing}
                  className="flex items-center gap-2 rounded-xl bg-[#c7ff44] px-4 py-2 text-xs font-bold text-black hover:bg-[#b2eb35] disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <i className="ph ph-spinner animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-check" />
                      <span>Lưu & Đồng bộ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
