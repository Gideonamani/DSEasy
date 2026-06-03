import type { TrendDataPoint, DividendEntry } from "../types/market";

export interface DcaSimulationResult {
  timeline: DcaTimelineStep[];
  totalContributed: number;
  finalValue: number;
  totalDividends: number;
  yieldOnCost: number;
  totalSharesOwned: number;
  hasProjections: boolean;
  historicalYears: number;
  projectedYears: number;
  cagrUsed: number;
  divYieldUsed: number;
}

export interface DcaTimelineStep {
  date: string;
  type: "contribution" | "drip" | "dividend_cash" | "projection";
  amount: number;
  price: number;
  sharesBought: number;
  sharesOwned: number;
  cashBalance: number;
  portfolioValue: number;
  totalContributed: number;
}

const parseSheetDate = (sheetName: string): Date | null => {
  if (!sheetName) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(sheetName)) {
    return new Date(sheetName);
  }
  const match = sheetName.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const year = parseInt(match[3]);
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  return new Date(year, months[monthStr], day);
};

function findClosePrice(targetDate: Date, data: Array<TrendDataPoint & { parsedDate: Date }>): { price: number; actualDate: Date } {
  for (const entry of data) {
    if (entry.parsedDate.getTime() >= targetDate.getTime()) {
      return { price: entry.close, actualDate: entry.parsedDate };
    }
  }
  const last = data[data.length - 1];
  return { price: last.close, actualDate: last.parsedDate };
}

export function runDcaSimulation(
  history: TrendDataPoint[],
  dividends: DividendEntry[],
  contributionAmount: number,
  periodicity: "monthly" | "quarterly",
  horizonYears: number,
  reinvestDividends: boolean
): DcaSimulationResult {
  const parsedHistory = history
    .map((h) => ({
      ...h,
      parsedDate: parseSheetDate(h.date || ""),
    }))
    .filter((h) => h.parsedDate !== null) as Array<TrendDataPoint & { parsedDate: Date }>;

  if (parsedHistory.length === 0) {
    return {
      timeline: [],
      totalContributed: 0,
      finalValue: 0,
      totalDividends: 0,
      yieldOnCost: 0,
      totalSharesOwned: 0,
      hasProjections: false,
      historicalYears: 0,
      projectedYears: horizonYears,
      cagrUsed: 0.08,
      divYieldUsed: 0.04,
    };
  }

  // Sort history chronologically
  parsedHistory.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  const endDate = parsedHistory[parsedHistory.length - 1].parsedDate;
  const targetStartDate = new Date(endDate);
  targetStartDate.setFullYear(endDate.getFullYear() - horizonYears);

  let simulationStartDate: Date;
  let hasProjections = false;
  let projectedYears = 0;
  let historicalYears = horizonYears;

  const earliestDate = parsedHistory[0].parsedDate;
  if (earliestDate > targetStartDate) {
    simulationStartDate = earliestDate;
    hasProjections = true;
    const diffMs = endDate.getTime() - earliestDate.getTime();
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    historicalYears = diffYears;
    projectedYears = Math.max(0, horizonYears - diffYears);
  } else {
    simulationStartDate = targetStartDate;
  }

  // Generate historical events
  const events: Array<{
    date: Date;
    type: "contribution" | "dividend_ex" | "dividend_pay" | "dividend_cash";
    amount: number;
    paymentDate?: Date;
  }> = [];

  // 1. Contribution Dates
  const stepMonths = periodicity === "monthly" ? 1 : 3;
  let nextContributionDate = new Date(simulationStartDate);
  while (nextContributionDate <= endDate) {
    events.push({
      date: new Date(nextContributionDate),
      type: "contribution",
      amount: contributionAmount,
    });
    nextContributionDate.setMonth(nextContributionDate.getMonth() + stepMonths);
  }

  // 2. Dividend Dates
  const parsedDividends = dividends
    .map((d) => ({
      ...d,
      parsedExDate: parseSheetDate(d.data.exDate),
      parsedPayDate: parseSheetDate(d.data.paymentDate),
    }))
    .filter((d) => d.parsedExDate !== null && d.parsedPayDate !== null) as Array<
    DividendEntry & { parsedExDate: Date; parsedPayDate: Date }
  >;

  for (const div of parsedDividends) {
    if (div.parsedExDate >= simulationStartDate && div.parsedExDate <= endDate) {
      events.push({
        date: div.parsedExDate,
        type: "dividend_ex",
        amount: div.data.amount,
        paymentDate: div.parsedPayDate,
      });
    }
  }

  // Priority sorting: dividend_ex first, then contribution, then payments
  const priority = {
    dividend_ex: 1,
    contribution: 2,
    dividend_pay: 3,
    dividend_cash: 3,
  };

  let sharesOwned = 0;
  let totalContributed = 0;
  let totalDividends = 0;
  let cashBalance = 0;
  const timeline: DcaTimelineStep[] = [];

  let i = 0;
  while (i < events.length) {
    // Keep events sorted as we might insert new payment events dynamically
    events.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      return priority[a.type] - priority[b.type];
    });

    const event = events[i];
    const dateStr = event.date.toISOString().split("T")[0];

    if (event.type === "contribution") {
      const { price } = findClosePrice(event.date, parsedHistory);
      const sharesBought = event.amount / price;
      sharesOwned += sharesBought;
      totalContributed += event.amount;
      timeline.push({
        date: dateStr,
        type: "contribution",
        amount: event.amount,
        price,
        sharesBought,
        sharesOwned,
        cashBalance,
        portfolioValue: sharesOwned * price + cashBalance,
        totalContributed,
      });
    } else if (event.type === "dividend_ex") {
      const grossDiv = sharesOwned * event.amount;
      const netDiv = grossDiv * 0.95; // 5% withholding tax
      if (netDiv > 0) {
        totalDividends += netDiv;
        if (reinvestDividends) {
          events.push({
            date: event.paymentDate!,
            type: "dividend_pay",
            amount: netDiv,
          });
        } else {
          events.push({
            date: event.paymentDate!,
            type: "dividend_cash",
            amount: netDiv,
          });
        }
      }
    } else if (event.type === "dividend_pay") {
      const { price } = findClosePrice(event.date, parsedHistory);
      const sharesBought = event.amount / price;
      sharesOwned += sharesBought;
      timeline.push({
        date: dateStr,
        type: "drip",
        amount: event.amount,
        price,
        sharesBought,
        sharesOwned,
        cashBalance,
        portfolioValue: sharesOwned * price + cashBalance,
        totalContributed,
      });
    } else if (event.type === "dividend_cash") {
      cashBalance += event.amount;
      const { price } = findClosePrice(event.date, parsedHistory);
      timeline.push({
        date: dateStr,
        type: "dividend_cash",
        amount: event.amount,
        price,
        sharesBought: 0,
        sharesOwned,
        cashBalance,
        portfolioValue: sharesOwned * price + cashBalance,
        totalContributed,
      });
    }

    i++;
  }

  // Calculate CAGR and Average Dividend Yield for Projections
  const firstPrice = parsedHistory[0].close;
  const lastPrice = parsedHistory[parsedHistory.length - 1].close;
  const numYears = (endDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  let cagr = 0.08; // Default 8% CAGR
  if (numYears > 0.1 && firstPrice > 0 && lastPrice > 0) {
    cagr = Math.pow(lastPrice / firstPrice, 1 / numYears) - 1;
  }
  cagr = Math.min(Math.max(cagr, -0.2), 0.3); // Clamp between -20% and +30%

  // Compute historical average dividend yield
  const sumOfDividendAmounts = dividends.reduce((sum, div) => sum + div.data.amount, 0);
  const averagePrice = parsedHistory.reduce((sum, h) => sum + h.close, 0) / parsedHistory.length;
  let divYield = 0.04; // Default 4% yield
  if (averagePrice > 0 && numYears > 0.1) {
    divYield = (sumOfDividendAmounts / averagePrice) / numYears;
  }
  divYield = Math.min(Math.max(divYield, 0), 0.15); // Clamp between 0% and 15%

  let currentPrice = lastPrice || 100;

  // Run Projection if horizon exceeds available history
  if (projectedYears > 0) {
    const totalProjMonths = Math.round(projectedYears * 12);
    const monthlyGrowthRate = Math.pow(1 + cagr, 1 / 12) - 1;
    const monthlyDivYield = divYield / 12;

    for (let m = 1; m <= totalProjMonths; m++) {
      currentPrice = currentPrice * (1 + monthlyGrowthRate);

      // Perform contribution on projection steps
      // Projection contributes periodically based on periodicity (monthly or quarterly)
      const isContributionStep = (periodicity === "monthly") || (m % 3 === 0);
      let sharesBought = 0;
      let stepAmount = 0;

      if (isContributionStep) {
        stepAmount = contributionAmount;
        sharesBought = contributionAmount / currentPrice;
        sharesOwned += sharesBought;
        totalContributed += contributionAmount;
      }

      // Continuous projected dividend payment model (monthly)
      const monthlyGrossDiv = sharesOwned * currentPrice * monthlyDivYield;
      const monthlyNetDiv = monthlyGrossDiv * 0.95;
      
      let projSharesBoughtFromDrip = 0;

      if (monthlyNetDiv > 0) {
        totalDividends += monthlyNetDiv;
        if (reinvestDividends) {
          projSharesBoughtFromDrip = monthlyNetDiv / currentPrice;
          sharesOwned += projSharesBoughtFromDrip;
        } else {
          cashBalance += monthlyNetDiv;
        }
      }

      const projDate = new Date(endDate);
      projDate.setMonth(endDate.getMonth() + m);
      const projDateStr = projDate.toISOString().split("T")[0];

      timeline.push({
        date: projDateStr,
        type: "projection",
        amount: stepAmount + (reinvestDividends ? monthlyNetDiv : 0),
        price: currentPrice,
        sharesBought: sharesBought + projSharesBoughtFromDrip,
        sharesOwned,
        cashBalance,
        portfolioValue: sharesOwned * currentPrice + cashBalance,
        totalContributed,
      });
    }
  }

  const finalValue = sharesOwned * currentPrice + cashBalance;
  const annualisedNetDividends = sharesOwned * currentPrice * divYield * 0.95;
  const yieldOnCost = totalContributed > 0 ? (annualisedNetDividends / totalContributed) * 100 : 0;

  return {
    timeline,
    totalContributed,
    finalValue,
    totalDividends,
    yieldOnCost,
    totalSharesOwned: sharesOwned,
    hasProjections,
    historicalYears,
    projectedYears,
    cagrUsed: cagr,
    divYieldUsed: divYield,
  };
}
