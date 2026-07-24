import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { safeSend, store } from "../domain.js";
import { clear, enter, expired, flow } from "../flow.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Enquire/Enroll", data: "enquiry:start" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Enquire/Enroll", data: "enquiry:start", order: 40 });
const composer = new Composer<Ctx>();

composer.callbackQuery("enquiry:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const courses = await store.courses();
  if (!courses.length) { await ctx.reply("Enrolment is not set up yet. Please try again shortly."); return; }
  await ctx.reply("Choose the course you’re interested in.", { reply_markup: inlineKeyboard(courses.map((course) => [inlineButton(course.name, `enqcourse:${course.id}`)])) });
});

composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("enqcourse:") && !data.startsWith("enqbatch:") && data !== "enquiry:skip" && data !== "enquiry:confirm" && data !== "enquiry:restart") return next();
  await ctx.answerCallbackQuery();
  if (data.startsWith("enqcourse:")) {
    const course = await store.course(data.slice(10));
    if (!course) { await ctx.reply("That course is no longer available. Start again from Enquire/Enroll."); return; }
    flow(ctx).enquiry = { courseId: course.id, courseName: course.name, batch: "" };
    await ctx.editMessageText("Choose the batch that suits you.", { reply_markup: inlineKeyboard(course.batches.map((batch, i) => [inlineButton(batch, `enqbatch:${i}`)])) }); return;
  }
  if (data.startsWith("enqbatch:")) {
    const enquiry = flow(ctx).enquiry; const course = enquiry && await store.course(enquiry.courseId); const batch = course?.batches[Number(data.slice(9))];
    if (!enquiry || !batch) { await ctx.reply("That selection has expired. Start again from Enquire/Enroll."); clear(ctx); return; }
    enquiry.batch = batch; enter(ctx, "enquiry:name"); await ctx.reply("What’s your name?", { reply_markup: { force_reply: true, input_field_placeholder: "Type your full name" } }); return;
  }
  if (data === "enquiry:skip") { const enquiry = flow(ctx).enquiry; if (!enquiry) return; enquiry.message = ""; enter(ctx, "enquiry:confirm"); await confirm(ctx); return; }
  if (data === "enquiry:restart") { clear(ctx); await ctx.reply("Start again by choosing Enquire/Enroll from the menu."); return; }
  const enquiry = flow(ctx).enquiry;
  if (!enquiry?.name || !enquiry.phone) { await ctx.reply("That enquiry has expired. Start again from Enquire/Enroll."); clear(ctx); return; }
  const created = await store.createEnquiry({ name: enquiry.name, phone: enquiry.phone, course: enquiry.courseName, batch: enquiry.batch });
  if (!created) { await ctx.reply("Enrolment is not set up yet. Please try again shortly."); return; }
  const settings = await store.settings();
  await safeSend(ctx, settings.admissionsChatId, `New enrolment enquiry\n${created.prospect.name} is interested in ${created.prospect.course}, ${created.prospect.batch}.\nPhone: ${created.prospect.phone}${enquiry.message ? `\nNote: ${enquiry.message}` : ""}`);
  clear(ctx); await ctx.reply("Your enquiry is with admissions. They’ll follow up with you soon.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});

async function confirm(ctx: Ctx): Promise<void> { const e = flow(ctx).enquiry!; await ctx.reply(`You’re enquiring about ${e.courseName}, ${e.batch}.\nName: ${e.name}\nPhone: ${e.phone}${e.message ? `\nNote: ${e.message}` : ""}\n\nSend this to admissions?`, { reply_markup: inlineKeyboard([[inlineButton("Submit enquiry", "enquiry:confirm")], [inlineButton("Start over", "enquiry:restart")]]) }); }
composer.on("message:text", async (ctx, next) => {
  if (expired(ctx)) { await ctx.reply("That form timed out. Tap Enquire/Enroll to start again."); return; }
  const state = flow(ctx); const text = ctx.message.text.trim(); const enquiry = state.enquiry;
  if (!enquiry || !state.step?.startsWith("enquiry:")) return next();
  if (state.step === "enquiry:name") { if (text.length < 2 || text.length > 80) { await ctx.reply("Enter your full name so admissions can help you."); return; } enquiry.name = text; enter(ctx, "enquiry:phone"); await ctx.reply("What phone number should admissions use?", { reply_markup: { force_reply: true, input_field_placeholder: "Include country code if needed" } }); return; }
  if (state.step === "enquiry:phone") { if (!/^\+?[0-9][0-9\s()-]{6,19}$/.test(text)) { await ctx.reply("That phone number doesn’t look right. Try digits with an optional + country code."); return; } enquiry.phone = text; enter(ctx, "enquiry:message"); await ctx.reply("Anything else admissions should know?", { reply_markup: inlineKeyboard([[inlineButton("Skip note", "enquiry:skip")]]) }); return; }
  if (state.step === "enquiry:message") { if (text.length > 1000) { await ctx.reply("Keep your note under 1,000 characters."); return; } enquiry.message = text; enter(ctx, "enquiry:confirm"); await confirm(ctx); }
});

export default composer;
