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
      bio
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
      type
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
    }
}
`;

export const FOLLOWING_FEED = gql`
  query FollowingFeed($skip: Int, $take: Int) {
    followerFeed(skip: $skip, take: $take) {
      id
      title
      createdAt
      hotspot {
        id
        name 
      }
      author {
        id 
        name
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
        followersCount
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
      }
    }
  }
`;

export const ALL_HOTSPOTS = gql`
  query AllHotspots {
    allHotspots {
      id
      name
      avatar
      description
      type
      location {
        id
        latitude
        longitude
        address
      }
      ratings
      visits
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
      author {
        id
        name
        pfp
      }
      hotspot {
        id
        name
      }
    }
  }
`;
