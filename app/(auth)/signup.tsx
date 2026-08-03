import { useMutation } from "@apollo/client/react";
import { useNavigation } from '@react-navigation/native';
import { router } from "expo-router";
import React, { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthPayload, SIGNUP_MUTATION } from "../../app/apollo/mutations/auth"; // ✅ adjust import path
import { useAuth } from '../../contexts/auth';

export default function SignupScreen() {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signup, { loading, error }] = useMutation<{ signup: AuthPayload }>(
    SIGNUP_MUTATION,
    {
      onCompleted: async (data: any) => {
        console.log('✅ Signup successful!');
        console.log('Response:', JSON.stringify(data, null, 2));
        if (data?.signup?.token) {
          console.log('✅ Token received, signing in...');
          const t = data.signup.token;
          await signIn(t);
                  } else {
          console.error('❌ No token in signup response');
        }
      },
      onError: (err) => {
        console.error('❌ Signup error:', err.message);
        console.error('Error details:', JSON.stringify(err, null, 2));
      },
    }
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button
        title={loading ? "Signing up..." : "Sign Up"}
        disabled={loading || !name.trim() || !email.trim() || !password.trim()}
        onPress={() => {
          const trimmedName = name.trim();
          const trimmedEmail = email.trim().toLowerCase();
          const trimmedPassword = password.trim();
          
          console.log('=== SIGNUP ATTEMPT ===');
          console.log('Name:', trimmedName);
          console.log('Email:', trimmedEmail);
          console.log('Password length:', trimmedPassword.length);
          console.log('Variables:', JSON.stringify({ name: trimmedName, email: trimmedEmail, password: '***' }));
          
          signup({ variables: { name: trimmedName, email: trimmedEmail, password: trimmedPassword } });
        }}
      />

      {error && <Text style={styles.error}>{error.message}</Text>}
      
      <Text style={styles.hint}>
        📝 After signup, use the EXACT same email and password to login
      </Text>

      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Login' as never)}
      >
        Already have an account? Log in
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
  hint: { color: "#666", marginTop: 10, textAlign: "center", fontSize: 12 },
});
