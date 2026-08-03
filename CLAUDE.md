# Plugged — Claude Code Master Prompt (Updated Visual Design)

## CRITICAL: READ THIS FIRST

This project already exists at `C:/Users/kille/plugged`.
Run with: `npx expo start`

SDK: **Expo SDK 54** — Expo Go compatible only.
DO NOT use `@rnmapbox/maps` — it crashes Expo Go. Use `react-native-maps` only.
DO NOT use `react-navigation` directly — use `expo-router v4` only.
DO NOT add new packages without checking Expo Go compatibility first.

---

## What this app is

Plugged is a real-time social nightlife discovery app for young adults (18–25).
Live city map, check-ins, dynamic heatmap, friend activity, gamification
(streaks, leaderboards), venue/hotspot discovery.
Emotional drivers: FOMO, social connection, status.

---

## Existing tech stack — never deviate

| Layer | Tool | Status |
|---|---|---|
| Framework | Expo SDK 54, React Native 0.76.5 | installed |
| Language | TypeScript strict, no `any` | configured |
| Routing | Expo Router v4 (file-based) | wired |
| Backend | Supabase auth + postgres + real-time | lib/supabase.ts |
| API | Apollo Client + GraphQL | app/apollo/ |
| Map | react-native-maps 1.18.0 | installed |
| Animations | react-native-reanimated v3 | installed |
| Icons | react-native-svg v15 + lucide-react-native | installed |
| State | Zustand v5 | add if not installed |
| Payments | RevenueCat (stub in dev, native build for prod) | add when shipping |
| Push | expo-notifications | installed |

**To add Zustand:** `npx expo install zustand @react-native-async-storage/async-storage`
**RevenueCat note:** requires native build — wrap all RC calls in `__DEV__` guards
so the app runs in Expo Go (see stub pattern below).

---

## Fonts — ALREADY LOADED, use these always

The app uses **Roobert TRIAL** loaded in `app/_layout.tsx`.
Never use system fonts. Never use `fontWeight` strings in StyleSheet objects —
use explicit `fontFamily` instead.

```ts
// Font family reference
'Roobert-Light'    // weight 300
'Roobert-Regular'  // weight 400 / normal
'Roobert-Medium'   // weight 500
'Roobert-SemiBold' // weight 600
'Roobert-Bold'     // weight 700 / bold
'Roobert-Heavy'    // weight 800+

// CORRECT usage in StyleSheet
title: {
  fontFamily: 'Roobert-Bold',
  fontSize: 28,
  letterSpacing: -0.8,
}

// WRONG — never do this
title: {
  fontWeight: '700',
  fontSize: 28,
}
```

---

## Theme / colors — existing context

- Theme context lives in `contexts/theme.tsx`
- `useColors()` hook returns the `C` object used across all screens
- Design tokens: `constants/colors.ts`, `constants/typography.ts`, `constants/layout.ts`

### Updated color tokens — replace constants/colors.ts with this

```ts
// constants/colors.ts
export const dark = {
  bg:          '#000000',
  bg2:         '#111111',
  bg3:         '#1A1A1A',
  border:      '#222222',
  border2:     '#2A2A2A',
  txt:         '#FFFFFF',
  txt2:        'rgba(255,255,255,0.50)',
  txt3:        'rgba(255,255,255,0.25)',
  txt4:        'rgba(255,255,255,0.12)',
  accent:      '#FFFFFF',
  accentInv:   '#000000',
  card:        '#111111',
  card2:       '#1A1A1A',
  input:       '#111111',
  inputBorder: '#222222',
  pill:        'rgba(255,255,255,0.08)',
  pillBorder:  'rgba(255,255,255,0.14)',
  danger:      '#FF3B30',
}

export const light = {
  bg:          '#FFFFFF',
  bg2:         '#F5F5F5',
  bg3:         '#EBEBEB',
  border:      '#E0E0E0',
  border2:     '#D0D0D0',
  txt:         '#000000',
  txt2:        'rgba(0,0,0,0.50)',
  txt3:        'rgba(0,0,0,0.25)',
  txt4:        'rgba(0,0,0,0.12)',
  accent:      '#000000',
  accentInv:   '#FFFFFF',
  card:        '#F5F5F5',
  card2:       '#EBEBEB',
  input:       '#F5F5F5',
  inputBorder: '#E0E0E0',
  pill:        'rgba(0,0,0,0.06)',
  pillBorder:  'rgba(0,0,0,0.12)',
  danger:      '#FF3B30',
}

export type Theme = typeof dark
```

### Updated typography tokens — replace constants/typography.ts with this

```ts
// constants/typography.ts
export const type = {
  appName: { fontFamily: 'Roobert-Bold',     fontSize: 26, letterSpacing: -1.0 },
  h1:      { fontFamily: 'Roobert-Bold',     fontSize: 28, letterSpacing: -0.8 },
  h2:      { fontFamily: 'Roobert-Bold',     fontSize: 22, letterSpacing: -0.6 },
  h3:      { fontFamily: 'Roobert-SemiBold', fontSize: 17, letterSpacing: -0.4 },
  h4:      { fontFamily: 'Roobert-SemiBold', fontSize: 15, letterSpacing: -0.3 },
  body:    { fontFamily: 'Roobert-Regular',  fontSize: 14, lineHeight: 20 },
  bodySm:  { fontFamily: 'Roobert-Regular',  fontSize: 13, lineHeight: 18 },
  label:   { fontFamily: 'Roobert-Medium',   fontSize: 11, letterSpacing: 0.06 },
  labelSm: { fontFamily: 'Roobert-SemiBold', fontSize: 10, letterSpacing: 0.08 },
  caption: { fontFamily: 'Roobert-Regular',  fontSize: 11 },
  num:     { fontFamily: 'Roobert-Bold',     fontSize: 22, letterSpacing: -0.6 },
  numLg:   { fontFamily: 'Roobert-Bold',     fontSize: 36, letterSpacing: -1.5 },
}
```

### Updated layout tokens — replace constants/layout.ts with this

```ts
// constants/layout.ts
import { StyleSheet } from 'react-native'

export const layout = {
  screenPadding: 22,
  cardPadding:   16,
  cardRadius:    14,
  pillRadius:    20,
  inputHeight:   46,
  inputRadius:   12,
  btnHeight:     50,
  btnRadius:     14,
  tabBarHeight:  72,
  borderWidth:   StyleSheet.hairlineWidth,
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
}
```

---

## Visual design system — this is the look to achieve

**The aesthetic:** iOS 18-inspired. Pure black and white only. No color accents.
No gradients. No shadows. No glow. Hierarchy is built entirely through opacity,
weight, and spacing. Clean, sleek, modern nightlife app.

### Dynamic Island
- Position absolute, top 12, horizontally centered
- Width 108, height 30, borderRadius 16
- bg = theme.bg, border: hairlineWidth in theme.border
- Left: time string — Roobert-SemiBold, fontSize 11, letterSpacing -0.2
- Right: battery bar shape

### App bar
- "plugged®" wordmark — Roobert-Bold, fontSize 26, letterSpacing -1.0
- Right side: notification bell (with white pip dot) + avatar circle
- Notification button: 32px circle, bg=card, border hairlineWidth
- Avatar: 32px circle, bg=card2, border 1.5px accent

### Map zone (210px height)
- `react-native-maps` MapView with `customMapStyle` (dark/light)
- `PROVIDER_GOOGLE` on Android
- `showsUserLocation={true}`, no compass, no scale, no buildings
- `rotateEnabled={false}`, `pitchEnabled={false}`
- Venue pins as custom Marker children (not default pins):
  - **Primary pin:** white pill bubble (bg=accent, text=accentInv),
    pulsing live dot, venue name + count, 2px white tail pointing down
  - **Secondary pin:** dark pill bubble (bg=card2, border hairlineWidth),
    static dot, venue name + count, faded tail
- Bottom-left city pill: bg=card, border hairlineWidth, live pulsing dot,
  city name in txt, count in txt3

### Section headers
- Left: title Roobert-Bold 16px letterSpacing -0.4, txt color
  + optional LiveChip inline (animated pulsing dot + "live" label)
- Right: "See all" in txt3, fontSize 12
- Padding: 14 top, screenPadding horizontal, 8 bottom

### Live chip
- bg=card, border hairlineWidth, borderRadius 10, padding 2 8
- Animated dot (opacity 1→0.25→1, 1200ms withRepeat)
- Label: Roobert-Medium, fontSize 10, txt color

### Hotspot cards (horizontal scroll)
- Width 130, borderRadius 16, bg=card, border hairlineWidth
- Image area: 80px tall, bg=card2
- Rank badge in bottom-left: bg=pill, border=pillBorder, borderRadius 7,
  Roobert-Bold fontSize 9
- Venue name: Roobert-SemiBold, fontSize 12, letterSpacing -0.2, txt
- Area: Roobert-Regular, fontSize 10, txt3
- Count: Roobert-Medium, fontSize 10, txt, with 4px dot bullet

### Friend rows
- FlexRow, gap 10, paddingVertical 10, hairlineWidth border bottom
- Avatar 36px circle, bg=card2
  - Active: 1.5px accent ring with 2px gap (inner border trick)
  - Inactive: ring at opacity 0.2
- Name: Roobert-Medium, fontSize 13, letterSpacing -0.2, txt
- Location string: Roobert-Regular, fontSize 11, txt3
- Right: chevron button (28px circle bg=card) or time string txt4

### Venue hero (check-in screen)
- 200px tall, position relative, overflow hidden
- Architectural SVG cityscape at ~28% opacity inside
- Linear gradient overlay bottom-to-top (theme.bg → transparent, 60% start)
- Back button top-left: 32px circle, bg=rgba(255,255,255,0.10) dark /
  rgba(0,0,0,0.08) light, border hairlineWidth
- Bottom content: pill tags row, venue name h1, distance string txt3

### Stat blocks
- FlexRow, gap 2, 3 equal flex-1 blocks
- Each: bg=card, border hairlineWidth, borderRadius 12, padding 12 centered
- Number: Roobert-Bold, fontSize 22, letterSpacing -0.6, txt
- Label: Roobert-SemiBold, fontSize 9, UPPERCASE, letterSpacing 0.06, txt3

### Vibe grid (4 items, 1 row or 2×2)
- Each: borderRadius 11, border hairlineWidth, bg=card, padding 9
- Default: bg=card, label txt3
- **Selected:** bg=accent, borderColor=accent, label=accentInv
- Emoji: fontSize 15. Label: Roobert-Medium, fontSize 9
- NO emoji in production — replace with SVG icons for the 4 vibe states

### Buttons
- **Primary:** bg=accent, text=accentInv, height 50, borderRadius 14,
  Roobert-Bold fontSize 15 letterSpacing -0.3, activeOpacity 0.82
- **Secondary:** bg=transparent, border hairlineWidth in border color,
  same height/radius, text=txt, Roobert-SemiBold fontSize 13
- **Small action:** height 32, borderRadius 9, Roobert-SemiBold fontSize 12

### Input fields
- Height 46, borderRadius 12, border hairlineWidth in inputBorder
- bg=input, Roobert-Regular fontSize 14, color=txt
- placeholderTextColor=txt3
- Focus: borderColor switches to accent

### Post bar
- FlexRow, gap 7, padding 0 screenPadding 12
- Input: flex 1, height 40, borderRadius 10, bg=card, border hairlineWidth
- "Post" button: height 40, borderRadius 10, bg=accent, text=accentInv,
  Roobert-Bold fontSize 12

### Post items
- bg=card, borderRadius 12, padding 10 12
- Name: Roobert-SemiBold fontSize 12, txt
- Time: Roobert-Regular fontSize 10, txt4
- Content: Roobert-Regular fontSize 12, txt2, lineHeight 1.4

### Leaderboard rows
- FlexRow, gap 10, paddingVertical 9, hairlineWidth border bottom
- Rank number: Roobert-SemiBold fontSize 13, txt3 (white for #1)
- Avatar 36px: bg=card2, border hairlineWidth
  - #1: 1.5px accent ring
- Name: Roobert-Medium fontSize 13, letterSpacing -0.2, txt
- Detail: Roobert-Regular fontSize 11, txt3
- Points: Roobert-Bold fontSize 15, letterSpacing -0.3, txt
- "You" row: bg=card2, border hairlineWidth border2, borderRadius 12,
  padding 9 12 (no bottom border)

### Progress card
- bg=card, border hairlineWidth, borderRadius 14, padding 12 14
- Label: Roobert-SemiBold 10px UPPERCASE letterSpacing 0.07, txt4
- "840 pts" left, "need 1,200" right in txt3
- Progress bar: bg=border, borderRadius 3, height 4, fill bg=accent
- Hint text: Roobert-Regular fontSize 11, txt4

### Profile hero
- Avatar 72px, borderRadius 999, bg=card, border 2px accent
- Initials: Roobert-Bold fontSize 24, txt
- Display name: Roobert-Bold fontSize 20, letterSpacing -0.6, txt
- @handle + city: Roobert-Regular fontSize 13, txt3
- Badge row: 4 badges, 34px square, borderRadius 10, bg=card,
  border hairlineWidth. Locked = opacity 0.25. SVG icon 16px stroke inside

### Streak tracker
- 8 equal-flex bars, height 4, borderRadius 2, gap 5
- Filled: bg=accent. Empty: bg=border, border hairlineWidth border2
- Day labels below: Roobert-Regular fontSize 9, txt4

### Setting rows
- FlexRow, gap 12, paddingVertical 11, hairlineWidth border bottom
- Icon square: 30px, borderRadius 8, bg=card2, border hairlineWidth
  - SVG icon 14px stroke inside
- Title: Roobert-Medium fontSize 13, txt
- Subtitle: Roobert-Regular fontSize 11, txt3
- Right: "›" in txt4 opacity 0.2, OR Toggle component

### Toggle switches
- Size 42×24, borderRadius 12
- On: bg=accent. Off: bg=border2
- Knob: 18×18, borderRadius 9, absolute
  - On: right 3, bg=accentInv
  - Off: left 3, bg=txt3
- Animated with withTiming 150ms

### Segmented control
- FlexRow, bg=card, border hairlineWidth, borderRadius 10, padding 3
- Each segment: flex 1, borderRadius 7, padding 6
  - Active: bg=accent, text=accentInv, Roobert-SemiBold
  - Inactive: bg=transparent, txt3, Roobert-Medium
- fontSize 11

### Tab bar
- Height 72, border top hairlineWidth
- BlurView tint=dark/light, intensity 80, absoluteFill behind
- Active icon/label: accent color. Inactive: txt3
- Labels: Roobert-Medium, fontSize 9
- Center + button: 46px circle, bg=accent, border 3px bg color,
  raised 14px above bar, icon=accentInv

### Plugged+ paywall
- Eyebrow chip: bg=card, border hairlineWidth, dot + "UPGRADE" text
- Title: "plugged+" Roobert-Bold 28px letterSpacing -1, txt,
  "+" slightly transparent
- Feature list rows (same style as setting rows)
- Monthly/Annual segmented toggle
- Price: Roobert-Bold 36px letterSpacing -1.5, "/mo" in txt3 fontSize 13
- "Get Plugged+" primary button full width
- Footer: "Restore · Terms · Privacy" txt4 fontSize 9

### OR divider
- FlexRow, gap 10, marginVertical 10
- Line: flex 1, height hairlineWidth, bg=border
- "or": Roobert-Regular fontSize 12, txt3

### Social sign-in buttons
- Height 46, borderRadius 12, border hairlineWidth inputBorder, bg=input
- FlexRow center, gap 9
- Brand SVG logo 16×16, label Roobert-Medium fontSize 14, txt

---

## Map implementation — react-native-maps (Expo Go compatible)

```ts
// constants/mapStyle.ts
export const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#444444' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry',        stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111111' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'water',     elementType: 'geometry',  stylers: [{ color: '#050505' }] },
  { featureType: 'poi',       stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',   stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'landscape',      elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
]

export const LIGHT_MAP_STYLE = [
  { elementType: 'geometry',          stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill',  stylers: [{ color: '#888888' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0f0f0' }] },
]
```

```tsx
// components/map/LiveHeatmap.tsx — full working component
import { useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import MapView, { PROVIDER_GOOGLE, Marker, Region } from 'react-native-maps'
import { useColors } from '@/contexts/theme'
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyle'
import { VenuePin } from './VenuePin'
import { MapPillBar } from './MapPillBar'
import type { Venue } from '@/types'

interface Props {
  venues: Venue[]
  userLat?: number
  userLng?: number
  city: string
  activeCount: number
  onVenuePress: (venue: Venue) => void
}

export function LiveHeatmap({ venues, userLat, userLng, city, activeCount, onVenuePress }: Props) {
  const C = useColors()
  const mapRef = useRef<MapView>(null)

  const region: Region = {
    latitude:       userLat  ?? 30.2672,
    longitude:      userLng  ?? -97.7431,
    latitudeDelta:  0.04,
    longitudeDelta: 0.04,
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        customMapStyle={C.bg === '#000000' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        {venues.slice(0, 5).map((venue, i) => (
          <Marker
            key={venue.id}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
            onPress={() => onVenuePress(venue)}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <VenuePin venue={venue} isPrimary={i === 0} />
          </Marker>
        ))}
      </MapView>
      <MapPillBar city={city} activeCount={activeCount} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { height: 210, overflow: 'hidden' },
})
```

```tsx
// components/map/VenuePin.tsx
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming
} from 'react-native-reanimated'
import { useEffect } from 'react'
import { useColors } from '@/contexts/theme'
import type { Venue } from '@/types'

interface Props { venue: Venue; isPrimary: boolean }

export function VenuePin({ venue, isPrimary }: Props) {
  const C = useColors()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (!isPrimary) return
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1
    )
  }, [isPrimary])

  const dotAnim = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const bg     = isPrimary ? C.accent  : C.card2
  const bdCol  = isPrimary ? 'transparent' : C.border
  const txtCol = isPrimary ? C.accentInv  : C.txt
  const tailBg = isPrimary ? C.accent : C.txt3

  return (
    <View style={styles.wrap}>
      <View style={[styles.bubble, { backgroundColor: bg, borderColor: bdCol }]}>
        {isPrimary && (
          <Animated.View style={[styles.dot, { backgroundColor: C.accentInv }, dotAnim]} />
        )}
        {!isPrimary && <View style={[styles.dot, { backgroundColor: C.txt3 }]} />}
        <Text style={[styles.name, { color: txtCol }]} numberOfLines={1}>
          {venue.name}
        </Text>
        <Text style={[styles.count, { color: txtCol, opacity: 0.5 }]}>
          {venue.liveCount}
        </Text>
      </View>
      <View style={[styles.tail, { backgroundColor: tailBg }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center' },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot:   { width: 5, height: 5, borderRadius: 3 },
  name:  { fontFamily: 'Roobert-Bold', fontSize: 10, letterSpacing: -0.2 },
  count: { fontFamily: 'Roobert-Regular', fontSize: 9 },
  tail:  { width: 2, height: 6, borderRadius: 1 },
})
```

```tsx
// components/map/MapPillBar.tsx
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming
} from 'react-native-reanimated'
import { useColors } from '@/contexts/theme'

interface Props { city: string; activeCount: number }

export function MapPillBar({ city, activeCount }: Props) {
  const C = useColors()
  const opacity = useSharedValue(1)
  opacity.value = withRepeat(
    withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })), -1
  )
  const dotAnim = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View style={[styles.pill, { backgroundColor: C.card, borderColor: C.border }]}>
      <Animated.View style={[styles.dot, { backgroundColor: C.txt }, dotAnim]} />
      <Text style={[styles.city,  { color: C.txt  }]}>{city}</Text>
      <Text style={[styles.count, { color: C.txt3 }]}>{activeCount} out tonight</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute', bottom: 12, left: 18,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot:   { width: 5, height: 5, borderRadius: 3 },
  city:  { fontFamily: 'Roobert-Medium',  fontSize: 11 },
  count: { fontFamily: 'Roobert-Regular', fontSize: 11 },
})
```

---

## RevenueCat stub — safe for Expo Go

```ts
// lib/revenuecat.ts
export async function initPurchases(): Promise<void> {
  if (__DEV__) { console.log('[RC] stubbed in dev'); return }
  const { default: Purchases } = await import('react-native-purchases')
  Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_RC_KEY_IOS! })
}

export async function checkPlusEntitlement(): Promise<boolean> {
  if (__DEV__) return false
  try {
    const { default: Purchases } = await import('react-native-purchases')
    const info = await Purchases.getCustomerInfo()
    return info.entitlements.active['plus'] !== undefined
  } catch { return false }
}

export async function purchasePlus(): Promise<boolean> {
  if (__DEV__) { console.log('[RC] purchase stubbed'); return false }
  try {
    const { default: Purchases } = await import('react-native-purchases')
    const offerings = await Purchases.getOfferings()
    const pkg = offerings.current?.availablePackages[0]
    if (!pkg) return false
    await Purchases.purchasePackage(pkg)
    return true
  } catch { return false }
}
```

---

## lib/supabase.ts — existing file, keep as-is but verify this pattern

```ts
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

---

## Routing — expo-router v4 only

```tsx
// CORRECT
import { useRouter, useLocalSearchParams, Link } from 'expo-router'
import { Stack, Tabs } from 'expo-router'

// WRONG — never do this
import { useNavigation } from '@react-navigation/native'
```

---

## Animations — reanimated v3 only

```tsx
// CORRECT
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withRepeat, withSequence
} from 'react-native-reanimated'

// WRONG
import { Animated } from 'react-native'
```

---

## Icons — lucide-react-native for standard, react-native-svg for custom

```tsx
// Standard icons — lucide-react-native (already installed)
import { Bell, Search, ChevronRight } from 'lucide-react-native'
<Bell size={20} color={C.txt} strokeWidth={1.5} />

// Custom SVG icons — react-native-svg
import Svg, { Path, Circle } from 'react-native-svg'
function HomeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  )
}
```

---

## StyleSheet rules

```tsx
// CORRECT — static in StyleSheet, dynamic inline only
const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  }
})
<View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]} />

// WRONG
<View style={{ borderRadius: 14, padding: 16, backgroundColor: C.card }} />
```

---

## Zustand v5 — add if not installed

```bash
npx expo install zustand @react-native-async-storage/async-storage
```

```ts
// stores/userStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface UserStore {
  profile: User | null
  points: number
  weeklyPoints: number
  streakDays: number
  isPlus: boolean
  setProfile: (p: User) => void
  addPoints:  (n: number) => void
  setPlus:    (v: boolean) => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      profile: null, points: 0, weeklyPoints: 0, streakDays: 0, isPlus: false,
      setProfile: (p) => set({ profile: p }),
      addPoints:  (n) => set((s) => ({ points: s.points + n, weeklyPoints: s.weeklyPoints + n })),
      setPlus:    (v) => set({ isPlus: v }),
    }),
    { name: 'user-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

---

## File structure (existing + additions)

```
C:/Users/kille/plugged/
├── app/
│   ├── _layout.tsx              ← root: fonts loaded, providers
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← BlurView tab bar
│   │   ├── index.tsx            ← Discover
│   │   ├── friends.tsx
│   │   ├── checkin.tsx
│   │   ├── leaderboard.tsx
│   │   └── profile.tsx
│   ├── venue/[id].tsx
│   ├── settings.tsx
│   ├── pluggedplus.tsx
│   └── apollo/                  ← existing Apollo config
│       ├── client.ts
│       └── queries/
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   ├── Toggle.tsx
│   │   ├── LiveChip.tsx
│   │   ├── SegmentedControl.tsx
│   │   ├── PillTag.tsx
│   │   ├── StatBlock.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── OrDivider.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── SocialButton.tsx
│   │   └── SettingRow.tsx
│   ├── map/
│   │   ├── LiveHeatmap.tsx      ← react-native-maps version above
│   │   ├── VenuePin.tsx
│   │   └── MapPillBar.tsx
│   ├── venue/
│   │   ├── SpotCard.tsx
│   │   ├── PostItem.tsx
│   │   ├── VibeGrid.tsx
│   │   └── VenueHero.tsx
│   ├── leaderboard/
│   │   ├── RankRow.tsx
│   │   └── ProgressCard.tsx
│   └── profile/
│       ├── BadgeGrid.tsx
│       └── StreakTracker.tsx
│
├── contexts/
│   ├── theme.tsx                ← existing, update colors
│   └── auth.tsx                 ← existing
│
├── hooks/
│   ├── useCheckIn.ts
│   ├── useHotspots.ts
│   ├── useFriends.ts
│   ├── useLeaderboard.ts
│   └── useTheme.ts
│
├── stores/
│   ├── userStore.ts
│   ├── venueStore.ts
│   └── friendStore.ts
│
├── lib/
│   ├── supabase.ts              ← existing
│   └── revenuecat.ts            ← stub pattern above
│
├── constants/
│   ├── colors.ts                ← replace with tokens above
│   ├── typography.ts            ← replace with Roobert tokens above
│   ├── layout.ts                ← replace with tokens above
│   └── mapStyle.ts              ← new: dark/light Google Maps JSON
│
└── types/
    └── index.ts
```

---

## Database schema (Supabase — existing)

```
users:      id, username, display_name, avatar_url, city, created_at
venues:     id, name, area, city, lat, lng, category, live_count, vibe_score
check_ins:  id, user_id, venue_id, vibe_rating, note, created_at
follows:    follower_id, following_id
points:     user_id, total_points, weekly_points, streak_days, last_checkin_date
badges:     user_id, badge_type, earned_at
```

---

## .env

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=your_google_ios_key
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=your_google_android_key
EXPO_PUBLIC_RC_KEY_IOS=your_revenuecat_ios_key
EXPO_PUBLIC_RC_KEY_ANDROID=your_revenuecat_android_key
```

---

## NEVER install or use these

```
@rnmapbox/maps             ← crashes Expo Go, already excluded
@react-navigation/native   ← use expo-router only
expo-app-loading           ← removed, use expo-splash-screen
expo-permissions           ← removed, use module-specific APIs
Constants.manifest         ← removed, use Constants.expoConfig
fontWeight strings in StyleSheet ← use fontFamily: 'Roobert-X' instead
hardcoded hex colors in components ← always use C.xxx from useColors()
inline style objects for static values ← always StyleSheet.create
```

---

## Gamification logic

| Action | Points |
|---|---|
| Standard check-in | +10 |
| First ever at a venue | +25 |
| First person tonight at venue | +50 |
| Adding a note | +15 |
| 3–6 day streak | ×1.5 multiplier |
| 7+ day streak | ×2.0 multiplier |

Badges: `pioneer` (first 10 at venue tonight), `streak7`, `streak30`,
`top10` (weekly leaderboard), `explorer` (10 different venues).
Weekly leaderboard resets Monday 00:00 UTC.

---

## Plugged+ features ($9.99/mo or $89.99/yr)

- Early alerts: push 30 min before venue trends publicly
- Incognito mode: invisible on friend maps (gate in settings via `checkPlusEntitlement()`)
- Exclusive badge drops: plus-only `badge_type` values
- Crew leaderboard: private rankings among mutual follows
- Priority alerts: instant delivery on friend check-in push

---

## Code rules — enforced on every file

1. All static styles in `StyleSheet.create` — dynamic values inline only
2. All colors from `useColors()` — never hardcode hex
3. All fonts use `fontFamily: 'Roobert-X'` — never `fontWeight` strings
4. Icons: `lucide-react-native` for standard, `react-native-svg` for custom
5. No third-party UI libraries — all components built from scratch
6. All components export typed `Props` interface
7. All components accept `style?: ViewStyle` for layout overrides
8. All async functions: `try/catch` with error + loading state
9. Loading: opacity pulse via `useSharedValue` + `withRepeat`
10. `TouchableOpacity` with `activeOpacity={0.82}` always
11. `FlatList` for any list that could exceed 5 items
12. `StyleSheet.hairlineWidth` for ALL borders — never `0.5` or `1`
13. No `any` types — use `unknown` and narrow
14. Import order: React → React Native → Expo → third-party → `@/` internal
15. No emoji in production UI — use SVG icons

---

## How to respond to requests

**"Build the [screen] screen"**
→ Complete `.tsx` file + every new component it needs.
Uses `useColors()` from `contexts/theme.tsx`, Roobert fonts,
existing Supabase setup from `lib/supabase.ts`. Paste-ready.

**"Create the [component] component"**
→ Full file: Props interface, all variants, dark/light via useColors(),
StyleSheet with Roobert fonts, JSDoc usage example at top.

**"Write the [hook] hook"**
→ Complete hook: TypeScript types, Supabase calls, error/loading states.

**"Scaffold [feature]"**
→ All files the feature needs: screen + components + hook + store slice.

**"Update [existing screen] to match the new design"**
→ Rewrite the full file with new visual system (Roobert fonts, updated
color tokens, new component specs) while preserving existing logic and
Supabase/Apollo integration.

Always complete. Never partial. Always Expo Go compatible. Always SDK 54.
Always Roobert fonts. Always useColors() for every color value.