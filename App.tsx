
import React, { useState, useEffect, useRef } from 'react';
import { DeviceCard } from './components/DeviceCard';
import { QRCodeModal } from './components/QRCodeModal';
import { DeviceStream } from './types';

// TRONG THỰC TẾ: Thay BroadcastChannel bằng Firebase hoặc Socket.io để chạy qua Internet.
// BroadcastChannel hiện tại chỉ hỗ trợ demo trên CÙNG MỘT TRÌNH DUYỆT.
const signaling = new BroadcastChannel('webrtc_signaling_channel');
// Define a mock room ID for the UI
const MOCK_ROOM_ID = "ROOM-VPRO-99";

const App: React.FC = () => {
  const [devices, setDevices] = useState<DeviceStream[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'sender') {
      setIsSender(true);
    }

    const handleSignaling = async (event: MessageEvent) => {
      const { type, from, to, payload } = event.data;

      if (!isSender) {
        if (type === 'JOIN') {
          console.log("Thiết bị mới đang yêu cầu kết nối:", from);
          createPeerConnection(from, true);
        } else if (to === 'DASHBOARD' && type === 'OFFER') {
          const pc = peerConnections.current.get(from);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signaling.postMessage({ type: 'ANSWER', from: 'DASHBOARD', to: from, payload: answer });
          }
        } else if (to === 'DASHBOARD' && type === 'ICE_CANDIDATE') {
          const pc = peerConnections.current.get(from);
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload));
        }
      } 
      else if (isSender && to === from) {
         const pc = peerConnections.current.get('DASHBOARD');
         if (type === 'ANSWER') {
           await pc?.setRemoteDescription(new RTCSessionDescription(payload));
         } else if (type === 'ICE_CANDIDATE') {
           await pc?.addIceCandidate(new RTCIceCandidate(payload));
         }
      }
    };

    signaling.onmessage = handleSignaling;
    return () => {
      peerConnections.current.forEach(pc => pc.close());
    };
  }, [isSender]);

  const createPeerConnection = (deviceId: string, isReceiver: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signaling.postMessage({
          type: 'ICE_CANDIDATE',
          from: isReceiver ? 'DASHBOARD' : deviceId,
          to: isReceiver ? deviceId : 'DASHBOARD',
          payload: e.candidate
        });
      }
    };

    if (isReceiver) {
      pc.ontrack = (e) => {
        setDevices(prev => {
          if (prev.find(d => d.id === deviceId)) return prev;
          return [...prev, {
            id: deviceId,
            name: `Mobile ${deviceId.slice(0, 4)}`,
            stream: e.streams[0],
            connectedAt: Date.now(),
            isFocused: false,
            quality: 'high'
          }];
        });
      };
    } else {
      localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnections.current.set(isReceiver ? deviceId : 'DASHBOARD', pc);
    return pc;
  };

  const handleFocus = (id: string) => setFocusedId(current => current === id ? null : id);

  const startMobileCapture = async () => {
    setError(null);
    try {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        throw new Error("LỖI: Trình duyệt yêu cầu HTTPS để mở tính năng quay màn hình.");
      }

      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ 
        video: { cursor: "always" },
        audio: false 
      });
      
      localStreamRef.current = stream;
      setIsStreaming(true);

      const myId = "DEV-" + Math.random().toString(36).substr(2, 4).toUpperCase();
      const pc = createPeerConnection(myId, false);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      signaling.postMessage({ type: 'JOIN', from: myId });
      signaling.postMessage({ type: 'OFFER', from: myId, to: 'DASHBOARD', payload: offer });

      stream.getVideoTracks()[0].onended = () => {
        setIsStreaming(false);
        pc.close();
      };
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isSender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900 text-slate-100 font-sans">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 transition-all ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 shadow-2xl shadow-indigo-600/20'}`}>
          <span className="text-4xl">{isStreaming ? '📡' : '📱'}</span>
        </div>
        
        <h1 className="text-2xl font-black mb-2 uppercase italic tracking-tighter">Mobile Transmitter</h1>
        <p className="text-slate-400 text-xs mb-8 text-center max-w-[240px] leading-relaxed">
          {isStreaming ? "Màn hình của bạn đang được truyền đi. Đừng đóng trình duyệt này." : "Nhấn nút dưới để bắt đầu chia sẻ màn hình điện thoại với máy tính giám sát."}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-[10px] font-bold uppercase leading-normal">
            ⚠️ {error}
          </div>
        )}
        
        {!isStreaming ? (
          <button onClick={startMobileCapture} className="w-full max-w-xs py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-sm">
            Bắt đầu phát
          </button>
        ) : (
          <button onClick={() => window.location.reload()} className="w-full max-w-xs py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-sm border border-white/5">
            Dừng kết nối
          </button>
        )}

        <div className="mt-12 pt-8 border-t border-white/5 w-full max-w-xs text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Lưu ý quan trọng</p>
          <ul className="text-[9px] text-slate-600 space-y-1 text-left list-disc pl-4">
            <li>Sử dụng trình duyệt Chrome hoặc Safari bản mới nhất.</li>
            <li>Đảm bảo đường dẫn bắt đầu bằng <b>https://</b></li>
            <li>Cho phép quyền "Quay màn hình" khi hệ thống yêu cầu.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <header className="flex items-center justify-between px-8 py-5 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">V-Monitor <span className="text-indigo-500">PRO</span></h1>
            <p className="text-[9px] text-slate-500 font-black uppercase mt-1 tracking-[0.2em]">Centralized Surveillance System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black text-green-500 uppercase">Server Online</span>
          </div>
          <button onClick={() => setShowQR(true)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-[0.1em] shadow-xl shadow-indigo-600/20 active:scale-95">
            + Kết nối thiết bị
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar">
        {devices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <div className="w-24 h-24 mb-6 border-2 border-dashed border-slate-800 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-sm font-black text-slate-600 uppercase tracking-[0.4em]">Waiting for signals</h2>
            <p className="text-[10px] text-slate-700 mt-2 font-bold uppercase">Quét mã QR để đồng bộ thiết bị của bạn</p>
          </div>
        ) : (
          <div className={focusedId ? "max-w-4xl mx-auto" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8"}>
            {devices.map(device => {
              if (focusedId && device.id !== focusedId) return null;
              return (
                <div key={device.id} className="animate-in fade-in zoom-in duration-500">
                  <DeviceCard
                    device={{...device, isFocused: focusedId === device.id}}
                    onFocus={handleFocus}
                    onRename={(id, name) => setDevices(prev => prev.map(d => d.id === id ? {...d, name} : d))}
                    onRefresh={() => {}}
                  />
                  {focusedId === device.id && (
                    <button onClick={() => setFocusedId(null)} className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full mx-auto block text-xs font-black uppercase tracking-widest border border-white/10 transition-all">
                      Thoát chế độ tập trung
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="px-8 py-4 bg-slate-900/50 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex gap-8 text-[9px] font-black text-slate-600 uppercase tracking-widest italic">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Node: {MOCK_ROOM_ID}</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Active Peers: {devices.length}</span>
        </div>
        <div className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">
          Secure WebRTC Monitoring &copy; 2024
        </div>
      </footer>

      {showQR && <QRCodeModal url={`${window.location.origin}${window.location.pathname}?mode=sender`} onClose={() => setShowQR(false)} />}
    </div>
  );
};

export default App;