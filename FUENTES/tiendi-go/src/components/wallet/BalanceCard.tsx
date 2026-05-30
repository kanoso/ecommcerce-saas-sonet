import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface BalanceCardProps {
  balance: number;
  cashOnHand: number;
  pending: number;
  cashBlocked: number;
  onWithdraw: () => void;
  onDeposit: () => void;
}

function formatCop(n: number): string {
  return '$' + n.toLocaleString('es-CO');
}

export function BalanceCard({
  balance,
  cashOnHand,
  pending,
  cashBlocked,
  onWithdraw,
  onDeposit,
}: BalanceCardProps) {
  const depositEnabled = cashBlocked > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.mainLabel}>Disponible</Text>
      <Text style={styles.mainAmount}>{formatCop(balance)}</Text>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>En efectivo</Text>
          <Text style={styles.fieldValue}>{formatCop(cashOnHand)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Pendiente</Text>
          <Text style={styles.fieldValue}>{formatCop(pending)}</Text>
        </View>
      </View>

      {cashBlocked > 0 ? (
        <View style={styles.blockedBadge}>
          <Text style={styles.blockedText}>
            {formatCop(cashBlocked)} bloqueado — Depositá para seguir trabajando
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btn}
          onPress={onWithdraw}
          accessibilityRole="button"
          accessibilityLabel="Retirar fondos"
        >
          <Text style={styles.btnText}>Retirar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, !depositEnabled && styles.btnDisabled]}
          onPress={depositEnabled ? onDeposit : undefined}
          disabled={!depositEnabled}
          accessibilityRole="button"
          accessibilityLabel="Depositar efectivo"
        >
          <Text style={[styles.btnText, !depositEnabled && styles.btnTextDisabled]}>
            Depositar efectivo
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  mainLabel: {
    fontSize: 13,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  field: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.text2,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  blockedBadge: {
    backgroundColor: Colors.warning + '33',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  blockedText: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  btn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.card2,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  btnTextDisabled: {
    color: Colors.text2,
  },
});
