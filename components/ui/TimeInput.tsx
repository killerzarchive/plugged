import { useColors } from "@/contexts/theme";
import React from "react";
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";

type Props = {
  value?: string;
  onChange: (val?: string) => void;
  placeholder?: string;
  label?: string;
};

/**
 * Simple time-only input component (HH:mm AM/PM format)
 * - Emits `HH:mm AM/PM` format (e.g., "02:30 PM")
 * - If cleared, onChange(undefined) is called
 */
export default function TimeInput({
  value,
  onChange,
  placeholder,
  label,
}: Props) {
  const C = useColors();
  const [visible, setVisible] = React.useState(false);
  const [hour, setHour] = React.useState(""); // 1-12
  const [minute, setMinute] = React.useState(""); // 00-59
  const [ampm, setAmpm] = React.useState<"AM" | "PM">("PM");

  React.useEffect(() => {
    if (!value) {
      setHour("");
      setMinute("");
      setAmpm("PM");
      return;
    }
    // Parse formats like "2:30 PM" or "02:30 PM"
    const m12 = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
      const h = parseInt(m12[1], 10);
      setHour(String(h));
      setMinute(m12[2]);
      setAmpm(m12[3].toUpperCase() === "AM" ? "AM" : "PM");
      return;
    }

    // Fallback: 24h HH:mm -> convert to 12h
    const m24 = value.match(/(\d{1,2}):(\d{2})/);
    if (m24) {
      const h24 = parseInt(m24[1], 10);
      const m = m24[2];
      const ap = h24 >= 12 ? "PM" : "AM";
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      setHour(String(h12));
      setMinute(m);
      setAmpm(ap as "AM" | "PM");
    }
  }, [value]);

  function formatPreview() {
    if (!hour && !minute) return "";
    if (hour && minute) return `${hour.padStart(2, "0")}:${minute} ${ampm}`;
    if (hour) return `${hour}:00 ${ampm}`;
    return "";
  }

  function isValid() {
    if (!hour || !minute) return false;
    const hourOk =
      /^\d{1,2}$/.test(hour) &&
      parseInt(hour, 10) >= 1 &&
      parseInt(hour, 10) <= 12;
    const minuteOk =
      /^\d{2}$/.test(minute) &&
      parseInt(minute, 10) >= 0 &&
      parseInt(minute, 10) <= 59;
    return hourOk && minuteOk;
  }

  function onSave() {
    if (!isValid()) return;
    onChange(`${hour.padStart(2, "0")}:${minute} ${ampm}`);
    setVisible(false);
    Keyboard.dismiss();
  }

  function setNow() {
    const now = new Date();
    const h24 = now.getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const hh = String(h12);
    const min = String(now.getMinutes()).padStart(2, "0");
    setHour(hh);
    setMinute(min);
    setAmpm(h24 >= 12 ? "PM" : "AM");
  }

  return (
    <View style={{ backgroundColor: C.bg, marginBottom: 20 }}>
      {label && (
        <Text style={{ color: C.label, marginBottom: 8, fontFamily: "Roobert-SemiBold" }}>
          {label}
        </Text>
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setVisible(true)}
        style={{ borderWidth: 2, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
      >
        <Text style={{ color: C.label, fontSize: 12, fontFamily: "Roobert-Medium" }}>
          {formatPreview() || placeholder || "Pick time"}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={onSave}>
            <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={{ backgroundColor: C.card, width: "100%", padding: 16, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 2, borderColor: C.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <Text style={{ color: C.label, fontSize: 18, fontFamily: "Roobert-SemiBold" }}>
                      Choose time
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setVisible(false);
                        Keyboard.dismiss();
                      }}
                      style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                    >
                      <Text style={{ color: C.muted, fontSize: 24, fontFamily: "Roobert-Medium" }}>×</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <TextInput
                        style={{
                          borderWidth: 2, borderColor: C.border, borderRadius: 12,
                          paddingHorizontal: 16, paddingVertical: 12,
                          color: C.label, fontSize: 24, textAlign: "center",
                          fontFamily: "Roobert-Medium", width: 70,
                          backgroundColor: C.surface,
                        }}
                        placeholder="12"
                        placeholderTextColor={C.muted}
                        keyboardType="number-pad"
                        value={hour}
                        onChangeText={(text) => {
                          if (/^\d{0,2}$/.test(text)) {
                            setHour(text);
                          }
                        }}
                        maxLength={2}
                      />
                      <Text style={{ color: C.label, fontSize: 24, marginHorizontal: 8, fontFamily: "Roobert-Medium" }}>:</Text>
                      <TextInput
                        style={{
                          borderWidth: 2, borderColor: C.border, borderRadius: 12,
                          paddingHorizontal: 16, paddingVertical: 12,
                          color: C.label, fontSize: 24, textAlign: "center",
                          fontFamily: "Roobert-Medium", width: 70,
                          backgroundColor: C.surface,
                        }}
                        placeholder="00"
                        placeholderTextColor={C.muted}
                        keyboardType="number-pad"
                        value={minute}
                        onChangeText={(text) => {
                          if (/^\d{0,2}$/.test(text)) {
                            setMinute(text);
                          }
                        }}
                        maxLength={2}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setAmpm("AM")}
                      style={{
                        paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
                        backgroundColor: ampm === "AM" ? C.label : "transparent",
                        borderWidth: ampm === "AM" ? 0 : 2,
                        borderColor: C.border,
                      }}
                    >
                      <Text style={{ textAlign: "center", fontSize: 16, fontFamily: "Roobert-SemiBold", color: ampm === "AM" ? C.bg : C.label }}>
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setAmpm("PM")}
                      style={{
                        paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
                        backgroundColor: ampm === "PM" ? C.label : "transparent",
                        borderWidth: ampm === "PM" ? 0 : 2,
                        borderColor: C.border,
                      }}
                    >
                      <Text style={{ textAlign: "center", fontSize: 16, fontFamily: "Roobert-SemiBold", color: ampm === "PM" ? C.bg : C.label }}>
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setNow();
                      onSave();
                    }}
                    style={{ backgroundColor: C.label, paddingVertical: 12, borderRadius: 12, marginTop: 16 }}
                  >
                    <Text style={{ color: C.bg, textAlign: "center", fontSize: 14, fontFamily: "Roobert-Bold" }}>
                      Now
                    </Text>
                  </TouchableOpacity>
                </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
