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
// Menu: wire this into /start via registerMainMenuItem({ label: "Submit Doubt", data: "doubt:start" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Submit Doubt", data: "doubt:start", order: 60 });
const composer = new Composer<Ctx>();

composer.callbackQuery("doubt:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from || !(await store.verified(String(ctx.from.id)))) { await ctx.reply("Student support opens after enrolment is verified. Tap I am Enrolled to request access."); return; }
  enter(ctx, "doubt:message"); flow(ctx).doubt = {}; await ctx.reply("Send your academic question. You can add one file after this.", { reply_markup: { force_reply: true, input_field_placeholder: "Type your question" } });
});
composer.on("message:text", async (ctx, next) => {
  if (expired(ctx)) { await ctx.reply("That doubt form timed out. Tap Submit Doubt to start again."); return; }
  const state = flow(ctx); if (state.step !== "doubt:message") return next(); const message = ctx.message.text.trim();
  if (message.length < 3 || message.length > 2000) { await ctx.reply("Keep your question between 3 and 2,000 characters."); return; }
  state.doubt = { message }; enter(ctx, "doubt:attachment"); await ctx.reply("Attach one file now, or tap Skip file.", { reply_markup: inlineKeyboard([[inlineButton("Skip file", "doubt:skip")]]) });
});
composer.on(["message:document", "message:photo"], async (ctx, next) => {
  const state = flow(ctx); if (state.step !== "doubt:attachment") return next();
  const attachment = ctx.message.document?.file_id ?? ctx.message.photo?.at(-1)?.file_id;
  if (!attachment) return next(); state.doubt = { ...state.doubt, attachment }; enter(ctx, "doubt:confirm"); await showConfirm(ctx);
});
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data; if (data !== "doubt:skip" && data !== "doubt:confirm" && data !== "doubt:restart") return next(); await ctx.answerCallbackQuery();
  if (data === "doubt:restart") { clear(ctx); await ctx.reply("Tap Submit Doubt when you’re ready."); return; }
  if (data === "doubt:skip") { if (!flow(ctx).doubt?.message) return; enter(ctx, "doubt:confirm"); await showConfirm(ctx); return; }
  const doubt = flow(ctx).doubt; if (!ctx.from || !doubt?.message) { clear(ctx); await ctx.reply("That doubt form has expired. Tap Submit Doubt to start again."); return; }
  const result = await store.createDoubt(String(ctx.from.id), doubt.message, doubt.attachment ? [doubt.attachment] : []);
  if (!result) { await ctx.reply("Student support is not set up yet. Please try again shortly."); return; }
  if (result.duplicate) { clear(ctx); await ctx.reply("We already have that doubt. The academic team will get back to you soon."); return; }
  const created = result.doubt!;
  const settings = await store.settings(); await safeSend(ctx, settings.instructorsChatId, `New student doubt\n${created.message}${created.attachments.length ? "\nA file was attached." : ""}`);
  clear(ctx); await ctx.reply("Your doubt has been sent to the academic team. We’ll get back to you soon.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});
async function showConfirm(ctx: Ctx): Promise<void> { const doubt = flow(ctx).doubt!; await ctx.reply(`Send this doubt to the academic team?${doubt.attachment ? " A file is attached." : ""}`, { reply_markup: inlineKeyboard([[inlineButton("Submit doubt", "doubt:confirm")], [inlineButton("Start over", "doubt:restart")]]) }); }

export default composer;
