import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  Screen,
  dofursColors,
  getBookingCatalog,
  useBookingDraftStore,
} from '@dofurs/shared';

type BadgeVariant = 'popular' | 'best-value' | 'premium' | 'deal' | 'special' | 'coming-soon';

type GroomingPackage = {
  title: string;
  price: string | number;
  mrp?: number;
  features: string[];
  badge?: string;
  badgeVariant?: BadgeVariant;
  isBookable?: boolean;
  serviceTypeKeywords: string[];
};

type MarketingSubscriptionPlan = {
  title: string;
  badge: string;
  duration: string;
  price: string;
  worth: string;
  sessions: string;
  description: string;
  serviceType: string;
  highlight?: boolean;
  bonus?: string;
};

type MarketingSubscriptionPlanGroup = {
  title: string;
  dealLabel: string;
  summary: string;
  plans: MarketingSubscriptionPlan[];
};

type CatalogService = {
  id: string;
  provider_id: number;
  service_type: string;
  service_mode: string;
  service_duration_minutes: number;
  base_price: number;
};

const GROOMING_PACKAGES: GroomingPackage[] = [
  {
    title: 'Monthly Care',
    price: 699,
    mrp: 899,
    features: [
      'Nail Clipping',
      'Nail Grinding',
      'Knot Removal',
      'Eye & Ear Cleaning',
      'Paw Hair Trimming & Cleaning',
      'De-shedding',
    ],
    badge: 'Popular',
    badgeVariant: 'popular',
    serviceTypeKeywords: ['monthly care', 'monthly hygiene', 'doorstep pet grooming', 'basic package'],
  },
  {
    title: 'Fur Bath Care',
    price: 999,
    mrp: 1399,
    features: [
      'Anti-Tick Medicated Bath',
      'Drying',
      'Brushing',
      'De-shedding',
      'De-matting (Knot Removal)',
    ],
    badge: 'Great Deal',
    badgeVariant: 'deal',
    serviceTypeKeywords: ['fur bath care', 'summer pack', 'summer bonanza', 'offer package'],
  },
  {
    title: 'Fur Makeover',
    price: 1199,
    mrp: 1499,
    features: [
      'Hair Cut',
      'Paw Hair Cleaning',
      'Sanitary Area Hair Cleaning',
      'De-matting',
      'Brushing',
      'Ear & Eye Cleaning',
      'De-shedding',
    ],
    badge: 'Great Deal',
    badgeVariant: 'deal',
    serviceTypeKeywords: ['fur makeover', 'fur makeover package'],
  },
  {
    title: 'Essential Grooming',
    price: 1599,
    mrp: 1799,
    features: [
      'Bathing & Drying',
      'Shampoo & Conditioning',
      'Nail Clipping',
      'Paw Hair Cleaning',
      'Sanitary Area Cleaning (Hygiene Trim)',
      'Brushing & De-shedding',
      'De-matting (Knot Removal)',
      'Eye Cleaning / Eye Stain Cleaning',
      'Paw Moisturizing / Paw Massage',
      'Machine Trim (Max 15mm)',
    ],
    badge: 'Best Value',
    badgeVariant: 'best-value',
    serviceTypeKeywords: ['essential grooming'],
  },
  {
    title: 'Complete Care',
    price: 1999,
    mrp: 2299,
    features: [
      'Bathing & Drying',
      'Shampoo & Conditioning',
      'Brushing & De-shedding',
      'De-matting (Knot Removal)',
      'Scissor Haircut (as per your preference)',
      'Face Styling & Eye Area Trimming',
      'Hygiene Trim / Sanitary Area Cleaning',
      'Paw Hair Cleaning',
      'Nail Clipping & Grinding (Smooth Finish)',
      'Paw Moisturizing / Paw Massage',
      'Eye Stain & Ear Cleaning',
      'Nose Cleaning & Moisturizing',
      'Machine Trim (Upto Zero)',
    ],
    badge: 'Premium',
    badgeVariant: 'premium',
    serviceTypeKeywords: ['complete care'],
  },
];

const MARKETING_SUBSCRIPTION_PLAN_GROUPS: MarketingSubscriptionPlanGroup[] = [
  {
    title: '3M Care Packs',
    dealLabel: '2-month price',
    summary: 'Pay for 2 grooming services and receive credit value for 3 services, valid for 90 days.',
    plans: [
      {
        title: 'Monthly Care 3M',
        badge: 'Pay 2, Get 3',
        duration: '90 days',
        price: 'INR 1,798',
        worth: 'INR 2,697',
        sessions: '3 Monthly Care services',
        description: '3 Monthly Care grooming services at the price of 2.',
        serviceType: 'Grooming credit value',
      },
      {
        title: 'Fur Bath Care 3M',
        badge: 'Pay 2, Get 3',
        duration: '90 days',
        price: 'INR 2,798',
        worth: 'INR 4,197',
        sessions: '3 Fur Bath Care services',
        description: '3 Fur Bath Care services at the price of 2.',
        serviceType: 'Grooming credit value',
      },
      {
        title: 'Fur Makeover 3M',
        badge: 'Pay 2, Get 3',
        duration: '90 days',
        price: 'INR 2,998',
        worth: 'INR 4,497',
        sessions: '3 Fur Makeover services',
        description: '3 Fur Makeover services at the price of 2.',
        serviceType: 'Grooming credit value',
      },
      {
        title: 'Essential Care 3M',
        badge: 'Pay 2, Get 3',
        duration: '90 days',
        price: 'INR 3,598',
        worth: 'INR 5,397',
        sessions: '3 Essential Care services',
        description: '3 Essential Care grooming services at the price of 2.',
        serviceType: 'Grooming credit value',
        highlight: true,
      },
      {
        title: 'Complete Care 3M',
        badge: 'Full Care',
        duration: '90 days',
        price: 'INR 4,598',
        worth: 'INR 6,897',
        sessions: '3 Complete Care services',
        description: '3 Complete Care grooming services at the price of 2.',
        serviceType: 'Grooming credit value',
      },
    ],
  },
  {
    title: '6M Care Packs',
    dealLabel: '5-month price',
    summary: 'Pay for 5 grooming services and receive credit value for 6 services, valid for 180 days, with a final-service herbal shampoo bonus.',
    plans: [
      {
        title: 'Monthly Care 6M',
        badge: 'Shampoo Bonus',
        duration: '180 days',
        price: 'INR 4,495',
        worth: 'INR 5,394',
        sessions: '6 Monthly Care services',
        description: '6 Monthly Care grooming services at the price of 5.',
        serviceType: 'Grooming credit value',
        bonus: '+1 Herbal Shampoo Treatment on final service',
      },
      {
        title: 'Fur Bath Care 6M',
        badge: 'Shampoo Bonus',
        duration: '180 days',
        price: 'INR 6,995',
        worth: 'INR 8,394',
        sessions: '6 Fur Bath Care services',
        description: '6 Fur Bath Care services at the price of 5.',
        serviceType: 'Grooming credit value',
        bonus: '+1 Herbal Shampoo Treatment on final service',
      },
      {
        title: 'Fur Makeover 6M',
        badge: 'Shampoo Bonus',
        duration: '180 days',
        price: 'INR 7,495',
        worth: 'INR 8,994',
        sessions: '6 Fur Makeover services',
        description: '6 Fur Makeover services at the price of 5.',
        serviceType: 'Grooming credit value',
        bonus: '+1 Herbal Shampoo Treatment on final service',
      },
      {
        title: 'Essential Care 6M',
        badge: 'Popular 6M',
        duration: '180 days',
        price: 'INR 8,995',
        worth: 'INR 10,794',
        sessions: '6 Essential Care services',
        description: '6 Essential Care grooming services at the price of 5.',
        serviceType: 'Grooming credit value',
        bonus: '+1 Herbal Shampoo Treatment on final service',
      },
      {
        title: 'Complete Care 6M',
        badge: 'Best Value',
        duration: '180 days',
        price: 'INR 11,495',
        worth: 'INR 13,794',
        sessions: '6 Complete Care services',
        description: '6 Complete Care grooming services at the price of 5.',
        serviceType: 'Grooming credit value',
        bonus: '+1 Herbal Shampoo Treatment on final service',
        highlight: true,
      },
    ],
  },
];

const BADGE_STYLE_BY_VARIANT: Record<BadgeVariant, { textColor: string; backgroundColor: string; borderColor: string }> = {
  popular: { textColor: '#c7773b', backgroundColor: '#fff4e6', borderColor: '#f0c89a' },
  'best-value': { textColor: '#ffffff', backgroundColor: '#d38145', borderColor: '#c37035' },
  premium: { textColor: '#ffffff', backgroundColor: '#232323', borderColor: '#232323' },
  deal: { textColor: '#116b3e', backgroundColor: '#edf9f1', borderColor: '#ccecd6' },
  special: { textColor: '#6f2dbd', backgroundColor: '#f6efff', borderColor: '#e2ceff' },
  'coming-soon': { textColor: '#9f1239', backgroundColor: '#fff1f4', borderColor: '#fecdd3' },
};

function formatCurrency(value: number) {
  return `INR ${Math.round(value).toLocaleString('en-IN')}`;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePriceInr(label: string) {
  const parsed = Number.parseInt(label.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPackageName(title: string) {
  return title.replace(/\s+(3M|6M)$/i, '');
}

function getPlanPromise(title: string) {
  return title.includes('6M') ? 'Pay for 5, get 6 services' : 'Pay for 2, get 3 services';
}

function getCtaLabel(title: string) {
  return title.includes('6M') ? 'Choose 6M Pack' : 'Choose 3M Pack';
}

function toNormalizedMode(value: string): 'home_visit' | 'clinic_visit' | 'teleconsult' {
  if (value === 'clinic_visit' || value === 'teleconsult') {
    return value;
  }
  return 'home_visit';
}

function OptionChip({ label, selected }: { label: string; selected: boolean }) {
  return (
    <View style={[styles.planOptionChip, selected ? styles.planOptionChipSelected : null]}>
      <Text style={[styles.planOptionTitle, selected ? styles.planOptionTitleSelected : null]}>{label}</Text>
    </View>
  );
}

export default function CustomerServicesScreen() {
  const router = useRouter();
  const setServiceSelection = useBookingDraftStore((state) => state.setServiceSelection);

  const catalogQuery = useQuery({
    queryKey: ['customer', 'catalog'],
    queryFn: getBookingCatalog,
  });

  const initialPlanSelection = useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const group of MARKETING_SUBSCRIPTION_PLAN_GROUPS) {
      defaults[group.title] = group.plans.find((plan) => plan.highlight)?.title ?? group.plans[0].title;
    }
    return defaults;
  }, []);

  const [selectedPlanByGroup, setSelectedPlanByGroup] = useState<Record<string, string>>(initialPlanSelection);

  const catalogServices = useMemo(() => {
    return ((catalogQuery.data?.services ?? []) as CatalogService[]).slice().sort((left, right) => {
      const leftPrice = Number(left.base_price);
      const rightPrice = Number(right.base_price);
      if (Number.isFinite(leftPrice) && Number.isFinite(rightPrice) && leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }
      return String(left.service_type).localeCompare(String(right.service_type));
    });
  }, [catalogQuery.data?.services]);

  function findMatchingCatalogService(keywords: string[]) {
    const normalizedKeywords = keywords.map((value) => normalizeSearchText(value));

    return catalogServices.find((service) => {
      const normalizedType = normalizeSearchText(service.service_type ?? '');
      return normalizedKeywords.some((keyword) => normalizedType.includes(keyword));
    }) ?? null;
  }

  function handleBookPackage(pkg: GroomingPackage) {
    const matchedService = findMatchingCatalogService(pkg.serviceTypeKeywords);

    if (matchedService) {
      setServiceSelection({
        providerServiceId: matchedService.id,
        providerId: matchedService.provider_id,
        bookingMode: toNormalizedMode(matchedService.service_mode),
      });
    }

    router.push('/booking/new/service');
  }

  function handleRefresh() {
    void catalogQuery.refetch();
  }

  return (
    <Screen scroll refreshing={catalogQuery.isRefetching} onRefresh={handleRefresh}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeaderRow}>
          <Text style={styles.heroEyebrow}>Pet Grooming Packages</Text>
          <Text style={styles.heroPill}>Bengaluru</Text>
        </View>
        <Text style={styles.heroTitle}>Drag to explore services</Text>
        <Text style={styles.heroSubtitle}>Web-parity grooming and subscription cards with complete package inclusions.</Text>
      </View>

      {catalogQuery.isLoading ? <Text style={styles.metaInfo}>Loading provider availability...</Text> : null}

      <View style={styles.railWrap}>
        <View style={styles.railHeaderRow}>
          <Text style={styles.railTitle}>Drag to explore</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
          {GROOMING_PACKAGES.map((pkg) => {
            const badgeVariant = pkg.badgeVariant ?? 'popular';
            const badgeStyle = BADGE_STYLE_BY_VARIANT[badgeVariant];
            const matchedService = findMatchingCatalogService(pkg.serviceTypeKeywords);

            return (
              <View key={pkg.title} style={styles.serviceCard}>
                <View style={styles.serviceBadgeRow}>
                  {pkg.badge ? (
                    <Text
                      style={[
                        styles.serviceBadge,
                        {
                          color: badgeStyle.textColor,
                          backgroundColor: badgeStyle.backgroundColor,
                          borderColor: badgeStyle.borderColor,
                        },
                      ]}
                    >
                      {pkg.badge}
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.serviceTitle}>{pkg.title}</Text>

                <View style={styles.servicePriceWrap}>
                  {typeof pkg.mrp === 'number' ? (
                    <Text style={styles.serviceMrp}>MRP <Text style={styles.serviceMrpLine}>{formatCurrency(pkg.mrp)}</Text></Text>
                  ) : null}
                  <View style={styles.serviceNowRow}>
                    {typeof pkg.mrp === 'number' ? <Text style={styles.serviceNowLabel}>Now</Text> : null}
                    <Text style={styles.servicePrice}>{typeof pkg.price === 'number' ? formatCurrency(pkg.price) : pkg.price}</Text>
                    {typeof pkg.price === 'number' ? <Text style={styles.serviceSession}>/ session</Text> : null}
                  </View>
                </View>

                <View style={styles.serviceDivider} />

                <View style={styles.serviceFeaturesWrap}>
                  {pkg.features.map((feature) => (
                    <View key={`${pkg.title}-${feature}`} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={13} color="#c7773b" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  style={[styles.bookNowButton, !matchedService ? styles.bookNowButtonDisabled : null]}
                  disabled={!matchedService}
                  onPress={() => handleBookPackage(pkg)}
                >
                  <Text style={[styles.bookNowButtonLabel, !matchedService ? styles.bookNowButtonLabelDisabled : null]}>
                    {matchedService ? 'Book Now' : 'Coming Soon'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {MARKETING_SUBSCRIPTION_PLAN_GROUPS.map((group) => {
        const selectedTitle = selectedPlanByGroup[group.title] ?? group.plans[0].title;
        const selectedPlan = group.plans.find((plan) => plan.title === selectedTitle) ?? group.plans[0];
        const lowestPlan = group.plans.reduce((lowest, current) => (
          parsePriceInr(current.price) < parsePriceInr(lowest.price) ? current : lowest
        ), group.plans[0]);
        const selectedPrice = parsePriceInr(selectedPlan.price);
        const selectedWorth = parsePriceInr(selectedPlan.worth);
        const savings = Math.max(0, selectedWorth - selectedPrice);

        return (
          <View key={group.title} style={[styles.subscriptionCard, group.title.includes('6M') ? styles.subscriptionCardGold : styles.subscriptionCardSilver]}>
            <View style={styles.subscriptionTopRow}>
              <Text style={styles.subscriptionPromise}>{getPlanPromise(group.title)}</Text>
              <Text style={styles.subscriptionDuration}>{selectedPlan.duration}</Text>
            </View>

            <Text style={styles.subscriptionTitle}>{group.title}</Text>
            <Text style={styles.subscriptionSummary}>{group.summary}</Text>

            <View style={styles.startsAtCard}>
              <Text style={styles.startsAtLabel}>Starts at</Text>
              <Text style={styles.startsAtValue}>{lowestPlan.price}</Text>
              <Text style={styles.startsAtPackage}>{getPackageName(lowestPlan.title)}</Text>
            </View>

            <View style={styles.selectedPackageCard}>
              <View style={styles.selectedPackageHeader}>
                <View>
                  <Text style={styles.selectedPackageLabel}>Selected package</Text>
                  <Text style={styles.selectedPackageName}>{getPackageName(selectedPlan.title)}</Text>
                  <Text style={styles.selectedPackageSessions}>{selectedPlan.sessions}</Text>
                </View>
                <View style={styles.selectedPriceWrap}>
                  <Text style={styles.selectedDealLabel}>{group.dealLabel}</Text>
                  <Text style={styles.selectedPrice}>{selectedPlan.price}</Text>
                  <Text style={styles.selectedWorth}>Value {selectedPlan.worth}{savings > 0 ? ` · Save ${formatCurrency(savings)}` : ''}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.optionLegend}>Choose grooming package</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planOptionsRow}>
              {group.plans.map((plan) => {
                const selected = plan.title === selectedPlan.title;
                return (
                  <Pressable
                    key={plan.title}
                    style={[styles.planOptionCard, selected ? styles.planOptionCardSelected : null]}
                    onPress={() => {
                      setSelectedPlanByGroup((previous) => ({
                        ...previous,
                        [group.title]: plan.title,
                      }));
                    }}
                  >
                    <OptionChip label={plan.badge} selected={selected} />
                    <Text style={styles.planOptionName}>{getPackageName(plan.title)}</Text>
                    <Text style={styles.planOptionSessions}>{plan.sessions}</Text>
                    <Text style={styles.planOptionPrice}>{plan.price}</Text>
                    <Text style={styles.planOptionWorth}>value {plan.worth}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.benefitsGrid}>
              <View style={styles.benefitChip}><Text style={styles.benefitChipText}>Credit value after purchase</Text></View>
              <View style={styles.benefitChip}><Text style={styles.benefitChipText}>Pick date and time later</Text></View>
              <View style={styles.benefitChip}><Text style={styles.benefitChipText}>Valid for {selectedPlan.duration}</Text></View>
              <View style={styles.benefitChip}><Text style={styles.benefitChipText}>{selectedPlan.bonus ? 'Herbal shampoo bonus' : 'Eligible grooming credit'}</Text></View>
            </View>

            <Pressable style={styles.choosePackButton} onPress={() => router.push('/subscription/plans')}>
              <Text style={styles.choosePackButtonLabel}>{getCtaLabel(group.title)}</Text>
            </Pressable>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e7c7ad',
    backgroundColor: '#fff8f1',
    padding: 16,
    gap: 8,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroEyebrow: {
    color: '#9a6745',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#edd9c7',
    backgroundColor: '#ffffff',
    color: '#7a5a46',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: dofursColors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#6d5c4f',
    fontSize: 13,
    lineHeight: 20,
  },
  metaInfo: {
    color: '#7b6959',
    fontSize: 12,
  },
  railWrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ead5c0',
    backgroundColor: '#fff8f1',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  railTitle: {
    color: '#8b6c56',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  railContent: {
    gap: 12,
    paddingRight: 8,
  },
  serviceCard: {
    width: 210,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9d7c7',
    backgroundColor: '#fffdfb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  serviceBadgeRow: {
    height: 22,
    justifyContent: 'center',
  },
  serviceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceTitle: {
    color: '#0f0f0f',
    fontSize: 13,
    fontWeight: '700',
  },
  servicePriceWrap: {
    gap: 2,
  },
  serviceMrp: {
    color: '#9a7258',
    fontSize: 10,
    fontWeight: '600',
  },
  serviceMrpLine: {
    textDecorationLine: 'line-through',
  },
  serviceNowRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  serviceNowLabel: {
    color: '#c7773b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  servicePrice: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '800',
  },
  serviceSession: {
    color: '#9a7258',
    fontSize: 10,
    marginBottom: 2,
  },
  serviceDivider: {
    borderTopWidth: 1,
    borderTopColor: '#f0e4d6',
    marginTop: 2,
    marginBottom: 4,
  },
  serviceFeaturesWrap: {
    gap: 5,
    minHeight: 160,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  featureText: {
    flex: 1,
    color: '#5c3d22',
    fontSize: 11,
    lineHeight: 14,
  },
  bookNowButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e0c4a8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bookNowButtonDisabled: {
    borderColor: '#ead8c8',
    backgroundColor: '#fbf4ee',
  },
  bookNowButtonLabel: {
    color: '#7c5335',
    fontSize: 12,
    fontWeight: '700',
  },
  bookNowButtonLabelDisabled: {
    color: '#aa8b72',
  },
  subscriptionCard: {
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#fffdfb',
    padding: 14,
    gap: 10,
  },
  subscriptionCardGold: {
    borderColor: '#e7bf55',
  },
  subscriptionCardSilver: {
    borderColor: '#c7d1de',
  },
  subscriptionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionPromise: {
    color: '#835739',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  subscriptionDuration: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ead6c2',
    backgroundColor: '#ffffff',
    color: '#7a5a45',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  subscriptionTitle: {
    color: '#2d221a',
    fontSize: 21,
    fontWeight: '800',
  },
  subscriptionSummary: {
    color: '#6a5242',
    fontSize: 13,
    lineHeight: 18,
  },
  startsAtCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ecd7c2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  startsAtLabel: {
    color: '#8b6c56',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  startsAtValue: {
    color: '#2d221a',
    fontSize: 20,
    fontWeight: '800',
  },
  startsAtPackage: {
    color: '#8b6c56',
    fontSize: 10,
    fontWeight: '700',
  },
  selectedPackageCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e9d4bf',
    backgroundColor: '#fff8ef',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  selectedPackageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedPackageLabel: {
    color: '#8b6c56',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectedPackageName: {
    color: '#30251d',
    fontSize: 16,
    fontWeight: '800',
  },
  selectedPackageSessions: {
    color: '#7a5a45',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedPriceWrap: {
    alignItems: 'flex-end',
  },
  selectedDealLabel: {
    color: '#8b6c56',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectedPrice: {
    color: '#2d221a',
    fontSize: 22,
    fontWeight: '800',
  },
  selectedWorth: {
    color: '#8b6c56',
    fontSize: 10,
    fontWeight: '600',
  },
  optionLegend: {
    color: '#765743',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  planOptionsRow: {
    gap: 8,
    paddingRight: 8,
  },
  planOptionCard: {
    width: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0dfcf',
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 2,
  },
  planOptionCardSelected: {
    borderColor: '#d48950',
    backgroundColor: '#fff1e3',
  },
  planOptionChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ecd5bf',
    backgroundColor: '#ffffff',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  planOptionChipSelected: {
    borderColor: '#d48950',
    backgroundColor: '#ffe8d3',
  },
  planOptionTitle: {
    color: '#6d5542',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  planOptionTitleSelected: {
    color: '#6a3c1d',
  },
  planOptionName: {
    color: '#3c2d23',
    fontSize: 12,
    fontWeight: '700',
  },
  planOptionSessions: {
    color: '#755b49',
    fontSize: 10,
  },
  planOptionPrice: {
    color: '#2d221a',
    fontSize: 13,
    fontWeight: '800',
  },
  planOptionWorth: {
    color: '#8b6c56',
    fontSize: 9,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  benefitChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0dfcf',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  benefitChipText: {
    color: '#5d4739',
    fontSize: 11,
    fontWeight: '700',
  },
  choosePackButton: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2c2a4',
    backgroundColor: '#cd7a3d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  choosePackButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
