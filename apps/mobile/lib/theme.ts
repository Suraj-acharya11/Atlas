import { StyleSheet } from 'react-native';

export const colors = { bg: '#07070b', surface: '#111119', surface2: '#171522', border: '#292536', text: '#f8f7ff', muted: '#a7a1ba', violet: '#8050ff', violetSoft: '#c4a8ff', pink: '#ec5eab', green: '#56d39a', yellow: '#f4bf4f', red: '#ff6f7d' } as const;
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 110 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 14 },
  label: { color: colors.violetSoft, fontSize: 12, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  body: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  button: { backgroundColor: colors.violet, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  input: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 10, backgroundColor: colors.surface },
});
