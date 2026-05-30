import { StyleSheet, Text, View } from 'react-native';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Transaction, TransactionType } from '@/types/wallet.types';

interface TransactionRowProps {
  item: Transaction;
}

const TYPE_LABEL: Record<TransactionType, string> = {
  COMMISSION: 'Comisión',
  WITHDRAWAL: 'Retiro',
  CASH_DEPOSIT: 'Depósito',
  BONUS: 'Bono',
  ADJUSTMENT: 'Ajuste',
};

const TYPE_ICON: Record<TransactionType, string> = {
  COMMISSION: '↑',
  WITHDRAWAL: '↓',
  CASH_DEPOSIT: '💵',
  BONUS: '★',
  ADJUSTMENT: '⟳',
};

const DEBIT_TYPES: Set<TransactionType> = new Set(['WITHDRAWAL']);

function formatCop(n: number): string {
  return '$' + Math.abs(n).toLocaleString('es-CO');
}

function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return iso.slice(0, 10);
  }
}

export function TransactionRow({ item }: TransactionRowProps) {
  const isDebit = DEBIT_TYPES.has(item.type) || item.amount < 0;
  const label = TYPE_LABEL[item.type] ?? 'Movimiento';
  const icon = TYPE_ICON[item.type] ?? '·';

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.date}>{relativeDate(item.createdAt)}</Text>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, isDebit ? styles.debit : styles.credit]}>
        {isDebit ? '−' : '+'}{formatCop(item.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    color: Colors.text,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  date: {
    fontSize: 12,
    color: Colors.text2,
  },
  desc: {
    fontSize: 12,
    color: Colors.text2,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  credit: {
    color: Colors.success,
  },
  debit: {
    color: Colors.error,
  },
});
