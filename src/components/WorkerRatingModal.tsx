import React, { useState } from 'react';
import { Star, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Worker, WorkerReview } from '../types';
import { Language, t, bi } from '../services/i18n';
import { db } from '../services/db';

interface WorkerRatingModalProps {
  worker: Worker;
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onRatingAdded?: (review: WorkerReview) => void;
}

export const WorkerRatingModal: React.FC<WorkerRatingModalProps> = ({
  worker,
  lang,
  isOpen,
  onClose,
  onRatingAdded,
}) => {
  const [overallRating, setOverallRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [skillRating, setSkillRating] = useState<number>(5);
  const [safetyRating, setSafetyRating] = useState<number>(5);
  const [punctualityRating, setPunctualityRating] = useState<number>(5);
  const [raterName, setRaterName] = useState<string>('');
  const [raterRole, setRaterRole] = useState<WorkerReview['raterRole']>('supervisor');
  const [siteName, setSiteName] = useState<string>('Indore Metro Line 3 Viaduct Package');
  const [comment, setComment] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const getStarLabel = (score: number) => {
    switch (score) {
      case 5:
        return bi(lang, '5.0 — Outstanding craftsmanship & ethics', '5.0 — उत्कृष्ट कारीगरी व उच्च आचरण');
      case 4:
        return bi(lang, '4.0 — Very good work quality', '4.0 — बहुत अच्छा कार्य व गुणवत्ता');
      case 3:
        return bi(lang, '3.0 — Satisfactory performance', '3.0 — संतोषजनक प्रदर्शन');
      case 2:
        return bi(lang, '2.0 — Needs supervision & improvement', '2.0 — सुधार एवं मार्गदर्शन आवश्यक');
      case 1:
        return bi(lang, '1.0 — Unsatisfactory / Safety concern', '1.0 — असंतोषजनक / सुरक्षा उल्लंघन');
      default:
        return '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRaterName = raterName.trim() || (lang === 'hi' ? 'सत्यापित साइट सुपरवाइज़र' : 'Verified Site Supervisor');
    const finalComment = comment.trim() || (lang === 'hi' ? 'कारीगरी व अनुशासन मानकों के अनुरूप।' : 'Work performed in compliance with site safety and masonry quality standards.');

    const { review } = db.addWorkerReview({
      workerId: worker.id,
      raterName: finalRaterName,
      raterRole,
      siteName,
      rating: overallRating,
      skillRating,
      punctualityRating,
      safetyRating,
      comment: finalComment,
    });

    setIsSubmitted(true);
    if (onRatingAdded) {
      onRatingAdded(review);
    }

    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 1400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="worker-rating-modal-title"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-sand-200 bg-white p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-ink-400 hover:text-ink-800 rounded-full hover:bg-sand-100 transition-colors cursor-pointer"
          aria-label={bi(lang, 'Close modal', 'बंद करें')}
        >
          <X className="w-5 h-5" />
        </button>

        {isSubmitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 bg-forest-100 text-forest-700 rounded-full mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-ink-900">
              {t('reviewSubmitted', lang)}
            </h3>
            <p className="text-xs text-ink-600 max-w-sm mx-auto">
              {bi(
                lang,
                'Rating recorded in the cryptographic audit ledger. The worker rating score has been updated.',
                'रेटिंग सुरक्षित ऑडिट बहीखाते में दर्ज कर ली गई है। श्रमिक स्कोर अपडेट हो गया है।'
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brass-700">
                <Star className="w-4 h-4 fill-brass-500 text-brass-500" />
                <span>{t('rateWorkerTitle', lang)}</span>
              </div>
              <h2 id="worker-rating-modal-title" className="text-lg font-extrabold text-ink-900 mt-0.5">
                {lang === 'hi' ? worker.hindiName : worker.name}
              </h2>
              <p className="text-xs text-ink-500">
                {worker.trade} · <span className="font-mono">{worker.id}</span>
              </p>
            </div>

            {/* Overall Star Selection */}
            <div className="p-4 rounded-2xl bg-sand-50 border border-sand-200 text-center space-y-2">
              <label className="block text-xs font-bold text-ink-800 uppercase tracking-wider">
                {t('overallRating', lang)}
              </label>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || overallRating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setOverallRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 text-brass-500 hover:scale-125 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-brass-400 rounded-lg"
                      aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          active
                            ? 'fill-brass-400 text-brass-500 drop-shadow-xs'
                            : 'text-sand-300 stroke-1'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-semibold text-brass-800 min-h-[1.25rem]">
                {getStarLabel(hoverRating || overallRating)}
              </p>
            </div>

            {/* Sub-Category Ratings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-white rounded-xl border border-sand-200 space-y-1.5">
                <span className="font-bold text-ink-800 block text-[11px] leading-tight">
                  {t('craftsmanship', lang)}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkillRating(s)}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          skillRating >= s ? 'fill-brass-400 text-brass-500' : 'text-sand-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-[10px] font-mono font-bold text-ink-600 ml-1">{skillRating}.0</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-sand-200 space-y-1.5">
                <span className="font-bold text-ink-800 block text-[11px] leading-tight">
                  {t('safetyCompliance', lang)}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSafetyRating(s)}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          safetyRating >= s ? 'fill-brass-400 text-brass-500' : 'text-sand-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-[10px] font-mono font-bold text-ink-600 ml-1">{safetyRating}.0</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-sand-200 space-y-1.5">
                <span className="font-bold text-ink-800 block text-[11px] leading-tight">
                  {t('punctuality', lang)}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPunctualityRating(s)}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          punctualityRating >= s ? 'fill-brass-400 text-brass-500' : 'text-sand-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-[10px] font-mono font-bold text-ink-600 ml-1">{punctualityRating}.0</span>
                </div>
              </div>
            </div>

            {/* Reviewer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-700 mb-1">
                  {bi(lang, 'Evaluator Name', 'मूल्यांकनकर्ता का नाम')}
                </label>
                <input
                  type="text"
                  value={raterName}
                  onChange={(e) => setRaterName(e.target.value)}
                  placeholder={bi(lang, 'e.g. Anil Sisodiya (AE)', 'उदा. अनिल सिसौदिया (सहायक यंत्री)')}
                  className="w-full p-2.5 border border-sand-300 rounded-xl bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-700 mb-1">
                  {bi(lang, 'Evaluator Role', 'मूल्यांकनकर्ता की भूमिका')}
                </label>
                <select
                  value={raterRole}
                  onChange={(e) => setRaterRole(e.target.value as any)}
                  className="w-full p-2.5 border border-sand-300 rounded-xl bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
                >
                  <option value="supervisor">{t('raterRoleSupervisor', lang)}</option>
                  <option value="contractor">{t('raterRoleContractor', lang)}</option>
                  <option value="engineer">{t('raterRoleEngineer', lang)}</option>
                  <option value="peer">{t('raterRolePeer', lang)}</option>
                </select>
              </div>
            </div>

            {/* Comment */}
            <div className="text-xs">
              <label className="block font-semibold text-ink-700 mb-1">
                {bi(lang, 'Work Observation & Remarks', 'कार्य अवलोकन व टिप्पणी')}
              </label>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('feedbackPlaceholder', lang)}
                className="w-full p-2.5 border border-sand-300 rounded-xl bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest-600"
              />
            </div>

            {/* Trust notice */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-forest-50 border border-forest-200 text-[11px] text-forest-900">
              <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
              <span>{t('ratingScaleHelp', lang)}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-sand-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-ink-600 hover:bg-sand-100 rounded-xl transition-colors cursor-pointer"
              >
                {bi(lang, 'Cancel', 'रद्द करें')}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Star className="w-3.5 h-3.5 fill-brass-300 text-brass-300" />
                <span>{t('submitReview', lang)}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
