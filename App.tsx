
import React, { useState, useEffect, useRef } from 'react';
import { DeviceCard } from './components/DeviceCard';
import { QRCodeModal } from './components/QRCodeModal';
import { DeviceStream } from './types';

// URL Firebase của bạn - Đã thêm .json vào logic fetch bên dưới
const ROOM_ID = "vmonitor_global_room_001";
const FIREBASE_BASE_URL = `https://v-monitor-pro-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/${ROOM_ID}`;

const App: React.FC = () => {
  const [devices, setDevices] = useState<DeviceStream[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWebview, setIsWebview] = useState(false);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const myDeviceId = useRef<string>("DEV-" + Math.random().toString(36).substr(2, 4).toUpperCase());
  const lastProcessedTimestamp = useRef<number>(Date.now());

  // Gửi tín hiệu lên Firebase (Yêu cầu đuôi .json cho REST API)
  const sendSignal = async (to: string, data: any) => {
    try {
      await fetch(`${FIREBASE_BASE_URL}/signals.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: isSender ? myDeviceId.current : 'DASHBOARD',
          to: to,
          ...data,
          timestamp: Date.now()
        })
      });
    } catch (e) {
      console.error("Firebase send error:", e);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'sender') {
      setIsSender(true);
      const ua = navigator.userAgent || "";
      setIsWebview(/Zalo|FBAN|FBAV/i.test(ua));
    }

    // Lắng nghe tín hiệu từ Firebase mỗi 1.5 giây
    const signalInterval = setInterval(async () => {
      try {
        const res = await fetch(`${FIREBASE_BASE_URL}/signals.json?orderBy="timestamp"&limitToLast=10`);
        const data = await res.json();
        if (!data) return;

        const target = isSender ? myDeviceId.current : 'DASHBOARD';
        
        // Chuyển object Firebase thành array và sắp xếp theo thời gian
        const messages = Object.keys(data).map(key => data[key]);
        messages.sort((a, b) => a.timestamp - b.timestamp);

        for (const msg of messages) {
          if (msg.timestamp <= lastProcessedTimestamp.current) continue;
          if (msg.to !== target || msg.from === target) continue;

          await handleIncomingSignal(msg);
          lastProcessedTimestamp.current = msg.timestamp;
        }
      } catch (e) {
        // Lỗi mạng hoặc Firebase chưa có dữ liệu
      }
    }, 1500);

    return () => {
      clearInterval(signalInterval);
      peerConnections.current.forEach(pc => pc.close());
    };
  }, [isSender]);

  const handleIncomingSignal = async (msg: any) => {
    const { type, from, payload } = msg;

    if (!isSender) {
      if (type === 'JOIN') {
        createPeerConnection(from, true);
      } else if (type === 'OFFER') {
        let pc = peerConnections.current.get(from);
        if (!pc) pc = createPeerConnection(from, true);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { type: 'ANSWER', payload: answer });
      } else if (type === 'ICE_CANDIDATE') {
        const pc = peerConnections.current.get(from);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
      }
    } else {
      const pc = peerConnections.current.get('DASHBOARD');
      if (type === 'ANSWER') {
        await pc?.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ICE_CANDIDATE') {
        await pc?.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
      }
    }
  };

  const createPeerConnection = (id: string, isReceiver: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(isReceiver ? id : 'DASHBOARD', { 
          type: 'ICE_CANDIDATE', 
          payload: e.candidate 
        });
      }
    };

    if (isReceiver) {
      pc.ontrack = (e) => {
        setDevices(prev => {
          if (prev.find(d => d.id === id)) return prev;
          return [...prev, {
            id: id,
            name: `Device ${id.slice(-4)}`,
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

    peerConnections.current.set(isReceiver ? id : 'DASHBOARD', pc);
    return pc;
  };

  const startMobileCapture = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { frameRate: 15, width: { ideal: 720 } }, 
        audio: false 
      });
      localStreamRef.current = stream;
      setIsStreaming(true);

      const pc = createPeerConnection(myDeviceId.current, false);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Thông báo cho Dashboard có thiết bị mới
      await sendSignal('DASHBOARD', { type: 'JOIN' });
      // Gửi Offer kèm theo
      await sendSignal('DASHBOARD', { type: 'OFFER', payload: offer });

      stream.getVideoTracks()[0].onended = () => {
        setIsStreaming(false);
        pc.close();
        window.location.reload();
      };
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? "Bạn cần cho phép quay màn hình để tiếp tục" : err.message);
    }
  };

  if (isSender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-slate-100">
        <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl transition-all duration-700 ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}>
          <span className="text-4xl">{isStreaming ? '📡' : '📱'}</span>
        </div>
        
        <h1 className="text-xl font-black uppercase italic mb-2 tracking-tighter">Remote Node</h1>
        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.3em] mb-12 italic">Device ID: {myDeviceId.current}</p>

        {isWebview ? (
          <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl text-center max-w-xs">
            <p className="text-amber-500 text-[11px] font-black uppercase mb-4">⚠️ Trình duyệt không hỗ trợ</p>
            <p className="text-slate-400 text-[10px] mb-6">Vui lòng copy link và mở bằng ứng dụng <b>Safari</b> hoặc <b>Chrome</b>.</p>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Đã copy link!");
            }} className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-amber-500/20">Copy Link</button>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl text-center max-w-xs">
            <p className="text-red-400 text-[10px] font-black uppercase mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-red-500 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-red-500/20">Thử lại</button>
          </div>
        ) : (
          !isStreaming && (
            <button onClick={startMobileCapture} className="w-full max-w-xs py-6 bg-indigo-600 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all">Bắt đầu truyền hình ảnh</button>
          )
        )}

        {isStreaming && (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Đang phát trực tiếp</p>
            </div>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-slate-800 text-slate-300 text-[10px] font-black uppercase rounded-xl border border-white/5">Dừng phát</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-8 py-5 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter">V-Monitor <span className="text-indigo-500">Global</span></h1>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.3em]">Signaling via Firebase Singapore</p>
          </div>
        </div>
        <button onClick={() => setShowQR(true)} className="px-6 py-3 bg-indigo-600 text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30">Thêm thiết bị</button>
      </header>

      <main className="flex-1 p-8 overflow-y-auto bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        {devices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
              <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500 animate-pulse">Đang đợi kết nối từ xa...</p>
            <p className="text-[9px] mt-4 text-slate-500 max-w-xs text-center leading-relaxed">Nhấn nút "Thêm thiết bị" và dùng điện thoại quét mã để bắt đầu giám sát.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8 animate-in fade-in duration-700">
            {devices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onFocus={() => {}}
                onRename={(id, name) => setDevices(prev => prev.map(d => d.id === id ? {...d, name} : d))}
                onRefresh={() => {}}
              />
            ))}
          </div>
        )}
      </main>

      {showQR && <QRCodeModal url={`${window.location.origin}${window.location.pathname}?mode=sender`} onClose={() => setShowQR(false)} />}
    </div>
  );
};

export default App;