export type MedalTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type MedalCategory =
  | "checkins"
  | "streaks"
  | "hotspots"
  | "exploration"
  | "social"
  | "reviews"
  | "posts"
  | "points"
  | "nightlife"
  | "special";

export type RequirementType =
  | "total_checkins"
  | "streak_days"
  | "hotspots_created"
  | "unique_venues"
  | "followers"
  | "reviews_written"
  | "posts_created"
  | "total_points"
  | "events_attended"
  | "special";

export interface MedalDef {
  id: string;
  name: string;
  description: string;
  category: MedalCategory;
  tier: MedalTier;
  points: number;
  icon: string;
  requirement: {
    type: RequirementType;
    value: number;
  };
}

export const TIER_COLORS: Record<MedalTier, string> = {
  bronze:   "#CD7F32",
  silver:   "#A8B2BD",
  gold:     "#FFD700",
  platinum: "#C8C8D4",
  diamond:  "#7DD6F5",
};

export const MEDALS: MedalDef[] = [
  // ── Check-in milestones ────────────────────────────────────────────────────
  {
    id: "first_checkin",
    name: "First Step",
    description: "Complete your first check-in",
    category: "checkins",
    tier: "bronze",
    points: 25,
    icon: "🚶",
    requirement: { type: "total_checkins", value: 1 },
  },
  {
    id: "checkin_5",
    name: "Five & Counting",
    description: "Check in 5 times",
    category: "checkins",
    tier: "bronze",
    points: 50,
    icon: "🛸",
    requirement: { type: "total_checkins", value: 5 },
  },
  {
    id: "checkin_10",
    name: "Regular",
    description: "Check in 10 times",
    category: "checkins",
    tier: "bronze",
    points: 75,
    icon: "🔁",
    requirement: { type: "total_checkins", value: 10 },
  },
  {
    id: "checkin_25",
    name: "Frequent Flyer",
    description: "Check in 25 times",
    category: "checkins",
    tier: "silver",
    points: 150,
    icon: "🌀",
    requirement: { type: "total_checkins", value: 25 },
  },
  {
    id: "checkin_50",
    name: "Half Century",
    description: "Check in 50 times",
    category: "checkins",
    tier: "silver",
    points: 200,
    icon: "⚡",
    requirement: { type: "total_checkins", value: 50 },
  },
  {
    id: "checkin_100",
    name: "Century Club",
    description: "Check in 100 times",
    category: "checkins",
    tier: "gold",
    points: 400,
    icon: "🧬",
    requirement: { type: "total_checkins", value: 100 },
  },
  {
    id: "checkin_250",
    name: "Devoted",
    description: "Check in 250 times",
    category: "checkins",
    tier: "platinum",
    points: 750,
    icon: "🪐",
    requirement: { type: "total_checkins", value: 250 },
  },
  {
    id: "checkin_500",
    name: "Legend",
    description: "Check in 500 times — you ARE the scene",
    category: "checkins",
    tier: "diamond",
    points: 1500,
    icon: "🌌",
    requirement: { type: "total_checkins", value: 500 },
  },

  // ── Streaks ────────────────────────────────────────────────────────────────
  {
    id: "streak_3",
    name: "On A Roll",
    description: "Check in 3 days in a row",
    category: "streaks",
    tier: "bronze",
    points: 50,
    icon: "🔥",
    requirement: { type: "streak_days", value: 3 },
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "7-day check-in streak",
    category: "streaks",
    tier: "silver",
    points: 100,
    icon: "🗡️",
    requirement: { type: "streak_days", value: 7 },
  },
  {
    id: "streak_14",
    name: "Two Week Run",
    description: "14-day check-in streak",
    category: "streaks",
    tier: "silver",
    points: 175,
    icon: "⚔️",
    requirement: { type: "streak_days", value: 14 },
  },
  {
    id: "streak_30",
    name: "Monthly Grind",
    description: "30-day check-in streak",
    category: "streaks",
    tier: "gold",
    points: 350,
    icon: "🌋",
    requirement: { type: "streak_days", value: 30 },
  },
  {
    id: "streak_60",
    name: "Two Month Strong",
    description: "60-day check-in streak",
    category: "streaks",
    tier: "platinum",
    points: 600,
    icon: "🧲",
    requirement: { type: "streak_days", value: 60 },
  },
  {
    id: "streak_100",
    name: "Unstoppable",
    description: "100-day check-in streak",
    category: "streaks",
    tier: "diamond",
    points: 1200,
    icon: "☄️",
    requirement: { type: "streak_days", value: 100 },
  },

  // ── Hotspot creation ──────────────────────────────────────────────────────
  {
    id: "first_hotspot",
    name: "Scene Setter",
    description: "Create your first hotspot",
    category: "hotspots",
    tier: "bronze",
    points: 50,
    icon: "📶",
    requirement: { type: "hotspots_created", value: 1 },
  },
  {
    id: "hotspot_3",
    name: "Local Guide",
    description: "Create 3 hotspots",
    category: "hotspots",
    tier: "bronze",
    points: 100,
    icon: "🗾",
    requirement: { type: "hotspots_created", value: 3 },
  },
  {
    id: "hotspot_5",
    name: "City Expert",
    description: "Create 5 hotspots",
    category: "hotspots",
    tier: "silver",
    points: 200,
    icon: "🏗️",
    requirement: { type: "hotspots_created", value: 5 },
  },
  {
    id: "hotspot_10",
    name: "Venue Master",
    description: "Create 10 hotspots",
    category: "hotspots",
    tier: "gold",
    points: 350,
    icon: "🧱",
    requirement: { type: "hotspots_created", value: 10 },
  },
  {
    id: "hotspot_25",
    name: "Scene Builder",
    description: "Create 25 hotspots",
    category: "hotspots",
    tier: "platinum",
    points: 700,
    icon: "🏛️",
    requirement: { type: "hotspots_created", value: 25 },
  },
  {
    id: "hotspot_50",
    name: "City Legend",
    description: "Create 50 hotspots — you built this city",
    category: "hotspots",
    tier: "diamond",
    points: 1400,
    icon: "🌃",
    requirement: { type: "hotspots_created", value: 50 },
  },

  // ── Exploration ───────────────────────────────────────────────────────────
  {
    id: "explore_3",
    name: "Explorer",
    description: "Visit 3 different venues",
    category: "exploration",
    tier: "bronze",
    points: 50,
    icon: "🪂",
    requirement: { type: "unique_venues", value: 3 },
  },
  {
    id: "explore_10",
    name: "Adventurer",
    description: "Visit 10 different venues",
    category: "exploration",
    tier: "silver",
    points: 150,
    icon: "🧿",
    requirement: { type: "unique_venues", value: 10 },
  },
  {
    id: "explore_25",
    name: "Pathfinder",
    description: "Visit 25 different venues",
    category: "exploration",
    tier: "gold",
    points: 300,
    icon: "🗺️",
    requirement: { type: "unique_venues", value: 25 },
  },
  {
    id: "explore_50",
    name: "World Wanderer",
    description: "Visit 50 different venues",
    category: "exploration",
    tier: "platinum",
    points: 600,
    icon: "🛰️",
    requirement: { type: "unique_venues", value: 50 },
  },
  {
    id: "explore_100",
    name: "Legendary Explorer",
    description: "Visit 100 different venues",
    category: "exploration",
    tier: "diamond",
    points: 1200,
    icon: "🌠",
    requirement: { type: "unique_venues", value: 100 },
  },

  // ── Social ────────────────────────────────────────────────────────────────
  {
    id: "followers_1",
    name: "First Fan",
    description: "Get your first follower",
    category: "social",
    tier: "bronze",
    points: 25,
    icon: "🫂",
    requirement: { type: "followers", value: 1 },
  },
  {
    id: "followers_5",
    name: "Growing",
    description: "Reach 5 followers",
    category: "social",
    tier: "bronze",
    points: 75,
    icon: "🌱",
    requirement: { type: "followers", value: 5 },
  },
  {
    id: "followers_10",
    name: "Popular",
    description: "Reach 10 followers",
    category: "social",
    tier: "silver",
    points: 125,
    icon: "🫧",
    requirement: { type: "followers", value: 10 },
  },
  {
    id: "followers_25",
    name: "Rising Star",
    description: "Reach 25 followers",
    category: "social",
    tier: "silver",
    points: 200,
    icon: "✨",
    requirement: { type: "followers", value: 25 },
  },
  {
    id: "followers_50",
    name: "Scene Leader",
    description: "Reach 50 followers",
    category: "social",
    tier: "gold",
    points: 350,
    icon: "🎙️",
    requirement: { type: "followers", value: 50 },
  },
  {
    id: "followers_100",
    name: "Icon",
    description: "Reach 100 followers",
    category: "social",
    tier: "gold",
    points: 600,
    icon: "🪩",
    requirement: { type: "followers", value: 100 },
  },
  {
    id: "followers_250",
    name: "Celebrity",
    description: "Reach 250 followers",
    category: "social",
    tier: "platinum",
    points: 1000,
    icon: "🌟",
    requirement: { type: "followers", value: 250 },
  },

  // ── Reviews ───────────────────────────────────────────────────────────────
  {
    id: "first_review",
    name: "Critic",
    description: "Rate your first hotspot",
    category: "reviews",
    tier: "bronze",
    points: 30,
    icon: "🔎",
    requirement: { type: "reviews_written", value: 1 },
  },
  {
    id: "review_5",
    name: "Regular Critic",
    description: "Rate 5 hotspots",
    category: "reviews",
    tier: "bronze",
    points: 100,
    icon: "🖊️",
    requirement: { type: "reviews_written", value: 5 },
  },
  {
    id: "review_10",
    name: "Trusted Voice",
    description: "Rate 10 hotspots",
    category: "reviews",
    tier: "silver",
    points: 175,
    icon: "🎙️",
    requirement: { type: "reviews_written", value: 10 },
  },
  {
    id: "review_25",
    name: "Respected Critic",
    description: "Rate 25 hotspots",
    category: "reviews",
    tier: "gold",
    points: 350,
    icon: "🧪",
    requirement: { type: "reviews_written", value: 25 },
  },
  {
    id: "review_50",
    name: "Top Critic",
    description: "Rate 50 hotspots",
    category: "reviews",
    tier: "platinum",
    points: 700,
    icon: "🔬",
    requirement: { type: "reviews_written", value: 50 },
  },

  // ── Posts ─────────────────────────────────────────────────────────────────
  {
    id: "first_post",
    name: "Content Creator",
    description: "Publish your first post",
    category: "posts",
    tier: "bronze",
    points: 30,
    icon: "🖼️",
    requirement: { type: "posts_created", value: 1 },
  },
  {
    id: "post_5",
    name: "Regular Poster",
    description: "Publish 5 posts",
    category: "posts",
    tier: "bronze",
    points: 100,
    icon: "🎞️",
    requirement: { type: "posts_created", value: 5 },
  },
  {
    id: "post_10",
    name: "Active Creator",
    description: "Publish 10 posts",
    category: "posts",
    tier: "silver",
    points: 175,
    icon: "🎬",
    requirement: { type: "posts_created", value: 10 },
  },
  {
    id: "post_25",
    name: "Prolific Creator",
    description: "Publish 25 posts",
    category: "posts",
    tier: "gold",
    points: 350,
    icon: "📲",
    requirement: { type: "posts_created", value: 25 },
  },
  {
    id: "post_50",
    name: "Content Machine",
    description: "Publish 50 posts",
    category: "posts",
    tier: "platinum",
    points: 600,
    icon: "🖥️",
    requirement: { type: "posts_created", value: 50 },
  },
  {
    id: "post_100",
    name: "Media Legend",
    description: "Publish 100 posts",
    category: "posts",
    tier: "diamond",
    points: 1200,
    icon: "📡",
    requirement: { type: "posts_created", value: 100 },
  },

  // ── Points milestones ─────────────────────────────────────────────────────
  {
    id: "points_100",
    name: "Point Starter",
    description: "Earn 100 total points",
    category: "points",
    tier: "bronze",
    points: 0,
    icon: "🪙",
    requirement: { type: "total_points", value: 100 },
  },
  {
    id: "points_500",
    name: "Point Collector",
    description: "Earn 500 total points",
    category: "points",
    tier: "bronze",
    points: 50,
    icon: "💳",
    requirement: { type: "total_points", value: 500 },
  },
  {
    id: "points_1000",
    name: "Point Hunter",
    description: "Earn 1,000 total points",
    category: "points",
    tier: "silver",
    points: 100,
    icon: "🧾",
    requirement: { type: "total_points", value: 1000 },
  },
  {
    id: "points_2500",
    name: "Point Hustler",
    description: "Earn 2,500 total points",
    category: "points",
    tier: "silver",
    points: 150,
    icon: "💹",
    requirement: { type: "total_points", value: 2500 },
  },
  {
    id: "points_5000",
    name: "Point King",
    description: "Earn 5,000 total points",
    category: "points",
    tier: "gold",
    points: 250,
    icon: "🏺",
    requirement: { type: "total_points", value: 5000 },
  },
  {
    id: "points_10000",
    name: "Point Lord",
    description: "Earn 10,000 total points",
    category: "points",
    tier: "platinum",
    points: 500,
    icon: "🗝️",
    requirement: { type: "total_points", value: 10000 },
  },
  {
    id: "points_25000",
    name: "Point God",
    description: "Earn 25,000 total points",
    category: "points",
    tier: "diamond",
    points: 1000,
    icon: "⚜️",
    requirement: { type: "total_points", value: 25000 },
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    id: "event_1",
    name: "Event Goer",
    description: "Attend your first event",
    category: "nightlife",
    tier: "bronze",
    points: 50,
    icon: "🎟️",
    requirement: { type: "events_attended", value: 1 },
  },
  {
    id: "event_5",
    name: "Event Enthusiast",
    description: "Attend 5 events",
    category: "nightlife",
    tier: "silver",
    points: 150,
    icon: "🥂",
    requirement: { type: "events_attended", value: 5 },
  },
  {
    id: "event_10",
    name: "Event Master",
    description: "Attend 10 events",
    category: "nightlife",
    tier: "gold",
    points: 300,
    icon: "🎭",
    requirement: { type: "events_attended", value: 10 },
  },
  {
    id: "event_25",
    name: "Festival King",
    description: "Attend 25 events",
    category: "nightlife",
    tier: "platinum",
    points: 600,
    icon: "🔊",
    requirement: { type: "events_attended", value: 25 },
  },

  // ── Special ───────────────────────────────────────────────────────────────
  {
    id: "pioneer",
    name: "Pioneer",
    description: "First 10 people to check in somewhere tonight",
    category: "special",
    tier: "gold",
    points: 200,
    icon: "🚀",
    requirement: { type: "special", value: 1 },
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Check in after midnight",
    category: "nightlife",
    tier: "silver",
    points: 75,
    icon: "🌙",
    requirement: { type: "special", value: 1 },
  },
  {
    id: "weekend_warrior",
    name: "Weekend Warrior",
    description: "Check in on 5 different weekends",
    category: "nightlife",
    tier: "silver",
    points: 100,
    icon: "🎸",
    requirement: { type: "special", value: 1 },
  },
  {
    id: "top10_leaderboard",
    name: "Top 10",
    description: "Reach top 10 on the weekly leaderboard",
    category: "special",
    tier: "gold",
    points: 250,
    icon: "🥇",
    requirement: { type: "special", value: 1 },
  },
  {
    id: "plugged_in",
    name: "Plugged In",
    description: "Use Plugged every day for a month",
    category: "special",
    tier: "diamond",
    points: 800,
    icon: "🔋",
    requirement: { type: "streak_days", value: 30 },
  },
];

export function computeEarnedMedals(stats: {
  totalCheckins: number;
  longestStreak: number;
  hotspotsCreated: number;
  uniqueVenues: number;
  followers: number;
  reviewsWritten: number;
  postsCreated: number;
  totalPoints: number;
  eventsAttended: number;
  specialIds?: string[];
}): Set<string> {
  const earned = new Set<string>();
  const special = new Set(stats.specialIds ?? []);

  for (const medal of MEDALS) {
    const { type, value } = medal.requirement;
    let qualifies = false;

    switch (type) {
      case "total_checkins":   qualifies = stats.totalCheckins >= value; break;
      case "streak_days":      qualifies = stats.longestStreak >= value; break;
      case "hotspots_created": qualifies = stats.hotspotsCreated >= value; break;
      case "unique_venues":    qualifies = stats.uniqueVenues >= value; break;
      case "followers":        qualifies = stats.followers >= value; break;
      case "reviews_written":  qualifies = stats.reviewsWritten >= value; break;
      case "posts_created":    qualifies = stats.postsCreated >= value; break;
      case "total_points":     qualifies = stats.totalPoints >= value; break;
      case "events_attended":  qualifies = stats.eventsAttended >= value; break;
      case "special":          qualifies = special.has(medal.id); break;
    }

    if (qualifies) earned.add(medal.id);
  }

  return earned;
}

export function computeStreak(checkinDates: string[]): number {
  if (!checkinDates.length) return 0;
  const days = Array.from(
    new Set(checkinDates.map((d) => new Date(d).toISOString().slice(0, 10)))
  ).sort().reverse();

  let streak = 0;
  let prev: Date | null = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const dayStr of days) {
    const day = new Date(dayStr);
    if (!prev) {
      const diffDays = Math.floor((today.getTime() - day.getTime()) / 86400000);
      if (diffDays > 1) break;
      streak = 1;
      prev = day;
    } else {
      const diffDays = Math.floor((prev.getTime() - day.getTime()) / 86400000);
      if (diffDays === 1) { streak++; prev = day; }
      else break;
    }
  }
  return streak;
}

export function computeMedalPointsForUser(user: {
  visits?: number;
  followersCount?: number;
  hotspots?: { id: string }[];
  reviews?: { id: string }[];
  posts?: { id: string }[];
  points?: number;
}): number {
  const earned = computeEarnedMedals({
    totalCheckins:  user.visits ?? 0,
    longestStreak:  0,
    hotspotsCreated: user.hotspots?.length ?? 0,
    uniqueVenues:   0,
    followers:      user.followersCount ?? 0,
    reviewsWritten: user.reviews?.length ?? 0,
    postsCreated:   user.posts?.length ?? 0,
    totalPoints:    user.points ?? 0,
    eventsAttended: 0,
  });
  return Array.from(earned).reduce((sum, id) => {
    const medal = MEDALS.find((m) => m.id === id);
    return sum + (medal?.points ?? 0);
  }, 0);
}
