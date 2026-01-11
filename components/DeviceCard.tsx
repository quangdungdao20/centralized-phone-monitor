
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
    }
  }, [device.stream]);

  const duration = Math.floor((Date.now() - device.connectedAt) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div 
      className={`relative group bg-slate-800 rounded-lg overflow-hidden border-2 transition-all ${
        device.isFocused ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* Video Stream */}
      <div 
        className="aspect-[9/16] bg-black flex items-center justify-center cursor-pointer"
        onClick={() => onFocus(device.id)}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
      </div>

      {/* Overlay Info */}
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col">
          <input
            type="text"
            value={device.name}
            onChange={(e) => onRename(device.id, e.target.value)}
            className="bg-transparent border-none text-sm font-bold focus:ring-0 text-white truncate w-32"
          />
          <span className="text-[10px] text-slate-300">
            {minutes}:{seconds.toString().padStart(2, '0')} online
          </span>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={(e) => { e.stopPropagation(); onRefresh(device.id); }}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
            title="Refresh Stream"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-2 bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-400 truncate max-w-[100px]">{device.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-1.5 bg-green-500" />
            <div className="w-0.5 h-2.5 bg-green-500" />
            <div className="w-0.5 h-3.5 bg-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
