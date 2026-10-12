// API error codes ({ error: { code, message } } from app/api) in the UI language.
// Codes come from lib/domain/permissions.ts, lib/domain/limits.ts, lib/server/services and middleware.ts.
// Unknown codes fall back to the server's (English) message.
import type { Lang } from "./config";

type Messages = Record<Lang, string>;

const MESSAGES: Record<string, Messages> = {
  // Role and maker-checker (BP-17, BP-08)
  not_approver: {
    en: "Prepare only: you can't approve. Switch to an approver.",
    ar: "إعداد فقط: لا يمكنك الاعتماد. بدّل إلى معتمِد.",
  },
  creator_cannot_approve: {
    en: "You created this bill, so someone else must approve it.",
    ar: "أنت من أنشأ هذه الفاتورة، لذا يجب أن يعتمدها شخص آخر.",
  },
  editor_cannot_approve: {
    en: "You edited this bill, so someone else must approve it.",
    ar: "أنت من عدّل هذه الفاتورة، لذا يجب أن يعتمدها شخص آخر.",
  },
  submitter_cannot_approve: {
    en: "You submitted this bill, so someone else must approve it.",
    ar: "أنت من أرسل هذه الفاتورة، لذا يجب أن يعتمدها شخص آخر.",
  },
  run_creator_cannot_approve: {
    en: "You created this run, so someone else must approve it.",
    ar: "أنت من أنشأ دفعة الموردين هذه، لذا يجب أن يعتمدها شخص آخر.",
  },
  run_editor_cannot_approve: {
    en: "You edited this run, so someone else must approve it.",
    ar: "أنت من عدّل دفعة الموردين هذه، لذا يجب أن يعتمدها شخص آخر.",
  },
  run_submitter_cannot_approve: {
    en: "You submitted this run, so someone else must approve it.",
    ar: "أنت من أرسل دفعة الموردين هذه، لذا يجب أن يعتمدها شخص آخر.",
  },
  requester_cannot_approve: {
    en: "You requested this IBAN change, so someone else must approve it.",
    ar: "أنت من طلب تغيير الآيبان، لذا يجب أن يعتمده شخص آخر.",
  },
  maker_cannot_confirm: {
    en: "You entered this IBAN, so someone else must confirm the name match.",
    ar: "أنت من أدخل هذا الآيبان، لذا يجب أن يؤكد شخص آخر تطابق الاسم.",
  },
  supplier_creator_cannot_approve_first_payment: {
    en: "You added this supplier, so someone else must approve its first payment.",
    ar: "أنت من أضاف هذا المورد، لذا يجب أن يعتمد شخص آخر الدفعة الأولى له.",
  },
  iban_changer_cannot_approve_first_payment: {
    en: "You changed this supplier's IBAN, so someone else must approve its first payment.",
    ar: "أنت من غيّر آيبان هذا المورد، لذا يجب أن يعتمد شخص آخر الدفعة الأولى له.",
  },

  // Supplier gate (BP-06, BP-07)
  iban_change_pending: {
    en: "Payments to this supplier are paused: an IBAN change is waiting for approval.",
    ar: "المدفوعات إلى هذا المورد موقوفة: تغيير الآيبان بانتظار الموافقة.",
  },
  name_check_failed: {
    en: "The account name doesn't match the supplier.",
    ar: "اسم الحساب لا يطابق المورد.",
  },
  name_check_unconfirmed: {
    en: "The account name is a close match: an approver must confirm it first.",
    ar: "تطابق جزئي في اسم الحساب: يجب أن يؤكده معتمِد أولًا.",
  },
  screening_pending: {
    en: "Payee screening for this supplier hasn't cleared yet.",
    ar: "لم يكتمل فحص المستفيد لهذا المورد بعد.",
  },
  screening_blocked: {
    en: "This supplier didn't pass payee screening.",
    ar: "لم يجتز هذا المورد فحص المستفيد.",
  },
  supplier_not_linked: {
    en: "Save the supplier and its IBAN first.",
    ar: "احفظ المورد والآيبان أولًا.",
  },

  // Money controls (BP-18)
  per_payment_limit: {
    en: "This payment is above the per-payment limit.",
    ar: "هذه الدفعة أعلى من حد الدفعة الواحدة.",
  },
  daily_limit: {
    en: "This would go over the daily limit for that pay date.",
    ar: "سيتجاوز هذا الحد اليومي لتاريخ الدفع.",
  },

  // Status and workflow
  not_awaiting_approval: {
    en: "This bill isn't waiting for approval anymore.",
    ar: "هذه الفاتورة لم تعد بانتظار الموافقة.",
  },
  run_not_awaiting_approval: {
    en: "This run isn't waiting for approval anymore.",
    ar: "دفعة الموردين هذه لم تعد بانتظار الموافقة.",
  },
  run_empty: { en: "Add at least one bill to the run.", ar: "أضف فاتورة واحدة على الأقل إلى الدفعة." },
  in_run: { en: "This bill is already in a payment run.", ar: "هذه الفاتورة ضمن دفعة موردين بالفعل." },
  not_draft: { en: "Only a draft can be changed or submitted.", ar: "يمكن تعديل المسودة أو إرسالها فقط." },
  needs_review: { en: "Check the flagged fields first.", ar: "راجع الحقول المعلَّمة أولًا." },
  duplicate_unresolved: {
    en: "This bill looks like a duplicate. Cancel it or dismiss the warning first.",
    ar: "تبدو هذه الفاتورة مكررة. ألغِها أو تجاهل التنبيه أولًا.",
  },
  pay_date_in_past: { en: "The pay date can't be in the past.", ar: "لا يمكن أن يكون تاريخ الدفع في الماضي." },
  invalid_pay_date: { en: "Choose a pay date.", ar: "اختر تاريخ الدفع." },
  payment_sent: {
    en: "The payment has already been sent and can't be cancelled.",
    ar: "أُرسلت الدفعة بالفعل ولا يمكن إلغاؤها.",
  },
  already_paid: { en: "This bill is already paid.", ar: "هذه الفاتورة مدفوعة بالفعل." },
  already_cancelled: { en: "This bill is already cancelled.", ar: "هذه الفاتورة ملغاة بالفعل." },
  not_paid: {
    en: "A confirmation is available once the bill is paid.",
    ar: "يتوفر تأكيد الدفع بعد دفع الفاتورة.",
  },
  not_found: { en: "Not found. It may have been removed.", ar: "غير موجود. ربما حُذف." },

  // Demo and transport
  clock_backwards: { en: "The demo clock can only move forward.", ar: "ساعة العرض تتقدم إلى الأمام فقط." },
  unknown_user: { en: "That user doesn't exist in this demo.", ar: "هذا المستخدم غير موجود في العرض." },
  cross_origin: {
    en: "Blocked: the request came from another site.",
    ar: "تم الحظر: الطلب جاء من موقع آخر.",
  },
  internal: { en: "Something went wrong. Try again.", ar: "حدث خطأ. حاول مرة أخرى." },
};

/**
 * The message for an API error code in `lang`; `fallback` (usually the server's message) for codes
 * not listed here. Example: `errorMessage(err.code, err.message, lang)`.
 */
export function errorMessage(code: string | undefined, fallback: string, lang: Lang): string {
  const entry = code ? MESSAGES[code] : undefined;
  return entry ? entry[lang] : fallback;
}

/** Whether `code` has a translated message. */
export function hasErrorMessage(code: string | undefined): boolean {
  return !!code && code in MESSAGES;
}
