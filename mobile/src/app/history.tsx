import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ApertureMark } from '@/components/aperture-mark';
import { ApertureFrame } from '@/components/aperture-reveal';
import { HalftonePlate } from '@/components/halftone-plate';
import { ThemedText } from '@/components/themed-text';
import { VerdictSeal } from '@/components/verdict-seal';
import {
  Font,
  Gutter,
  RISK_TO_VERDICT,
  Radius,
  Space,
  Type,
  useSurface,
  useVerdictColors,
} from '@/constants/design';
import { fetchHistory, scanTitle } from '@/lib/history';
import { labelThumbnailUri } from '@/lib/label-thumbnails';
import { goBackOrHome } from '@/lib/navigation';
import { getActiveProfileId, listProfiles } from '@/lib/profiles';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { RiskLevel, ScanHistory } from '@/lib/types';

// Screen 08 — Retention · History grid.
//
// Scanned products as tiles, each carrying the seal it was given. The seal is
// the point: history is a shelf of stamped verdicts, not a list of receipts.
// Verdict colour appears on the tile edge and in the seal, which are verdict
// surfaces — it appears nowhere else on this screen.

const PAGE_SIZE = 30;

const RISK_KEYS: Record<RiskLevel, TranslationKey> = {
  low: 'risk.low',
  moderate: 'risk.moderate',
  high: 'risk.high',
};

type Filter = 'all' | RiskLevel;
const FILTERS: Filter[] = ['all', 'high', 'moderate', 'low'];

/** Grid rows and their date headings, flattened so one FlatList can page. */
type Item =
  | { kind: 'heading'; key: string; label: string }
  | { kind: 'row'; key: string; scans: ScanHistory[] };

function formatDate(value: string | Date): string {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Group by recency, then pair into grid rows.
 *
 * "This week" earns its own heading because that is the window someone is
 * actually recalling in ("didn't I scan this one on Tuesday?"). Older scans
 * are grouped by month, which is how people remember shopping trips.
 */
function toItems(scans: ScanHistory[], t: (key: TranslationKey) => string): Item[] {
  // Snapped to the start of the day six days back, not a rolling 168 hours:
  // a rolling cutoff lands mid-afternoon and splits one date across two
  // headings, so the same "Aug 3" shows up under both THIS WEEK and the month.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekAgo = weekStart.getTime();
  const items: Item[] = [];
  let currentLabel: string | null = null;
  let pending: ScanHistory[] = [];

  const flushRow = () => {
    if (pending.length === 0) return;
    items.push({ kind: 'row', key: `row-${pending[0].id}`, scans: pending });
    pending = [];
  };

  for (const scan of scans) {
    const at = new Date(scan.createdAt);
    const label =
      at.getTime() >= weekAgo
        ? t('history.thisWeek')
        : at.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    if (label !== currentLabel) {
      flushRow();
      items.push({ kind: 'heading', key: `head-${label}-${scan.id}`, label });
      currentLabel = label;
    }
    pending.push(scan);
    if (pending.length === 2) flushRow();
  }
  flushRow();
  return items;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const verdict = useVerdictColors();

  const [filter, setFilter] = useState<Filter>('all');
  const [scans, setScans] = useState<ScanHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset: number, risk: Filter) => {
    // The reset lives here rather than in the effect that changes the filter:
    // clearing the list is part of loading page zero, not a separate render.
    if (offset === 0) {
      setLoading(true);
      setScans([]);
    }
    try {
      // Resolved the same way scan-detail resolves it, so the tile and the
      // screen it opens are scored for the same person. Failures fall through
      // to an unpersonalized list rather than an empty one — a grid of
      // universal verdicts is degraded, a grid of nothing is broken.
      const [profiles, activeId] = await Promise.all([
        listProfiles().catch(() => []),
        getActiveProfileId().catch(() => null),
      ]);
      const active =
        profiles.find((p) => p.id === activeId) ??
        profiles.find((p) => p.isDefault) ??
        profiles[0];

      const page = await fetchHistory(
        offset,
        PAGE_SIZE,
        risk === 'all' ? undefined : risk,
        active?.id,
      );
      setScans((prev) => (offset === 0 ? page.scans : [...prev, ...page.scans]));
      setTotal(page.total);
      setHasMore(page.hasMore);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reloaded on focus, not once on mount. A scan deleted from its detail screen,
  // or one saved since this list was last built, has to be reflected when the
  // user comes back — otherwise the grid keeps offering a tile that opens onto
  // "Scan not found".
  useFocusEffect(
    useCallback(() => {
      void load(0, filter);
    }, [load, filter]),
  );

  function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    void load(scans.length, filter);
  }

  // Resolved once per page of scans, never per render: each lookup is a
  // synchronous filesystem check, and doing that inside renderItem would put
  // one on the JS thread for every tile of every frame while scrolling.
  const thumbnails = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const scan of scans) map[scan.id] = labelThumbnailUri(scan.id);
    return map;
  }, [scans]);

  const items = toItems(scans, t);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <View style={styles.header}>
        <Pressable onPress={goBackOrHome} hitSlop={12}>
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ‹ {t('common.back')}
          </ThemedText>
        </Pressable>
        <ThemedText style={[Type.title, { color: surface.ink }]}>{t('history.title')}</ThemedText>
        <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
          {total === 1 ? t('history.countOne') : t('history.count', { count: total })}
        </ThemedText>

        <View style={styles.pillRow}>
          {FILTERS.map((option) => {
            const active = option === filter;
            return (
              <Pressable
                key={option}
                onPress={() => setFilter(option)}
                style={[
                  styles.pill,
                  { borderColor: surface.rule },
                  // Buttons are ink, never verdict ink — a green filter pill
                  // would be the app's only non-verdict colour.
                  active && { backgroundColor: surface.ink, borderColor: surface.ink },
                ]}
              >
                <ThemedText style={[styles.pillText, { color: active ? surface.card : surface.inkMuted }]}>
                  {option === 'all' ? t('history.filterAll') : t(RISK_KEYS[option])}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={surface.ink} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ThemedText style={[Type.body, { color: surface.ink }]}>{error}</ThemedText>
        </View>
      ) : scans.length === 0 ? (
        /* An empty aperture, at the size of the tile that will fill it.
           The brackets are the mark's own, drawn faint because nothing has
           been caught in them yet — a slot waiting for the first scan rather
           than a sentence apologising for the absence of one. Curiosity, not
           fear: the frame invites, it does not explain. */
        <View style={styles.centered}>
          {/* A page with genuinely nothing on it is the one place a plate is
              doing work rather than decorating: it gives the eye somewhere to
              rest that is not an apology for the absence of scans. Scatter,
              not a subject — it must not look like a scan that failed. */}
          <HalftonePlate name="almonds" opacity={0.07} />
          <ApertureFrame style={styles.emptySlot} color={surface.inkFaint}>
            <ApertureMark size={28} color={surface.inkFaint} />
          </ApertureFrame>
          <ThemedText style={[Type.body, styles.emptyText, { color: surface.inkMuted }]}>
            {filter === 'all' ? t('history.empty') : t('history.emptyFiltered')}
          </ThemedText>
          {filter === 'all' ? (
            <Pressable onPress={() => router.replace('/')}>
              <ThemedText style={[Type.label, { color: surface.ink }]}>
                {t('history.emptyCta')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.grid}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color={surface.ink} /> : null
          }
          renderItem={({ item }) =>
            item.kind === 'heading' ? (
              <ThemedText style={[Type.eyebrow, styles.heading, { color: surface.inkFaint }]}>
                {item.label}
              </ThemedText>
            ) : (
              <View style={styles.row}>
                {item.scans.map((scan) => {
                  const risk = (scan.overallRisk as RiskLevel) ?? 'low';
                  const tone = verdict[RISK_TO_VERDICT[risk]];
                  return (
                    <Pressable
                      key={scan.id}
                      style={[styles.tile, { backgroundColor: surface.card, borderColor: surface.rule }]}
                      onPress={() => router.push({ pathname: '/scan-detail', params: { id: scan.id } })}
                    >
                      {/* The specimen itself, behind its own record.

                          This is the app's most credible image and it was
                          already being taken and thrown away — a grid about
                          products somebody physically held, rendered entirely
                          in type. The photograph never left the phone and does
                          not start now; it is a local cache keyed to the scan
                          id, absent on a second device, and the tile is built
                          to read with or without it.

                          Held well back. It is the ground the record sits on,
                          not the subject — at full strength a snapshot of a
                          crumpled packet would out-shout the verdict seal,
                          which is the one thing on this tile that has to be
                          legible at a glance. */}
                      {thumbnails[scan.id] ? (
                        <>
                          <Image
                            source={{ uri: thumbnails[scan.id]! }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={220}
                          />
                          <View
                            style={[
                              StyleSheet.absoluteFill,
                              { backgroundColor: surface.card, opacity: 0.86 },
                            ]}
                          />
                        </>
                      ) : null}
                      <View style={[styles.tileEdge, { backgroundColor: tone.ink }]} />
                      <View style={styles.tileBody}>
                        <VerdictSeal
                          lines={[t(RISK_KEYS[risk]), '']}
                          color={tone.ink}
                          size={56}
                          still
                        />
                        <ThemedText style={[Type.label, { color: surface.ink }]} numberOfLines={3}>
                          {scanTitle(scan)}
                        </ThemedText>
                        <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                          {formatDate(scan.createdAt)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
                {/* Keeps a lone last tile at half width instead of stretching. */}
                {item.scans.length === 1 ? <View style={styles.tileSpacer} /> : null}
              </View>
            )
          }
        />
      )}

      {/* Ways back out. Not a tab bar — the camera is the app's home, and a
          persistent tab bar would make it one destination among three. */}
      <View style={[styles.bottomBar, { borderTopColor: surface.rule }]}>
        <Pressable style={styles.bottomItem} onPress={() => router.replace('/')}>
          <ApertureMark size={20} color={surface.ink} />
          <ThemedText style={[Type.meta, { color: surface.ink }]}>{t('history.toScan')}</ThemedText>
        </Pressable>

        {/* Language used to sit here as a row of pills. Nobody looked for a
            settings control on a screen of past scans, so it moved to Account,
            which is where the rest of "things about me" already lives. */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Gutter },
  emptySlot: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.sm,
  },
  emptyText: { textAlign: 'center' },
  header: {
    paddingHorizontal: Gutter,
    paddingTop: Space.sm,
    paddingBottom: Space.lg,
    gap: Space.xs,
  },
  pillRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },

  grid: { paddingHorizontal: Gutter, paddingBottom: Space.xxl },
  heading: { marginTop: Space.lg, marginBottom: Space.sm },
  row: { flexDirection: 'row', gap: Space.md, marginBottom: Space.md },
  tile: {
    flex: 1,
    borderRadius: Radius.flat,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 158,
  },
  tileEdge: { height: 4 },
  tileBody: { flex: 1, padding: Space.md, gap: Space.sm },
  tileSpacer: { flex: 1 },
  footer: { paddingVertical: Space.lg },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomItem: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
});
