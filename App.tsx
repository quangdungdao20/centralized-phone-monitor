
import React, { useState, useEffect, useRef } from 'react';
import { DeviceCard } from './components/DeviceCard';
import { QRCodeModal } from './components/QRCodeModal';
import { DeviceStream } from './types';

const MOCK_ROOM_ID = "VN-MONITOR-001";

const App: React.FC = () => {
  const [devices, setDevices] = useState<DeviceStream[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Xác định vai trò từ URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'sender') {
      setIsSender(true);
    }
  }, []);

  const handleFocus = (id: string) => {
    setFocusedId(prev => prev === id ? null : id);
  };

  const handleRename = (id: string, newName: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
  };

  const handleRefresh = (id: string) => {
    console.log(`Đang làm mới thiết bị: ${id}`);
  };

  // Logic dành cho ĐIỆN THOẠI (Sender)
  const startMobileCapture = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Trình duyệt này không hỗ trợ quay màn hình. Hãy dùng Chrome hoặc Safari mới nhất.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor', // Yêu cầu lấy toàn bộ màn hình
        },
        audio: false
      });

      setIsStreaming(true);
      
      // Giả lập gửi stream về Dashboard qua ID phòng
      // Trong thực tế, đoạn này sẽ gửi qua WebRTC PeerConnection
      window.postMessage({ type: 'NEW_STREAM', streamId: Math.random().toString(36).substr(2, 9), stream }, "*");
      
      stream.getVideoTracks()[0].onended = () => {
        setIsStreaming(false);
      };

    } catch (err: any) {
      setError(err.message || "Không thể bắt đầu chia sẻ màn hình.");
    }
  };

  // Giao diện ĐIỆN THOẠI
  if (isSender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900 text-slate-100">
        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 ${isStreaming ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' : 'bg-blue-600 shadow-lg shadow-blue-500/20'}`}>
          <span className="text-4xl">{isStreaming ? '📡' : '📱'}</span>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Hệ Thống Truyền Tin</h1>
        <p className="text-slate-400 text-sm mb-8 text-center max-w-xs">
          {isStreaming 
            ? "Màn hình của bạn đang được truyền về trung tâm quan sát. Bạn có thể thoát ứng dụng để thực hiện tác vụ khác." 
            : "Nhấn nút dưới đây để bắt đầu chia sẻ toàn bộ màn hình điện thoại của bạn."}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs w-full">
            ⚠️ {error}
          </div>
        )}

        {!isStreaming ? (
          <button 
            onClick={startMobileCapture}
            className="w-full max-w-xs py-5 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3"
          >
            BẮT ĐẦU CHIA SẺ
          </button>
        ) : (
          <div className="text-red-500 font-bold flex items-center gap-2 animate-bounce">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            ĐANG TRUYỀN DỮ LIỆU...
          </div>
        )}

        <div className="mt-auto pt-10 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          ID Phòng: {MOCK_ROOM_ID}
        </div>
      </div>
    );
  }

  // Giao diện MÁY TÍNH (Dashboard)
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header Dashboard */}
      <header className="flex items-center justify-between px-8 py-5 bg-slate-900/50 border-b border-white/5 backdrop-blur-md z-10">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Trung Tâm Giám Sát Tập Trung</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Hệ thống đang trực tuyến | {MOCK_ROOM_ID}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-800 rounded-lg border border-white/5">
            <span className="text-xs text-slate-400 font-bold">Thiết bị: </span>
            <span className="text-xs font-black text-indigo-400">{devices.length}</span>
          </div>
          <button 
            onClick={() => setShowQR(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-lg transition-all shadow-lg shadow-indigo-600/20 uppercase"
          >
            + Thêm Điện Thoại
          </button>
        </div>
      </header>

      {/* Vùng hiển thị danh sách thiết bị */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {devices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <div className="w-32 h-32 mb-6 text-slate-700">
               <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
               </svg>
            </div>
            <h2 className="text-lg font-bold">Chưa có kết nối nào</h2>
            <p className="text-sm">Hãy quét mã QR trên điện thoại để bắt đầu truyền hình ảnh.</p>
          </div>
        ) : (
          <div className={focusedId ? "flex justify-center h-full" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8"}>
            {devices.map(device => {
              if (focusedId && device.id !== focusedId) return null;
              return (
                <div key={device.id} className={focusedId === device.id ? 'w-full max-w-2xl' : ''}>
                  <DeviceCard
                    device={{...device, isFocused: focusedId === device.id}}
                    onFocus={handleFocus}
                    onRename={handleRename}
                    onRefresh={handleRefresh}
                  />
                  {focusedId === device.id && (
                    <button 
                      onClick={() => setFocusedId(null)}
                      className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl block mx-auto text-xs font-bold transition-all border border-white/5"
                    >
                      THOÁT CHẾ ĐỘ PHÓNG TO
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Dashboard */}
      <footer className="px-8 py-3 bg-slate-900/80 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Luồng dữ liệu: Mã hóa P2P</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Độ trễ: Cực thấp</span>
        </div>
        <div>
          TRUNG TÂM ĐIỀU HÀNH V1.2.0
        </div>
      </footer>

      {showQR && (
        <QRCodeModal 
          url={`${window.location.origin}${window.location.pathname}?mode=sender`} 
          onClose={() => setShowQR(false)} 
        />
      )}
    </div>
  );
};

export default App;
