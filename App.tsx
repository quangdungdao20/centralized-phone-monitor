
import React, { useState, useEffect, useRef } from 'react';
import { DeviceCard } from './components/DeviceCard';
import { QRCodeModal } from './components/QRCodeModal';
import { DeviceStream } from './types';

const ROOM_ID = "vmonitor_meet_room_888";
const FIREBASE_BASE_URL = `https://v-monitor-pro-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/${ROOM_ID}`;

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' }
  ],
  iceCandidatePoolSize: 10,
};

const App: React.FC = () => {
  const [devices, setDevices] = useState<DeviceStream[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [role, setRole] = useState<'sender' | 'dashboard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWebview, setIsWebview] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Ready');
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const myDeviceId = useRef<string>("USER-" + Math.random().toString(36).substr(2, 4).toUpperCase());
  const lastProcessedTimestamp = useRef<number>(Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'sender') setRole('sender');
    if (mode === 'dashboard') setRole('dashboard');
    
    const ua = navigator.userAgent || "";
    setIsWebview(/Zalo|FBAN|FBAV/i.test(ua));
  }, []);

  const sendSignal = async (to: string, data: any) => {
    try {
      await fetch(`${FIREBASE_BASE_URL}/signals.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: myDeviceId.current,
          to: to,
          ...data,
          timestamp: Date.now()
        })
      });
    } catch (e) { console.error("Signal Error:", e); }
  };

  useEffect(() => {
    if (!role) return;

    // Dashboard chủ động thông báo "Tôi đã vào" để các máy đang share biết mà gửi Offer
    if (role === 'dashboard') {
      sendSignal('BROADCAST', { type: 'JOIN' });
    }

    const signalInterval = setInterval(async () => {
      try {
        const res = await fetch(`${FIREBASE_BASE_URL}/signals.json?orderBy="timestamp"&limitToLast=10`);
        const data = await res.json();
        if (!data) return;

        const messages = Object.keys(data).map(key => data[key]);
        messages.sort((a, b) => a.timestamp - b.timestamp);

        for (const msg of messages) {
          if (msg.timestamp <= lastProcessedTimestamp.current) continue;
          if (msg.to !== myDeviceId.current && msg.to !== 'BROADCAST') continue;
          if (msg.from === myDeviceId.current) continue;

          await handleIncomingSignal(msg);
          lastProcessedTimestamp.current = msg.timestamp;
        }
      } catch (e) {}
    }, 1500);

    return () => {
      clearInterval(signalInterval);
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
    };
  }, [role, isStreaming]);

  const handleIncomingSignal = async (msg: any) => {
    const { type, from, payload } = msg;
    let pc = peerConnections.current.get(from);

    switch (type) {
      case 'JOIN':
        // Nếu mình là Dashboard, chuẩn bị nhận
        if (role === 'dashboard') {
          setConnectionStatus(`Detecting sender ${from}...`);
          createPeerConnection(from, true);
          sendSignal(from, { type: 'REQUEST_OFFER' });
        } 
        // Nếu mình là Sender và đang phát, phản hồi lại Dashboard mới
        else if (role === 'sender' && isStreaming) {
          handleIncomingSignal({ type: 'REQUEST_OFFER', from });
        }
        break;
      case 'REQUEST_OFFER':
        if (role === 'sender' && isStreaming) {
          setConnectionStatus(`Sending stream to ${from}...`);
          const newPc = createPeerConnection(from, false);
          const offer = await newPc.createOffer();
          await newPc.setLocalDescription(offer);
          sendSignal(from, { type: 'OFFER', payload: offer });
        }
        break;
      case 'OFFER':
        if (role === 'dashboard') {
          if (!pc) pc = createPeerConnection(from, true);
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(from, { type: 'ANSWER', payload: answer });
        }
        break;
      case 'ANSWER':
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          setConnectionStatus('Connected!');
        }
        break;
      case 'ICE_CANDIDATE':
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
        break;
    }
  };

  const createPeerConnection = (remoteId: string, isReceiver: boolean) => {
    if (peerConnections.current.has(remoteId)) {
        peerConnections.current.get(remoteId)?.close();
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remoteId, { type: 'ICE_CANDIDATE', payload: e.candidate });
      }
    };

    if (isReceiver) {
      pc.ontrack = (e) => {
        console.log("Track received from", remoteId);
        setDevices(prev => {
          if (prev.find(d => d.id === remoteId)) return prev;
          return [...prev, {
            id: remoteId,
            name: `Device ${remoteId.split('-')[1]}`,
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

    pc.oniceconnectionstatechange = () => {
      console.log(`Connection state with ${remoteId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setDevices(prev => prev.filter(d => d.id !== remoteId));
        peerConnections.current.delete(remoteId);
      }
    };

    peerConnections.current.set(remoteId, pc);
    return pc;
  };

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
            frameRate: { ideal: 30, max: 60 },
            width: { ideal: 1280 }
        }, 
        audio: false 
      });
      localStreamRef.current = stream;
      setIsStreaming(true);
      setConnectionStatus('Streaming started, waiting for Dashboard...');
      
      // Gửi broadcast ngay lập tức
      await sendSignal('BROADCAST', { type: 'JOIN' });
      
      stream.getVideoTracks()[0].onended = () => {
        setIsStreaming(false);
        window.location.reload();
      };
    } catch (err) {
      setError("Không thể chia sẻ màn hình. Hãy chắc chắn bạn đã cấp quyền.");
    }
  };

  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-600/20">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter mb-2 uppercase">V-Monitor Center</h1>
        <p className="text-slate-500 text-sm mb-12 uppercase tracking-[0.3em] font-bold text-center">Hệ thống giám sát điện thoại thời gian thực</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button onClick={() => setRole('dashboard')} className="group p-8 bg-slate-900 border border-white/5 rounded-[2rem] hover:border-indigo-500/50 transition-all text-left">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors">
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-2 uppercase">Giao diện Dashboard</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Tiếp nhận và xem luồng trực tiếp từ các máy điện thoại.</p>
          </button>
          <button onClick={() => setRole('sender')} className="group p-8 bg-slate-900 border border-white/5 rounded-[2rem] hover:border-emerald-500/50 transition-all text-left">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-2 uppercase">Thiết bị Phát (Phone)</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Chia sẻ toàn bộ màn hình điện thoại của bạn ngay lập tức.</p>
          </button>
        </div>
      </div>
    );
  }

  if (role === 'sender') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950">
        <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl transition-all duration-700 ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}>
          <span className="text-4xl">{isStreaming ? '📡' : '📱'}</span>
        </div>
        <h2 className="text-xl font-black uppercase italic mb-4 tracking-tighter">Phone: {myDeviceId.current.split('-')[1]}</h2>
        <div className="mb-8 px-4 py-2 bg-slate-900 rounded-full border border-white/5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{connectionStatus}</span>
        </div>

        {isWebview ? (
          <div className="bg-amber-500/10 border border-amber-500/30 p-8 rounded-3xl text-center max-w-xs">
            <p className="text-amber-500 text-xs font-black uppercase mb-4 leading-relaxed">⚠️ Hãy mở bằng Safari (iOS) hoặc Chrome (Android)</p>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Đã copy!"); }} className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase">Copy Link</button>
          </div>
        ) : isStreaming ? (
          <div className="text-center">
            <button onClick={() => window.location.reload()} className="px-10 py-4 bg-slate-900 border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-red-500/20 transition-all">Dừng phát</button>
          </div>
        ) : (
          <button onClick={startSharing} className="w-full max-w-xs py-6 bg-indigo-600 rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all">Chia sẻ ngay</button>
        )}
        <button onClick={() => setRole(null)} className="mt-12 text-slate-600 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors italic">← Đổi vai trò</button>
        {error && <p className="mt-8 text-red-500 text-[10px] uppercase font-bold text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-10 py-6 bg-slate-900/40 backdrop-blur-2xl border-b border-white/5 z-20">
        <div className="flex items-center gap-5">
          <button onClick={() => setRole(null)} className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter">V-Monitor <span className="text-indigo-500">Center</span></h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Trạng thái: {connectionStatus}</p>
          </div>
        </div>
        <button onClick={() => setShowQR(true)} className="px-6 py-3 bg-indigo-600 text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-indigo-500 transition-all">Mã QR</button>
      </header>

      <main className="flex-1 p-10 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-slate-950 to-slate-950">
        {devices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">Đang chờ tín hiệu từ điện thoại...</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            {devices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onFocus={() => {}}
                onRename={(id, name) => setDevices(prev => prev.map(d => d.id === id ? {...d, name} : d))}
                onRefresh={() => sendSignal(device.id, { type: 'REQUEST_OFFER' })}
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