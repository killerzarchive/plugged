import { useAuth } from "@/contexts/auth";
import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import { type } from "@/constants/typography";
import { router } from "expo-router";
import {
  Bell,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Shield,
  User,
  UserX,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";

// ─── Back icon ────────────────────────────────────────────────────────────────
function IconBack({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Line x1="19" y1="12" x2="5" y2="12" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="11" y1="6" x2="5" y2="12" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="11" y1="18" x2="5" y2="12" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  const C = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: C.txt3 }]}>{label.toUpperCase()}</Text>
  );
}

// ─── Row with chevron ─────────────────────────────────────────────────────────
interface RowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  showChevron?: boolean;
  titleColor?: string;
  first?: boolean;
  last?: boolean;
}

function Row({ icon, title, subtitle, onPress, right, showChevron = true, titleColor, first, last }: RowProps) {
  const C = useColors();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.82 : 1}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: C.card,
          borderColor: C.border,
          borderTopLeftRadius: first ? layout.cardRadius : 0,
          borderTopRightRadius: first ? layout.cardRadius : 0,
          borderBottomLeftRadius: last ? layout.cardRadius : 0,
          borderBottomRightRadius: last ? layout.cardRadius : 0,
          borderTopWidth: first ? StyleSheet.hairlineWidth : 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderRightWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: titleColor ?? C.txt }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: C.txt3 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? (
        showChevron ? <ChevronRight size={15} color={C.txt3} /> : null
      )}
    </TouchableOpacity>
  );
}

// ─── Row divider inside a card group ─────────────────────────────────────────
function Divider() {
  const C = useColors();
  return <View style={[styles.divider, { backgroundColor: C.border, marginLeft: 56 }]} />;
}

// ─── Plugged+ upgrade card ───────────────────────────────────────────────────
function PluggedPlusCard() {
  const C = useColors();
  return (
    <View style={[styles.plusCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.plusTop}>
        <View>
          <Text style={[styles.plusTitle, { color: C.txt }]}>Plugged+</Text>
          <Text style={[styles.plusSub, { color: C.txt2 }]}>
            Early alerts, incognito, exclusive badges.
          </Text>
        </View>
        <View style={[styles.plusBadge, { borderColor: C.border2, backgroundColor: C.bg3 }]}>
          <Text style={[styles.plusBadgeText, { color: C.txt2 }]}>PRO</Text>
        </View>
      </View>
      <View style={[styles.plusDivider, { backgroundColor: C.border }]} />
      <View style={styles.plusPricing}>
        <View>
          <Text style={[styles.plusPrice, { color: C.txt }]}>$9.99</Text>
          <Text style={[styles.plusPriceSub, { color: C.txt3 }]}>/ month</Text>
        </View>
        <View>
          <Text style={[styles.plusPrice, { color: C.txt }]}>$7.49</Text>
          <Text style={[styles.plusPriceSub, { color: C.txt3 }]}>/ month, annual</Text>
        </View>
      </View>
      <TouchableOpacity
        activeOpacity={0.82}
        style={[styles.plusCta, { backgroundColor: C.accent }]}
      >
        <Text style={[styles.plusCtaText, { color: C.accentInv }]}>Upgrade to Plugged+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const C = useColors();
  const { signOut } = useAuth();

  const [notifications, setNotifications] = React.useState(true);
  const [location, setLocation] = React.useState(true);
  const [incognito, setIncognito] = React.useState(false);

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => { signOut(); router.replace("/(auth)/login"); } },
      ]
    );
  };

  const handleIncognitoPress = () => {
    Alert.alert(
      "Plugged+ required",
      "Incognito mode is available to Plugged+ subscribers.",
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={["top"]}>
      <StatusBar barStyle={C.statusBar} />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.82}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <IconBack color={C.txt} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.txt }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Account ── */}
        <SectionLabel label="Account" />
        <View style={styles.cardGroup}>
          <Row
            first
            icon={<User size={18} color={C.txt2} />}
            title="Edit profile"
            subtitle="Name, photo, bio"
            onPress={() => {}}
          />
          <Divider />
          <Row
            icon={<Lock size={18} color={C.txt2} />}
            title="Password & security"
            subtitle="Change your password"
            onPress={() => {}}
          />
          <Divider />
          <Row
            last
            icon={<Mail size={18} color={C.txt2} />}
            title="Email"
            subtitle="Manage your email address"
            onPress={() => {}}
          />
        </View>

        {/* ── Preferences ── */}
        <SectionLabel label="Preferences" />
        <View style={styles.cardGroup}>
          <Row
            icon={<Bell size={18} color={C.txt2} />}
            title="Notifications"
            subtitle="Push alerts for activity"
            showChevron={false}
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: C.border2, true: C.txt2 }}
                thumbColor={C.accentInv}
              />
            }
          />
          <Divider />
          <Row
            icon={<MapPin size={18} color={C.txt2} />}
            title="Location"
            subtitle="Required for nearby hotspots"
            showChevron={false}
            right={
              <Switch
                value={location}
                onValueChange={setLocation}
                trackColor={{ false: C.border2, true: C.txt2 }}
                thumbColor={C.accentInv}
              />
            }
          />
          <Divider />
          <Row
            last
            icon={<Shield size={18} color={C.txt2} />}
            title="Incognito mode"
            subtitle="Hide your activity — Plugged+ only"
            showChevron={false}
            onPress={incognito ? undefined : handleIncognitoPress}
            right={
              <Switch
                value={incognito}
                onValueChange={(v) => { if (!v) { setIncognito(false); } else { handleIncognitoPress(); } }}
                trackColor={{ false: C.border2, true: C.txt2 }}
                thumbColor={C.accentInv}
                disabled
              />
            }
          />
        </View>

        {/* ── Subscription ── */}
        <SectionLabel label="Subscription" />
        <PluggedPlusCard />

        {/* ── Support ── */}
        <SectionLabel label="Support" />
        <View style={styles.cardGroup}>
          <Row
            first
            icon={<HelpCircle size={18} color={C.txt2} />}
            title="Help & support"
            subtitle="FAQs, contact us"
            onPress={() => {}}
          />
          <Divider />
          <Row
            last
            icon={<CreditCard size={18} color={C.txt2} />}
            title="Privacy policy"
            onPress={() => {}}
          />
        </View>

        {/* ── Sign out ── */}
        <View style={[styles.cardGroup, { marginBottom: 40 }]}>
          <Row
            first
            last
            icon={<LogOut size={18} color="#FF3B30" />}
            title="Sign out"
            titleColor="#FF3B30"
            showChevron={false}
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  headerTitle: { ...type.h3 },
  scroll: { paddingHorizontal: layout.screenPadding, paddingTop: 16, paddingBottom: 40 },
  sectionLabel: {
    ...type.labelSm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardGroup: { borderRadius: layout.cardRadius, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: layout.cardPadding,
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: { width: 28, alignItems: "center" },
  rowBody: { flex: 1 },
  rowTitle: { ...type.body, fontFamily: "Roobert-Medium" },
  rowSubtitle: { ...type.caption, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  plusCard: {
    borderRadius: layout.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: layout.cardPadding,
  },
  plusTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  plusTitle: { ...type.h3, marginBottom: 4 },
  plusSub: { ...type.bodySm },
  plusBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  plusBadgeText: { ...type.labelSm, letterSpacing: 0.5 },
  plusDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  plusPricing: { flexDirection: "row", gap: 32, marginBottom: 16 },
  plusPrice: { ...type.h2 },
  plusPriceSub: { ...type.caption, marginTop: 2 },
  plusCta: {
    height: layout.btnHeight,
    borderRadius: layout.btnRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  plusCtaText: { ...type.body, fontFamily: "Roobert-Bold" },
});
