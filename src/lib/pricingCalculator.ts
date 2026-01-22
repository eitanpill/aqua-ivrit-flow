/**
 * Pricing Calculator Utility
 * Handles proration calculations, family discounts, and pricing breakdowns
 */

export interface ProrationResult {
  basePrice: number;
  totalDays: number;
  remainingDays: number;
  prorationFactor: number;
  proratedAmount: number;
  discountAmount: number;
}

export interface PricingBreakdown {
  baseAmount: number;
  prorationDiscount: number;
  familyDiscount: number;
  familyDiscountName?: string;
  finalAmount: number;
}

/**
 * Calculate prorated price based on start date within a period
 */
export function calculateProration(
  basePrice: number,
  startDate: Date,
  periodStart: Date,
  periodEnd: Date
): ProrationResult {
  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  let remainingDays: number;
  
  if (startDate <= periodStart) {
    remainingDays = totalDays;
  } else if (startDate > periodEnd) {
    remainingDays = 0;
  } else {
    remainingDays = Math.ceil(
      (periodEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
  }

  const prorationFactor = remainingDays / totalDays;
  const proratedAmount = Math.round(basePrice * prorationFactor * 100) / 100;
  const discountAmount = basePrice - proratedAmount;

  return {
    basePrice,
    totalDays,
    remainingDays,
    prorationFactor: Math.round(prorationFactor * 10000) / 10000,
    proratedAmount,
    discountAmount,
  };
}

/**
 * Calculate family discount percentage based on number of active children
 */
export function getFamilyDiscountPercentage(activeChildren: number): number {
  if (activeChildren >= 3) return 15; // 15% for 3+ children
  if (activeChildren >= 2) return 10; // 10% for 2 children
  return 0;
}

/**
 * Format currency in ILS
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
  }).format(amount);
}

/**
 * Calculate full pricing breakdown
 */
export function calculatePricingBreakdown(
  baseAmount: number,
  prorationDiscount: number = 0,
  familyDiscountPercent: number = 0,
  familyDiscountName?: string
): PricingBreakdown {
  const afterProration = baseAmount - prorationDiscount;
  const familyDiscount = Math.round(afterProration * (familyDiscountPercent / 100) * 100) / 100;
  const finalAmount = Math.max(0, afterProration - familyDiscount);

  return {
    baseAmount,
    prorationDiscount,
    familyDiscount,
    familyDiscountName,
    finalAmount,
  };
}
