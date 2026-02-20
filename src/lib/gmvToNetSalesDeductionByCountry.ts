/**
 * Default GMV to net sales deduction (%) by HQ country.
 * Used when formData.gmvToNetSalesDeductionPct is not set.
 */
export const GMV_TO_NET_SALES_DEDUCTION_BY_COUNTRY: Record<string, number> = {
  "United States of America": 11,
  "Japan": 17,
  "United Kingdom of Great Britain and Northern Ireland": 31,
  "Canada": 16,
  "Germany": 35,
  "China": 19,
  "France": 31,
  "Australia": 17,
  "Italy": 31,
  "Brazil": 26,
  "Spain": 28,
  "Poland": 29,
  "Norway": 34,
  "Netherlands": 30,
  "Mexico": 25,
  "Taiwan": 11,
  "Ireland": 32,
  "Korea, Republic of": 16,
  "Israel": 25,
  "Hong Kong": 6,
  "Sweden": 34,
  "Denmark": 34,
  "Singapore": 16,
  "Switzerland": 17,
  "Argentina": 30,
  "Malaysia": 17,
  "Saudi Arabia": 26,
  "Russian Federation": 31,
  "Venezuela (Bolivarian Republic of)": 25,
  "Austria": 31,
  "United Arab Emirates": 16,
  "Belgium": 30,
  "Portugal": 31,
  "Greece": 31,
  "Dominican Republic": 27,
  "New Zealand": 22,
  "India": 29,
  "Puerto Rico": 20,
  "Thailand": 14,
  "Turkey": 29,
  "Colombia": 28,
  "Czechia": 28,
  "South Africa": 22,
  "Finland": 34,
  "Vietnam": 15,
  "Nigeria": 16,
  "Chile": 28,
  "Philippines": 21,
  "Romania": 27,
  "Latvia": 29,
  "Peru": 26,
  "Hungary": 34,
  "Indonesia": 20,
  "Jamaica": 24,
  "Ecuador": 24,
  "Kuwait": 7,
  "Ukraine": 29,
  "Qatar": 7,
  "Panama": 14,
  "Cyprus": 28,
  "Lithuania": 29,
  "Croatia": 33,
  "Iceland": 32,
  "Malta": 26,
  "Morocco": 29,
  "Costa Rica": 20,
  "Egypt": 21,
  "Trinidad and Tobago": 19,
  "Pakistan": 30,
  "Slovakia": 32,
  "Kenya": 25,
  "Jordan": 25,
  "Bulgaria": 27,
  "Slovenia": 30,
  "Bahamas": 16,
  "Estonia": 32,
  "Luxembourg": 24,
  "Honduras": 22,
  "Haiti": 17,
  "El Salvador": 20,
  "Guatemala": 19,
  "Kazakhstan": 25,
  "Palestinian Authority": 26,
  "Georgia": 26,
  "Guam": 10,
  "Lebanon": 19,
  "Gabon": 27,
  "Bangladesh": 25,
  "Angola": 21,
  "Serbia": 28,
  "Paraguay": 17,
  "Uruguay": 30,
  "Maldives": 15,
  "Uzbekistan": 20,
  "Ghana": 24,
  "French Polynesia": 24,
  "Armenia": 27,
  "Bahrain": 17,
  "Aruba": 11,
  "Senegal": 27,
  "Bolivia (Plurinational State of)": 20,
  "Oman": 12,
  "Cambodia": 18,
  "Azerbaijan": 26,
  "Zambia": 24,
  "Mauritius": 22,
  "Albania": 29,
  "Moldova, Republic of": 29,
};

const FALLBACK_PCT = 20;

/**
 * Returns the effective GMV to net sales deduction %:
 * - formData.gmvToNetSalesDeductionPct if set
 * - else country default from hqLocation if in lookup table
 * - else 20
 */
export function getGmvToNetSalesDeductionPct(formData: {
  gmvToNetSalesDeductionPct?: number;
  hqLocation?: string;
}): number {
  if (formData.gmvToNetSalesDeductionPct != null && formData.gmvToNetSalesDeductionPct !== undefined) {
    return formData.gmvToNetSalesDeductionPct;
  }
  const country = formData.hqLocation?.trim();
  if (country && country in GMV_TO_NET_SALES_DEDUCTION_BY_COUNTRY) {
    return GMV_TO_NET_SALES_DEDUCTION_BY_COUNTRY[country];
  }
  return FALLBACK_PCT;
}
