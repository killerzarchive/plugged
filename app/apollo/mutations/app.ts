import { gql } from "@apollo/client";

export const PFP_MUTATION = gql`
  mutation UpdateProfile($data: UpdateProfileInput!) {
    updateProfile(data: $data) {
      id
      name
      pfp
      bio
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
