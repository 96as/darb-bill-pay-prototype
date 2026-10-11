/**
 * Seed data for the invoice fixtures. Everything here is fictitious and follows
 * docs/BUILD-NOTES.md (section "Seed"). Amounts are integer halalas.
 */

export const SAR = (halalas: number): string => (halalas / 100).toFixed(2);

/** "39130.43" -> "39,130.43" */
export const SAR_DISPLAY = (halalas: number): string =>
  (halalas / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** VAT at 15 %, rounded half-up to the halala. */
export const vat15 = (halalas: number): number => Math.round((halalas * 15) / 100);

export const BUYER = {
  nameEn: "Sahab Facility Services Co.",
  nameAr: "شركة سحاب للخدمات المرفقية",
  vat: "310458812300003",
  cr: "1010765432",
  address: {
    en: {
      street: "King Abdulaziz Road",
      building: "2956",
      additional: "6610",
      district: "Al Wurud",
      city: "Riyadh",
      postal: "12251",
      region: "Riyadh Region",
    },
    ar: {
      street: "طريق الملك عبدالعزيز",
      building: "2956",
      additional: "6610",
      district: "حي الورود",
      city: "الرياض",
      postal: "12251",
      region: "منطقة الرياض",
    },
  },
};

// ---------- Supplier B: Cool Breeze (ZATCA e-invoice, PDF with embedded XML) ----------

export const COOL_BREEZE = {
  nameEn: "Cool Breeze HVAC Contracting Co.",
  nameAr: "شركة النسيم البارد للمقاولات والتكييف",
  vat: "310387452600003",
  cr: "1010932185",
  email: "finance@coolbreeze-hvac.example",
  iban: "SA6710000000020315550044",
  bankEn: "Saudi National Bank",
  bankAr: "البنك الأهلي السعودي",
  address: {
    en: {
      street: "Prince Mohammed bin Abdulaziz Road",
      building: "7421",
      additional: "3187",
      district: "Al Sulimaniyah",
      city: "Riyadh",
      postal: "12234",
      region: "Riyadh Region",
    },
    ar: {
      street: "طريق الأمير محمد بن عبدالعزيز",
      building: "7421",
      additional: "3187",
      district: "حي السليمانية",
      city: "الرياض",
      postal: "12234",
      region: "منطقة الرياض",
    },
  },
};

export interface InvoiceLine {
  id: string;
  sellerItemId: string;
  nameEn: string;
  nameAr: string;
  quantity: number;
  unitCode: string;
  unitPrice: number; // halalas
}

export const COOL_BREEZE_INVOICE = {
  id: "INV-2026-0451",
  uuid: "6f1c9a52-3b7e-4d21-9c88-0a4e5b2d7f13",
  icv: "451",
  issueDate: "2026-10-13",
  issueTime: "10:42:17",
  /** Same moment in UTC (Riyadh is UTC+3), used for PDF metadata. */
  issueInstantUtc: "2026-10-13T07:42:17Z",
  supplyDate: "2026-10-13",
  dueDate: "2026-11-12",
  orderRef: "PO-SFS-2026-0388",
  embeddedXmlName: "INV-2026-0451.xml",
  lines: [
    {
      id: "1",
      sellerItemId: "SRV-CHL-PM-Q",
      nameEn: "Quarterly preventive maintenance, water-cooled chillers – Q4 2026",
      nameAr: "صيانة وقائية ربع سنوية للمبردات المائية – الربع الرابع 2026",
      quantity: 3,
      unitCode: "EA",
      unitPrice: 561668,
    },
    {
      id: "2",
      sellerItemId: "PRT-CMP-SCR-10T",
      nameEn: "Replacement compressor parts – scroll compressor kit and oil filter, supply and installation",
      nameAr: "قطع غيار للضاغط – طقم ضاغط حلزوني وفلتر زيت، توريد وتركيب",
      quantity: 1,
      unitCode: "SET",
      unitPrice: 2228039,
    },
  ] as InvoiceLine[],
  /** Seed totals (BUILD-NOTES): the script asserts the lines add up to these. */
  expected: { subtotal: 3913043, vat: 586957, total: 4500000 },
};

// ---------- Supplier A: Green Oasis (paper invoice photo, OCR) ----------

export const GREEN_OASIS = {
  nameEn: "Green Oasis Landscaping Est.",
  nameAr: "مؤسسة الواحة الخضراء لتنسيق الحدائق",
  vat: "311902476500003",
  cr: "1010847261",
  email: "accounts@greenoasis.example",
  iban: "SA5880000000318204466710",
  bankAr: "مصرف الراجحي",
  bankEn: "Al Rajhi Bank",
  addressAr: "الرياض – حي الملقا – طريق أنس بن مالك – مبنى 4128",
  addressEn: "Building 4128, Anas Bin Malik Road, Al Malqa, Riyadh",
};

export const GREEN_OASIS_INVOICE = {
  id: "GOL-2026-1003",
  issueDate: "2026-10-10",
  issueDateShown: "2026/10/10",
  dueDate: "2026-10-25",
  dueDateShown: "2026/10/25",
  /** Time stamp in the QR TLV (tag 3), Riyadh local time like the Cool Breeze invoice. */
  qrTimestamp: "2026-10-10T09:15:00",
  lines: [
    {
      nameAr: "أعمال الصيانة الشهرية للحدائق والمسطحات الخضراء – شهر أكتوبر 2026",
      quantity: 1,
      unitAr: "شهر",
      unitPrice: 520000,
    },
    {
      nameAr: "إصلاح شبكة الري بالتنقيط واستبدال الرشاشات التالفة",
      quantity: 1,
      unitAr: "مقطوعية",
      unitPrice: 180000,
    },
  ],
  expected: { subtotal: 700000, vat: 105000, total: 805000 },
  totalInWordsAr: "فقط ثمانية آلاف وخمسون ريالاً سعودياً لا غير",
};

/**
 * The seeded "saved earlier" bill (BUILD-NOTES: GOL-2026-0917, 10,869.57 + 1,630.43 = 12,500.00).
 * A clean digital PDF, no embedded XML. Line amounts are chosen so the per-line VAT
 * (rounded half-up) adds up to the seed VAT: 985.44 + 644.99 = 1,630.43.
 */
export const GREEN_OASIS_INVOICE_0917 = {
  id: "GOL-2026-0917",
  issueDate: "2026-09-20",
  issueDateShown: "2026/09/20",
  dueDate: "2026-10-14",
  dueDateShown: "2026/10/14",
  /** Riyadh local time; also used (as UTC+3) for the PDF metadata dates. */
  issueTime: "11:30:00",
  issueInstantUtc: "2026-09-20T08:30:00Z",
  supplyAr: "سبتمبر 2026",
  supplyEn: "September 2026",
  lines: [
    {
      nameAr: "زراعة موسمية – سبتمبر 2026",
      nameEn: "Seasonal planting — September 2026",
      quantity: 1,
      unitAr: "مقطوعية",
      unitEn: "lump sum",
      unitPrice: 656961,
    },
    {
      nameAr: "تقليم أشجار النخيل (12 نخلة)",
      nameEn: "Palm tree trimming (12 trees)",
      quantity: 12,
      unitAr: "نخلة",
      unitEn: "tree",
      unitPrice: 35833,
    },
  ],
  expected: { subtotal: 1086957, vat: 163043, total: 1250000 },
  totalInWordsAr: "فقط اثنا عشر ألفاً وخمسمائة ريال سعودي لا غير",
  totalInWordsEn: "Twelve thousand five hundred Saudi riyals only",
};
