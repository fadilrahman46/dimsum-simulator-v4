import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Handshake,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  X,
} from 'lucide-react';
import { formatRupiah } from '../config/gameBalance';
import {
  acceptCurrentCounterOffer,
  applySupplierDealToPackPrice,
  assessOfferRisk,
  cancelNegotiationPolitely,
  evaluateNegotiationRound,
  getSupplierProfile,
  getSupplierRelationshipTier,
  startNegotiationSession,
  type NegotiationSessionState,
  type NegotiationTactic,
} from '../domain/negotiationEngine';
import { t } from '../i18n/translations';
import type { Language, SupplierRelationshipState } from '../types/game';
import { soundFx } from '../utils/audio';

export interface NegotiableLineItem {
  ingredientId: string;
  nameEn: string;
  nameId: string;
  packs: number;
  unitPackPrice: number;
}

interface SupplierNegotiationModalProps {
  language: Language;
  supplier: string;
  relationship: SupplierRelationshipState;
  items: NegotiableLineItem[];
  onComplete: (result: {
    supplier: string;
    outcome: 'ACCEPTED' | 'WALKED_OUT' | 'CANCELLED';
    discountRate: number;
    minPacks: number;
    trustDelta: number;
  }) => void;
  onClose: () => void;
}

const DISCOUNT_PRESETS = [0.05, 0.1, 0.15, 0.2, 0.25] as const;

export const SupplierNegotiationModal: React.FC<SupplierNegotiationModalProps> = ({
  language,
  supplier,
  relationship,
  items,
  onComplete,
  onClose,
}) => {
  const profile = useMemo(() => getSupplierProfile(supplier), [supplier]);
  const totalPacks = useMemo(
    () => items.reduce((sum, item) => sum + item.packs, 0),
    [items],
  );
  const baseSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.packs * item.unitPackPrice, 0),
    [items],
  );

  const initialInit = useMemo(
    () =>
      startNegotiationSession({
        supplier,
        baseSubtotal,
        packCount: totalPacks,
        relationship,
      }),
    [supplier, baseSubtotal, totalPacks, relationship],
  );

  const [session, setSession] = useState<NegotiationSessionState | null>(
    initialInit.ok ? initialInit.session : null,
  );
  const [tactic, setTactic] = useState<NegotiationTactic>('friendly');
  const [targetDiscount, setTargetDiscount] = useState<number>(0.1);
  const [outcomeRecorded, setOutcomeRecorded] = useState(false);

  const activeDiscount = session?.currentOfferDiscount ?? 0;
  const discountedSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + item.packs * applySupplierDealToPackPrice(item.unitPackPrice, activeDiscount),
        0,
      ),
    [items, activeDiscount],
  );
  const currentSavings = Math.max(0, baseSubtotal - discountedSubtotal);

  const requestedSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + item.packs * applySupplierDealToPackPrice(item.unitPackPrice, targetDiscount),
        0,
      ),
    [items, targetDiscount],
  );

  const riskPreview = useMemo(() => {
    if (!session) return null;
    return assessOfferRisk(session, tactic, targetDiscount);
  }, [session, tactic, targetDiscount]);

  const commitOutcomeIfNeeded = (finalSession: NegotiationSessionState) => {
    if (outcomeRecorded) return;
    if (
      finalSession.status === 'ACCEPTED' ||
      finalSession.status === 'WALKED_OUT' ||
      finalSession.status === 'CANCELLED'
    ) {
      setOutcomeRecorded(true);
      onComplete({
        supplier: finalSession.supplier,
        outcome: finalSession.status,
        discountRate:
          finalSession.status === 'ACCEPTED' ? finalSession.currentOfferDiscount : 0,
        minPacks: finalSession.packCount,
        trustDelta: finalSession.trustDeltaTotal,
      });
    }
  };

  const handleSendOffer = () => {
    if (!session || session.status !== 'ACTIVE') return;
    const next = evaluateNegotiationRound(session, {
      tactic,
      requestedDiscountRate: targetDiscount,
    });
    if (next.status === 'ACCEPTED') {
      soundFx.playSuccess();
      commitOutcomeIfNeeded(next);
    } else if (next.status === 'WALKED_OUT') {
      soundFx.playError();
      commitOutcomeIfNeeded(next);
    } else {
      soundFx.playClick();
    }
    setSession(next);
  };

  const handleAcceptCounter = () => {
    if (!session || session.status !== 'ACTIVE' || session.currentOfferDiscount <= 0) return;
    const next = acceptCurrentCounterOffer(session);
    soundFx.playSuccess();
    commitOutcomeIfNeeded(next);
    setSession(next);
  };

  const handleWalkAway = () => {
    if (!session) {
      onClose();
      return;
    }
    if (session.status === 'ACTIVE') {
      const next = cancelNegotiationPolitely(session);
      soundFx.playClick();
      commitOutcomeIfNeeded(next);
    }
    onClose();
  };

  if (!initialInit.ok || !session) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#1C3529]/65">
        <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 bg-[#244D3B] text-[#FAF5EA]">
            <h3 className="font-display text-lg font-bold">{supplier}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2.5 text-sm text-[#991B1B]">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{!initialInit.ok ? (language === 'id' ? initialInit.reasonId : initialInit.reasonEn) : ''}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-[#244D3B] text-white font-semibold text-sm cursor-pointer"
            >
              {t(language, 'Back to Market', 'Kembali ke Pasar')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const trustTier = getSupplierRelationshipTier(session.currentTrust);
  const trustLabel =
    trustTier === 'trusted'
      ? t(language, 'Trusted Partner (-5% passive)', 'Mitra Tepercaya (-5% pasif)')
      : trustTier === 'good'
        ? t(language, 'Good Standing', 'Hubungan Baik')
        : trustTier === 'wary'
          ? t(language, 'Wary', 'Waspada')
          : t(language, 'Strained (+10% surcharge)', 'Tegang (+10% harga)');

  const patienceColor =
    session.patience >= 60
      ? 'bg-[#3D7A5A]'
      : session.patience >= 30
        ? 'bg-[#D97706]'
        : 'bg-[#DC2626]';

  const riskText =
    riskPreview?.risk === 'extreme'
      ? t(language, 'Extreme Risk · High walk-out danger', 'Risiko Ekstrem · Berisiko batal')
      : riskPreview?.risk === 'high'
        ? t(language, 'High Risk · Heavy patience drain', 'Risiko Tinggi · Kesabaran cepat habis')
        : riskPreview?.risk === 'medium'
          ? t(language, 'Balanced Risk · Moderate counter chance', 'Risiko Sedang · Peluang kompromi')
          : t(language, 'Low Risk · Safe & builds goodwill', 'Risiko Rendah · Aman & bangun relasi');

  const riskTextColor =
    riskPreview?.risk === 'extreme'
      ? 'text-[#B91C1C]'
      : riskPreview?.risk === 'high'
        ? 'text-[#B45309]'
        : riskPreview?.risk === 'medium'
          ? 'text-[#244D3B]'
          : 'text-[#15803D]';

  const latestRound = session.history[session.history.length - 1];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/65">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-[#ED9B53] shrink-0" />
              <h2 className="font-display text-lg md:text-xl font-bold truncate">
                {t(language, 'Wholesale Bulk Negotiation', 'Negosiasi Harga Grosir')} · {supplier}
              </h2>
            </div>
            <div className="text-xs text-[#D9E8C8] mt-0.5 flex flex-wrap items-center gap-2">
              <span>{language === 'id' ? profile.specialtyId : profile.specialtyEn}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {t(language, `${totalPacks} packs in bulk order`, `${totalPacks} kemasan grosir`)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {t(language, `Round ${session.round} of ${session.maxRounds}`, `Ronde ${session.round} dari ${session.maxRounds}`)}
              </span>
            </div>
          </div>
          <button
            onClick={handleWalkAway}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="Close Negotiation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {/* Top Status Meters: Relationship Trust & Supplier Patience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white border border-[#244D3B]/12 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#587567] flex items-center gap-1.5">
                  {trustTier === 'strained' || trustTier === 'wary' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-[#B45309]" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-[#244D3B]" />
                  )}
                  {t(language, 'Supplier Trust', 'Kepercayaan Pemasok')}
                </span>
                <span className="font-mono tabular-nums font-bold text-[#244D3B]">
                  {session.currentTrust}/100
                </span>
              </div>
              <div className="h-2 w-full rounded-sm bg-[#E7E0D0] overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    trustTier === 'strained'
                      ? 'bg-[#DC2626]'
                      : trustTier === 'wary'
                        ? 'bg-[#D97706]'
                        : 'bg-[#244D3B]'
                  }`}
                  style={{ width: `${session.currentTrust}%` }}
                />
              </div>
              <div className="text-xs font-medium text-[#587567] flex items-center justify-between">
                <span>{trustLabel}</span>
                {session.trustDeltaTotal !== 0 && (
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      session.trustDeltaTotal > 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {session.trustDeltaTotal > 0 ? `+${session.trustDeltaTotal}` : session.trustDeltaTotal}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#244D3B]/12 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#587567] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[#244D3B]" />
                  {t(language, 'Supplier Patience', 'Kesabaran Pemasok')}
                </span>
                <span className="font-mono tabular-nums font-bold text-[#244D3B]">
                  {session.patience}%
                </span>
              </div>
              <div className="h-2 w-full rounded-sm bg-[#E7E0D0] overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${patienceColor}`}
                  style={{ width: `${session.patience}%` }}
                />
              </div>
              <div className="text-xs text-[#587567]">
                {session.patience >= 60
                  ? t(language, 'Open to reasonable bulk offers.', 'Terbuka untuk tawaran grosir yang wajar.')
                  : session.patience >= 30
                    ? t(language, 'Getting tense — avoid extreme demands.', 'Mulai tegang — hindari permintaan ekstrem.')
                    : session.patience > 0
                      ? t(language, 'Near breaking point! One harsh push may end deals.', 'Hampir habis sabar! Tekanan keras bisa gagalkan deal.')
                      : t(language, 'Negotiation collapsed.', 'Kesabaran habis, negosiasi batal.')}
              </div>
            </div>
          </div>

          {/* Bulk Quote Summary */}
          <div className="p-4 rounded-xl bg-[#F6EBD4]/80 border border-[#244D3B]/15 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#587567]">
                {t(language, 'Bulk Cart Items', 'Item Grosir')}
              </div>
              <div className="text-sm font-semibold text-[#244D3B]">
                {items
                  .map(
                    (it) =>
                      `${it.packs}× ${language === 'id' ? it.nameId : it.nameEn}`,
                  )
                  .join(' · ')}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[11px] text-[#587567]">
                  {t(language, 'Standard Cost', 'Harga Normal')}
                </div>
                <div className="font-mono tabular-nums text-sm font-semibold text-[#587567] line-through">
                  {formatRupiah(baseSubtotal)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#587567]">
                  {t(language, 'Current Offer', 'Penawaran Saat Ini')}
                </div>
                <div className="font-mono tabular-nums text-base font-bold text-[#244D3B]">
                  {formatRupiah(discountedSubtotal)}
                  {activeDiscount > 0 && (
                    <span className="ml-2 text-xs text-[#15803D]">
                      (-{Math.round(activeDiscount * 100)}%)
                    </span>
                  )}
                </div>
              </div>
              {currentSavings > 0 && (
                <div>
                  <div className="text-[11px] text-[#15803D]">
                    {t(language, 'Savings', 'Hemat')}
                  </div>
                  <div className="font-mono tabular-nums text-sm font-bold text-[#15803D]">
                    -{formatRupiah(currentSavings)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Response / Dialogue Box */}
          <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#587567]">
              <span className="font-semibold text-[#244D3B]">{supplier}</span>
              <span className="font-mono tabular-nums">
                {latestRound
                  ? t(language, `Round ${latestRound.round} Response`, `Respons Ronde ${latestRound.round}`)
                  : t(language, 'Opening Quote', 'Harga Pembuka')}
              </span>
            </div>
            <p className="text-sm text-[#1C3529] leading-relaxed">
              {latestRound
                ? language === 'id'
                  ? latestRound.messageId
                  : latestRound.messageEn
                : session.currentOfferDiscount > 0
                  ? t(
                      language,
                      `"Good to see you ordering ${totalPacks} packs in bulk! Since you're a solid buyer, I'll start you off with ${Math.round(session.currentOfferDiscount * 100)}% off—or let's talk numbers."`,
                      `"Senang melihat pesanan grosir ${totalPacks} kemasan! Sebagai pembuka saya beri ${Math.round(session.currentOfferDiscount * 100)}% diskon—silakan ajukan penawaranmu."`,
                    )
                  : t(
                      language,
                      `"Ordering ${totalPacks} packs today? Standard total is ${formatRupiah(baseSubtotal)}. Make me a fair bulk offer."`,
                      `"Pesan ${totalPacks} kemasan hari ini? Total standarnya ${formatRupiah(baseSubtotal)}. Ajukan penawaran grosir yang masuk akal."`,
                    )}
            </p>
          </div>

          {/* Interactive Controls OR Final Outcome Banner */}
          {session.status === 'ACTIVE' ? (
            <div className="space-y-4">
              {/* Step 1: Target Discount */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#244D3B]">
                    {t(language, '1. Choose Target Discount', '1. Pilih Target Diskon')}
                  </label>
                  <div className="font-mono tabular-nums text-xs font-bold text-[#244D3B]">
                    {Math.round(targetDiscount * 100)}% off ·{' '}
                    {formatRupiah(requestedSubtotal)} (
                    <span className="text-[#15803D]">
                      -{formatRupiah(Math.max(0, baseSubtotal - requestedSubtotal))}
                    </span>
                    )
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {DISCOUNT_PRESETS.map((pct) => {
                    const selected = Math.abs(targetDiscount - pct) < 0.005;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setTargetDiscount(pct);
                        }}
                        className={`px-3.5 py-2 rounded-lg font-mono tabular-nums text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          selected
                            ? 'bg-[#244D3B] text-white'
                            : 'bg-white border border-[#244D3B]/15 text-[#244D3B] hover:bg-[#D9E8C8]/50'
                        }`}
                      >
                        -{Math.round(pct * 100)}%
                      </button>
                    );
                  })}
                  <input
                    type="range"
                    min={3}
                    max={28}
                    step={1}
                    value={Math.round(targetDiscount * 100)}
                    onChange={(e) => setTargetDiscount(Number(e.target.value) / 100)}
                    className="flex-1 min-w-[140px] accent-[#244D3B] cursor-pointer"
                    aria-label="Target discount percentage"
                  />
                </div>
              </div>

              {/* Step 2: Bargaining Tactic */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#244D3B]">
                  {t(language, '2. Select Bargaining Approach', '2. Pilih Gaya Negosiasi')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'friendly' as const,
                        titleEn: 'Friendly Partnership',
                        titleId: 'Pendekatan Persahabatan',
                        descEn: 'Low patience cost · +3 Trust on deal',
                        descId: 'Hemat kesabaran · +3 Kepercayaan jika deal',
                      },
                      {
                        id: 'firm' as const,
                        titleEn: 'Market Benchmark',
                        titleId: 'Banding Harga Pasar',
                        descEn: 'Balanced risk · Fair margin push',
                        descId: 'Risiko seimbang · Dorong margin wajar',
                      },
                      {
                        id: 'aggressive' as const,
                        titleEn: 'Aggressive Squeeze',
                        titleId: 'Tekan Harga Maksimal',
                        descEn: 'Deepest cap · Heavy trust risk',
                        descId: 'Potongan terdalam · Risiko rusak relasi',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = tactic === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setTactic(opt.id);
                        }}
                        className={`p-3 rounded-xl text-left transition-colors cursor-pointer border ${
                          active
                            ? 'bg-[#244D3B] text-white border-[#244D3B]'
                            : 'bg-white text-[#244D3B] border-[#244D3B]/15 hover:bg-[#F6EBD4]/60'
                        }`}
                      >
                        <div className="text-xs font-bold">
                          {language === 'id' ? opt.titleId : opt.titleEn}
                        </div>
                        <div
                          className={`text-[11px] mt-1 ${
                            active ? 'text-[#D9E8C8]' : 'text-[#587567]'
                          }`}
                        >
                          {language === 'id' ? opt.descId : opt.descEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Risk Preview Line */}
              {riskPreview && (
                <div className={`flex items-center gap-2 text-xs font-semibold ${riskTextColor}`}>
                  {riskPreview.risk === 'high' || riskPreview.risk === 'extreme' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 shrink-0" />
                  )}
                  <span>{riskText}</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`p-4 rounded-xl border ${
                session.status === 'ACCEPTED'
                  ? 'bg-[#D9E8C8]/70 border-[#244D3B]/25 text-[#1C3529]'
                  : 'bg-[#FEE2E2]/80 border-[#B91C1C]/25 text-[#7F1D1D]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {session.status === 'ACCEPTED' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="text-sm font-bold">
                    {session.status === 'ACCEPTED'
                      ? t(
                          language,
                          `Bulk Discount Locked: ${Math.round(session.currentOfferDiscount * 100)}% Off`,
                          `Diskon Grosir Disepakati: ${Math.round(session.currentOfferDiscount * 100)}%`,
                        )
                      : t(
                          language,
                          'Supplier Walked Out — Relationship Damaged',
                          'Pemasok Membatalkan — Hubungan Memburuk',
                        )}
                  </div>
                  <p>
                    {session.status === 'ACCEPTED'
                      ? t(
                          language,
                          `You save ${formatRupiah(currentSavings)} on this ${totalPacks}-pack bulk order. Confirm purchase in the market cart to apply it.`,
                          `Kamu hemat ${formatRupiah(currentSavings)} untuk pesanan grosir ${totalPacks} kemasan ini. Klik Bayar di keranjang pasar untuk memakainya.`,
                        )
                      : t(
                          language,
                          `Trust dropped to ${session.currentTrust}/100. Future orders from ${supplier} carry strained pricing until trust recovers.`,
                          `Kepercayaan turun menjadi ${session.currentTrust}/100. Pesanan dari ${supplier} terkena penyesuaian harga sampai hubungan pulih.`,
                        )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-[#244D3B]/15 flex flex-wrap items-center justify-between gap-3">
          {session.status === 'ACTIVE' ? (
            <>
              <button
                type="button"
                onClick={handleWalkAway}
                className="px-4 py-2 rounded-xl border border-[#244D3B]/20 text-[#587567] hover:text-[#244D3B] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {t(language, 'Walk Away', 'Batalkan')}
              </button>
              <div className="flex flex-wrap items-center gap-2.5">
                {session.currentOfferDiscount > 0 && (
                  <button
                    type="button"
                    onClick={handleAcceptCounter}
                    className="px-4 py-2.5 rounded-xl bg-[#D9E8C8] hover:bg-[#C6DDB0] text-[#1C3529] font-bold text-xs cursor-pointer whitespace-nowrap"
                  >
                    {t(
                      language,
                      `Accept ${Math.round(session.currentOfferDiscount * 100)}% Counter`,
                      `Terima Tawaran ${Math.round(session.currentOfferDiscount * 100)}%`,
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendOffer}
                  className="px-5 py-2.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold text-sm cursor-pointer whitespace-nowrap"
                >
                  {t(
                    language,
                    `Propose ${Math.round(targetDiscount * 100)}% Off`,
                    `Ajukan Diskon ${Math.round(targetDiscount * 100)}%`,
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#244D3B] hover:bg-[#1C3529] text-white font-bold text-sm cursor-pointer whitespace-nowrap"
              >
                {t(language, 'Return to Market Cart', 'Kembali ke Keranjang Pasar')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
