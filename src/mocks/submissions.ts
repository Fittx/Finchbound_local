/*
 * MOCK DATA: prototype only.
 * Guest submissions for three events, seeded so every moderation state exists:
 * Pending, Approved, Rejected, In book, with and without photo, long message,
 * anonymous guest (Email only), and reported entries.
 * Delete once GET /api/books/:bookId/submissions is live.
 */
import { PHOTOS, photo } from "../data";
import { minutesAgo } from "../lib/time";
import type { Submission } from "../types/submissions";

const LONG =
  "Room 4B forever. We promised each other in sophomore year that whoever got married first would have the whole crew there, and look at us. Maya, you once drove four hours in a snowstorm because I said I missed you, and Theo, you learned to make her grandmother's soup from a voicemail recipe. That's who you are. Thank you for the dancing, the speeches that made the back row cry, and the late-night fries. We love you both. Congratulations, you beautiful nerds.";

export const MOCK_SUBMISSIONS: Submission[] = [
  // Maya & Theo (b1): Name only, entries arrive Approved.
  {
    id: "s-b1-1",
    bookId: "b1",
    name: "Priya Raman",
    message:
      "We have watched you laugh at the same terrible jokes for eight years. Here is to eighty more.",
    photo: photo(PHOTOS.toast),
    createdAt: minutesAgo(4),
    status: "in-book",
    pageId: "p1",
    reactions: 6,
    reacted: false,
  },
  {
    id: "s-b1-2",
    bookId: "b1",
    name: "Aunt June",
    message: "Theo stepped on your toes twice and you did not stop smiling once.",
    photo: photo(PHOTOS.dance),
    createdAt: minutesAgo(9),
    status: "in-book",
    pageId: "p2",
    reactions: 11,
    reacted: true,
  },
  {
    id: "s-b1-3",
    bookId: "b1",
    name: "Leo",
    message: "The vows made the whole back row cry. Mostly me.",
    createdAt: minutesAgo(14),
    status: "approved",
    reactions: 3,
    reacted: false,
  },
  {
    id: "s-b1-4",
    bookId: "b1",
    name: "The Okafors",
    message: "Best seat in the house was anywhere near you two.",
    photo: photo(PHOTOS.table),
    createdAt: minutesAgo(22),
    status: "in-book",
    pageId: "p3",
    reactions: 8,
    reacted: false,
  },
  {
    id: "s-b1-5",
    bookId: "b1",
    name: "Dani Cho",
    message: LONG,
    photo: photo(PHOTOS.group),
    createdAt: minutesAgo(31),
    status: "approved",
    reactions: 2,
    reacted: false,
  },
  {
    id: "s-b1-6",
    bookId: "b1",
    name: "Grandpa Ray",
    message: "Proud of you both. Now go eat some cake.",
    photo: photo(PHOTOS.garden),
    createdAt: minutesAgo(38),
    status: "approved",
    reactions: 1,
    reacted: false,
    report: { reason: "privacy", count: 1, lastReportedAt: minutesAgo(12) },
  },
  {
    id: "s-b1-7",
    bookId: "b1",
    name: "DJ Nights",
    message: "Need music for your next party? Book us at the link in our bio.",
    createdAt: minutesAgo(45),
    status: "rejected",
    reactions: 0,
    reacted: false,
  },

  // Pine Lake reunion (b4): Strict, entries arrive Pending.
  {
    id: "s-b4-1",
    bookId: "b4",
    name: "Hannah",
    email: "hannah@example.com",
    message: "Same lake, same jokes, a few more kids running around.",
    photo: photo(PHOTOS.picnic),
    createdAt: minutesAgo(60),
    status: "in-book",
    pageId: "r1",
    reactions: 4,
    reacted: true,
  },
  {
    id: "s-b4-2",
    bookId: "b4",
    name: "Sam Ortiz",
    email: "sam@example.com",
    message: "The three-hour lunch on the dock is still the best meal I have ever had.",
    photo: photo(PHOTOS.lunch),
    createdAt: minutesAgo(3),
    status: "pending",
    reactions: 0,
    reacted: false,
  },
  {
    id: "s-b4-3",
    bookId: "b4",
    name: "Mei Tanaka",
    email: "mei@example.com",
    message:
      "Every summer started the same way: someone forgot the oars, someone fell in the lake before lunch, and by sunset we were all on the dock pretending we weren't tired. Ten years later I still measure every summer against those ones. Thank you for getting us all back together, and for keeping the tradition of terrible campfire songs alive.",
    photo: photo(PHOTOS.water),
    createdAt: minutesAgo(7),
    status: "pending",
    reactions: 0,
    reacted: false,
  },
  {
    id: "s-b4-4",
    bookId: "b4",
    name: "Kofi Mensah",
    email: "kofi@example.com",
    message: "Found this photo from 2015. Nobody has aged, clearly.",
    photo: photo(PHOTOS.beach),
    createdAt: minutesAgo(11),
    status: "pending",
    reactions: 0,
    reacted: false,
  },
  {
    id: "s-b4-5",
    bookId: "b4",
    name: "Rachel Kim",
    email: "rachel@example.com",
    message: "Already counting down to next year.",
    photo: photo(PHOTOS.garden),
    createdAt: minutesAgo(26),
    status: "approved",
    reactions: 2,
    reacted: false,
  },
  {
    id: "s-b4-6",
    bookId: "b4",
    name: "Jake",
    email: "jake@example.com",
    message: "lol you all look ridiculous",
    photo: photo(PHOTOS.room),
    createdAt: minutesAgo(18),
    status: "pending",
    reactions: 0,
    reacted: false,
    report: { reason: "inappropriate", count: 2, lastReportedAt: minutesAgo(5) },
  },
  {
    id: "s-b4-7",
    bookId: "b4",
    name: "Prize Center",
    email: "win@example.com",
    message: "Congratulations, you won a free cruise. Claim it now.",
    createdAt: minutesAgo(50),
    status: "rejected",
    reactions: 0,
    reacted: false,
    report: { reason: "spam", count: 3, lastReportedAt: minutesAgo(40) },
  },

  // Ana & Leo (b5): Email only, names optional, entries arrive Approved.
  {
    id: "s-b5-1",
    bookId: "b5",
    name: "",
    email: "guest1@example.com",
    message: "We met you both at the climbing gym and have been cheering ever since.",
    photo: photo(PHOTOS.beach),
    createdAt: minutesAgo(6),
    status: "approved",
    reactions: 0,
    reacted: false,
  },
  {
    id: "s-b5-2",
    bookId: "b5",
    name: "Lucía",
    email: "lucia@example.com",
    message: "Ana, you are going to be the best wife. Leo, you are very lucky.",
    createdAt: minutesAgo(15),
    status: "approved",
    reactions: 1,
    reacted: false,
  },
  {
    id: "s-b5-3",
    bookId: "b5",
    name: "",
    email: "guest2@example.com",
    message: "Congratulations from your old neighbors on Pine Street.",
    createdAt: minutesAgo(29),
    status: "approved",
    reactions: 0,
    reacted: false,
  },
  {
    id: "s-b5-4",
    bookId: "b5",
    name: "Tom",
    email: "tom@example.com",
    message: "Engagement party of the year.",
    photo: photo(PHOTOS.lunch),
    createdAt: minutesAgo(41),
    status: "approved",
    reactions: 0,
    reacted: false,
  },
];

// MOCK DATA: keep the original moderation fixtures first; older arrivals make pagination visible.
for (const bookId of ["b1", "b4", "b5"]) {
  for (let i = 0; i < 44; i++)
    MOCK_SUBMISSIONS.push({
      id: `scale-${bookId}-${i}`,
      bookId,
      name: `Guest ${i + 1}`,
      email: `guest${i + 1}@example.com`,
      message: `Memory ${i + 1}: Thank you for bringing the whole flock together. A day worth keeping.`,
      photo: i % 3 === 0 ? undefined : photo(PHOTOS.picnic),
      createdAt: minutesAgo(120 + i),
      status: bookId === "b4" && i % 2 === 0 ? "pending" : "approved",
      reactions: i % 4,
      reacted: false,
    });
}

/** Simulated arrivals for the live feed, per book. */
export const MOCK_INCOMING: Record<string, Pick<Submission, "name" | "message" | "photo">[]> = {
  b1: [
    { name: "Marco", message: "Still not sure who requested that song four times." },
    {
      name: "Nina",
      message: "Best dance floor I've been on all year.",
      photo: photo(PHOTOS.dance),
    },
  ],
  b4: [{ name: "Ella", message: "Bring back the canoe race!", photo: photo(PHOTOS.water) }],
  b5: [{ name: "", message: "So happy for you two.", photo: photo(PHOTOS.picnic) }],
};
