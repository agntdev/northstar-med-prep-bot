import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { safeSend, store } from "../domain.js";
import { clear, enter, flow } from "../flow.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Staff tools", data: "staff:tools", order: 70 });
const composer = new Composer<Ctx>();

async function isAdmin(ctx: Ctx): Promise<boolean> {
  if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") || !ctx.from) return false;
  try { const admins = await ctx.api.getChatAdministrators(ctx.chat.id); return admins.some((member) => member.user.id === ctx.from!.id); } catch { return false; }
}
async function guard(ctx: Ctx): Promise<boolean> { if (await isAdmin(ctx)) return true; await ctx.reply("Open Staff tools in your admissions or instructor group as a group admin."); return false; }

composer.callbackQuery("staff:tools", async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return;
  await ctx.reply("Choose what you want to manage for this group.", { reply_markup: inlineKeyboard([[inlineButton("Set admissions alerts", "staff:admissions")], [inlineButton("Set instructor alerts", "staff:instructors")], [inlineButton("Add course", "staff:add-course")], [inlineButton("Add FAQ", "staff:add-faq")], [inlineButton("View request status", "staff:status")]]) });
});
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data; if (!data.startsWith("staff:") && !data.startsWith("verify:approve:")) return next(); await ctx.answerCallbackQuery();
  if (data.startsWith("verify:approve:")) { if (!(await guard(ctx))) return; const approved = await store.approveVerification(data.slice(15)); if (!approved) { await ctx.reply("That verification request is no longer available."); return; } await safeSend(ctx, Number(approved.studentId), "Your student access is active. You can now submit doubts from the main menu."); await ctx.reply("Student access is now active."); return; }
  if (!(await guard(ctx)) || !ctx.chat) return;
  if (data === "staff:admissions" || data === "staff:instructors") { const settings = await store.settings(); if (data === "staff:admissions") settings.admissionsChatId = ctx.chat.id; else settings.instructorsChatId = ctx.chat.id; if (!(await store.saveSettings(settings))) { await ctx.reply("Staff settings are not set up yet. Please try again shortly."); return; } await ctx.reply(data === "staff:admissions" ? "This group will receive new enrolment enquiries." : "This group will receive new student doubts."); return; }
  if (data === "staff:status") { const counts = await store.statusCounts(); await ctx.reply(`There are ${counts.enquiries} enrolment enquiries and ${counts.doubts} student doubts on record.`); return; }
  if (data === "staff:add-course") { enter(ctx, "staff:course"); flow(ctx).staffDraft = {}; await ctx.reply("Send the course as: name | fees | schedule | batch one, batch two"); return; }
  if (data === "staff:add-faq") { enter(ctx, "staff:faq-question"); flow(ctx).staffDraft = {}; await ctx.reply("Send the FAQ question."); }
});
composer.on("message:text", async (ctx, next) => {
  const state = flow(ctx); if (!state.step?.startsWith("staff:")) return next(); if (!(await guard(ctx))) return; const text = ctx.message.text.trim();
  if (state.step === "staff:course") { const [name, fees, schedule, batches] = text.split("|").map((part) => part.trim()); const batchList = batches?.split(",").map((batch) => batch.trim()).filter(Boolean) ?? []; if (!name || !fees || !schedule || !batchList.length) { await ctx.reply("Use: name | fees | schedule | batch one, batch two"); return; } const course = await store.addCourse({ name, fees, schedule, batches: batchList }); clear(ctx); await ctx.reply(course ? "That course is now available to students." : "Courses are not set up yet. Please try again shortly."); return; }
  if (state.step === "staff:faq-question") { if (text.length < 5) { await ctx.reply("Enter a fuller FAQ question."); return; } state.staffDraft = { faqQuestion: text }; enter(ctx, "staff:faq-answer"); await ctx.reply("Now send the approved answer."); return; }
  const question = state.staffDraft?.faqQuestion; if (!question || text.length < 2) { await ctx.reply("Enter the approved answer."); return; } const faq = await store.addFaq(question, text); clear(ctx); await ctx.reply(faq ? "That FAQ is now available to students." : "FAQs are not set up yet. Please try again shortly.");
});
export default composer;
