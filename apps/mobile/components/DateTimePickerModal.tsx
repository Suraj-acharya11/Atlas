import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, styles } from '../lib/theme';

interface DateTimePickerModalProps {
  visible: boolean;
  value: string | null;
  onConfirm: (isoString: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function formatHumanDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${day} ${month} ${year} · ${hours12}:${minutes} ${ampm}`;
}

export function DateTimePickerModal({ visible, value, onConfirm, onClear, onClose }: DateTimePickerModalProps) {
  const initial = value ? new Date(value) : new Date();
  const validInitial = isNaN(initial.getTime()) ? new Date() : initial;

  const [selectedYear, setSelectedYear] = useState(validInitial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(validInitial.getMonth());
  const [selectedDay, setSelectedDay] = useState(validInitial.getDate());

  let initialHour = validInitial.getHours();
  const initialAmpm = initialHour >= 12 ? 'PM' : 'AM';
  initialHour = initialHour % 12 || 12;
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(Math.floor(validInitial.getMinutes() / 5) * 5);
  const [selectedAmpm, setSelectedAmpm] = useState<'AM' | 'PM'>(initialAmpm);
  const [tab, setTab] = useState<'date' | 'time'>('date');

  React.useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      const current = isNaN(d.getTime()) ? new Date() : d;
      setSelectedYear(current.getFullYear());
      setSelectedMonth(current.getMonth());
      setSelectedDay(current.getDate());
      let h = current.getHours();
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setSelectedHour(h);
      setSelectedMinute(Math.floor(current.getMinutes() / 5) * 5);
      setSelectedAmpm(ap);
      setTab('date');
    }
  }, [visible, value]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();

  const handleConfirm = () => {
    let hour24 = selectedHour % 12;
    if (selectedAmpm === 'PM') hour24 += 12;
    const finalDate = new Date(selectedYear, selectedMonth, selectedDay, hour24, selectedMinute, 0, 0);
    onConfirm(finalDate.toISOString());
    onClose();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={[styles.card, { width: '100%', maxWidth: 360, padding: 18, marginTop: 0, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={[styles.title, { fontSize: 18 }]}>Set Deadline</Text>
            {value && onClear ? (
              <Pressable onPress={() => { onClear(); onClose(); }} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: colors.red, fontSize: 13, fontWeight: '700' }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 10, padding: 3, marginBottom: 14 }}>
            <Pressable
              onPress={() => setTab('date')}
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: tab === 'date' ? colors.violet : 'transparent' }}>
              <Text style={{ color: tab === 'date' ? '#fff' : colors.muted, fontWeight: '700', fontSize: 13 }}>
                📅 {selectedDay} {MONTH_NAMES[selectedMonth]} {selectedYear}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('time')}
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: tab === 'time' ? colors.violet : 'transparent' }}>
              <Text style={{ color: tab === 'time' ? '#fff' : colors.muted, fontWeight: '700', fontSize: 13 }}>
                ⏰ {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {selectedAmpm}
              </Text>
            </Pressable>
          </View>

          {tab === 'date' ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Pressable onPress={handlePrevMonth} style={{ padding: 8 }}>
                  <Text style={{ color: colors.violetSoft, fontSize: 18, fontWeight: 'bold' }}>‹</Text>
                </Pressable>
                <Text style={[styles.body, { fontWeight: '700' }]}>
                  {MONTH_NAMES[selectedMonth]} {selectedYear}
                </Text>
                <Pressable onPress={handleNextMonth} style={{ padding: 8 }}>
                  <Text style={{ color: colors.violetSoft, fontSize: 18, fontWeight: 'bold' }}>›</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                {DAYS_OF_WEEK.map((d) => (
                  <Text key={d} style={{ flex: 1, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <View key={`empty-${i}`} style={{ width: '14.28%', height: 34 }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = day === selectedDay;
                  return (
                    <Pressable
                      key={`day-${day}`}
                      onPress={() => setSelectedDay(day)}
                      style={{
                        width: '14.28%',
                        height: 34,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 17,
                        backgroundColor: isSelected ? colors.violet : 'transparent',
                      }}>
                      <Text style={{ color: isSelected ? '#fff' : colors.text, fontSize: 13, fontWeight: isSelected ? '800' : '500' }}>
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setTab('time')}
                style={{ marginTop: 14, alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: colors.violetSoft, fontSize: 13, fontWeight: '700' }}>Next: Select Time →</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={[styles.label, { marginBottom: 10, textAlign: 'center' }]}>Select Time</Text>

              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Hour</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => setSelectedHour(h)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: selectedHour === h ? colors.violet : colors.surface2,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                      <Text style={{ color: selectedHour === h ? '#fff' : colors.text, fontWeight: '700' }}>{h}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Minute</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setSelectedMinute(m)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: selectedMinute === m ? colors.violet : colors.surface2,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                      <Text style={{ color: selectedMinute === m ? '#fff' : colors.text, fontWeight: '700' }}>
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                {(['AM', 'PM'] as const).map((period) => (
                  <Pressable
                    key={period}
                    onPress={() => setSelectedAmpm(period)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: selectedAmpm === period ? colors.violet : colors.surface2,
                      alignItems: 'center',
                    }}>
                    <Text style={{ color: selectedAmpm === period ? '#fff' : colors.text, fontWeight: '800' }}>{period}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
            <Pressable
              onPress={onClose}
              style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={[styles.button, { flex: 1 }]}>
              <Text style={styles.buttonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
