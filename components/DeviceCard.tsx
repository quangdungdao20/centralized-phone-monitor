
import React, { useEffect, useRef } from 'react';
import { DeviceStream } from '../types';

interface DeviceCardProps {
  device: DeviceStream;
  onFocus: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onRefresh: (id: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onFocus, onRename, onRefresh }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && device.stream) {
      videoRef.current.srcObject = device.stream;
      
      // Cố gắng ép trình duyệt phát video nếu nó bị dừng
      const playVideo = async () => {
        try {
          if (videoRef.current) {
            await videoRef.current.play();
          }
        } catch (err) {
          console.error("Video play failed:", err);
        }
      };
      playVideo();
    }
  }, [device.stream]);

  const duration = Math.floor((Date.now() - device.connectedAt) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div 
      className={`relative group bg-slate-800 rounded-3xl overflow-hidden border-2 transition-all duration-500 ${
        device.isFocused ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-white/5 hover:border-white/20'
      }`}
    >
      {/* Video Stream Container */}
      <div 
        className="aspect-[9/16] bg-slate-950 flex items-center justify-center cursor-pointer relative overflow-hidden"
        onClick={() => onFocus(device.id)}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          className="w-full h-full object-cover"
        />
        
        {/* Loading Overlay if no track is active */}
        {!device.stream.active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 gap-4">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đang nhận dữ liệu...</p>
          </div>
        )}
      </div>

      {/* Info Overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 pointer-events-auto">
          <input
            type="text"
            value={device.name}
            onChange={(e) => onRename(device.id, e.target.value)}
            className="bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 text-white truncate w-24 tracking-tighter"
          />
        </div>
        <div className="bg-red-500 px-2 py-1 rounded-lg pointer-events-auto">
          <span className="text-[8px] font-black text-white uppercase tracking-tighter">Live</span>
        </div>
      </div>

      {/* Footer Status */}
      <div className="p-4 bg-slate-900/80 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRefresh(device.id); }}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
    </div>
  );
};