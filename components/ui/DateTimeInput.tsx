import { useColors } from "@/contexts/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS    = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES  = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const ITEM_H = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildDates(): Date[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86_400_000);
    return d;
  });
}

function toISO(dates: Date[], dateIdx: number, hourIdx: number, minuteIdx: number, ampm: "AM" | "PM"): string {
  const d = new Date(dates[dateIdx].getTime());
  let h = hourIdx + 1; // HOURS[i] = String(i+1)
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  d.setHours(h, parseInt(MINUTES[minuteIdx], 10), 0, 0);
  return d.toISOString();
}

function formatDisplay(dates: Date[], dateIdx: number, hourIdx: number, minuteIdx: number, ampm: "AM" | "PM"): string {
  const d = dates[dateIdx];
  const dayStr =
    dateIdx === 0 ? "Today"
    : dateIdx === 1 ? "Tomorrow"
    : `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return `${dayStr} · ${HOURS[hourIdx]}:${MINUTES[minuteIdx]} ${ampm}`;
}

function isoToIdxs(iso: string, dates: Date[]): { dateIdx: number; hourIdx: number; minuteIdx: number; ampm: "AM" | "PM" } | null {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;

    const midnight = new Date(d);
    midnight.setHours(0, 0, 0, 0);
    const diff = Math.round((midnight.getTime() - dates[0].getTime()) / 86_400_000);
    const dateIdx = diff >= 0 && diff < 30 ? diff : 0;

    const h24 = d.getHours();
    const ap: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const hourIdx = h12 - 1;

    const min = d.getMinutes();
    const rounded = Math.round(min / 5) * 5 % 60;
    const mStr = String(rounded).padStart(2, "0");
    const minuteIdx = Math.max(0, MINUTES.indexOf(mStr));

    return { dateIdx, hourIdx, minuteIdx, ampm: ap };
  } catch {
    return null;
  }
}

// ─── Scroll-wheel column ──────────────────────────────────────────────────────
function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  width = 60,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  width?: number;
}) {
  const C = useColors();
  const ref = useRef<ScrollView>(null);
  const [localIdx, setLocalIdx] = useState(selectedIndex);

  useEffect(() => {
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    });
    setLocalIdx(selectedIndex);
  }, [selectedIndex]);

  return (
    <View style={{ width, height: ITEM_H * 3, overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_H,
          left: 4,
          right: 4,
          height: ITEM_H,
          borderRadius: 10,
          backgroundColor: C.bg3,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: C.border,
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), items.length - 1));
          setLocalIdx(idx);
          onSelect(idx);
        }}
        onScrollEndDrag={(e) => {
          const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), items.length - 1));
          setLocalIdx(idx);
          onSelect(idx);
        }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => {
              setLocalIdx(i);
              onSelect(i);
              ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
            style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: i === localIdx ? "Roobert-Bold" : "Roobert-Regular",
                fontSize: i === localIdx ? 22 : 18,
                color: i === localIdx ? C.txt : C.txt3,
                letterSpacing: -0.5,
              }}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  value?: string;       // ISO 8601 string from/to parent
  onChange: (val?: string) => void;
  placeholder?: string;
  label?: string;
};

export default function DateTimeInput({ value, onChange, placeholder, label }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  // Stable dates array — rebuilt when modal opens so it's always fresh
  const [dates] = useState<Date[]>(() => buildDates());

  const [dateIdx, setDateIdx]     = useState(0);
  const [hourIdx, setHourIdx]     = useState(7);  // "8"
  const [minuteIdx, setMinuteIdx] = useState(6);  // "30"
  const [ampm, setAmpm]           = useState<"AM" | "PM">("PM");

  // Sync wheels to incoming ISO value
  useEffect(() => {
    if (!value) return;
    const idxs = isoToIdxs(value, dates);
    if (!idxs) return;
    setDateIdx(idxs.dateIdx);
    setHourIdx(idxs.hourIdx);
    setMinuteIdx(idxs.minuteIdx);
    setAmpm(idxs.ampm);
  }, [value]);

  function handleConfirm() {
    onChange(toISO(dates, dateIdx, hourIdx, minuteIdx, ampm));
    setVisible(false);
  }

  function handleClear() {
    onChange(undefined);
    setVisible(false);
  }

  // Format value for display in trigger button
  const triggerText = value ? (() => {
    const idxs = isoToIdxs(value, dates);
    if (!idxs) return value;
    return formatDisplay(dates, idxs.dateIdx, idxs.hourIdx, idxs.minuteIdx, idxs.ampm);
  })() : "";

  return (
    <>
      {label && (
        <Text style={{ color: C.txt3, fontFamily: "Roobert-SemiBold", fontSize: 11, letterSpacing: 0.4, marginBottom: 4 }}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => setVisible(true)}
        style={[styles.trigger, { backgroundColor: C.bg3, borderColor: C.border }]}
      >
        <Text style={{ fontFamily: "Roobert-Regular", fontSize: 14, color: triggerText ? C.txt : C.txt3 }}>
          {triggerText || placeholder || "Pick date & time"}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: C.bg, paddingBottom: insets.bottom + 12 }]}>
            <View style={[styles.handle, { backgroundColor: C.border2 }]} />

            {/* Nav */}
            <View style={styles.nav}>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={{ color: C.txt2, fontFamily: "Roobert-Regular", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 16 }}>Date & Time</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 15 }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Day strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              {dates.map((d, i) => {
                const selected = i === dateIdx;
                const dayLbl =
                  i === 0 ? "Today"
                  : i === 1 ? "Tmrw"
                  : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
                const wkLbl = i < 2 ? "" : WEEKDAYS[d.getDay()].toUpperCase();
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setDateIdx(i)}
                    activeOpacity={0.82}
                    style={[styles.dayPill, { backgroundColor: selected ? C.txt : C.card, borderColor: selected ? C.txt : C.border }]}
                  >
                    {wkLbl ? (
                      <Text style={{ fontFamily: "Roobert-SemiBold", fontSize: 9, letterSpacing: 0.4, color: selected ? C.bg : C.txt3 }}>
                        {wkLbl}
                      </Text>
                    ) : null}
                    <Text style={{ fontFamily: "Roobert-Bold", fontSize: 13, letterSpacing: -0.3, color: selected ? C.bg : C.txt }}>
                      {dayLbl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            {/* Time wheels */}
            <View style={styles.wheels}>
              <WheelColumn items={HOURS}   selectedIndex={hourIdx}   onSelect={setHourIdx}   width={72} />
              <Text style={{ fontFamily: "Roobert-Bold", fontSize: 26, color: C.txt, letterSpacing: -0.5, marginBottom: 4, width: 16, textAlign: "center" }}>:</Text>
              <WheelColumn items={MINUTES} selectedIndex={minuteIdx} onSelect={setMinuteIdx} width={72} />

              <View style={[styles.ampmWrap, { backgroundColor: C.card, borderColor: C.border }]}>
                {(["AM", "PM"] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setAmpm(p)}
                    activeOpacity={0.82}
                    style={[styles.ampmBtn, ampm === p && { backgroundColor: C.txt }]}
                  >
                    <Text style={{ fontFamily: "Roobert-SemiBold", fontSize: 13, color: ampm === p ? C.bg : C.txt3 }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preview + clear */}
            <View style={styles.footer}>
              <View style={[styles.preview, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={{ fontFamily: "Roobert-Medium", fontSize: 14, color: C.txt }}>
                  {formatDisplay(dates, dateIdx, hourIdx, minuteIdx, ampm)}
                </Text>
              </View>
              {value ? (
                <TouchableOpacity onPress={handleClear} style={[styles.clearBtn, { borderColor: C.border }]}>
                  <Text style={{ fontFamily: "Roobert-Medium", fontSize: 13, color: C.txt3 }}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  dayStrip: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    minWidth: 56,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 22,
    marginBottom: 4,
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  ampmWrap: {
    marginLeft: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  ampmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  preview: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
