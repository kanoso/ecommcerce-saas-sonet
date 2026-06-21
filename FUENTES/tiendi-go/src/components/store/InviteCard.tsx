import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useStoreInvitationStore } from '@/stores/store-invitation.store';
import { useDeliveryStore } from '@/stores/delivery.store';

/**
 * Returns up to two initials from a store name.
 * "Farmacia Central" → "FC", "Tienda" → "T"
 */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Bottom overlay card shown when a store-invite FCM push is received.
 * Hidden while a delivery offer is active (OfferCard takes priority).
 */
export function InviteCard() {
  const invitation = useStoreInvitationStore((s) => s.invitation);
  const acting = useStoreInvitationStore((s) => s.acting);
  const accept = useStoreInvitationStore((s) => s.accept);
  const reject = useStoreInvitationStore((s) => s.reject);

  // OfferCard takes visual priority — hide InviteCard while an offer is active.
  const offer = useDeliveryStore((s) => s.offer);

  if (!invitation || offer) return null;

  const { storeName, storeLogoUrl } = invitation;
  const isActing = acting !== 'idle';

  return (
    <View testID="invite-card" style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          {/* Logo or initials fallback */}
          <View style={styles.logoContainer}>
            {storeLogoUrl ? (
              <Image
                source={{ uri: storeLogoUrl }}
                style={styles.logo}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={styles.initialsContainer}>
                <Text style={styles.initials}>{getInitials(storeName)}</Text>
              </View>
            )}
          </View>

          <View style={styles.storeInfo}>
            <Text style={styles.label}>Invitación de tienda</Text>
            <Text testID="invite-store-name" style={styles.storeName} numberOfLines={1}>
              {storeName}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>
          ¿Querés unirte como repartidor de esta tienda?
        </Text>

        <View style={styles.actions}>
          <Button
            testID="invite-reject-btn"
            label="Rechazar"
            variant="ghost"
            onPress={reject}
            loading={acting === 'reject'}
            disabled={isActing}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Rechazar invitación"
            accessibilityState={{ disabled: isActing }}
          />
          <Button
            testID="invite-accept-btn"
            label="Aceptar"
            variant="primary"
            onPress={accept}
            loading={acting === 'accept'}
            disabled={isActing}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Aceptar invitación"
            accessibilityState={{ disabled: isActing }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
  },
  initialsContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  storeInfo: {
    flex: 1,
  },
  label: {
    color: Colors.text2,
    fontSize: 12,
  },
  storeName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: Colors.text2,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
