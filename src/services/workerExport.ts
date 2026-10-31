import { Worker } from '../types';
import { buildVerifyUrl } from './verifyLink';

/**
 * Downloads a standard RFC 6350 vCard 3.0 for the worker
 */
export function downloadWorkerVCard(worker: Worker): void {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${worker.name}`,
    `N:${worker.name};;;;`,
    `TITLE:${worker.trade}`,
    `ORG:Madhya Pradesh BOCW Registered Workforce`,
    `TEL;TYPE=CELL,VOICE:${worker.phone}`,
    `NOTE:WurkUp Verified Artisan. Trade: ${worker.trade}. Daily Statutory Wage: INR ${worker.dailyBaseWage}. e-Shram UAN: ${worker.eShramUAN}. Emergency Contact: ${worker.emergencyContact.name} (${worker.emergencyContact.phone}). Verify at: ${buildVerifyUrl(worker.id)}`,
    `URL:${buildVerifyUrl(worker.id)}`,
    'END:VCARD',
  ].join('\r\n');

  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${worker.name.replace(/\s+/g, '_')}_WorkPass.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a tamper-evident digital work passport JSON file
 */
export function exportWorkerJsonPassport(worker: Worker, stats?: any): void {
  const payload = {
    standard: 'WurkUp Digital Labour Record',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    worker: {
      id: worker.id,
      name: worker.name,
      hindiName: worker.hindiName,
      trade: worker.trade,
      skillLevel: worker.skillLevel,
      dailyBaseWage: worker.dailyBaseWage,
      bocwRegistrationNo: worker.bocwRegistrationNo,
      eShramUAN: worker.eShramUAN,
      aadhaarMasked: `XXXX-XXXX-${worker.aadhaarLast4}`,
      bloodGroup: worker.bloodGroup,
      ratingSummary: worker.ratingSummary,
      activeSiteId: worker.activeSiteId,
    },
    verifiedStats: stats || null,
    verificationUrl: buildVerifyUrl(worker.id),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${worker.id}_work_passport.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
