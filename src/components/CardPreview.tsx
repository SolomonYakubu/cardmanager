import { useState } from 'react';
import type { Patient, Card } from '../../core/domain/models';
import { QRCode } from './QRCode';
import { Barcode } from './Barcode';
import { CardIcon } from './icons';

interface CardPreviewProps {
  patient: Patient | null;
  card: Card | null;
  frontBackground?: string | null;
  backBackground?: string | null;
}

export function CardPreview({ patient, card, frontBackground, backBackground }: CardPreviewProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!patient) {
    return (
      <div className="flex h-[255px] w-[405px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#2c2e35] bg-[#1a1b20]">
        <CardIcon className="text-4xl text-slate-500 mb-3" />
        <p className="text-xs font-semibold text-slate-400">Select a patient to preview credential</p>
      </div>
    );
  }

  const hospitalNo = patient.hospitalNo;
  const qrLink = `https://emr.hospital.local/patient/${patient.emrReference}`;
  const barcodeValue = card?.originalityCode ?? '0000000000000000';

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 3D Card Container */}
      <div 
        className="perspective-1000 cursor-pointer shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] rounded-2xl transition-all hover:shadow-[0_25px_60px_-15px_rgba(216,255,62,0.15)] hover:-translate-y-1"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div 
          className={`preserve-3d relative h-[255px] w-[405px] transition-transform duration-700 ${isFlipped ? 'rotate-y-180' : ''}`}
        >
          {/* ── Front of Card ── */}
          <div 
            className="backface-hidden absolute inset-0 rounded-2xl overflow-hidden bg-[#1a1b20] border border-[#2c2e35] shadow-inner"
            style={{ 
              backgroundImage: frontBackground ? `url(${frontBackground})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Default Header (Only when no custom design) */}
            {!frontBackground && (
              <div className="absolute top-0 left-0 right-0 h-2 bg-[#d8ff3e]" />
            )}
            
            <div className="flex flex-col h-full relative z-10">
              {/* Patient Details */}
              <div className="absolute bottom-4 left-[115px] flex flex-col">
                <span className={`text-[9px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                  PATIENT NAME
                </span>
                <h2 className={`text-lg font-bold tracking-tight leading-none mb-2 truncate max-w-[250px] ${frontBackground ? 'text-white drop-shadow-md' : 'text-white'}`}>
                  {patient.name}
                </h2>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className={`text-[8px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                      HOSPITAL NO.
                    </span>
                    <span className={`font-mono text-sm font-bold ${frontBackground ? 'text-white drop-shadow-sm' : 'text-slate-200'}`}>
                      {hospitalNo}
                    </span>
                  </div>
                  
                  <div className="h-7 w-px bg-[#009688]/60" />
                  <div className="flex flex-col">
                    <span className={`text-[8px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                      WALLET NO.
                    </span>
                    <span className={`font-mono text-sm font-bold ${frontBackground ? 'text-white drop-shadow-sm' : 'text-slate-200'}`}>
                      {patient.walletNo || 'AY 00000000 00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Back of Card ── */}
          <div 
            className="backface-hidden rotate-y-180 absolute inset-0 rounded-2xl overflow-hidden bg-[#1a1b20] border border-[#2c2e35] shadow-inner"
            style={{ 
              backgroundImage: backBackground ? `url(${backBackground})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="w-full h-full relative z-10">
              {/* Left Side: QR Code */}
              <div className="absolute left-7 top-[55%] -translate-y-1/2 flex flex-col items-center bg-white p-2 rounded-xl shadow-lg">
                <QRCode value={qrLink} className="h-[76px] w-[76px] rounded-sm overflow-hidden" />
              </div>

              {/* Bottom Right: Barcode */}
              <div className="absolute bottom-2 right-4 flex justify-center shadow-lg max-w-[60%]">
                <Barcode value={barcodeValue} className="h-6 w-auto max-w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flip Instruction Pill */}
      <button 
        onClick={() => setIsFlipped(!isFlipped)}
        className="rounded-full bg-[#1c1d22] px-4 py-1.5 text-[11px] font-bold text-slate-400 border border-[#2c2e35] transition hover:text-white hover:bg-[#25272e]"
      >
        Click card to flip ↺
      </button>
    </div>
  );
}
