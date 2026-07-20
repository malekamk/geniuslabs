import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

const PRIMARY = '#1565C0';

export type OtpInputHandle = { reset: () => void };

// Auto-advancing N-digit code input — used for both signup verification
// and password-reset recovery codes (Supabase's native email OTP).
export const OtpInput = forwardRef<OtpInputHandle, { length?: number; onChange: (code: string) => void }>(
  function OtpInput({ length = 6, onChange }, ref) {
    const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
    const boxRefs = useRef<(TextInput | null)[]>([]);

    useImperativeHandle(ref, () => ({
      reset() {
        setDigits(Array(length).fill(''));
        onChange('');
        boxRefs.current[0]?.focus();
      },
    }));

    function handleChangeDigit(text: string, index: number) {
      const clean = text.replace(/[^0-9]/g, '');

      if (clean.length > 1) {
        const pasted = clean.slice(0, length).split('');
        const next = Array(length).fill('');
        pasted.forEach((d, i) => { next[i] = d; });
        setDigits(next);
        onChange(next.join(''));
        boxRefs.current[Math.min(pasted.length, length) - 1]?.focus();
        return;
      }

      const next = [...digits];
      next[index] = clean;
      setDigits(next);
      onChange(next.join(''));
      if (clean && index < length - 1) boxRefs.current[index + 1]?.focus();
    }

    function handleKeyPress(key: string, index: number) {
      if (key === 'Backspace' && !digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        onChange(next.join(''));
        boxRefs.current[index - 1]?.focus();
      }
    }

    return (
      <View style={styles.row}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => { boxRefs.current[i] = el; }}
            style={styles.box}
            value={d}
            onChangeText={(t) => handleChangeDigit(t, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={i === 0 ? length : 1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1, borderWidth: 1.5, borderColor: PRIMARY + '50', borderRadius: 8,
    backgroundColor: '#F9FAFB', paddingVertical: 12,
    fontSize: 22, fontWeight: '700', color: '#111827',
  },
});
