import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AuthContextType = {
  token: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  signIn: async () => {},
  signOut: async () => {},
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token from SecureStore on mount
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("token");
        if (storedToken && storedToken !== "null" && storedToken !== "undefined") {
          setToken(storedToken);
        }
      } catch (e) {
        console.error('Failed to load token', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (newToken: string) => {
    await SecureStore.setItemAsync("token", newToken);
    setToken(newToken);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync("token");
    setToken(null);
  }, []);

  const value = useMemo(() => ({
    token,
    signIn,
    signOut,
    isLoading
  }), [token, signIn, signOut, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};