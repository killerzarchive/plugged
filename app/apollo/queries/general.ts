import { gql } from "@apollo/client";

export const ME_QUERY = gql`
  query Me {
    me {
      id
      name
      email
      pfp
      visits
      ratings
      points
      bio
      type
      joined
      followersCount
      reviews {
        id
        rating
        comment
        hotspot {
          id
          isEvent
      
          name
          avatar
          description
        }
      }
      location {
        longitude
        latitude
        address
      }
      following {
        id
        name
        pfp
        bio
        location {
          latitude
          longitude
          address
        }
        hotspots {
          id
          name
          avatar
          description
          isPopup
          popupStart
          popupEnd
          type
          followersCount
          ratings
          visits
          location {
            id
            latitude
            longitude
            address
          }
          author {
            id
            name
            pfp
          }
          displayPosts {
            id
            media
          }
          posts {
            id
            title
            media
            type
            createdAt
            author {
              id
              name
              pfp
            }
          }
        }
        posts {
          id
          title
          content
          media
          type
          createdAt
          likesCount
          isLikedByMe
          author {
            id
            name
            pfp
          }
          hotspot {
            id
            name
            type
            createdAt
            avatar
            description
            location {
              id
              latitude
              longitude
              address
            }
          }
        }
      }
      followingHotspots {
        id
        name
        avatar
        isEvent
        description
        followersCount
        checkins{
        id
        }
        type
        createdAt
        time
        visits
        ratings
        location {
          id
          latitude
          longitude
          address
        }
        posts {
          id
          title
          content
          media
          type
          createdAt
          likesCount
          isLikedByMe
          author {
            id
            name
            pfp
          }
          hotspot {
            id
            name
            type
            avatar
            description
            location {
              id
              latitude
              longitude
              address
            }
          }
        }
      }
      followingEventHotspots {
        id
        name
        avatar
        description
        createdAt
        followersCount
        isEvent
        checkins{
        id
        }
        type
        visits
        ratings
        site
        time
        location {
          id
          latitude
          longitude
          address
        }
        posts {
          id
          title
          content
          media
          type
          createdAt
          likesCount
          isLikedByMe
          author {
            id
            name
            pfp
          }
          hotspot {
            id
            name
            type
            avatar
            description
            location {
              id
              latitude
              longitude
              address
            }
          }
        }
      }
      hotspots {
        id
        name
        type
        avatar
        description
        isEvent
        createdAt
        time
        ratings
        posts {
          id
          title
          media
          type
          createdAt
        }
        location {
          id
          latitude
          longitude
          address
        }
      }
      
      posts {
        id
        title
        media
        type
        createdAt
      }
    }
  }
`;

export const FOLLOWING_HOTSPOTS = gql`
  query FollowingHotspots($skip: Int, $take: Int) {
    followerHotspots(skip: $skip, take: $take) {
      id
      name
      avatar
      description
      createdAt
      isEvent
      type
      time
      visits
      ratings
      location {
        id
        latitude
        longitude
        address
      }
      author {
        id
        name
        pfp
      }
      posts {
        id
        title
        content
        media
        type
        createdAt
        likesCount
        isLikedByMe
        author {
          id
          name
          pfp
        }
        hotspot {
          id
          name
          type
          avatar
          description
          createdAt
          location {
            id
            latitude
            longitude
            address
          }
        }
      }
    }
  }
`;

export const FOLLOWING_CHECKINS =  gql`
query FollowerRecentCheckins($skip: Int, $take: Int) {
  followerRecentCheckins(skip: $skip, take: $take) {
    id
    createdAt
    user {
      id
      name
      pfp
    }
    hotspot {
      id
      name
      avatar
      description
      location {
        latitude
        longitude
        address
      }
    }
  }
}
`
export const FOLLOWING_FEED = gql`
  query FollowingFeed($skip: Int, $take: Int) {
    followerFeed(skip: $skip, take: $take) {
      id
      title
      content
      media
      type
      createdAt
      likesCount
      isLikedByMe
      hotspot {
        id
        name
        type
        avatar
        time
        description
        location {
          id
          latitude
          longitude
          address
        }
      }
      author {
        id
        name
        pfp
      }
    }
  }
`;

export const GET_FOLLOWING = gql`
  query GetFollowing($userId: String!) {
    user(id: $userId) {
      id
      following {
        id
        name
        pfp
        bio
      }
    }
  }
`;

export const SEARCH_QUERY = gql`
  query SearchUsers($searchString: String!, $skip: Int, $take: Int) {
    searchUsers(searchString: $searchString, skip: $skip, take: $take) {
      id
      name
      pfp
      bio
      followersCount
      isFollowingUser
      reviews {
        id
        hotspot {
          id
          name
          avatar
        }
      }
      posts {
        id
        title
        media
        type
        createdAt
      }
    }
  }
`;

export const LEADERBOARD_HOTSPOTS = gql`
  query LeaderboardHotspots {
    leaderboardHotspots {
      id
      name
      avatar
      type
      isEvent
      isPopup
      points
      visits
      followersCount
      followers {
        id
        name
        pfp
      }
      location {
        id
        latitude
        longitude
        address
      }
      checkins {
        id
        createdAt
      }
      posts {
        id
        media
        createdAt
        author {
          id
          name
          pfp
        }
      }
    }
  }
`;

export const LEADERBOARD_HOTSPOTS_BY_POINTS = gql`
  query LeaderboardHotspotsByPoints($period: String, $take: Int) {
    leaderboardHotspotsByPoints(period: $period, take: $take) {
      periodPoints
      hotspot {
        id
        name
        avatar
        type
        isEvent
        isPopup
        points
        visits
        location {
          id
          latitude
          longitude
          address
        }
        checkins {
          id
          createdAt
        }
        displayPosts {
          id
          media
        }
      }
    }
  }
`;

export const LEADERBOARD_USERS_BY_POINTS = gql`
  query LeaderboardUsersByPoints($period: String, $take: Int) {
    leaderboardUsersByPoints(period: $period, take: $take) {
      periodPoints
      user {
        id
        name
        pfp
        points
        visits
        followersCount
        hotspots { id }
        reviews { id }
        posts { id }
        location {
          latitude
          longitude
          address
        }
      }
    }
  }
`;

export const DAILY_CHECKIN = gql`
  mutation DailyCheckin {
    dailyCheckin {
      id
      points
    }
  }
`;

export const ALL_HOTSPOTS = gql`
  query AllHotspots {
    allHotspots {
      id
      name
      avatar
      createdAt
      time
      description
      type
      isEvent
      isPopup
      location {
        id
        latitude
        longitude
        address
      }
      ratings
      visits
      points
      followersCount
      checkins {
        id
        createdAt
        user {
          id
          name
          pfp
        }
      }
      displayPosts {
        id
        media
      }
      posts {
        id
        title
        content
        media
        type
        createdAt
        likesCount
        isLikedByMe
        author {
          id
          name
          pfp
        }
      }
    }
  }
`;

export const USER_CHECKINS = gql`
  query UserCheckins($userId: Int!) {
    userCheckIns(userId: $userId) {
      id
      createdAt
      hotspot {
        id
        name
        avatar
        description
        type
        isEvent
        location {
          latitude
          longitude
          address
        }
      }
    }
  }
`;

export const USER_POSTS = gql`
  query UserPosts($userId: Int!, $skip: Int, $take: Int) {
    userPosts(userId: $userId, skip: $skip, take: $take) {
      id
      title
      media
      type
      createdAt
    }
  }
`;

export const SEARCH_POSTS = gql`
  query SearchPosts($searchString: String!, $skip: Int, $take: Int) {
    searchPosts(searchString: $searchString, skip: $skip, take: $take) {
      id
      title
      content
      media
      type
      createdAt
      likesCount
      isLikedByMe
      author {
        id
        name
        pfp
      }
      hotspot {
        id
        name
        type
        avatar
        description
        location {
          id
          latitude
          longitude
          address
        }
      }
    }
  }
`;

  export const SEARCH_EVENTS = gql`
    query SearchEvents($searchString: String!, $skip: Int, $take: Int) {
      searchEvents(searchString: $searchString, skip: $skip, take: $take) {
        id
        name
        avatar
        time
        description
        site
        time
        type
        location {
          id
          latitude
          longitude
          address
        }
        posts {
          id
          title
          media
          type
          createdAt
          author {
            id
            name
            pfp
          }
        }
      }
    }
  `;

export const TOP_SEARCH_POSTS = gql`
  query TopSearchPosts($searchString: String!, $skip: Int, $take: Int) {
    topSearchPosts(searchString: $searchString, skip: $skip, take: $take) {
      id
      title
      content
      media
      type
      createdAt
      likesCount
      isLikedByMe
      author {
        id
        name
        pfp
      }
      hotspot {
        id
        name
        type
        time
        avatar
        description
        location {
          id
          latitude
          longitude
          address
        }
      }
    }
  }
`;

export const GENERAL_SEARCH_POSTS = gql`
  query GeneralSearchPosts($searchString: String!, $skip: Int, $take: Int) {
    generalSearchPosts(searchString: $searchString, skip: $skip, take: $take) {
      id
      title
      content
      media
      type
      createdAt
      likesCount
      isLikedByMe
      author {
        id
        name
        pfp
      }
      hotspot {
        id
        name
        type
        avatar
        description
        location {
          id
          latitude
          longitude
          address
        }
      }
    }
  }
`;

export const GET_EVENTS = gql`
  query AllEventHotspots {
    allEventHotspots {
      id
      name
      avatar
      description
      time
      site
      type
      time
      location {
        id
        latitude
        longitude
        address
      }
      ratings
      visits
      followersCount
      displayPosts {
        id
        media
      }
      posts {
        id
        title
        media
        type
        createdAt
        author {
          id
          name
          pfp
        }
      }
    }
  }
`;

export const GET_POST = gql`
  query GetPost($id: Int!) {
    postById(id: $id) {
      id
      title
      likesCount
      isLikedByMe
      author {
        id
        name
        pfp
      }
    }
  }
`;

export const UNREAD_NOTIFICATION_COUNT = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MY_NOTIFICATIONS = gql`
  query MyNotifications($skip: Int, $take: Int) {
    myNotifications(skip: $skip, take: $take) {
      id
      createdAt
      read
      type
      message
      actorId
      hotspotId
      postId
      actor {
        id
        name
        pfp
      }
      hotspot {
        id
        name
        avatar
      }
    }
    unreadNotificationCount
  }
`;

export const LEADERBOARD_PLUGGED_IN_USERS = gql`
  query LeaderboardPluggedInUsers($period: String, $take: Int) {
    leaderboardPluggedInUsers(period: $period, take: $take) {
      periodPoints
      user {
        id
        name
        pfp
        points
        location {
          latitude
          longitude
          address
        }
      }
    }
  }
`;

export const ALL_POPUPS = gql`
  query AllPopups {
    allPopups {
      id
      name
      avatar
      description
      isPopup
      popupStart
      popupEnd
      type
      location {
        id
        latitude
        longitude
        address
      }
      ratings
      visits
      followersCount
      followers {
        id
        name
        pfp
      }
      author {
        id
        name
        pfp
      }
      displayPosts {
        id
        media
      }
      posts {
        id
        title
        media
        type
        createdAt
        author {
          id
          name
          pfp
        }
      }
    }
  }
`;
