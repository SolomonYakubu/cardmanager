import { useState } from 'react';
import type { Patient, Card } from '../../core/domain/models';
import { QRCode } from './QRCode';
import { Barcode } from './Barcode';
import { CardIcon, SolidCalendarIcon, SolidUserIcon, SolidPhoneIcon, SolidPlusIcon } from './icons';

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
  const formattedDate = (card?.issuedAt ? new Date(card.issuedAt) : new Date())
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, ' / ');

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
              <div className="absolute bottom-3 left-[115px] right-3 flex flex-col">
                <span className={`text-[8px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                  PATIENT NAME
                </span>
                <h2 className={`text-base font-bold tracking-tight leading-none mb-1.5 truncate ${frontBackground ? 'text-white drop-shadow-md' : 'text-white'}`}>
                  {patient.name}
                </h2>
                
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col">
                    <span className={`text-[7px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                      HOSPITAL NO.
                    </span>
                    <span className={`font-mono text-xs font-bold ${frontBackground ? 'text-white drop-shadow-sm' : 'text-slate-200'}`}>
                      {hospitalNo}
                    </span>
                  </div>
                  
                  <div className="h-5 w-px bg-[#009688]/60" />
                  <div className="flex flex-col">
                    <span className={`text-[7px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                      WALLET NO.
                    </span>
                    <span className={`font-mono text-xs font-bold ${frontBackground ? 'text-white drop-shadow-sm' : 'text-slate-200'}`}>
                      {patient.walletNo || 'AY 00000000 00'}
                    </span>
                  </div>

                  <div className="h-5 w-px bg-[#009688]/60" />
                  <div className="flex flex-col">
                    <span className={`text-[7px] font-bold tracking-widest mb-0.5 ${frontBackground ? 'text-[#009688] drop-shadow-sm' : 'text-[#009688]'}`}>
                      BANK
                    </span>
                    <span className={`font-mono text-xs font-bold ${frontBackground ? 'text-white drop-shadow-sm' : 'text-slate-200'}`}>
                      Moniepoint
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
              {/* Left Side: QR Code + Instructions */}
              <div className="absolute left-2.5 top-[52%] -translate-y-1/2 flex items-center gap-1.5 max-w-[178px]">
                {/* QR Code inside White Rounded Box */}
                <div className="flex flex-col items-center justify-center bg-white p-[3px] rounded-lg border border-[#0f2b48]/30 shadow-md shrink-0">
                  <QRCode value={qrLink} className="h-[52px] w-[52px] rounded-sm overflow-hidden" />
                </div>

                {/* Instructions list */}
                <div className="flex flex-col gap-[4px] text-[#0f2b48] min-w-0 flex-1">
                  {/* Issued Date */}
                  <div className="flex items-center gap-1.5">
                    <SolidCalendarIcon className="w-4 h-4 shrink-0 text-[#0f2b48]" />
                    <span className="text-[8.5px] font-extrabold tracking-tight truncate">
                      Issued: {formattedDate}
                    </span>
                  </div>

                  {/* Instruction 1 */}
                  <div className="flex items-center gap-1.5">
                    <SolidUserIcon className="w-4 h-4 shrink-0 text-[#0f2b48]" />
                    <span className="text-[6.5px] font-bold leading-[1.15]">
                      Always present this card during registration and consultation.
                    </span>
                  </div>

                  {/* Instruction 2 */}
                  <div className="flex items-center gap-1.5">
                    <SolidPhoneIcon className="w-4 h-4 shrink-0 text-[#0f2b48]" />
                    <span className="text-[6.5px] font-bold leading-[1.15]">
                      Report lost card immediately.
                    </span>
                  </div>

                  {/* Instruction 3 */}
                  <div className="flex items-center gap-1.5">
                    <SolidPlusIcon className="w-4 h-4 shrink-0 text-[#0f2b48]" />
                    <span className="text-[6.5px] font-bold leading-[1.15]">
                      In case of emergency, bring this card to any UATH department.
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Right: Barcode in White Box */}
              <div className="absolute bottom-[9px] right-[14px] flex flex-col items-center justify-center w-[165px]">
                <div className="flex items-center justify-center h-[34px]">
                  <Barcode value={barcodeValue} className="h-6 w-auto max-w-full object-contain" />
                </div>
                <span className="text-[5px] text-white/70 font-medium tracking-wide mt-[-1px]">Powered by Blueguava &amp; Xenolink</span>
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
