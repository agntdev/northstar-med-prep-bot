import { createRequire } from "node:module";
import { createHash } from "node:crypto";

export interface Course { id: string; name: string; fees: string; schedule: string; batches: string[] }
export interface Faq { id: string; question: string; answer: string }
export interface Prospect { id: string; name: string; phone: string; course: string; batch: string; timestamp: string }
export interface Enquiry { id: string; prospect_id: string; status: "new" | "in_progress" | "closed"; assigned_staff?: string; timestamp: string }
export interface Doubt { id: string; student_id: string; message: string; attachments: string[]; status: "new" | "acknowledged" | "resolved"; timestamp: string }
export interface VerificationRequest { id: string; studentId: string; status: "pending" | "approved"; timestamp: string }
export interface Settings { admissionsChatId?: number; instructorsChatId?: number }

export type Clock = () => Date;
let clock: Clock = () => new Date();
export const now = () => clock();
export function setClockForTests(next: Clock | undefined): void { clock = next ?? (() => new Date()); }

interface RedisLike { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<unknown>; }
let client: RedisLike | undefined;

function redis(): RedisLike | undefined {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  const require = createRequire(import.meta.url);
  // ioredis is a production dependency; domain data always lives in Redis.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = require("ioredis");
  const Redis = mod.default ?? mod.Redis ?? mod;
  client = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false }) as RedisLike;
  return client;
}

const key = (name: string) => `northstar:${name}`;
async function read<T>(name: string): Promise<T | undefined> {
  const r = redis(); if (!r) return undefined;
  const value = await r.get(key(name));
  if (!value) return undefined;
  try { return JSON.parse(value) as T; } catch { return undefined; }
}
async function write<T>(name: string, value: T): Promise<boolean> {
  const r = redis(); if (!r) return false;
  await r.set(key(name), JSON.stringify(value)); return true;
}
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export const store = {
  ready: () => Boolean(process.env.REDIS_URL),
  async courses(): Promise<Course[]> { const ids = (await read<string[]>("courses:index")) ?? []; return (await Promise.all(ids.map((x) => read<Course>(`course:${x}`)))).filter((x): x is Course => Boolean(x)); },
  async course(courseId: string): Promise<Course | undefined> { return read<Course>(`course:${courseId}`); },
  async addCourse(input: Omit<Course, "id">): Promise<Course | undefined> { const course = { ...input, id: id("course") }; const ids = (await read<string[]>("courses:index")) ?? []; if (!(await write(`course:${course.id}`, course))) return undefined; await write("courses:index", [...ids, course.id]); return course; },
  async faqs(): Promise<Faq[]> { const ids = (await read<string[]>("faqs:index")) ?? []; return (await Promise.all(ids.map((x) => read<Faq>(`faq:${x}`)))).filter((x): x is Faq => Boolean(x)); },
  async addFaq(question: string, answer: string): Promise<Faq | undefined> { const faq = { id: id("faq"), question, answer }; const ids = (await read<string[]>("faqs:index")) ?? []; if (!(await write(`faq:${faq.id}`, faq))) return undefined; await write("faqs:index", [...ids, faq.id]); return faq; },
  async settings(): Promise<Settings> { return (await read<Settings>("settings")) ?? {}; },
  async saveSettings(settings: Settings): Promise<boolean> { return write("settings", settings); },
  async createEnquiry(input: Omit<Prospect, "id" | "timestamp">): Promise<{ prospect: Prospect; enquiry: Enquiry } | undefined> { const timestamp = now().toISOString(); const prospect = { ...input, id: id("prospect"), timestamp }; const enquiry: Enquiry = { id: id("enquiry"), prospect_id: prospect.id, status: "new", timestamp }; const prospectIds = (await read<string[]>("prospects:index")) ?? []; const enquiryIds = (await read<string[]>("enquiries:index")) ?? []; if (!(await write(`prospect:${prospect.id}`, prospect))) return undefined; await write(`enquiry:${enquiry.id}`, enquiry); await write("prospects:index", [...prospectIds, prospect.id]); await write("enquiries:index", [...enquiryIds, enquiry.id]); return { prospect, enquiry }; },
  async createDoubt(studentId: string, message: string, attachments: string[]): Promise<{ doubt?: Doubt; duplicate: boolean } | undefined> { const fingerprint = createHash("sha256").update(`${studentId}\n${message}\n${attachments.join(",")}`).digest("hex"); const seen = await read<boolean>(`doubt-fingerprint:${fingerprint}`); if (seen) return { duplicate: true }; const doubt: Doubt = { id: id("doubt"), student_id: studentId, message, attachments, status: "new", timestamp: now().toISOString() }; const ids = (await read<string[]>("doubts:index")) ?? []; if (!(await write(`doubt:${doubt.id}`, doubt))) return undefined; await write(`doubt-fingerprint:${fingerprint}`, true); await write("doubts:index", [...ids, doubt.id]); return { doubt, duplicate: false }; },
  async verified(studentId: string): Promise<boolean> { return Boolean(await read<boolean>(`student:${studentId}:verified`)); },
  async createVerificationRequest(studentId: string): Promise<VerificationRequest | undefined> { const existing = await read<string>(`student:${studentId}:request`); if (existing) return read<VerificationRequest>(`verify:${existing}`); const request: VerificationRequest = { id: id("verify"), studentId, status: "pending", timestamp: now().toISOString() }; if (!(await write(`verify:${request.id}`, request))) return undefined; await write(`student:${studentId}:request`, request.id); return request; },
  async approveVerification(requestId: string): Promise<VerificationRequest | undefined> { const request = await read<VerificationRequest>(`verify:${requestId}`); if (!request) return undefined; request.status = "approved"; const students = (await read<string[]>("students:index")) ?? []; await write(`verify:${request.id}`, request); await write(`student:${request.studentId}:verified`, true); if (!students.includes(request.studentId)) await write("students:index", [...students, request.studentId]); return request; },
  async statusCounts(): Promise<{ enquiries: number; doubts: number }> { return { enquiries: ((await read<string[]>("enquiries:index")) ?? []).length, doubts: ((await read<string[]>("doubts:index")) ?? []).length }; },
};

export async function safeSend(ctx: { api: { sendMessage(chatId: number, text: string, extra?: object): Promise<unknown> } }, chatId: number | undefined, text: string, extra?: object): Promise<void> {
  if (!chatId) return;
  try { await ctx.api.sendMessage(chatId, text, extra); } catch { /* A group/user can remove or block the bot; the main flow still succeeds. */ }
}
