# Northstar Med Prep Bot — Bot specification

**Archetype:** booking

**Voice:** Professional and warm — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot helping prospective students select courses, submit enrollment inquiries, and access FAQs. For enrolled students, it provides class reminders, quiz links, and doubt submission. All enrollment/doubt workflows require human staff follow-up.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Prospective medical students
- Enrolled students
- Admissions/academic staff

## Success criteria

- 500+ active users in first month
- 90% of inquiries forwarded to admissions within 24h
- 85% of doubts acknowledged by staff within 12h

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with course info, FAQs, and enrollment
- **View Courses & Batches** (button, actor: user, callback: courses:list) — Browse available courses and batch schedules
- **Find Right Batch** (button, actor: user, callback: batch:finder) — Answer questions to get batch recommendations
- **FAQs** (button, actor: user, callback: faq:list) — Access approved program questions and answers
- **Enquire/Enroll** (button, actor: user, callback: enquiry:start) — Submit enrollment inquiry with name/phone
- **I am Enrolled** (button, actor: user, callback: student:verify) — Access student features after verification
- **Submit Doubt** (button, actor: user, callback: doubt:start) — Send academic questions to instructors

## Flows

### Enrollment Inquiry
_Trigger:_ enquiry:start

1. Select course
2. Choose batch
3. Enter name/phone
4. Optional message
5. Confirm submission

_Data touched:_ Prospect, Enquiry

### Doubt Submission
_Trigger:_ doubt:start

1. Enter message
2. Attach file (optional)
3. Submit to support team
4. Receive ticket ID

_Data touched:_ Doubt

### Batch Recommendation
_Trigger:_ batch:finder

1. Answer 3 preference questions
2. Display matching batches
3. Option to enquire

_Data touched:_ Course

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Prospect** _(retention: persistent)_ — Potential student with contact info
  - fields: name, phone, course, batch, timestamp
- **Enquiry** _(retention: persistent)_ — Enrollment request with status tracking
  - fields: prospect_id, status, assigned_staff
- **Course** _(retention: persistent)_ — Program details and schedules
  - fields: name, fees, schedule, batches
- **Doubt** _(retention: persistent)_ — Student questions with resolution tracking
  - fields: student_id, message, attachments, status

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure notification groups
- Edit course/FAQ content
- Mark students as enrolled
- View inquiry/doubt status

## Notifications

- Admissions group receives new enquiry alerts
- Instructors notified of new doubts
- Students get class reminders 1h before sessions

## Permissions & privacy

- Only collect name/phone during explicit enrollment
- Store minimal data (no payment info)
- Admins control student verification

## Edge cases

- Users without verified enrollment accessing student features
- Duplicate doubt submissions
- Invalid phone number formats

## Required tests

- End-to-end enquiry submission to admissions
- Doubt submission with file attachment
- Batch recommendation accuracy with different inputs

## Assumptions

- Course data will be provided in spreadsheet format
- Admin group will maintain quiz links
- Staff will manually handle all follow-ups
