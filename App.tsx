
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceCard } from './components/DeviceCard';
import { QRCodeModal } from './components/QRCodeModal';
import { DeviceStream } from './types';

// In a real app, this would be a hash of the meeting room
const MOCK_ROOM_ID = "monitor-room-888";

const App: React.FC = () => {
  const [devices, setDevices] = useState<DeviceStream[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  
  // Ref to track peer connections for each device ID
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  
  // Detection for mobile view (Sender)
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
    console.log(`Refreshing device ${id}...`);
    // Logic for ICE restart would go here
  };

  // Mocking WebRTC signaling behavior for visualization
  // In a real environment, you'd use socket.io to connect these.
  const startScreenShare = async () => {
    try {
      // FIX: Removed 'cursor: "always"' as it is not part of the standard MediaTrackConstraints type.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      // Keep screen on simulation
      const wakeLock = (navigator as any).wakeLock ? await (navigator as any).wakeLock.request('screen') : null;
      
      // On mobile, send this stream to the signaling server
      // For this demo, we'll simulate the dashboard receiving it locally
      const mockId = Math.random().toString(36).substr(2, 9);
      setDevices(prev => [...prev, {
        id: mockId,
        name: `Device ${prev.length + 1}`,
        stream,
        connectedAt: Date.now(),
        isFocused: false,
        quality: 'high'
      }]);
      setIsSender(false); // Move back to dashboard for demo purposes
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  if (isSender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20">
          <span className="text-4xl">📱</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">Phone Streamer</h1>
        <p className="text-slate-400 mb-10 max-w-xs mx-auto">
          Ready to share your screen? The central dashboard will see your activity in real-time.
        </p>
        <button 
          onClick={startScreenShare}
          className="w-full max-w-xs py-4 px-8 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3"
        >
          <span className="text-xl">🚀</span>
          START SHARING
        </button>
        <div className="mt-12 p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-left w-full max-w-xs">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Requirements</p>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex gap-2">✅ iOS 13+ / Android Chrome</li>
            <li className="flex gap-2">✅ Stable Network</li>
            <li className="flex gap-2">✅ Do Not Disturb Mode (Recommended)</li>
          </ul>
        </div>
      </div>
    );
  }

  const gridClass = devices.length === 0 
    ? "flex items-center justify-center h-full"
    : focusedId 
      ? "grid grid-cols-1 gap-6 h-full"
      : `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6`;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-600 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Central Monitor</h1>
            <p className="text-xs text-slate-500 font-mono">{MOCK_ROOM_ID}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-xs font-bold text-slate-400">STATUS</span>
            <span className="text-sm text-green-400 font-medium">● Operational</span>
          </div>
          <button 
            onClick={() => setShowQR(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Add Device
          </button>
        </div>
      </header>

      {/* Dashboard Main Area */}
      <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-24 h-24 mb-6 opacity-20">
               <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4V6z"></path></svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No Devices Connected</h3>
            <p className="text-sm mb-8">Scan the QR code to connect your first mobile device.</p>
            <button 
              onClick={() => setShowQR(true)}
              className="px-6 py-3 border-2 border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl transition-all"
            >
              Get Pairing Code
            </button>
          </div>
        ) : (
          <div className={gridClass}>
            {devices.map(device => {
              // If focused, only show the focused one or show others in a sidebar? 
              // Simple version: Hide others when focused
              if (focusedId && device.id !== focusedId) return null;
              
              return (
                <div key={device.id} className={focusedId === device.id ? 'max-w-4xl mx-auto w-full' : ''}>
                  <DeviceCard
                    device={{...device, isFocused: focusedId === device.id}}
                    onFocus={handleFocus}
                    onRename={handleRename}
                    onRefresh={handleRefresh}
                  />
                  {focusedId === device.id && (
                    <button 
                      onClick={() => setFocusedId(null)}
                      className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg block mx-auto text-sm"
                    >
                      Close Focus Mode
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="px-6 py-2 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center shrink-0">
        <div className="flex gap-4">
          <span>Active Streams: {devices.length}</span>
          <span>Latency: ~50ms</span>
          <span>Protocol: WebRTC/UDP</span>
        </div>
        <div>
          &copy; 2024 View-Only Monitor v1.0.0
        </div>
      </footer>

      {/* Modals */}
      {showQR && (
        <QRCodeModal 
          url={`${window.location.origin}${window.location.pathname}?mode=sender&room=${MOCK_ROOM_ID}`} 
          onClose={() => setShowQR(false)} 
        />
      )}
    </div>
  );
};

export default App;
