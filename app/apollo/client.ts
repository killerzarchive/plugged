import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable } from "@apollo/client";
import * as SecureStore from "expo-secure-store";

const httpLink = new HttpLink({
  uri: "https://plugged-563q.onrender.com/graphql",
});

const authMiddleware = new ApolloLink((operation, forward) =>
  new Observable((observer) => {
    SecureStore.getItemAsync("token")
      .then((token) => {
        operation.setContext(({ headers = {} }: { headers: Record<string, string> }) => ({
          headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : "",
          },
        }));
        forward(operation).subscribe(observer);
      })
      .catch(observer.error.bind(observer));
  })
);

export const client = new ApolloClient({
  link: authMiddleware.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});
