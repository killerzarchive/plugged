import { gql } from "@apollo/client";

export const PFP_MUTATION = gql`
  mutation UpdateProfile($data: UpdateProfileInput!) {
    updateProfile(data: $data) {
      id
      name
      pfp
      bio
      type
    }
  }
`;

export const CREATE_HOTSPOT = gql`
  mutation CreateHotspot($data: HotspotCreateInput!) {
    createHotspot(data: $data) {
      id
      name
      avatar
      description
      type
      site
      email
      number
      isGroup
      isOrganization
      isShop
      visits
      ratings
      authorId
      location {
        id
        latitude
        longitude
        address
      }
      author {
        id
        name
        email
      }
    }
  }
`;
export const CREATE_EVENT = gql`
  mutation CreateEvent($data: HotspotCreateInput!) {
    createHotspot(data: $data) {
      id
      name
      avatar
      description
      type
      site
      time
      isEvent
      location {
        id
        latitude
        longitude
        address
      }
    }
  }
`;

export const CREATE_POPUP = gql`
  mutation CreatePopup($data: HotspotCreateInput!) {
    createHotspot(data: $data) {
      id
      name
      avatar
      description
      type
      isPopup
      popupStart
      popupEnd
      popupDuration
      location {
        id
        latitude
        longitude
        address
      }
    }
  }
`;

export const CREATE_REVIEW = gql`
  mutation CreateReview($hotspotId: Int!, $rating: Int!, $comment: String) {
    createReview(hotspotId: $hotspotId, rating: $rating, comment: $comment) {
      id
      rating
      comment
      createdAt
      updatedAt
      user {
        id
        name
      }
      hotspot {
        id
        name
        ratings
      }
    }
  }
`;

export const CREATE_POST = gql`
  mutation CreateHotspotPost(
    $hotspotId: Int!
    $data: PostCreateInHotspotInput!
  ) {
    createHotspotPost(hotspotId: $hotspotId, data: $data) {
      id
      title
      published
      media
      type
      tags
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

export const UPDATE_LOCATION = gql`
  mutation UpdateLocation(
    $latitude: Float!
    $longitude: Float!
    $address: String
  ) {
    updateLocation(
      data: { latitude: $latitude, longitude: $longitude, address: $address }
    ) {
      id
      latitude
      longitude
      address
    }
  }
`;

export const LIKE_POST = gql`
  mutation LikePost($postId: Int!) {
    likePost(postId: $postId) {
      id
      likesCount
      isLikedByMe
    }
  }
`;

export const UNLIKE_POST = gql`
  mutation UnlikePost($postId: Int!) {
    unlikePost(postId: $postId) {
      id
      likesCount
      isLikedByMe
    }
  }
`;

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead {
    markNotificationsRead {
      count
    }
  }
`;

export const CREATE_CHECKIN = gql`
  mutation CreateCheckIn($hotspotId: Int!) {
    createCheckIn(hotspotId: $hotspotId) {
      id
      createdAt
      updatedAt
      userId
      hotspotId
      user {
        id
        name
        email
      }
      hotspot {
        id
        name
      }
    }
  }
`;