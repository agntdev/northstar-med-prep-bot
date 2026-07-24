import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { safeSend, store } from "../domain.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "I am Enrolled", data: "student:verify" }) if the toolkit exposes it.

registerMainMenuItem({ label: "I am Enrolled", data: "student:verify", order: 50 });
const composer = new Composer<Ctx>();

composer.callbackQuery("student:verify", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  if (await store.verified(String(ctx.from.id))) { await ctx.reply("Your student access is active. You can submit doubts from the main menu.", { reply_markup: inlineKeyboard([[inlineButton("Submit Doubt", "doubt:start")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  const request = await store.createVerificationRequest(String(ctx.from.id));
  if (!request) { await ctx.reply("Student verification is not set up yet. Please try again shortly."); return; }
  const settings = await store.settings();
  await safeSend(ctx, settings.admissionsChatId, "A student has requested access.", { reply_markup: inlineKeyboard([[inlineButton("Approve student", `verify:approve:${request.id}`)]]) });
  await ctx.reply("Your verification request is with the admissions team. We’ll let you know once access is active.");
});

export default composer;
