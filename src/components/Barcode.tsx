import { useEffect, useRef } from 'react';
import bwipjs from 'bwip-js/browser';

interface BarcodeProps {
  value: string;
  className?: string;
}

export function Barcode({ value, className }: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'code128',
          text: value,
          scale: 3,
          height: 10,
          includetext: true,
          textxalign: 'center',
          textsize: 8,
          backgroundcolor: 'FFFFFF',
          paddingwidth: 1,
          paddingheight: 1,
        });
      } catch (e) {
        console.error('Barcode rendering error', e);
      }
    }
  }, [value]);

  return <canvas ref={canvasRef} className={className} />;
}
