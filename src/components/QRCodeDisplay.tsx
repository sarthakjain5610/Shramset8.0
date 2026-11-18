import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Language } from '../services/i18n';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
  lang?: Language;
}

/**
 * Standards-compliant ISO/IEC 18004 QR Code renderer using standard Reed-Solomon error correction.
 * Scannable by any standard smartphone camera or QR scanning device.
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 140,
  className = '',
  lang = 'en',
}) => {
  // Bilingual helper: every user-facing string in this component is authored in
  // both languages, so a Hindi reader never sees an English fragment.
  const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    QRCode.toDataURL(value, {
      width: size * 2, // 2x density for crisp retina / print display
      margin: 1,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setHasError(false);
        }
      })
      .catch((err) => {
        console.warn('QR code generation error:', err);
        if (isMounted) {
          setHasError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (hasError || !dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-sand-50 border border-sand-200 rounded flex items-center justify-center p-2 text-center text-[10px] text-ink-400 ${className}`}
      >
        <span>{tr('Loading QR...', 'QR लोड हो रहा है...')}</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={tr('Standards-compliant QR Code for worker reference', 'मानक-अनुरूप QR कोड, कामगार संदर्भ हेतु')}
      width={size}
      height={size}
      className={`select-none bg-white rounded-md shadow-xs ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
