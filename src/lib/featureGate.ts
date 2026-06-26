import type { Tier } from '@/store/userStore'

export function maxPagesForTier(tier: Tier): number {
  if (tier === 'free') return 10
  if (tier === 'starter') return 100
  return Infinity
}

export function maxDesignsPerMonth(tier: Tier): number {
  if (tier === 'free') return 3
  return Infinity
}

export function maxAIGenerationsPerMonth(tier: Tier): number {
  if (tier === 'free') return 3
  return Infinity
}

export function canExportWithoutWatermark(tier: Tier): boolean {
  return tier !== 'free'
}

export function canExportCMYK(tier: Tier): boolean {
  return tier !== 'free'
}

export function canUseCustomPaperSize(tier: Tier): boolean {
  return tier === 'pro'
}

export function canUseMultiUpLayout(tier: Tier): boolean {
  return tier === 'pro'
}

export function canUseImposedPDF(tier: Tier): boolean {
  return tier === 'pro'
}
