import { ME_QUERY, USER_CHECKINS } from "@/app/apollo/queries/general";
import {
  computeEarnedMedals,
  computeStreak,
  MEDALS,
  type MedalDef,
} from "@/constants/medals";
import { useQuery } from "@apollo/client/react";
import { useMemo } from "react";

interface CheckIn {
  id: string;
  createdAt?: string;
  hotspot?: { id: string; isEvent?: boolean };
}

interface MeData {
  me: {
    id: string;
    visits?: number;
    points?: number;
    followersCount?: number;
    reviews?: { id: string }[];
    posts?: { id: string }[];
    hotspots?: { id: string }[];
  };
}

export interface MedalWithStatus extends MedalDef {
  earned: boolean;
}

export function useMedals() {
  const { data: meData } = useQuery<MeData>(ME_QUERY);
  const me = meData?.me;

  const { data: checkinsData } = useQuery<{ userCheckIns: CheckIn[] }>(USER_CHECKINS, {
    variables: { userId: me?.id ? parseInt(me.id) : 0 },
    skip: !me?.id,
  });

  const medals = useMemo((): MedalWithStatus[] => {
    const checkins = checkinsData?.userCheckIns ?? [];
    const checkinDates = checkins.map((c) => c.createdAt ?? "").filter(Boolean);
    const uniqueVenues = new Set(checkins.map((c) => c.hotspot?.id).filter(Boolean)).size;
    const eventsAttended = checkins.filter((c) => c.hotspot?.isEvent).length;

    const stats = {
      totalCheckins: me?.visits ?? 0,
      longestStreak: computeStreak(checkinDates),
      hotspotsCreated: me?.hotspots?.length ?? 0,
      uniqueVenues,
      followers: me?.followersCount ?? 0,
      reviewsWritten: me?.reviews?.length ?? 0,
      postsCreated: me?.posts?.length ?? 0,
      totalPoints: me?.points ?? 0,
      eventsAttended,
      specialIds: [],
    };

    const earnedSet = computeEarnedMedals(stats);

    return MEDALS.map((m) => ({ ...m, earned: earnedSet.has(m.id) }));
  }, [me, checkinsData]);

  const earned = medals.filter((m) => m.earned);
  const locked = medals.filter((m) => !m.earned);
  const totalPoints = earned.reduce((sum, m) => sum + m.points, 0);

  return { medals, earned, locked, totalPoints };
}
