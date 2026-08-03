import { gql } from "@apollo/client";

export const UPDATE_LOCATION = gql`
  mutation UpdateLocation($latitude: Float!, $longitude: Float!, $address: String) {
    updateLocation(data: {
      latitude: $latitude
      longitude: $longitude
      address: $address
    }) {
      id
      latitude
      longitude
      address
    }
  }
`;
