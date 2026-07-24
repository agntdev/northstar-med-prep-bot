import type { Ctx } from "./bot.js";
import { now } from "./domain.js";

export type Step = "enquiry:name" | "enquiry:phone" | "enquiry:message" | "enquiry:confirm" | "doubt:message" | "doubt:attachment" | "doubt:confirm" | "batch:goal" | "batch:time" | "batch:format" | "staff:course" | "staff:faq-question" | "staff:faq-answer";
export interface FlowSession {
  step?: Step;
  expiresAt?: number;
  enquiry?: { courseId: string; courseName: string; batch: string; name?: string; phone?: string; message?: string };
  doubt?: { message?: string; attachment?: string };
  batchFinder?: { goal?: string; time?: string; format?: string };
  staffDraft?: { courseName?: string; faqQuestion?: string };
}
export const flow = (ctx: Ctx): FlowSession => ctx.session as FlowSession;
export function enter(ctx: Ctx, step: Step): void { const state = flow(ctx); state.step = step; state.expiresAt = now().getTime() + 15 * 60_000; }
export function clear(ctx: Ctx): void { const state = flow(ctx); delete state.step; delete state.expiresAt; delete state.enquiry; delete state.doubt; delete state.batchFinder; delete state.staffDraft; }
export function expired(ctx: Ctx): boolean { const state = flow(ctx); if (!state.expiresAt || now().getTime() <= state.expiresAt) return false; clear(ctx); return true; }
export const back = { reply_markup: { inline_keyboard: [[{ text: "Back to menu", callback_data: "menu:main" }]] } };
