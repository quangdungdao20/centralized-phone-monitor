
import React, { useState, useEffect, useRef } from 'react';
import { DeviceCard } from './components/DeviceCard';
import { QRCodeModal } from './components/QRCodeModal';
import { DeviceStream } from './types';

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

    const signalInterval = setInterval(async () => {
      try {
        const res = await fetch(`${FIREBASE_BASE_URL}/signals.json?orderBy="timestamp"&limitToLast=10`);
        const data = await res.json();
        if (!data) return;

        const target = isSender ? myDeviceId.current : 'DASHBOARD';
        const messages = Object.keys(data).map(key => data[key]);
        messages.sort((a, b) => a.timestamp - b.timestamp);

        for (const msg of messages) {
          if (msg.timestamp <= lastProcessedTimestamp.current) continue;
          if (msg.to !== target || msg.from === target) continue;

          handleIncomingSignal(msg);
          lastProcessedTimestamp.current = msg.timestamp;
        }
      } catch (e) {}
    }, 1000); // Tăng tần suất polling lên 1s để kết nối nhanh hơn

    return () => {
      clearInterval(signalInterval);
      peerConnections.current.forEach(pc => pc.close());
    };
  }, [isSender]);

  const handleIncomingSignal = async (msg: any) => {
    const { type, from, payload } = msg;
    let pc = peerConnections.current.get(from || 'DASHBOARD');

    if (!isSender) {
      if (type === 'JOIN') {
        createPeerConnection(from, true);
      } else if (type === 'OFFER') {
        if (!pc) pc = createPeerConnection(from, true);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { type: 'ANSWER', payload: answer });
      } else if (type === 'ICE_CANDIDATE') {
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(e => console.warn(e));
      }
    } else {
      if (type === 'ANSWER') {
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ICE_CANDIDATE') {
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(e => console.warn(e));
      }
    }
  };

  const createPeerConnection = (id: string, isReceiver: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }
    }

    // Theo dõi trạng thái kết nối
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected') {
        if (isReceiver) {
          setDevices(prev => prev.filter(d => d.id !== id));
        }
      }
    };

    peerConnections.current.set(isReceiver ? id : 'DASHBOARD', pc);
    return pc;
  };

  const startMobileCapture = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          frameRate: { ideal: 20, max: 30 },
          width: { ideal: 1280 } 
        }, 
        audio: false 
      });
      localStreamRef.current = stream;
      setIsStreaming(true);

      const pc = createPeerConnection(myDeviceId.current, false);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal('DASHBOARD', { type: 'JOIN' });
      await sendSignal('DASHBOARD', { type: 'OFFER', payload: offer });

      stream.getVideoTracks()[0].onended = () => {
        window.location.reload();
      };
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? "Vui lòng cấp quyền quay màn hình" : "Lỗi: " + err.message);
    }
  };

  if (isSender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-slate-100">
        <div className={`w-28 h-28 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl transition-all duration-1000 ${isStreaming ? 'bg-red-500 shadow-red-500/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
          <span className="text-4xl animate-pulse">{isStreaming ? '📡' : '📱'}</span>
        </div>
        
        <h1 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">Remote Node</h1>
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.4em] mb-12">ID: {myDeviceId.current}</p>

        {isWebview ? (
          <div className="bg-amber-500/10 border border-amber-500/30 p-8 rounded-[2rem] text-center max-w-xs backdrop-blur-xl">
            <p className="text-amber-500 text-xs font-black uppercase mb-4 tracking-widest">⚠️ Không hỗ trợ In-App Browser</p>
            <p className="text-slate-400 text-[10px] mb-8 leading-relaxed">Vui lòng bấm vào nút bên dưới, sau đó mở trình duyệt <b>Safari</b> (iOS) hoặc <b>Chrome</b> (Android) để tiếp tục.</p>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Đã copy link!");
            }} className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-amber-500/20">Copy Link Kết Nối</button>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-[2rem] text-center max-w-xs backdrop-blur-xl">
            <p className="text-red-400 text-xs font-black uppercase mb-4 tracking-widest">Lỗi thiết bị</p>
            <p className="text-slate-400 text-[10px] mb-8 leading-relaxed">{error}</p>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-red-500 rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-red-500/20">Thử lại</button>
          </div>
        ) : (
          !isStreaming && (
            <button 
              onClick={startMobileCapture} 
              className="group relative w-full max-w-xs py-6 bg-indigo-600 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all"
            >
              <span className="relative z-10">Bắt đầu truyền</span>
              <div className="absolute inset-0 bg-white/10 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )
        )}

        {isStreaming && (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-8 bg-white/5 px-6 py-3 rounded-2xl border border-white/5">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <p className="text-red-500 text-[11px] font-black uppercase tracking-widest">Đang truyền hình ảnh</p>
            </div>
            <button onClick={() => window.location.reload()} className="px-10 py-4 bg-slate-900 text-slate-400 text-[10px] font-black uppercase rounded-2xl border border-white/10 hover:text-white transition-colors">Ngắt kết nối</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      <header className="flex items-center justify-between px-10 py-6 bg-slate-900/40 backdrop-blur-2xl border-b border-white/5 z-20">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 transform -rotate-3">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-1">V-Monitor <span className="text-indigo-500">Pro</span></h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Global Relay Active</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowQR(true)} 
          className="group px-8 py-3.5 bg-indigo-600 text-[11px] font-black rounded-2xl uppercase tracking-widest hover:bg-indigo-500 hover:-translate-y-0.5 transition-all shadow-xl shadow-indigo-600/30 flex items-center gap-3"
        >
          <span>Thêm thiết bị</span>
          <svg className="w-4 h-4 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
        </button>
      </header>

      <main className="flex-1 p-10 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-slate-950 to-slate-950">
        {devices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-[6px] border-indigo-500/10 rounded-full" />
              <div className="absolute inset-0 border-t-[6px] border-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-4 bg-slate-900 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.6em] text-slate-600 mb-4">No Active Nodes</h2>
            <p className="text-[10px] text-slate-500 max-w-xs text-center leading-relaxed uppercase font-bold tracking-widest opacity-60">
              Hãy quét mã QR và nhấn bắt đầu truyền trên điện thoại để hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10 animate-in fade-in zoom-in-95 duration-1000">
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