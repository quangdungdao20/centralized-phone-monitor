
import React, { useEffect, useRef } from 'react';

interface QRCodeModalProps {
  url: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ url, onClose }) => {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
      new (window as any).QRCode(qrRef.current, {
        text: url,
        width: 256,
        height: 256,
        colorDark : "#0f172a",
        colorLight : "#ffffff",
        correctLevel : (window as any).QRCode.CorrectLevel.H
      });
    }
  }, [url]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-slate-900 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-2">Add New Device</h2>
        <p className="text-slate-500 text-center mb-6 text-sm">
          Scan this QR code with your mobile phone to start sharing your screen.
        </p>
        
        <div className="bg-slate-100 p-4 rounded-xl mb-6 shadow-inner border border-slate-200">
          <div ref={qrRef}></div>
        </div>

        <div className="w-full bg-slate-50 p-3 rounded-lg border border-dashed border-slate-300 mb-6 overflow-hidden">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Pairing URL</p>
           <a className="text-xs text-slate-600 truncate" href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
