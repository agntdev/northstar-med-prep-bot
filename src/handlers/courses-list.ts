import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../domain.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "View Courses & Batches", data: "courses:list" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Courses & Batches", data: "courses:list", order: 10 });
const composer = new Composer<Ctx>();

composer.callbackQuery("courses:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const courses = await store.courses();
  if (!courses.length) { await ctx.reply("Courses are being updated. Please check back shortly.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); return; }
  await ctx.reply("Choose a course to see its batches.", { reply_markup: inlineKeyboard([...courses.map((course) => [inlineButton(course.name, `course:${course.id}`)]), [inlineButton("Back to menu", "menu:main")]]) });
});

composer.on("callback_query:data", async (ctx, next) => {
  if (!ctx.callbackQuery.data.startsWith("course:")) return next();
  await ctx.answerCallbackQuery();
  const course = await store.course(ctx.callbackQuery.data.slice(7));
  if (!course) { await ctx.reply("That course is no longer available. Choose another course."); return; }
  await ctx.editMessageText(`${course.name}\nFees: ${course.fees}\nSchedule: ${course.schedule}\nBatches: ${course.batches.join(", ")}`, { reply_markup: inlineKeyboard([[inlineButton("Enquire now", "enquiry:start")], [inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
