# PTracker — Final-Year Project & Internship Tracker (v2 Build Plan)

> **Tags:** EdTech · Project Management · Workflow · Focus & Accountability
> **Users:** Students, Guides, Coordinators, Review Panel (+ Admin)
> **Stack:** React (Vite) + Firebase (Auth, Firestore, Storage, Cloud Functions, FCM, Hosting)
> **Baseline app:** [ptracker-app-7117.web.app](https://ptracker-app-7117.web.app/) — all new features extend
> the existing PTracker shell and **must reuse its exact design language** (see §4).

---

## 1. Problem Statement (What We Are Solving)

Guide allocation, review dates, logbooks, and internship approvals are scattered across
WhatsApp groups, email threads, and Excel sheets, and everything is handled at the last
minute. Because of this:

1. **Coordinators cannot see which teams are behind** — there is no single source of truth
   for progress, so at-risk teams are discovered only at the final review.
2. **Guides carry uneven loads** — some guides get 12 teams, others get 2, because
   allocation is manual and preference-blind.
3. **Students chase deadlines blind** — no single calendar of review dates, deliverables,
   and approval steps.
4. **Internship paperwork is chaos** — offer letters, approvals, and certificates are
   collected physically/over email with no tracking state.
5. **No daily work habit** — students cram before reviews; there is no tool that makes
   regular project work visible, measurable, or accountable.

**Evaluated on:** Allocation logic (preferences vs. load limits), review scheduling,
progress visibility, document handling. Every feature below maps back to these four pillars.

---

## 2. Solution in One Paragraph

PTracker becomes the single app for the whole final-year journey. The **coordinator** sets
up the semester in minutes and controls allocation — run the fair auto-allocation, then
**override any of it by hand** (pick specific students and place them under a specific
guide, swap, force-assign, or pre-lock pairs before the algorithm even runs). **Students**
form teams, submit guide preferences, work weekly through logbooks and documents, and —
new — get a YPT-style **Focus module**: a stopwatch that tracks work per subject/task, a
10-minute daily planner with check-off to-dos, a **live team room** showing who is focusing
right now, and **real-time leaderboards** with color-coded stats. **Guides** approve work
with structured feedback; **review panels** score on a rubric from a time-boxed dossier;
and the **heatmap + at-risk radar** finally give the coordinator one-glance progress truth.

---

## 3. Design System — Staying Consistent With PTracker (UI Contract)

Every new screen MUST be built from the existing PTracker visual vocabulary. This section
is the contract for all future UI work.

**Theme & surfaces**
- Near-black app background; content sits in a large rounded "device-style" panel
  (~28px outer radius) with a scenic photographic backdrop behind hero areas, dimmed by a
  dark gradient overlay so text always stays readable.
- Cards are dark translucent glass (`rgba(255,255,255,0.04–0.08)` fill, hairline light
  border, 20–24px radius, soft shadow) — never pure white, never flat gray boxes.

**Color**
- **PTracker orange** is the single accent: primary buttons, the center FAB, active nav
  item, active tab underline, timer-running state, focus dot indicators.
- Semantic status colors reuse the same saturation family: green = approved/on-track,
  amber = pending/late, red = overdue/at-risk, gray = upcoming/inactive. These four colors
  also drive the heatmap and color-coded stats so the whole app reads one system.
- Subject colors (Focus module) are picked from a fixed palette of the same tones.

**Typography**
- Very bold, large display numerals and headings (the "ALL / GOAL" style) for hero stats —
  hours, ranks, scores, progress %.
- Small uppercase letter-spaced labels ("FROM", "TO") over muted gray secondary text.
- Body text is white/gray on dark; never introduce a second font family.

**Components (reuse, don't invent)**
- Pill-shaped chips and buttons; circular icon buttons; the orange circular **FAB** with
  the + glyph as the universal "create/start" action.
- Segmented horizontal date strip ("All · Today · 07 08 09 10 11") — reused for week/day
  pickers in Planner, Reviews, and Calendar.
- Bottom navigation with icon tabs and the center FAB slot; top tab row with the active
  tab highlighted (the Schedule/Journey/Focus/Calendar/Stats pattern).
- Empty states follow the existing pattern: centered line icon, bold title, one muted
  hint line ("No Tasks Scheduled" style).
- Toasts, badges, and counters reuse the pill style; modals are bottom sheets on mobile
  widths, centered rounded cards on desktop.

**Motion**
- Subtle only: 150–250ms fades/slides, timer pulse while a stopwatch runs, count-up
  animations on leaderboard stats. No new motion libraries.

**Navigation mapping — existing tabs grow, they don't get replaced**

| Existing PTracker tab | What it grows into for the student |
|---|---|
| **Schedule** | Adds review slots, guide meetings, and deadline entries into the same list UI |
| **Journey** | Becomes the project hub: milestones, documents, logbook, internship tracker |
| **Focus** | The YPT module: stopwatch per subject/task, daily planner entry point, live team room |
| **Calendar** | Month view gains deadline dots, review dates, and planner history heatmap |
| **Stats** | Gains color-coded subject breakdown, leaderboards, streaks, team heatmap link |

Bottom nav stays a 5-slot bar with the center orange FAB for quick actions
(Start Focus · Log Work · Upload Document — contextual to the tab).

**Role shells** — Guide, Coordinator, and Panel dashboards reuse the identical shell
(dark glass cards, orange accent, bottom/side nav) with role-specific tabs
(e.g. Coordinator: Overview · Allocation · Reviews · Approvals · Heatmap). Same
components, same spacing, same typography — only the content changes.

---

## 4. Tech Stack (Firebase, Matching Your Existing Experience)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS + Recharts | You already deploy React to Firebase Hosting |
| Auth | Firebase Authentication (Email/Password + Google) | Custom claims for roles |
| Database | Cloud Firestore | Real-time listeners = live dashboards, live team rooms |
| Presence | Firestore heartbeat fields (or Realtime DB for focus-room presence) | "Who is focusing right now" |
| Files | Firebase Storage | Offer letters, logbook PDFs, reports, PPTs (size/type limits in rules) |
| Backend | Cloud Functions (onCall + triggers + scheduled) | Allocation engine, leaderboard aggregation, reminders, audit log, plagiarism hook |
| Notifications | FCM (push) + Trigger Email extension + in-app center | Deadline reminders, review alerts, room/rank nudges |
| Hosting | Firebase Hosting (SPA rewrite) | Same project, same deploy flow as PTracker |

**Roles** are custom claims (`student`, `guide`, `coordinator`, `panel`, `admin`) set by a
Cloud Function on signup approval / CSV import. Firestore Security Rules enforce access.

---

## 5. Firestore Data Model (Collections)

```
users/{uid}
  name, email, role, photoURL, department, year, fcmTokens[]
  guideInfo: { loadLimit, currentLoad, researchAreas[], isAcceptingPreferences }
  studentInfo: { rollNo, cgpa, teamId?, internshipStatus }
  focusProfile: { defaultSubjectId?, privacy (public|team|private), streakDays,
                  totalFocusMinutes, weeklyGoalMin }

teams/{teamId}
  name, leaderUid, memberUids[], inviteCode, size, status
  (forming | locked | allocated | active | submitted | archived)
  guideId, projectId, cycleId, createdAt

allocations/{allocId}
  cycleId, teamId, rankedGuideUids[uid1..uidN]
  assignedGuideUid, preferenceSatisfied (1st|2nd|3rd|coordinator|unassigned),
  status (draft | published), assignedBy (auto | manual), overrideReason?, overrideBy?

projects/{projectId}
  teamId, title, abstract, techStack[], domain, repoUrl, demoUrl
  status (registered | ongoing | submitted | evaluated)

logbooks/{entryId}
  teamId, authorUid, weekOf, workDone, hoursSpent, blockers, attachments[]
  status (draft | submitted | approved | changes_requested), guideRemarks, reviewedAt

documents/{docId}
  teamId, type (abstract | synopsis | report | ppt | offer_letter |
                 internship_report | certificate | final_submission)
  storagePath, fileName, version, uploadedBy, uploadedAt
  status (pending | guide_approved | changes_requested | coordinator_approved)
  reviewId?, similarityScore?, plagiarismFlag?

reviews/{reviewId}
  cycleId, teamId, round, scheduledAt, durationMin, room/mode
  panelUids[], guideUid, deliverablesDueAt
  scores: { panelUid: { criteria..., total, comments, verdict } }
  status (scheduled | deliverables_due | completed | rescheduled | missed)

internships/{internshipId}
  studentUid, company, role, mentorName, startDate, endDate, durationWeeks
  offerLetterDocId, reportDocId, certificateDocId
  status (applied | offer_uploaded | guide_approved | coordinator_approved |
          completed | rejected)
  approvals: { guideUid+at, coordinatorUid+at }, creditMapping

submissions/{submissionId}
  teamId, projectDocId, pptDocId, reportDocId, videoUrl?, submittedAt
  status (submitted | accepted | evaluated)

deadlines/{deadlineId}
  cycleId, title, type (document | review | logbook | preference | submission)
  dueAt, appliesTo, reminderOffsets [d7,d2,d1,d0]

panels/{panelId}          name, memberUids[], cycleId

// ---- Focus & Accountability module (YPT-style) ----
focusSubjects/{id}        ownerUid, name, colorCode, archived   // e.g. "FYP", "DAA", "Internship"
focusSessions/{id}        uid, subjectId, taskId?, teamId?, startedAt, endedAt,
                          durationMin, mode (stopwatch | manual), note?
dailyPlans/{uid_YYYY-MM-DD}
                          date, todos: [{ id, title, subjectId?, done, plannedMin }],
                          reflection?, reviewed(bool), moodRating?
focusRooms/{roomId}       roomId = teamId or focusGroupId
                          members: { uid: { status (focus|break|offline),
                          currentSubjectId?, sessionStartedAt?, lastHeartbeat } }
focusGroups/{id}          name, type (team | open | invite), memberUids[], createdBy
leaderboards/{cycleId_scope_period}
                          scope (dept | batch | team | subject), period (daily |
                          weekly | monthly | alltime),
                          entries: [{ uid, minutes, rank }]   // computed by scheduled function
badges/{uid}              streaks, milestones, unlocked[]

notifications/{notifId}   targetRole | targetUids[], title, body, type, link, readBy[]
announcements/{id}        cycleId, title, body, postedBy, pinned
auditLogs/{logId}         actorUid, action, targetType, targetId, before, after, at
config/cycle_{cycleId}    semester dates, load limits, review window, rubric weights,
                          focus config (min session length, leaderboard visibility)
```

---

## 6. End-to-End Semester Lifecycle

```
Wk 0  Coordinator: create cycle → import students/guides (CSV) → set load limits,
      deadlines, rubric, review windows
Wk 1  Students: sign up → form teams (invite code) → register project →
      submit ranked guide preferences (window enforced)
Wk 2  Coordinator: Run Auto-Allocation → review satisfaction stats →
      MANUALLY OVERRIDE anything (drag students/teams to any guide, force-assign,
      pre-locked pairs respected) → Publish. Everyone notified.
Wk 2–6  Weekly rhythm: students run focus sessions + daily planner → weekly logbook
      (auto-suggested hours from focus data) → guide approves + remarks.
Wk 3/8/13  Reviews 1–3: conflict-free schedule → panels assigned → deliverables uploaded
      → rubric scoring → feedback published.
Parallel  Internship module: offer letter → guide approval → weekly log → coordinator
      approval → certificate → completed.
Wk 14  Final submission record locked. Leaderboard champions + streak badges awarded.
Wk 15  Coordinator exports everything for the department file.
```

---

## 7. Role-by-Role Report (What Each User Sees & Does)

### 7.1 Student

**Screens:** Home · Team · Preferences · Project · Logbook · Documents · Reviews ·
Internship · **Focus** (timer, planner, rooms) · **Leaderboard** · Calendar · Stats · Notifications

1. **Onboarding** — college-email signup, validated against the coordinator's import list;
   role claim `student`.
2. **Team formation** — create (6-char invite code) or join; leader sees members live;
   locks at max size or manually; deadline enforced with reminders.
3. **Project registration** — title, abstract, domain, tech stack, GitHub/Drive links.
4. **Guide preferences** — ranks guides during the open window, filtered by research area,
   seeing each guide's **remaining capacity**.
5. **Allocation result** — notified on publish; sees assigned guide.
6. **Focus & planner (daily driver — see §11)** — starts a stopwatch under a subject
   (e.g. "FYP — backend", "DAA", "Internship prep"), checks off the 10-minute planner
   to-dos, and appears in the **team room** as "focusing" so teammates stay accountable.
   Focus hours per subject feed color-coded stats and leaderboards.
7. **Weekly logbook** — submits work done, hours (pre-filled from focus sessions, editable),
   blockers, attachments. Guide can reopen with change requests.
8. **Documents** — milestone deliverables with versioning; approval status + guide
   comments per document.
9. **Reviews** — schedule (date, time, room, panel) appears instantly; D-7/2/1/0 reminders;
   deliverable upload gate closes at review start; afterward sees per-criterion panel
   scores, comments, verdict, and guide remarks.
10. **Internship module** — apply → upload offer letter → guide approval → weekly
    internship log → report + certificate upload → coordinator approval; status tracker
    shows the exact waiting step; approved internships map to credits.
11. **Peer contribution** (stretch) — confidential per-review teammate ratings.
12. **Final submission** — one-click locked bundle with timestamp; journey timeline
    (Gantt-style) shows the whole semester at a glance.

### 7.2 Guide / Mentor

**Screens:** Dashboard (My Teams) · Team Detail · Logbook Approvals · Document Reviews ·
Feedback · Meetings · Internship Approvals · Availability · Team Focus Activity · Notifications

1. **Capacity setup** — load limit, research areas, accepting-preferences toggle; live
   load counter during allocation.
2. **Allocation visibility + swap rights** — sees incoming teams with their preference
   rank; can request swaps with the coordinator during the override window.
3. **Logbook approval queue** — all unreviewed weekly entries across teams, quick remark
   templates, overdue highlighting.
4. **Document review** — inline PDF view, approve / request changes; everything
   audit-logged.
5. **Guide feedback per review** — pre-review readiness note; post-review remarks visible
   to team + coordinator.
6. **Meetings** — publishes weekly slots; teams book 15-min slots; reminders both sides.
7. **Focus activity of mentees** (respecting privacy settings) — a light view of team
   focus consistency (days active, trend), not surveillance: used to spot disengagement
   early and praise consistent workers.
8. **Internship approvals** — verifies offer letter company/duration, approves or rejects
   with reason; required before coordinator approval.
9. **Alerts** — doc submitted, logbook missed, review scheduled/rescheduled, internship
   approval pending > 3 days.

### 7.3 Coordinator (Power User)

**Screens:** Setup Wizard · Users & Bulk Import · **Allocation Control Center (full
override)** · Review Scheduler · Heatmap Dashboard · At-Risk Radar · Approvals ·
Announcements · Reports & Exports · Audit Log · Focus Leaderboards

1. **Semester setup wizard** — cycle dates, guide load limits, milestone deadlines,
   review rounds + windows, rubric weights, internship credit rules, focus/leaderboard
   config. CSV bulk import of students and guides (roll-no validation of signups).
2. **Allocation Control Center — auto + manual (evaluation pillar #1):**
   - Live counters of which teams have/ haven't submitted preferences.
   - **Pre-locking:** before running the algorithm, the coordinator can pin specific
     team→guide pairs (e.g. a sponsor-funded project must go to Prof. X); the algorithm
     treats them as fixed and allocates around them.
   - One click **"Run Auto-Allocation"** (capacitated stable matching, §10) → results
     table with assigned guide, preference satisfied, department stats ("86% got 1st
     preference; max load 5/5; min load 3/5").
   - **Full manual override, always:** drag-and-drop any team from any guide to any
     other; **search and select specific students/teams and assign them to a chosen
     guide directly** (with or without running the auto pass); bulk reassign; load-limit
     warnings appear but can be **force-approved with a typed reason** (the coordinator's
     call is final); every override records who/when/why in the audit log and marks the
     allocation as `coordinator`-assigned with `overrideReason`.
   - Can also start from a **blank slate** (skip auto entirely and hand-place every team).
   - **Publish** locks everything, notifies all, opens a 48-hour swap window where guides
     may raise objections and the coordinator re-overrides if needed.
3. **Review Scheduler (pillar #2)** — as §10.2: windows, conflict-free generation,
   conflict-of-interest exclusion, manual tweak, publish, one-click reschedules.
4. **Heatmap Dashboard (pillar #3)** — team×week heatmap; At-Risk Radar rules; guide load
   chart; review readiness; **focus-consistency layer** (teams whose members stopped
   logging focus time show as cooling off — an early disengagement signal).
5. **Approvals inbox** — internship finals, allocation overrides, role requests,
   reschedule requests — one screen.
6. **Focus leaderboards & wellbeing** — sees department-wide focus trends (aggregate only
   when students set privacy=team/private) to spot batches in trouble without spying on
   individuals.
7. **Announcements, reports/exports (CSV/PDF), immutable audit log** — as before.

### 7.4 Review Panel

**Screens:** My Schedule · Team Dossier · Scoring Sheet · My Past Evaluations

1. **Schedule** — only their assigned slots; ICS/Calendar sync; can block availability
   in advance so the scheduler avoids them.
2. **Team dossier** — read-only, time-boxed (48h before → scoring close): abstract,
   members, guide, this round's deliverables inline, logbook highlights, previous scores.
3. **Scoring sheet** — weighted rubric (e.g. Problem 20 · Literature 15 · Design 20 ·
   Implementation & demo 25 · Results 10 · Presentation 10), comments, verdict
   (proceed / needs work / escalate); total auto-computed; **score locks on submit**.
4. **Conflict-of-interest** — guiding faculty flagged and blocked from scoring their own
   teams; scheduler prevents it upfront.
5. **Moderation** — coordinator sees outlier panel scores vs. guide feedback and can call
   a moderation pass.

---

## 8. Allocation Logic + Full Coordinator Override (Evaluation Pillar #1)

### 8.1 Inputs
Teams with ranked guide preferences (top-k) · guides with `loadLimit` and research areas ·
coordinator pre-locked pairs (hard constraints) · optional team domain tag.

### 8.2 Algorithm — capacitated stable matching (Gale–Shapley with capacities)
1. Pre-locked pairs are fixed first (coordinator authority outranks the algorithm).
2. Each team proposes to its 1st-choice guide; a guide tentatively accepts up to
   `loadLimit`, rejecting the worst-ranked applicant (tie-breakers: domain overlap →
   earlier submission → deterministic hash) who proposes to their next choice.
3. Post-pass balance repair: if a guide is under-loaded and a team landed a low choice
   while a domain-matching guide has space, propose strictly-improving swaps.
4. Unassigned teams go to the coordinator's manual queue with suggested guides
   (capacity + domain overlap).

### 8.3 Coordinator override powers (first-class feature, not a patch)
- **Override anything, anytime before publish:** drag-drop reassignment, direct
  "select students/teams → assign to guide" picker with search, bulk moves.
- **Skip the algorithm entirely** and hand-place all teams if desired.
- **Pre-lock pairs** so the algorithm must respect them.
- **Force beyond load limit** with an explicit confirmation + typed reason (stored and
  audit-logged; the UI shows the exceeded limit clearly at all times).
- **Override window after publish:** 48h for guide swap requests; coordinator re-overrides
  with one click; all history kept — no silent edits.
- Dry-run mode: preview results + satisfaction stats before committing; "Revert to auto"
  restores the algorithm's proposal in one click.

### 8.4 Outputs
`allocations` docs (with `assignedBy: auto|manual`, `overrideReason`),
per-guide `currentLoad`, satisfaction stats. Published state notifies everyone.

---

## 9. Review Scheduling (Evaluation Pillar #2)

- Inputs: review window, slot length, rooms, panel definitions, teams, faculty
  availability blocks.
- Greedy assignment with backtracking: same-guide teams spread across slots/panels;
  no faculty double-booked; no room clashes; guide never on a panel judging their own
  team; capacity respected.
- Deliverable gate: `deliverablesDueAt = scheduledAt − 24h`; misses flagged to the
  coordinator before the review.
- Reschedule: request → coordinator approves → system proposes next conflict-free slot →
  re-notifications; full history in the audit log (serial reschedulers visible).

## 10. Progress Visibility (Evaluation Pillar #3)

- **Progress % per team** = weighted mix of logbook compliance, milestone docs approved,
  review score trend, final submission status — computed by Cloud Function triggers.
- **Heatmap** (teams × weeks; green/amber/red/gray) with click-through evidence.
- **At-Risk Radar** rules: no logbook ≥ 10 days · doc pending ≥ 5 days · score drop ≥ 15%
  between rounds · deliverables missing 24h before review · **focus activity flatline**
  (whole team stopped timer usage for 2 weeks).
- **Charts:** guide load distribution · preference satisfaction · review score
  distribution · internship approval funnel · submission completion · focus-time trends.

## 11. Document Handling (Evaluation Pillar #4)

- Central `documents` collection with versioning; superseded versions retained.
- Status pipeline `pending → guide_approved | changes_requested → coordinator_approved`
  via role-restricted Cloud Functions; every transition audit-logged.
- Storage rules: PDF/image/PPT ≤ 10 MB; path `teams/{teamId}/{type}/v{n}-…`; read access
  only team + guide + assigned panel (time-boxed) + coordinator.
- **Plagiarism hook:** on final report upload a Cloud Function calls an external
  similarity API, stores `similarityScore`, flags above-threshold docs on the
  coordinator dashboard; pluggable provider.
- Final submission record: immutable timestamped bundle; exports for the department file.

---

## 12. Focus & Accountability Module (YPT-Inspired — Detailed)

The daily-habit layer that keeps project work happening between reviews. Lives in the
existing **Focus** and **Stats** tabs; follows the PTracker design language exactly.

### 12.1 Time Tracking & Subjects (stopwatch)
- **Subjects are user-created categories with fixed-palette colors** — e.g. "FYP",
  "FYP — Backend", "DAA", "Internship prep" — so stats are color-coded everywhere
  (session list, charts, calendar heatmap, leaderboard rows).
- Built-in **stopwatch timer**: pick subject (+ optional project task from the team's
  task list), tap start; the Focus tab shows a live bold timer, pulsing orange ring, and
  the current session feeding into "today's total". Sessions can be paused, edited, or
  logged manually (mode: `manual`) for offline work.
- Sessions attach to `teamId` when the subject is project-linked, so team-level rollups
  work. Minimum session length configurable to prevent 5-second farming.
- Hour goal per week (personal), progress ring on Home, gentle "goal reached" state.

### 12.2 10-Minute Planner
- Each morning (or the night before) a quick **structured to-do checklist**: items with
  optional subject + planned minutes. The planner deliberately takes ~10 minutes to fill.
- Evening **review prompt**: check off done items, one-line reflection, optional mood
  rating; marking the day "reviewed" builds the **streak**.
- Unchecked items roll over; the planner shows yesterday's log beside today's plan
  (the YPT "review daily logs" pattern) inside the existing Schedule/Journey card UI.
- Planner items can be converted into a focus session target ("2×45 min on Report") —
  closing the loop between planning and doing.

### 12.3 Team Rooms & Live Study Status (accountability)
- Every FYP team automatically gets a **room**; students can also create/join
  **open or invite-only study groups** (e.g. "Section B — DAA grind").
- Inside a room, members' **live status**: focusing (subject color + elapsed time),
  on break, offline — powered by heartbeat writes with a 2-minute staleness cutoff
  (or Realtime Database for true presence). Starting a session optionally broadcasts a
  "X started focusing on FYP" nudge to the room; a "room sprint" mode lets everyone start
  a 45-min pomodoro together with a shared countdown.
- **DND mode** hides a student's live status while still counting their hours.
- Remote-friendly: this is the "see friends studying" pull that keeps distributed teams
  actually working together.

### 12.4 Real-Time Rankings
- **Leaderboards by scope:** department · batch/year · team · subject (e.g. top FYP
  focusers this week) · custom study group; **period filters:** daily / weekly / monthly /
  all-time; computed by a scheduled Cloud Function into `leaderboards` docs so reads are
  O(1) and cheap.
- Rank changes animate subtly (count-up, small ↑/↓ deltas); the user's own row is pinned
  even off-screen.
- **Privacy-first:** `focusProfile.privacy` controls visibility — public (name + hours),
  team-only, or private (aggregate-only contribution to dept stats, no individual row).
  Leaderboard participation is opt-in-ish by default (team-only), pushed as a feature,
  never a surveillance tool — guides/coordinators see aggregates unless a student opts public.

### 12.5 Color-Coded Study Stats
- **Stats tab** additions, all in existing chart styles: subject-donut with each
  subject's color, daily/weekly bar charts, GitHub-style **calendar heatmap** of focus
  minutes, streak counter, best day/time-of-day pattern ("you focus best 9–11 PM").
- Team stats view: combined hours per member for the current sprint/week — feeds the
  coordinator's focus-consistency layer and (optionally, guide-visible only) contribution
  imbalance hints.
- Badges & streaks (milestone unlocks: first 100 hours, 30-day streak, full-room sprint)
  rendered as pill chips in the existing style.

---

## 13. Complete Feature List

### P0 — MVP (exactly the problem statement)
1. Auth + roles (student/guide/coordinator/panel) with custom claims + security rules
2. Team formation — create/join via invite code, live member status, lock at max size
3. Guide preference submission window with capacity visibility
4. **Preference-based allocation with load limits** — capacitated stable matching +
   satisfaction stats + publish/swap window
5. **Full coordinator override of allocation** — drag-drop, direct student→guide picker,
   pre-locked pairs, force-assign with reason, start-from-blank, revert-to-auto
6. Review scheduling — windows, panels, conflict-free generation, publish, reschedule
7. Progress logs (weekly logbook) — submit → guide approve/request changes, remarks
8. Document uploads — milestone deliverables with versioning + approval status
9. Final submission record — locked timestamped bundle
10. Coordinator dashboard — teams, guide loads, pending items, deadline compliance

### P1 — Core Strength
11. Team progress heatmap + progress % per team
12. At-Risk Radar (incl. focus-activity flatline rule) + drill-down team timeline
13. Deadline engine — configurable deadlines with automatic reminders (D-7/D-2/D-1/D-0)
14. Notification center (in-app + FCM push + email)
15. Rubric-based review scoring with weights, verdicts, score lock
16. Panel team dossier (read-only, time-boxed)
17. CSV bulk import; CSV/PDF exports (allocations, scores, logbooks)
18. Announcements with pinned notices and role-targeted fan-out
19. Audit log on every state-changing action
20. Guide availability slots + team-meeting booking
21. Review attendance marking feeding compliance stats
22. **Focus stopwatch timer with color-coded subjects/tasks** (YPT pillar 1)
23. **10-minute daily planner with check-off to-dos, rollover, and streaks** (YPT pillar 2)

### P2 — Stretch (from the problem statement)
24. **Internship approval workflow** — apply → offer letter → guide approval → weekly log
    → report + certificate → coordinator approval; status tracker + credit mapping
25. Guide feedback per review (pre-review readiness + post-review remarks)
26. Review-panel scoring with coordinator moderation view + outlier detection
27. Plagiarism/similarity check hook (pluggable external API via Cloud Function)
28. Deadline reminders via scheduled Cloud Functions
29. Team progress heatmap flagship view (if not already shipped in P1)

### P2.5 — Focus & Accountability (YPT-style stretch)
30. **Team rooms & study groups with live focus status, room sprints, DND** (YPT pillar 3)
31. **Real-time leaderboards** — dept/batch/team/subject scopes, daily/weekly/monthly/
    all-time periods, privacy tiers (YPT pillar 4)
32. **Color-coded stats** — subject donut, daily/weekly bars, calendar heatmap, streaks,
    time-of-day insight (YPT pillar 5)
33. Badges & milestone unlocks; streak-keeper nudges ("don't break the chain")
34. Room activity nudges (teammate started/ended session) via FCM

### P3 — Differentiators
35. Peer contribution rating (confidential, per review, imbalance flag to guide)
36. Personal timeline / Gantt of milestones per team
37. GitHub/Drive links per project + repo activity snapshot field
38. Certificate auto-generation (PDF) for approved internships
39. Weekly digest email to guides/coordinators (pending actions summary)
40. Dark mode polish + PWA install + offline drafts (logbook, planner, manual sessions)
41. Public showcase gallery of final projects (opt-in, scores hidden)
42. Multi-cycle support with archived history + "clone last semester setup"
43. Search & filters everywhere; ICS calendar export; Google Calendar links
44. Feedback remark templates for guides; role impersonation for admin (audit-logged)

---

## 14. Security Rules Summary (Firebase)

- `users`: read own (+ coordinator reads all); write own profile fields; roles only via
  Admin SDK/Cloud Function. `focusProfile.privacy` controls what others can read.
- `teams`: members read/write own team; coordinator all; guide read assigned.
- `logbooks`: student creates own; that team's guide updates status/remarks.
- `documents`: upload by team members; read = team + guide + time-boxed panel +
  coordinator; status transitions role-restricted.
- `reviews`: panel writes only their own score before lock; coordinator writes schedule;
  teams read own.
- `internships`: student writes own application/uploads; guide writes approval;
  coordinator final approval.
- `allocations`: write only by allocation Cloud Function + coordinator; override fields
  immutable once set (append-only via audit log).
- **Focus data:** `focusSessions`/`dailyPlans` readable only by the owner (+ aggregate
  rollups exposed via leaderboard docs honoring privacy tiers); room presence readable by
  room members only; guides/coordinators read aggregates only unless a user opts public.
- Storage mirrors the same matrix with content-type/size limits.

---

## 15. Build Roadmap (Phased)

| Phase | Deliverable | Highlights |
|---|---|---|
| **0 — Foundation** (wk 1) | Firebase, auth, roles, routing, PTracker design-system components | Signup → role claim → role dashboards in existing shell |
| **1 — MVP core** (wk 2–3) | Teams, preferences, allocation + **coordinator override UI**, logbooks, doc uploads, final submission | Problem-statement MVP end-to-end |
| **2 — Coordination** (wk 4–5) | Allocation Control Center polish (pre-lock, force-assign, stats), Review Scheduler, rubric scoring, coordinator dashboard v2 | Pillars #1 + #2 complete |
| **3 — Visibility & alerts** (wk 6) | Heatmap, At-Risk Radar, deadline engine, notifications, exports, audit log | Pillar #3 complete; reminders live |
| **4 — Stretch workflows** (wk 7) | Internship workflow end-to-end, guide feedback per review, plagiarism hook, moderation | Pillar #4 complete |
| **5 — Focus module** (wk 8–9) | Stopwatch + subjects, 10-min planner, team rooms + presence, leaderboards, color-coded stats, badges | YPT pillars 1–5 in the existing Focus/Stats tabs |
| **6 — Polish & demo** (wk 10) | Seed data (2 depts × 40 teams), ICS, PWA, dark-mode polish, performance, deploy | Firebase Hosting production |

**Demo script (6 min):** import CSV → set limits/deadlines → form 3 teams → submit
preferences → run auto-allocation → **drag one team to a different guide by hand and
force-assign past a limit with a reason** → publish → generate conflict-free review
schedule → upload deliverable → panel scores on rubric → coordinator heatmap shows one
team red → **switch to Focus: start a stopwatch under a colored subject, open the team
room showing a teammate "focusing", open the weekly leaderboard** → internship offer-letter
approval chain → final submission lock → export CSV.

---

## 16. Why This Wins on the Evaluation Criteria

| Criterion | How the plan addresses it |
|---|---|
| **Allocation logic (preferences vs. load limits)** | Capacitated stable matching with pre-locked coordinator constraints, capacity visible pre-selection, satisfaction stats, **complete manual override authority (drag-drop, direct picker, force-assign with reason, revert-to-auto)**, load distribution chart |
| **Review scheduling** | Conflict-free generator (no double-booking, no self-guide panels), deliverable gate, reschedule workflow, automatic reminders at D-7/2/1/0 |
| **Progress visibility** | Live heatmap, progress %, At-Risk Radar (incl. focus flatline), review-readiness view, guide load chart, focus-consistency aggregates — "who is behind?" answered in one glance |
| **Document handling** | Versioned uploads, role-restricted storage rules, approval pipelines, time-boxed panel access, plagiarism hook, immutable final submission record |
| **Daily engagement (bonus)** | YPT-style focus timer, planner, live team rooms, leaderboards, and color-coded stats keep students working all semester — not just before reviews |
