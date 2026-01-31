// Benchmark data from GVA spreadsheet for approval rate lookups

export interface VerticalBenchmark {
  name: string;
  approvalRate: number; // Parsed from ">XX%" format
}

export interface CountryBenchmark {
  name: string;
  approvalRate: number;
  currencyCode: string; // ISO 4217 currency code
  flag: string; // Emoji flag
}

// Top 10 world currencies with symbols
export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const topCurrencies: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
];

// Exchange rates to EUR (as of reference date - for 3DS AOV band calculation)
// These are approximate rates for demonstration; in production, use a live API
export const exchangeRatesToEUR: Record<string, number> = {
  EUR: 1.0,
  USD: 0.92,    // 1 USD = 0.92 EUR
  GBP: 1.17,    // 1 GBP = 1.17 EUR
  JPY: 0.0062,  // 1 JPY = 0.0062 EUR
  CNY: 0.13,    // 1 CNY = 0.13 EUR
  AUD: 0.60,    // 1 AUD = 0.60 EUR
  CAD: 0.68,    // 1 CAD = 0.68 EUR
  CHF: 1.05,    // 1 CHF = 1.05 EUR
  INR: 0.011,   // 1 INR = 0.011 EUR
  BRL: 0.17,    // 1 BRL = 0.17 EUR
};

// Exchange rates from USD (for investment pricing conversion)
export const exchangeRatesFromUSD: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,    // 1 USD = 0.92 EUR
  GBP: 0.79,    // 1 USD = 0.79 GBP
  JPY: 149.50,  // 1 USD = 149.50 JPY
  CNY: 7.24,    // 1 USD = 7.24 CNY
  AUD: 1.53,    // 1 USD = 1.53 AUD
  CAD: 1.36,    // 1 USD = 1.36 CAD
  CHF: 0.88,    // 1 USD = 0.88 CHF
  INR: 83.50,   // 1 USD = 83.50 INR
  BRL: 4.97,    // 1 USD = 4.97 BRL
};

// Convert amount from one currency to EUR
export const convertToEUR = (amount: number, fromCurrency: string): number => {
  const rate = exchangeRatesToEUR[fromCurrency] ?? exchangeRatesToEUR['USD'];
  return amount * rate;
};

// Convert amount from USD to target currency
export const convertFromUSD = (amount: number, toCurrency: string): number => {
  const rate = exchangeRatesFromUSD[toCurrency] ?? 1;
  return amount * rate;
};

// Convert between two currencies using USD as the pivot.
// Useful for re-converting already-converted values when base currency changes.
export const convertCurrencyViaUSD = (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number => {
  const fromRate = exchangeRatesFromUSD[fromCurrency] ?? 1;
  const toRate = exchangeRatesFromUSD[toCurrency] ?? 1;
  const amountInUSD = fromRate === 0 ? amount : amount / fromRate;
  return amountInUSD * toRate;
};

// Get exchange rate from currency to EUR
export const getExchangeRateToEUR = (fromCurrency: string): number => {
  return exchangeRatesToEUR[fromCurrency] ?? exchangeRatesToEUR['USD'];
};

// Get exchange rate from USD to target currency
export const getExchangeRateFromUSD = (toCurrency: string): number => {
  return exchangeRatesFromUSD[toCurrency] ?? 1;
};

// Get currency symbol by code
export const getCurrencySymbol = (currencyCode: string): string => {
  const currency = topCurrencies.find(c => c.code === currencyCode);
  return currency?.symbol ?? "$";
};

// Format currency with the correct symbol based on currency code
export const formatCurrencyValue = (
  value: number, 
  currencyCode: string = "USD",
  options?: { showSign?: boolean; showInMillions?: boolean }
): string => {
  const { showSign = false, showInMillions = false } = options ?? {};
  const absValue = Math.abs(value);
  
  let formatted: string;
  
  if (showInMillions) {
    const symbol = getCurrencySymbol(currencyCode);
    formatted = `${symbol}${(absValue / 1_000_000).toFixed(1)}M`;
  } else {
    formatted = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currencyCode, 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(absValue);
  }
  
  if (value < 0) return `(${formatted})`;
  if (value > 0 && showSign) return `+${formatted}`;
  return formatted;
};

// Helper to get currency by country (returns USD if not in top 10)
export const getCurrencyForCountry = (countryName: string): string => {
  const country = countryBenchmarks.find(
    (c) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  if (!country) return "USD";
  
  // Check if the country's currency is in the top 10
  const isTop10Currency = topCurrencies.some(c => c.code === country.currencyCode);
  return isTop10Currency ? country.currencyCode : "USD";
};

// Page 7: Sub-Vertical benchmarks
export const verticalBenchmarks: VerticalBenchmark[] = [
  { name: "Apparel", approvalRate: 99.5 },
  { name: "Auto Parts", approvalRate: 99 },
  { name: "B2B Services", approvalRate: 99 },
  { name: "Beauty", approvalRate: 99.5 },
  { name: "Consumer Services", approvalRate: 99 },
  { name: "Department Stores", approvalRate: 98.5 },
  { name: "Drug Stores & Pharmacies", approvalRate: 99.5 },
  { name: "Electronic Goods", approvalRate: 97.5 },
  { name: "Financial Services", approvalRate: 95.5 },
  { name: "Flowers, Gifts & Specialty Stores", approvalRate: 99 },
  { name: "Food & Beverage", approvalRate: 99.5 },
  { name: "Furniture", approvalRate: 99 },
  { name: "Gaming", approvalRate: 96 },
  { name: "Gift Cards / Discounts", approvalRate: 96.5 },
  { name: "Grocery", approvalRate: 99.5 },
  { name: "Ground Transportation", approvalRate: 98 },
  { name: "Home & Garden", approvalRate: 99.5 },
  { name: "Hospitality", approvalRate: 99 },
  { name: "Hotels / Lodging", approvalRate: 98.5 },
  { name: "Jewelry & Watch", approvalRate: 99 },
  { name: "Office Supplies", approvalRate: 99.5 },
  { name: "Online Delivery", approvalRate: 99.5 },
  { name: "OTA", approvalRate: 98 },
  { name: "QSR", approvalRate: 99.5 },
  { name: "Shoes", approvalRate: 99 },
  { name: "Software", approvalRate: 99 },
  { name: "Sporting Goods", approvalRate: 99.5 },
  { name: "Super Stores", approvalRate: 99 },
  { name: "Telecom", approvalRate: 97.5 },
  { name: "Ticket Brokers", approvalRate: 94 },
  { name: "Web Services", approvalRate: 98 },
  { name: "Wholesale", approvalRate: 99 },
];

// Page 8: Country benchmarks with currency codes and flags
export const countryBenchmarks: CountryBenchmark[] = [
  { name: "United States of America", approvalRate: 99, currencyCode: "USD", flag: "🇺🇸" },
  { name: "Japan", approvalRate: 99, currencyCode: "JPY", flag: "🇯🇵" },
  { name: "United Kingdom", approvalRate: 99, currencyCode: "GBP", flag: "🇬🇧" },
  { name: "Canada", approvalRate: 99, currencyCode: "CAD", flag: "🇨🇦" },
  { name: "Germany", approvalRate: 99, currencyCode: "EUR", flag: "🇩🇪" },
  { name: "China", approvalRate: 98, currencyCode: "CNY", flag: "🇨🇳" },
  { name: "France", approvalRate: 99, currencyCode: "EUR", flag: "🇫🇷" },
  { name: "Australia", approvalRate: 99, currencyCode: "AUD", flag: "🇦🇺" },
  { name: "Italy", approvalRate: 99, currencyCode: "EUR", flag: "🇮🇹" },
  { name: "Brazil", approvalRate: 97, currencyCode: "BRL", flag: "🇧🇷" },
  { name: "Spain", approvalRate: 99, currencyCode: "EUR", flag: "🇪🇸" },
  { name: "Poland", approvalRate: 99, currencyCode: "PLN", flag: "🇵🇱" },
  { name: "Norway", approvalRate: 99, currencyCode: "NOK", flag: "🇳🇴" },
  { name: "Netherlands", approvalRate: 99, currencyCode: "EUR", flag: "🇳🇱" },
  { name: "Mexico", approvalRate: 97, currencyCode: "MXN", flag: "🇲🇽" },
  { name: "Taiwan", approvalRate: 96, currencyCode: "TWD", flag: "🇹🇼" },
  { name: "Ireland", approvalRate: 99, currencyCode: "EUR", flag: "🇮🇪" },
  { name: "South Korea", approvalRate: 99, currencyCode: "KRW", flag: "🇰🇷" },
  { name: "Israel", approvalRate: 99, currencyCode: "ILS", flag: "🇮🇱" },
  { name: "Hong Kong", approvalRate: 98, currencyCode: "HKD", flag: "🇭🇰" },
  { name: "Sweden", approvalRate: 99, currencyCode: "SEK", flag: "🇸🇪" },
  { name: "Denmark", approvalRate: 99, currencyCode: "DKK", flag: "🇩🇰" },
  { name: "Singapore", approvalRate: 98, currencyCode: "SGD", flag: "🇸🇬" },
  { name: "Switzerland", approvalRate: 99, currencyCode: "CHF", flag: "🇨🇭" },
  { name: "Argentina", approvalRate: 95, currencyCode: "ARS", flag: "🇦🇷" },
  { name: "Malaysia", approvalRate: 96, currencyCode: "MYR", flag: "🇲🇾" },
  { name: "Saudi Arabia", approvalRate: 98, currencyCode: "SAR", flag: "🇸🇦" },
  { name: "Russia", approvalRate: 96, currencyCode: "RUB", flag: "🇷🇺" },
  { name: "Venezuela", approvalRate: 95, currencyCode: "VES", flag: "🇻🇪" },
  { name: "Austria", approvalRate: 99, currencyCode: "EUR", flag: "🇦🇹" },
  { name: "United Arab Emirates", approvalRate: 98, currencyCode: "AED", flag: "🇦🇪" },
  { name: "Belgium", approvalRate: 99, currencyCode: "EUR", flag: "🇧🇪" },
  { name: "Portugal", approvalRate: 99, currencyCode: "EUR", flag: "🇵🇹" },
  { name: "Greece", approvalRate: 99, currencyCode: "EUR", flag: "🇬🇷" },
  { name: "Dominican Republic", approvalRate: 96, currencyCode: "DOP", flag: "🇩🇴" },
  { name: "New Zealand", approvalRate: 99, currencyCode: "NZD", flag: "🇳🇿" },
  { name: "India", approvalRate: 97, currencyCode: "INR", flag: "🇮🇳" },
  { name: "Puerto Rico", approvalRate: 98, currencyCode: "USD", flag: "🇵🇷" },
  { name: "Thailand", approvalRate: 98, currencyCode: "THB", flag: "🇹🇭" },
  { name: "Turkey", approvalRate: 97, currencyCode: "TRY", flag: "🇹🇷" },
  { name: "Colombia", approvalRate: 96, currencyCode: "COP", flag: "🇨🇴" },
  { name: "Czech Republic", approvalRate: 99, currencyCode: "CZK", flag: "🇨🇿" },
  { name: "South Africa", approvalRate: 98, currencyCode: "ZAR", flag: "🇿🇦" },
  { name: "Finland", approvalRate: 99, currencyCode: "EUR", flag: "🇫🇮" },
  { name: "Vietnam", approvalRate: 98, currencyCode: "VND", flag: "🇻🇳" },
  { name: "Nigeria", approvalRate: 98, currencyCode: "NGN", flag: "🇳🇬" },
  { name: "Chile", approvalRate: 98, currencyCode: "CLP", flag: "🇨🇱" },
  { name: "Philippines", approvalRate: 97, currencyCode: "PHP", flag: "🇵🇭" },
  { name: "Romania", approvalRate: 99, currencyCode: "RON", flag: "🇷🇴" },
  { name: "Latvia", approvalRate: 99, currencyCode: "EUR", flag: "🇱🇻" },
  { name: "Peru", approvalRate: 97, currencyCode: "PEN", flag: "🇵🇪" },
  { name: "Hungary", approvalRate: 99, currencyCode: "HUF", flag: "🇭🇺" },
  { name: "Indonesia", approvalRate: 95, currencyCode: "IDR", flag: "🇮🇩" },
  { name: "Jamaica", approvalRate: 96, currencyCode: "JMD", flag: "🇯🇲" },
  { name: "Ecuador", approvalRate: 97, currencyCode: "USD", flag: "🇪🇨" },
  { name: "Kuwait", approvalRate: 98, currencyCode: "KWD", flag: "🇰🇼" },
  { name: "Ukraine", approvalRate: 97, currencyCode: "UAH", flag: "🇺🇦" },
  { name: "Qatar", approvalRate: 98, currencyCode: "QAR", flag: "🇶🇦" },
  { name: "Panama", approvalRate: 98, currencyCode: "USD", flag: "🇵🇦" },
  { name: "Cyprus", approvalRate: 99, currencyCode: "EUR", flag: "🇨🇾" },
  { name: "Lithuania", approvalRate: 99, currencyCode: "EUR", flag: "🇱🇹" },
  { name: "Croatia", approvalRate: 99, currencyCode: "EUR", flag: "🇭🇷" },
  { name: "Iceland", approvalRate: 99, currencyCode: "ISK", flag: "🇮🇸" },
  { name: "Malta", approvalRate: 99, currencyCode: "EUR", flag: "🇲🇹" },
  { name: "Morocco", approvalRate: 95, currencyCode: "MAD", flag: "🇲🇦" },
  { name: "Costa Rica", approvalRate: 98, currencyCode: "CRC", flag: "🇨🇷" },
  { name: "Egypt", approvalRate: 97, currencyCode: "EGP", flag: "🇪🇬" },
  { name: "Trinidad and Tobago", approvalRate: 98, currencyCode: "TTD", flag: "🇹🇹" },
  { name: "Pakistan", approvalRate: 95, currencyCode: "PKR", flag: "🇵🇰" },
  { name: "Slovakia", approvalRate: 99, currencyCode: "EUR", flag: "🇸🇰" },
  { name: "Kenya", approvalRate: 95, currencyCode: "KES", flag: "🇰🇪" },
  { name: "Jordan", approvalRate: 97, currencyCode: "JOD", flag: "🇯🇴" },
  { name: "Bulgaria", approvalRate: 98, currencyCode: "BGN", flag: "🇧🇬" },
  { name: "Slovenia", approvalRate: 99, currencyCode: "EUR", flag: "🇸🇮" },
  { name: "Bahamas", approvalRate: 98, currencyCode: "BSD", flag: "🇧🇸" },
  { name: "Estonia", approvalRate: 99, currencyCode: "EUR", flag: "🇪🇪" },
  { name: "Luxembourg", approvalRate: 99, currencyCode: "EUR", flag: "🇱🇺" },
  { name: "Honduras", approvalRate: 97, currencyCode: "HNL", flag: "🇭🇳" },
  { name: "Haiti", approvalRate: 97, currencyCode: "HTG", flag: "🇭🇹" },
  { name: "El Salvador", approvalRate: 98, currencyCode: "USD", flag: "🇸🇻" },
  { name: "Guatemala", approvalRate: 97, currencyCode: "GTQ", flag: "🇬🇹" },
  { name: "Kazakhstan", approvalRate: 97, currencyCode: "KZT", flag: "🇰🇿" },
  { name: "Palestine", approvalRate: 95, currencyCode: "ILS", flag: "🇵🇸" },
  { name: "Georgia", approvalRate: 98, currencyCode: "GEL", flag: "🇬🇪" },
  { name: "Guam", approvalRate: 98, currencyCode: "USD", flag: "🇬🇺" },
  { name: "Lebanon", approvalRate: 98, currencyCode: "LBP", flag: "🇱🇧" },
  { name: "Gabon", approvalRate: 98, currencyCode: "XAF", flag: "🇬🇦" },
  { name: "Bangladesh", approvalRate: 94, currencyCode: "BDT", flag: "🇧🇩" },
  { name: "Angola", approvalRate: 98, currencyCode: "AOA", flag: "🇦🇴" },
  { name: "Serbia", approvalRate: 97, currencyCode: "RSD", flag: "🇷🇸" },
  { name: "Paraguay", approvalRate: 98, currencyCode: "PYG", flag: "🇵🇾" },
  { name: "Uruguay", approvalRate: 97, currencyCode: "UYU", flag: "🇺🇾" },
  { name: "Maldives", approvalRate: 98, currencyCode: "MVR", flag: "🇲🇻" },
  { name: "Uzbekistan", approvalRate: 98, currencyCode: "UZS", flag: "🇺🇿" },
  { name: "Ghana", approvalRate: 93, currencyCode: "GHS", flag: "🇬🇭" },
  { name: "French Polynesia", approvalRate: 98, currencyCode: "XPF", flag: "🇵🇫" },
  { name: "Armenia", approvalRate: 98, currencyCode: "AMD", flag: "🇦🇲" },
  { name: "Bahrain", approvalRate: 98, currencyCode: "BHD", flag: "🇧🇭" },
  { name: "Aruba", approvalRate: 99, currencyCode: "AWG", flag: "🇦🇼" },
  { name: "Senegal", approvalRate: 97, currencyCode: "XOF", flag: "🇸🇳" },
  { name: "Bolivia", approvalRate: 96, currencyCode: "BOB", flag: "🇧🇴" },
  { name: "Oman", approvalRate: 98, currencyCode: "OMR", flag: "🇴🇲" },
  { name: "Cambodia", approvalRate: 96, currencyCode: "KHR", flag: "🇰🇭" },
  { name: "Azerbaijan", approvalRate: 97, currencyCode: "AZN", flag: "🇦🇿" },
  { name: "Zambia", approvalRate: 97, currencyCode: "ZMW", flag: "🇿🇲" },
  { name: "Mauritius", approvalRate: 98, currencyCode: "MUR", flag: "🇲🇺" },
  { name: "Albania", approvalRate: 97, currencyCode: "ALL", flag: "🇦🇱" },
  { name: "Moldova", approvalRate: 98, currencyCode: "MDL", flag: "🇲🇩" },
];

// Helper function to get approval rate by vertical
export const getVerticalApprovalRate = (verticalName: string): number | undefined => {
  const benchmark = verticalBenchmarks.find(
    (v) => v.name.toLowerCase() === verticalName.toLowerCase()
  );
  return benchmark?.approvalRate;
};

// Helper function to get approval rate by country
export const getCountryApprovalRate = (countryName: string): number | undefined => {
  const benchmark = countryBenchmarks.find(
    (c) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  return benchmark?.approvalRate;
};

// Calculate weighted average of vertical and country approval rates
export const getWeightedApprovalRate = (
  verticalName?: string,
  countryName?: string
): number | undefined => {
  const verticalRate = verticalName ? getVerticalApprovalRate(verticalName) : undefined;
  const countryRate = countryName ? getCountryApprovalRate(countryName) : undefined;

  if (verticalRate !== undefined && countryRate !== undefined) {
    // Average of both rates
    return (verticalRate + countryRate) / 2;
  } else if (verticalRate !== undefined) {
    return verticalRate;
  } else if (countryRate !== undefined) {
    return countryRate;
  }
  return undefined;
};

// Page 17: Existing Vendor benchmarks - CB rate reduction factors
export interface ExistingVendorBenchmark {
  name: string;
  cbRateReductionFactor: number; // Multiplier to apply to customer's current CB rate
}

// Values from LOOKUP: Chargeback Improvement spreadsheet tab, Column C
// Factor = 1 - reduction%. E.g., 34% reduction = 0.66 factor (target 66% of original)
export const existingVendorBenchmarks: ExistingVendorBenchmark[] = [
  { name: "Accertify", cbRateReductionFactor: 0.66 },               // 34% reduction
  { name: "Cybersource", cbRateReductionFactor: 0.23 },             // 77% reduction
  { name: "Kount", cbRateReductionFactor: 0.66 },                   // 34% reduction
  { name: "Ravelin", cbRateReductionFactor: 0.37 },                 // 63% reduction
  { name: "Riskified", cbRateReductionFactor: 0.46 },               // 54% reduction
  { name: "Sift", cbRateReductionFactor: 0.43 },                    // 57% reduction
  { name: "Signifyd", cbRateReductionFactor: 0.24 },                // 76% reduction
  { name: "Other", cbRateReductionFactor: 0.44 },                   // 56% reduction
];

// Helper function to get CB rate reduction factor by vendor
export const getVendorCBReductionFactor = (vendorName: string): number => {
  const vendor = existingVendorBenchmarks.find(
    (v) => v.name.toLowerCase() === vendorName.toLowerCase()
  );
  return vendor?.cbRateReductionFactor ?? 1.0;
};

// Page 15: 3DS Rate lookup based on country and AOV
// PSD2 countries have tiered 3DS rates based on AOV bands
// Non-PSD2 countries have 0% 3DS rate across all AOV bands
export interface ThreeDSLookup {
  countryGroup: 'non-psd2' | 'psd2';
  countries: string[];
}

// PSD2 countries from Page 15 - those with non-zero 3DS rates
const psd2Countries = [
  "United Kingdom of Great Britain and Northern Ireland", "United Kingdom",
  "Germany", "France", "Italy", "Spain", "Poland", "Norway", "Netherlands",
  "Ireland", "Sweden", "Denmark", "Belgium", "Portugal", "Greece", "Czechia",
  "Czech Republic", "Finland", "Romania", "Latvia", "Hungary", "Cyprus",
  "Lithuania", "Croatia", "Iceland", "Malta", "Slovakia", "Bulgaria",
  "Slovenia", "Estonia", "Luxembourg"
];

export const threeDSCountryGroups: ThreeDSLookup[] = [
  { 
    countryGroup: 'non-psd2', 
    countries: [
      "United States of America", "Canada", "Japan", "Australia", "Brazil", 
      "Mexico", "China", "Hong Kong", "Singapore", "Taiwan", "South Korea",
      "Korea, Republic of", "India", "Thailand", "Malaysia", "Indonesia", 
      "Philippines", "Vietnam", "New Zealand", "Argentina", "Chile", "Colombia", 
      "Peru", "Ecuador", "Israel", "United Arab Emirates", "Saudi Arabia", 
      "Qatar", "Kuwait", "South Africa", "Nigeria", "Kenya", "Egypt", "Morocco", 
      "Turkey", "Russia", "Russian Federation", "Switzerland", "Austria",
      "Venezuela", "Venezuela (Bolivarian Republic of)", "Dominican Republic",
      "Puerto Rico", "Jamaica", "Ukraine", "Panama", "Costa Rica",
      "Trinidad and Tobago", "Pakistan", "Jordan", "Bahamas", "Honduras",
      "Haiti", "El Salvador", "Guatemala", "Kazakhstan", "Palestine",
      "Palestinian Authority", "Georgia", "Guam", "Lebanon", "Gabon",
      "Bangladesh", "Angola", "Serbia", "Paraguay", "Uruguay", "Maldives",
      "Uzbekistan", "Ghana", "French Polynesia", "Armenia", "Bahrain",
      "Aruba", "Senegal", "Bolivia", "Bolivia (Plurinational State of)",
      "Oman", "Cambodia", "Azerbaijan", "Zambia", "Mauritius", "Albania",
      "Moldova", "Moldova, Republic of"
    ]
  },
  { 
    countryGroup: 'psd2', 
    countries: psd2Countries
  }
];

// Get recommended 3DS rate based on country and AOV (in EUR)
// Per spreadsheet Page 15 lookup logic with 4 AOV bands in EUR
// The AOV bands are always in EUR: <€100, €100-€250, €250-€500, €500+
export const get3DSRateByCountryAndAOV = (
  countryName: string,
  aovInBaseCurrency: number,
  baseCurrency: string = 'EUR'
): { rate: number; reason: string; aovInEUR: number } => {
  // Convert AOV to EUR for band calculation
  const aovInEUR = convertToEUR(aovInBaseCurrency, baseCurrency);
  
  // Check if country is in PSD2 list
  const isPSD2Country = psd2Countries.some(
    c => c.toLowerCase() === countryName.toLowerCase()
  );
  
  if (!isPSD2Country) {
    return { rate: 0, reason: 'Non-PSD2 region - 3DS not mandated', aovInEUR };
  }
  
  // PSD2 country - rate depends on AOV bands in EUR from Page 15
  if (aovInEUR < 100) {
    return { rate: 23, reason: 'PSD2 - AOV <€100', aovInEUR };
  } else if (aovInEUR < 250) {
    return { rate: 25, reason: 'PSD2 - AOV €100-€250', aovInEUR };
  } else if (aovInEUR < 500) {
    return { rate: 50, reason: 'PSD2 - AOV €250-€500', aovInEUR };
  } else {
    return { rate: 100, reason: 'PSD2 - AOV €500+', aovInEUR };
  }
};
