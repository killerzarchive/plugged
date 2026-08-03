import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import * as SecureStore from "expo-secure-store";

const httpLink = new HttpLink({
  uri: "https://plugged-563q.onrender.com/graphql", // GraphQL endpoint
});

const authMiddleware = setContext(async (operation, { headers }) => {
  // Get the authentication token from SecureStore
  const token = await SecureStore.getItemAsync("token");
  
  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

export const client = new ApolloClient({
  link: authMiddleware.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
