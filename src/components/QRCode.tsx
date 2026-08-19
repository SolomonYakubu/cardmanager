import { useEffect, useRef } from 'react';
import bwipjs from 'bwip-js/browser';

interface QRCodeProps {
  value: string;
  className?: string;
}

export function QRCode({ value, className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'qrcode',
          text: value,
          scale: 3,
          backgroundcolor: 'FFFFFF',
          paddingwidth: 0,
          paddingheight: 0,
        });
      } catch (e) {
        console.error('QR Code rendering error', e);
      }
    }
  }, [value]);

  return <canvas ref={canvasRef} className={className} />;
}
