import { useMutation } from "@apollo/client/react";
import { useNavigation } from '@react-navigation/native';
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthPayload, LOGIN_MUTATION } from "../../app/apollo/mutations/auth";
import { useAuth } from '../../contexts/auth';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [login, { loading, error }] = useMutation<{ login: AuthPayload }>(
    LOGIN_MUTATION,
    {
      onCompleted: async (data: any) => {
        console.log('Login response:', data);
        if (data?.login?.token) {
          const t = data.login.token;
          await signIn(t);
        }
      },
      onError: (err) => {
        console.error('Login error:', err);
        console.error('Error details:', JSON.stringify(err, null, 2));
      },
    }
  );

  // ✅ Google Sign-In
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
    androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success" && response.authentication) {
      const t = response.authentication.accessToken!;
      signIn(t);
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <View>
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Text 
          style={styles.showPasswordToggle}
          onPress={() => setShowPassword(!showPassword)}
        >
          {showPassword ? "🙈 Hide" : "👁️ Show"} Password
        </Text>
      </View>

      <Button
        title={loading ? "Logging in..." : "Log In"}
        disabled={loading || !email.trim() || !password.trim()}
        onPress={() => {
          const trimmedEmail = email.trim().toLowerCase();
          const trimmedPassword = password.trim();
          
          console.log('=== LOGIN ATTEMPT ===');
          console.log('Email:', trimmedEmail);
          console.log('Password length:', trimmedPassword.length);
          console.log('First char of password:', trimmedPassword.charAt(0));
          console.log('Last char of password:', trimmedPassword.charAt(trimmedPassword.length - 1));
          
          login({ variables: { email: trimmedEmail, password: trimmedPassword } });
        }}
      />
      {error && <Text style={styles.error}>{error.message}</Text>}

      <View style={{ marginVertical: 10 }} />
      <Button
        title="Sign in with Google"
        onPress={() => promptAsync()}
        disabled={!request}
      />

      <Text style={styles.link} onPress={() => navigation.navigate('Signup' as never)}>
        Don’t have an account? Sign up
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 5 },
  error: { color: "red", marginTop: 10 },
  link: { color: "blue", marginTop: 15, textAlign: "center" },
  showPasswordToggle: { color: "#666", fontSize: 12, marginTop: 4, textAlign: "right" },
});
