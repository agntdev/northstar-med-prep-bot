import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../domain.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "FAQs", data: "faq:list" }) if the toolkit exposes it.

registerMainMenuItem({ label: "FAQs", data: "faq:list", order: 30 });
const composer = new Composer<Ctx>();

composer.callbackQuery("faq:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const faqs = await store.faqs();
  if (!faqs.length) { await ctx.reply("No FAQs have been published yet. Tap Enquire/Enroll and our admissions team can help.", { reply_markup: inlineKeyboard([[inlineButton("Enquire/Enroll", "enquiry:start")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  await ctx.reply("Choose a question.", { reply_markup: inlineKeyboard([...faqs.map((faq) => [inlineButton(faq.question.slice(0, 60), `faq:${faq.id}`)]), [inlineButton("Back to menu", "menu:main")]]) });
});
composer.on("callback_query:data", async (ctx, next) => {
  if (!ctx.callbackQuery.data.startsWith("faq:")) return next();
  await ctx.answerCallbackQuery();
  const faq = (await store.faqs()).find((item) => item.id === ctx.callbackQuery.data.slice(4));
  if (!faq) { await ctx.reply("That answer is no longer available."); return; }
  await ctx.editMessageText(`${faq.question}\n\n${faq.answer}`, { reply_markup: inlineKeyboard([[inlineButton("More FAQs", "faq:list")], [inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
