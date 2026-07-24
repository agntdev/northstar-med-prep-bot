import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../domain.js";
import { clear, enter, flow } from "../flow.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Find Right Batch", data: "batch:finder" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Find Right Batch", data: "batch:finder", order: 20 });
const composer = new Composer<Ctx>();

composer.callbackQuery("batch:finder", async (ctx) => {
  await ctx.answerCallbackQuery();
  flow(ctx).batchFinder = {}; enter(ctx, "batch:goal"); await ctx.reply("What are you preparing for?", { reply_markup: inlineKeyboard([[inlineButton("NEET PG", "batchgoal:neet-pg")], [inlineButton("FMGE", "batchgoal:fmge")], [inlineButton("Foundation", "batchgoal:foundation")]]) });
});
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data; if (!data.startsWith("batchgoal:") && !data.startsWith("batchtime:") && !data.startsWith("batchformat:")) return next(); await ctx.answerCallbackQuery();
  const preferences = flow(ctx).batchFinder ?? (flow(ctx).batchFinder = {});
  if (data.startsWith("batchgoal:")) { preferences.goal = data.slice(10); enter(ctx, "batch:time"); await ctx.reply("When do you prefer to study?", { reply_markup: inlineKeyboard([[inlineButton("Weekdays", "batchtime:weekday")], [inlineButton("Weekends", "batchtime:weekend")], [inlineButton("Flexible", "batchtime:flexible")]]) }); return; }
  if (data.startsWith("batchtime:")) { preferences.time = data.slice(10); enter(ctx, "batch:format"); await ctx.reply("Which format works best?", { reply_markup: inlineKeyboard([[inlineButton("Live online", "batchformat:online")], [inlineButton("Classroom", "batchformat:classroom")], [inlineButton("Either", "batchformat:either")]]) }); return; }
  preferences.format = data.slice(12); const courses = await store.courses(); const words = [preferences.goal, preferences.time, preferences.format].filter(Boolean).map((x) => x!.toLowerCase()); const matches = courses.filter((course) => words.some((word) => `${course.name} ${course.schedule} ${course.batches.join(" ")}`.toLowerCase().includes(word)));
  clear(ctx); if (!matches.length) { await ctx.reply("We couldn’t find an exact batch match yet. Admissions can help you choose.", { reply_markup: inlineKeyboard([[inlineButton("Enquire/Enroll", "enquiry:start")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  await ctx.reply(`These batches look like a good fit:\n${matches.map((course) => `${course.name} — ${course.batches.join(", ")}`).join("\n")}`, { reply_markup: inlineKeyboard([[inlineButton("Enquire/Enroll", "enquiry:start")], [inlineButton("Start again", "batch:finder")]]) });
});

export default composer;
