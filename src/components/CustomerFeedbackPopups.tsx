import React from 'react';
import { MessageSquareQuote, Star, TrendingDown, TrendingUp, X } from 'lucide-react';
import { CUSTOMER_ARCHETYPES } from '../config/gameBalance';
import { getReputationTrafficBonusPct } from '../domain/customerEngine';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';

export const CustomerFeedbackPopups: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const feedbackPopups = useGameStore((s) => s.feedbackPopups);
  const dismissFeedbackPopup = useGameStore((s) => s.dismissFeedbackPopup);

  if (feedbackPopups.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-20 [@media(max-height:520px)]:top-14 right-3 md:right-5 z-[41] flex flex-col items-end gap-2 max-w-[calc(100vw-1.5rem)]"
      aria-live="polite"
    >
      {feedbackPopups.map((fb) => {
        const arch = CUSTOMER_ARCHETYPES.find((a) => a.id === fb.archetypeId);
        const trafficBonusPct = getReputationTrafficBonusPct(fb.newReputation);
        const isPositive = fb.reputationDelta > 0;
        const isNegative = fb.reputationDelta < 0;

        return (
          <div
            key={fb.id}
            className={`pointer-events-auto w-72 sm:w-80 [@media(max-height:520px)]:w-64 rounded-xl bg-[#FAF5EA] shadow-lg border-2 p-2.5 sm:p-3 text-xs transition-all ${
              fb.sentiment === 'positive'
                ? 'border-[#6E9B72]'
                : fb.sentiment === 'negative'
                  ? 'border-[#DC2626]/65'
                  : 'border-[#ED9B53]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white shrink-0"
                  style={{ backgroundColor: arch?.shirtColor ?? '#244D3B' }}
                >
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-[#244D3B] truncate">
                    {fb.customerName}
                    {arch && (
                      <span className="font-normal text-[#587567]">
                        {' '}
                        · {language === 'id' ? arch.nameId : arch.nameEn}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[1, 2, 3, 4, 5].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className={`w-3 h-3 ${
                          starIdx <= fb.ratingStars
                            ? 'fill-[#ED9B53] text-[#D97706]'
                            : 'text-[#D8CEBA]'
                        }`}
                      />
                    ))}
                    <span className="ml-1 font-mono tabular-nums text-[10px] font-semibold text-[#587567]">
                      {fb.satisfaction}%
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissFeedbackPopup(fb.id)}
                className="p-1 rounded-md text-[#587567] hover:text-[#244D3B] hover:bg-[#E9DEC8] cursor-pointer shrink-0"
                aria-label="Dismiss customer feedback"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="mt-2 text-[#244D3B] leading-snug bg-[#F6EBD4]/75 rounded-lg px-2.5 py-2 border border-[#244D3B]/10">
              “{language === 'id' ? fb.commentId : fb.commentEn}”
            </p>

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums">
              <span
                className={`inline-flex items-center gap-1 ${
                  isPositive
                    ? 'text-[#244D3B]'
                    : isNegative
                      ? 'text-[#991B1B]'
                      : 'text-[#587567]'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#6E9B72]" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[#DC2626]" />
                )}
                <span>
                  {t(language, 'Shop Rep', 'Reputasi Toko')}{' '}
                  {fb.reputationDelta > 0 ? `+${fb.reputationDelta}` : fb.reputationDelta} (
                  {fb.newReputation}/100)
                </span>
              </span>

              <span className="font-mono text-[#587567]">
                {trafficBonusPct >= 0 ? `+${trafficBonusPct}%` : `${trafficBonusPct}%`}{' '}
                {t(language, 'traffic', 'tamu')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
