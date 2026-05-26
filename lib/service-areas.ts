/**
 * Grooming-specific Bengaluru locality data.
 *
 * Research inputs checked before this expansion:
 * - Wikipedia's List of neighbourhoods in Bengaluru for regional groupings and locality names.
 * - PINcode.net.in Bangalore district locality/pincode listings as a postal locality cross-check.
 * - Dofurs in-repo booking coverage logic, including the Bengaluru city preset in lib/service-coverage.ts.
 *
 * The pincode arrays below are local SEO context, not unconditional service guarantees.
 * Public copy must keep availability pincode-aware and slot-dependent.
 */

export type CoverageTier = 'priority' | 'standard' | 'confirm';
export type LocalityPageStatus = 'published' | 'coverage_only';

export type BengaluruRegion =
  | 'Central Bengaluru'
  | 'Eastern Bengaluru'
  | 'North-Eastern Bengaluru'
  | 'Northern Bengaluru'
  | 'South-Eastern Bengaluru'
  | 'Southern Bengaluru'
  | 'Southern Suburbs'
  | 'Western Bengaluru'
  | 'Peripheral / Confirm Availability';

export type LocalityFaq = {
  question: string;
  answer: string;
};

export type LocalityLongFormSection = {
  heading: string;
  paragraphs: string[];
};

export type LocalityContent = {
  dogGrooming: string;
  catGrooming: string;
  mobileGrooming: string;
  apartmentAccess: string;
  localCoverage: string;
  packageFit: string;
  setupTip: string;
  travelNote: string;
};

export type BengaluruArea = {
  slug: string;
  name: string;
  shortName?: string;
  region: BengaluruRegion;
  aliases: string[];
  pincodes: string[];
  nearbyAreas: string[];
  landmarks: string[];
  coverageTier: CoverageTier;
  pageStatus: LocalityPageStatus;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  localNotes: string[];
  faqs: LocalityFaq[];
  content: LocalityContent;
  sections?: LocalityLongFormSection[];
};

type AreaSeed = {
  slug: string;
  name: string;
  shortName?: string;
  region: BengaluruRegion;
  aliases?: string[];
  pincodes: string[];
  nearbyAreas: string[];
  landmarks: string[];
  coverageTier?: CoverageTier;
  pageStatus?: LocalityPageStatus;
  content?: Partial<LocalityContent>;
  localNotes?: string[];
  faqs?: LocalityFaq[];
  sections?: LocalityLongFormSection[];
};

export const PET_GROOMING_CITY_PATH = '/pet-grooming/bengaluru';

const prioritySlugs = new Set([
  'whitefield',
  'electronic-city',
  'hsr-layout',
  'koramangala',
  'sarjapur-road',
  'indiranagar',
  'bellandur',
  'marathahalli',
  'jp-nagar',
  'jayanagar',
  'hebbal',
  'yelahanka',
  'malleshwaram',
  'rajajinagar',
  'basavanagudi',
  'banashankari',
  'btm-layout',
  'mahadevapura',
  'kr-puram',
  'hoodi',
  'varthur',
  'kadugodi',
  'kalyan-nagar',
  'ramamurthy-nagar',
  'bannerghatta-road',
  'rajarajeshwari-nagar',
  'kengeri',
]);

const confirmRegion: BengaluruRegion = 'Peripheral / Confirm Availability';

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function defaultContent(seed: AreaSeed): LocalityContent {
  const areaLabel = seed.shortName ?? seed.name;
  const landmarkSummary = seed.landmarks.slice(0, 3).join(', ');
  const nearbySummary = seed.nearbyAreas.slice(0, 4).join(', ');
  const pincodeSummary = seed.pincodes.join(', ');
  const isConfirm = seed.region === confirmRegion || seed.coverageTier === 'confirm';

  return {
    dogGrooming:
      `Dog grooming in ${seed.name} works best when coat condition, lift access and parking notes are shared before the visit. Dofurs groomers use the booking notes to prepare for bath care, de-shedding, nail trimming, hygiene trims and haircut requests around ${landmarkSummary}.`,
    catGrooming:
      `Cat grooming in ${areaLabel} is handled carefully because temperament and home setup matter more than speed. Share whether your cat is used to brushing, nail trims or bathing so the team can confirm the right groomer and package before the appointment.`,
    mobileGrooming:
      `Doorstep and mobile grooming around ${seed.region} helps pet parents avoid cross-city travel. Availability depends on the exact pincode, groomer slots, pet size and package, especially for addresses near ${nearbySummary}.`,
    apartmentAccess:
      `For apartments, villas and gated communities near ${landmarkSummary}, add visitor entry rules, tower names, parking instructions and any service-lift restrictions in the booking notes.`,
    localCoverage: isConfirm
      ? `${seed.name} is treated as a confirm-availability area. We list ${pincodeSummary} for address matching, but grooming is confirmed only after checking groomer routing and your exact pincode.`
      : `${seed.name} coverage is pincode-aware across ${pincodeSummary}. Nearby requests from ${nearbySummary} are matched to available groomers when the booking flow confirms address and slot availability.`,
    packageFit:
      `Monthly Care suits routine upkeep in ${areaLabel}, Fur Bath Care is useful after dusty walks or monsoon dampness, and Essential Grooming or Complete Care fit pets needing full coat, paw and hygiene care.`,
    setupTip:
      `Keep a dry towel, water access, a plug point and a quiet grooming corner ready before the groomer reaches ${seed.name}.`,
    travelNote:
      `Home grooming reduces salon travel from ${areaLabel}, which is especially useful during peak traffic, summer heat and weekend appointment rush.`,
  };
}

function buildArea(seed: AreaSeed): BengaluruArea {
  const pageStatus = seed.pageStatus ?? (prioritySlugs.has(seed.slug) ? 'published' : 'coverage_only');
  const coverageTier = seed.coverageTier ?? (prioritySlugs.has(seed.slug) ? 'priority' : seed.region === confirmRegion ? 'confirm' : 'standard');
  const nearbySummary = seed.nearbyAreas.slice(0, 4).join(', ');
  const areaLabel = seed.shortName ?? seed.name;
  const content = { ...defaultContent({ ...seed, coverageTier }), ...seed.content };

  return {
    slug: seed.slug,
    name: seed.name,
    shortName: seed.shortName,
    region: seed.region,
    aliases: unique([seed.name, seed.shortName ?? '', ...(seed.aliases ?? [])]).filter((value) => value !== seed.name),
    pincodes: unique(seed.pincodes),
    nearbyAreas: unique(seed.nearbyAreas),
    landmarks: unique(seed.landmarks),
    coverageTier,
    pageStatus,
    metaTitle: `Pet Grooming in ${seed.name}, Bengaluru | Doorstep Dog & Cat Grooming`,
    metaDescription: `Book pincode-aware doorstep pet grooming in ${seed.name}, Bengaluru. Dofurs covers ${seed.pincodes.join(', ')} and nearby ${nearbySummary} with dog grooming, cat grooming and home grooming packages.`,
    intro: `Dofurs offers pincode-aware doorstep pet grooming in ${seed.name}, Bengaluru for pet parents who want dog grooming, cat grooming and coat hygiene care without a stressful salon trip. Coverage around ${nearbySummary} is confirmed by exact address, groomer slots, pet size and selected package.`,
    localNotes: seed.localNotes ?? [
      content.apartmentAccess,
      content.setupTip,
      `Share coat condition, ticks or matting before your ${areaLabel} appointment so the package and duration can be confirmed clearly.`,
    ],
    faqs: seed.faqs ?? [
      {
        question: `Do you provide pet grooming in ${seed.name}?`,
        answer: `Yes. Dofurs accepts pet grooming bookings for ${seed.name} and nearby ${nearbySummary}, subject to pincode-aware availability, groomer slots, pet size and package fit.`,
      },
      {
        question: `Which pincodes are relevant for ${areaLabel} grooming?`,
        answer: `The ${areaLabel} page uses ${seed.pincodes.join(', ')} as local pincode context. Enter your exact address during booking so Dofurs can confirm whether a groomer is available for that pincode.`,
      },
      {
        question: `Can cats be groomed at home in ${seed.name}?`,
        answer: `Cat grooming can be arranged when the pet's temperament, coat condition and provider availability are suitable. Share cat handling notes before confirming a bath or trim package.`,
      },
      {
        question: `What should I keep ready before a home grooming session in ${seed.name}?`,
        answer: `Keep water access, a plug point, towels, a calm corner and society-entry instructions ready. The groomer brings tools and pet-safe grooming products.`,
      },
    ],
    content,
    sections: seed.sections,
  };
}

const areaSeeds: AreaSeed[] = [
  {
    slug: 'malleshwaram',
    name: 'Malleshwaram',
    region: 'Central Bengaluru',
    aliases: ['Malleswaram', 'Malleshwaram 8th Cross'],
    pincodes: ['560003', '560055'],
    nearbyAreas: ['Rajajinagar', 'Sadashivanagar', 'Yeshwanthpur', 'Kumara Park', 'Palace Guttahalli'],
    landmarks: ['8th Cross', 'Sampige Road', 'Mantri Square', 'Malleswaram Circle', 'Orion Mall'],
    content: {
      dogGrooming: 'Dog grooming in Malleshwaram often needs calm scheduling around older homes, compact apartment blocks and busy market streets. Monthly Care and Essential Grooming are useful for pets who walk around 8th Cross, Sankey Road and shaded residential lanes where dust and shedding build up quickly.',
      catGrooming: 'Malleshwaram cat parents should share temperament notes early because older buildings can have tighter bathroom spaces and more household movement. A quieter weekday slot usually helps cats settle before brushing, nail care or a hygiene trim.',
      mobileGrooming: 'Home pet grooming in Malleshwaram is practical because salon travel across Sampige Road, Rajajinagar and Yeshwanthpur can add stress before the session even begins.',
      apartmentAccess: 'For homes near 8th Cross, Mantri Square or temple streets, mention parking limits, floor number and whether the groomer should use a service lift or side entrance.',
      localCoverage: 'Malleshwaram coverage is pincode-aware across 560003 and 560055, with nearby matching for Rajajinagar, Sadashivanagar, Yeshwanthpur, Kumara Park and Palace Guttahalli when slots are open.',
      packageFit: 'Fur Bath Care is a good fit after dusty market walks, while Complete Care suits long-coated pets that need styling plus paw, nail and hygiene work in one visit.',
    },
  },
  {
    slug: 'indiranagar',
    name: 'Indiranagar',
    region: 'Central Bengaluru',
    aliases: ['Indira Nagar', 'Indiranagar 100 Feet Road'],
    pincodes: ['560038', '560008'],
    nearbyAreas: ['Domlur', 'HAL 2nd Stage', 'Jeevan Bhima Nagar', 'Ulsoor', 'C. V. Raman Nagar'],
    landmarks: ['100 Feet Road', '12th Main', 'CMH Road', 'Defence Colony', 'HAL 2nd Stage'],
    content: {
      dogGrooming: 'Dog grooming in Indiranagar is commonly needed for active pets that walk along 12th Main, Defence Colony and 100 Feet Road. Share coat type and paw condition so the groomer can plan bath care, nail care and de-shedding without rushing the session.',
      catGrooming: 'Cat grooming in Indiranagar works best when the session is kept quiet and predictable. If your cat hides around visitors or resists handling, tell us before choosing a bath or trim package so availability can be matched carefully.',
      mobileGrooming: 'Doorstep pet grooming in Indiranagar saves pet parents from navigating CMH Road traffic, limited parking and salon waiting areas, especially for senior dogs and anxious cats.',
      apartmentAccess: 'For apartments around 100 Feet Road, 12th Main and HAL 2nd Stage, add tower name, visitor approval steps and a landmark pin to help the groomer arrive smoothly.',
      localCoverage: 'Indiranagar coverage is pincode-aware across 560038 and 560008, with nearby matching for Domlur, Ulsoor, Jeevan Bhima Nagar, HAL 2nd Stage and C. V. Raman Nagar.',
      packageFit: 'Monthly Care fits regular apartment pets, Fur Makeover helps when paw hair and sanitary areas need attention, and Complete Care suits heavier styling or full coat refreshes.',
    },
  },
  { slug: 'sadashivanagar', name: 'Sadashivanagar', region: 'Central Bengaluru', aliases: ['Sadashiva Nagar'], pincodes: ['560080'], nearbyAreas: ['Malleshwaram', 'R. M. V. Extension', 'Palace Guttahalli', 'Vasanth Nagar'], landmarks: ['Sankey Tank', 'Cauvery Theatre', 'Sadashivanagar Club'] },
  { slug: 'shivajinagar', name: 'Shivajinagar', region: 'Central Bengaluru', aliases: ['Shivaji Nagar'], pincodes: ['560001', '560051'], nearbyAreas: ['M. G. Road', 'Vasanth Nagar', 'Frazer Town', 'Cunningham Road'], landmarks: ['Russell Market', 'Bangalore Cantonment', 'Commercial Street'] },
  { slug: 'vasanth-nagar', name: 'Vasanth Nagar', region: 'Central Bengaluru', aliases: ['Vasanthnagar'], pincodes: ['560052'], nearbyAreas: ['Cunningham Road', 'Sadashivanagar', 'Shivajinagar', 'Palace Grounds'], landmarks: ['Cunningham Road', 'Bangalore Palace', 'Mount Carmel College'] },
  { slug: 'ulsoor', name: 'Ulsoor', region: 'Central Bengaluru', aliases: ['Halasuru'], pincodes: ['560008', '560042'], nearbyAreas: ['M. G. Road', 'Indiranagar', 'Cox Town', 'Domlur'], landmarks: ['Ulsoor Lake', 'Halasuru Metro', 'Old Madras Road'] },
  { slug: 'domlur', name: 'Domlur', region: 'Central Bengaluru', pincodes: ['560071'], nearbyAreas: ['Indiranagar', 'Old Airport Road', 'HAL', 'Koramangala'], landmarks: ['Embassy GolfLinks', 'Domlur Flyover', 'Intermediate Ring Road'] },
  { slug: 'jeevan-bhima-nagar', name: 'Jeevan Bhima Nagar', region: 'Central Bengaluru', aliases: ['Jeevanbhima Nagar'], pincodes: ['560075'], nearbyAreas: ['Indiranagar', 'New Thippasandra', 'HAL 3rd Stage', 'C. V. Raman Nagar'], landmarks: ['Jeevan Bhima Nagar Main Road', 'HAL Market', 'New Thippasandra Road'] },
  { slug: 'seshadripuram', name: 'Seshadripuram', region: 'Central Bengaluru', pincodes: ['560020'], nearbyAreas: ['Kumara Park', 'Malleshwaram', 'Gandhinagar', 'Vasanth Nagar'], landmarks: ['Seshadripuram College', 'Kumara Park', 'Mantri Square'] },
  { slug: 'austin-town', name: 'Austin Town', region: 'Central Bengaluru', pincodes: ['560047'], nearbyAreas: ['Richmond Town', 'Adugodi', 'Koramangala', 'Vivek Nagar'], landmarks: ['Austin Town Football Ground', 'Neelasandra', 'Richmond Road'] },
  { slug: 'rt-nagar', name: 'R. T. Nagar', region: 'Central Bengaluru', aliases: ['RT Nagar', 'Rabindranath Tagore Nagar'], pincodes: ['560032'], nearbyAreas: ['Hebbal', 'Sultanpalya', 'Ganganagar', 'Sadashivanagar'], landmarks: ['R. T. Nagar Main Road', 'BDA Complex', 'Ganganagar'] },
  { slug: 'richmond-town', name: 'Richmond Town', region: 'Central Bengaluru', pincodes: ['560025'], nearbyAreas: ['Langford Town', 'Shanthinagar', 'Brigade Road', 'Austin Town'], landmarks: ['Richmond Road', 'Baldwin Boys High School', 'Johnson Market'] },
  { slug: 'fraser-town', name: 'Fraser Town', region: 'Central Bengaluru', aliases: ['Frazer Town'], pincodes: ['560005'], nearbyAreas: ['Cox Town', 'Benson Town', 'Cooke Town', 'Shivajinagar'], landmarks: ['Mosque Road', 'Coles Park', 'Frazer Town Police Station'] },
  { slug: 'cox-town', name: 'Cox Town', region: 'Central Bengaluru', pincodes: ['560005'], nearbyAreas: ['Fraser Town', 'Ulsoor', 'Banaswadi', 'Cooke Town'], landmarks: ['Wheeler Road', 'Cox Town Market', 'ITC Factory Road'] },
  { slug: 'murphy-town', name: 'Murphy Town', region: 'Central Bengaluru', pincodes: ['560008'], nearbyAreas: ['Ulsoor', 'Indiranagar', 'Cox Town', 'Halasuru'], landmarks: ['Murphy Town Market', 'Old Madras Road', 'Halasuru Lake'] },
  { slug: 'benson-town', name: 'Benson Town', region: 'Central Bengaluru', pincodes: ['560046'], nearbyAreas: ['Frazer Town', 'Cox Town', 'Jayamahal', 'Cantonment'], landmarks: ['Benson Cross Road', 'Jayamahal', 'Cantonment Railway Station'] },
  { slug: 'chamrajpet', name: 'Chamrajpet', region: 'Central Bengaluru', aliases: ['Chamarajpet'], pincodes: ['560018'], nearbyAreas: ['Basavanagudi', 'K. R. Market', 'Cottonpet', 'Gandhi Bazaar'], landmarks: ['5th Main', 'Fort High School', 'Tipu Sultan Palace'] },
  { slug: 'chickpet', name: 'Chickpet', region: 'Central Bengaluru', aliases: ['Chikpet'], pincodes: ['560002', '560053'], nearbyAreas: ['Balepet', 'Cottonpet', 'K. R. Market', 'Avenue Road'], landmarks: ['Chickpet Market', 'BVK Iyengar Road', 'Avenue Road'] },
  { slug: 'balepet', name: 'Balepet', region: 'Central Bengaluru', pincodes: ['560053'], nearbyAreas: ['Chickpet', 'Cottonpet', 'Avenue Road', 'Majestic'], landmarks: ['Balepet Main Road', 'Kempegowda Market', 'Majestic'] },
  { slug: 'cottonpet', name: 'Cottonpet', region: 'Central Bengaluru', pincodes: ['560053'], nearbyAreas: ['Balepet', 'Chickpet', 'Majestic', 'K. R. Market'], landmarks: ['Cottonpet Main Road', 'Majestic Bus Stand', 'BVK Iyengar Road'] },
  { slug: 'sultanpet', name: 'Sultanpet', region: 'Central Bengaluru', aliases: ['Sultan Pete'], pincodes: ['560053'], nearbyAreas: ['Chickpet', 'Balepet', 'K. R. Market', 'Avenue Road'], landmarks: ['Sultanpet Main Road', 'Pete Area', 'City Market'] },
  { slug: 'kr-market', name: 'K. R. Market', region: 'Central Bengaluru', aliases: ['KR Market', 'City Market', 'Krishna Rajendra Market'], pincodes: ['560002'], nearbyAreas: ['Chickpet', 'Chamrajpet', 'Avenue Road', 'Cottonpet'], landmarks: ['K. R. Market', 'City Market Metro', 'Tipu Sultan Palace'] },
  { slug: 'avenue-road', name: 'Avenue Road', region: 'Central Bengaluru', pincodes: ['560002'], nearbyAreas: ['Chickpet', 'K. R. Market', 'Balepet', 'Mysore Bank'], landmarks: ['Avenue Road Book Market', 'K. R. Market', 'Mysore Bank Circle'] },
  { slug: 'mg-road', name: 'M. G. Road', region: 'Central Bengaluru', aliases: ['MG Road', 'Mahatma Gandhi Road'], pincodes: ['560001'], nearbyAreas: ['Brigade Road', 'Ulsoor', 'Shivajinagar', 'Richmond Town'], landmarks: ['M. G. Road Metro', 'Trinity Circle', 'Church Street'] },
  { slug: 'brigade-road', name: 'Brigade Road', region: 'Central Bengaluru', pincodes: ['560001', '560025'], nearbyAreas: ['M. G. Road', 'Richmond Town', 'Ashok Nagar', 'Church Street'], landmarks: ['Brigade Road', 'Church Street', 'Garuda Mall'] },
  { slug: 'shanthinagar', name: 'Shanthinagar', region: 'Central Bengaluru', aliases: ['Shanti Nagar'], pincodes: ['560027'], nearbyAreas: ['Richmond Town', 'Wilson Garden', 'Adugodi', 'Sampangiram Nagar'], landmarks: ['BMTC Bus Station', 'Double Road', 'KH Road'] },
  { slug: 'wilson-garden', name: 'Wilson Garden', region: 'Central Bengaluru', pincodes: ['560027'], nearbyAreas: ['Jayanagar', 'Shanthinagar', 'Adugodi', 'Lalbagh'], landmarks: ['Wilson Garden Main Road', 'Lalbagh', 'Hosur Road'] },
  { slug: 'sampangiram-nagar', name: 'Sampangiram Nagar', region: 'Central Bengaluru', aliases: ['S. R. Nagar'], pincodes: ['560027'], nearbyAreas: ['Richmond Town', 'Shanthinagar', 'M. G. Road', 'Cubbon Park'], landmarks: ['Kanteerava Stadium', 'Corporation Circle', 'Cubbon Park'] },
  { slug: 'kumara-park', name: 'Kumara Park', region: 'Central Bengaluru', pincodes: ['560020'], nearbyAreas: ['Seshadripuram', 'Malleshwaram', 'Vasanth Nagar', 'Sadashivanagar'], landmarks: ['Kumara Park West', 'Race Course Road', 'Seshadripuram'] },
  { slug: 'palace-guttahalli', name: 'Palace Guttahalli', region: 'Central Bengaluru', pincodes: ['560003'], nearbyAreas: ['Malleshwaram', 'Vasanth Nagar', 'Sankey Road', 'Sadashivanagar'], landmarks: ['Palace Grounds', 'Sankey Road', 'Guttahalli Main Road'] },

  {
    slug: 'whitefield',
    name: 'Whitefield',
    region: 'Eastern Bengaluru',
    aliases: ['Whitefield Bangalore', 'Whitefield Bengaluru'],
    pincodes: ['560066', '560067', '560048'],
    nearbyAreas: ['ITPL', 'Brookefield', 'Kadugodi', 'Varthur', 'Hoodi', 'Mahadevapura'],
    landmarks: ['ITPL Main Road', 'Phoenix Marketcity', 'Forum Shantiniketan', 'Nallurhalli', 'Varthur Road'],
    content: {
      dogGrooming: 'Dog grooming in Whitefield often serves high-rise apartments, villas and tech-corridor homes where visitor approvals and elevator access matter. Dofurs plans sessions around coat type, pet size and society entry notes for bath care, de-shedding, paw cleaning and full haircut packages.',
      catGrooming: 'Cat grooming in Whitefield is best booked with clear temperament notes because long waits at large communities can unsettle cats. Share whether your cat tolerates brushing, nail clipping or drying before selecting Fur Bath Care or a full package.',
      mobileGrooming: 'Mobile dog grooming in Whitefield is useful around ITPL, Varthur Road and Brookefield because traffic can turn a salon visit into a long errand. Doorstep grooming keeps the pet in familiar surroundings while the groomer brings tools and pet-safe products.',
      apartmentAccess: 'For gated communities near ITPL, Nallurhalli or Forum Shantiniketan, add visitor approval, tower, parking and intercom details before the slot.',
      localCoverage: 'Whitefield coverage is pincode-aware across 560066, 560067 and 560048, with nearby requests from Kadugodi, Brookefield, ITPL, Hoodi and Varthur confirmed by exact address.',
      packageFit: 'Fur Bath Care works well after dusty tech-park walks, Essential Grooming suits routine coat maintenance, and Complete Care fits long-coated dogs that need styling plus hygiene work.',
    },
  },
  {
    slug: 'bellandur',
    name: 'Bellandur',
    region: 'Eastern Bengaluru',
    pincodes: ['560103'],
    nearbyAreas: ['Sarjapur Road', 'Marathahalli', 'HSR Layout', 'Kadubeesanahalli', 'Panathur'],
    landmarks: ['Bellandur Lake', 'Outer Ring Road', 'RMZ Ecospace', 'Central Mall', 'Kadubeesanahalli'],
    content: {
      dogGrooming: 'Dog grooming in Bellandur needs practical timing because ORR traffic and high-rise entry checks can affect arrival windows. Share tower, gate and parking instructions so bath care, de-shedding and nail work can start calmly.',
      catGrooming: 'Bellandur cat grooming depends on a quiet setup away from balcony noise and household movement. Cats near ORR apartments often do better with short, confidence-building grooming steps before any bath-heavy session.',
      mobileGrooming: 'Doorstep grooming in Bellandur helps pet parents avoid Outer Ring Road travel with a wet or anxious pet after the appointment.',
      apartmentAccess: 'For communities near RMZ Ecospace, Bellandur Lake and Kadubeesanahalli, mention security rules and whether a grooming table or bathroom space is available.',
      localCoverage: 'Bellandur coverage is pincode-aware for 560103, with nearby checks for Sarjapur Road, Marathahalli, Panathur, Kadubeesanahalli and HSR Layout.',
      packageFit: 'Monthly Care is useful for apartment dogs with regular paw and nail needs, while Essential Grooming handles the bath, hygiene trim and coat care most Bellandur pets need routinely.',
    },
  },
  {
    slug: 'marathahalli',
    name: 'Marathahalli',
    region: 'Eastern Bengaluru',
    pincodes: ['560037'],
    nearbyAreas: ['Bellandur', 'Brookefield', 'Doddanekkundi', 'Kundalahalli', 'HAL'],
    landmarks: ['Marathahalli Bridge', 'Outer Ring Road', 'Old Airport Road', 'Spice Garden', 'Munnekolala'],
    content: {
      dogGrooming: 'Dog grooming in Marathahalli often works around busy roads, compact apartments and pets that pick up dust along ORR and Old Airport Road walks. Share coat density and shedding level before selecting a bath or full grooming package.',
      catGrooming: 'Cat grooming in Marathahalli should be paced gently because traffic noise and visitor movement can make cats defensive. Tell us if your cat has previous grooming stress or matting near the belly and tail.',
      mobileGrooming: 'Home grooming in Marathahalli avoids bridge traffic and keeps post-bath pets from sitting in cabs or autos after a session.',
      apartmentAccess: 'For addresses near Marathahalli Bridge, Spice Garden or Munnekolala, add landmark details and parking notes to reduce coordination calls.',
      localCoverage: 'Marathahalli coverage is pincode-aware for 560037, with nearby matching for Brookefield, Doddanekkundi, Kundalahalli, Bellandur and HAL.',
      packageFit: 'Fur Bath Care is popular after dusty road walks, while Fur Makeover and Essential Grooming suit dogs needing paw hair cleaning, de-matting or haircut maintenance.',
    },
  },
  {
    slug: 'mahadevapura',
    name: 'Mahadevapura',
    region: 'Eastern Bengaluru',
    pincodes: ['560048'],
    nearbyAreas: ['Whitefield', 'Hoodi', 'K. R. Puram', 'Doddanekkundi', 'Brookefield'],
    landmarks: ['Phoenix Marketcity', 'Outer Ring Road', 'Mahadevapura Flyover', 'VR Bengaluru', 'Garudachar Palya'],
    content: {
      dogGrooming: 'Dog grooming in Mahadevapura is useful for pets living between mall traffic, ORR apartments and Whitefield connector roads. Full grooming helps manage dust, coat odour and paw hygiene after regular walks.',
      catGrooming: 'Cat grooming around Mahadevapura should be confirmed with temperament and carrier notes, especially for cats in high-rise homes where visitors and dryers may feel unfamiliar.',
      mobileGrooming: 'Mobile pet grooming in Mahadevapura saves the Phoenix Marketcity and ORR commute while keeping the pet in a known bathroom, balcony or utility setup.',
      apartmentAccess: 'For communities near VR Bengaluru, Garudachar Palya or Mahadevapura Flyover, share gate, tower and parking details before the appointment.',
      localCoverage: 'Mahadevapura coverage is pincode-aware for 560048, with nearby checks for Hoodi, Whitefield, K. R. Puram, Doddanekkundi and Brookefield.',
      packageFit: 'Essential Grooming works well for routine full care, while Complete Care is better for long coats, styling, face trim and advanced paw or nail work.',
    },
  },
  {
    slug: 'hoodi',
    name: 'Hoodi',
    region: 'Eastern Bengaluru',
    pincodes: ['560048'],
    nearbyAreas: ['Whitefield', 'Mahadevapura', 'Brookefield', 'Kundalahalli', 'ITPL'],
    landmarks: ['Hoodi Circle', 'Hoodi Metro', 'Graphite India Road', 'Ayyappa Nagar', 'Phoenix Marketcity'],
    content: {
      dogGrooming: 'Dog grooming in Hoodi often serves pets in dense apartment clusters between Whitefield and Mahadevapura. Dofurs groomers use address notes to plan coat care, bathing and drying in a home setup without salon travel.',
      catGrooming: 'Hoodi cat grooming is confirmed by temperament and setup because drying noise, new people and small bathrooms can affect the session. Share handling limits clearly before the slot.',
      mobileGrooming: 'Doorstep grooming around Hoodi Circle and Graphite India Road helps avoid peak-hour movement toward Whitefield or ORR grooming studios.',
      apartmentAccess: 'For communities near Hoodi Metro, Ayyappa Nagar or Graphite India Road, add tower, gate and parking details in the booking notes.',
      localCoverage: 'Hoodi coverage is pincode-aware for 560048, with nearby support checks for Whitefield, Mahadevapura, Brookefield, Kundalahalli and ITPL.',
      packageFit: 'Monthly Care fits regular hygiene upkeep, while Fur Bath Care and Essential Grooming are useful for dogs that shed heavily after outdoor walks.',
    },
  },
  {
    slug: 'kr-puram',
    name: 'K. R. Puram',
    shortName: 'KR Puram',
    region: 'Eastern Bengaluru',
    aliases: ['KR Puram', 'Krishnarajapuram'],
    pincodes: ['560036', '560016'],
    nearbyAreas: ['Mahadevapura', 'Devasandra', 'Ramamurthy Nagar', 'Dooravani Nagar', 'Hoodi'],
    landmarks: ['K. R. Puram Railway Station', 'Tin Factory', 'Old Madras Road', 'KR Puram Bridge', 'Devasandra'],
    content: {
      dogGrooming: 'Dog grooming in K. R. Puram is often planned around Old Madras Road traffic, railway-station routes and pets that need practical hygiene after dusty walks. Share size and coat condition before choosing a package.',
      catGrooming: 'Cat grooming in KR Puram should be matched to a groomer comfortable with slow handling and limited restraint. Tell us if your cat is new to grooming or has matting behind the legs.',
      mobileGrooming: 'Home grooming in KR Puram helps pet parents avoid crossing Tin Factory or Old Madras Road with an anxious pet.',
      apartmentAccess: 'For homes near KR Puram Railway Station, Devasandra or Tin Factory, add landmark and gate details so the groomer can route correctly.',
      localCoverage: 'K. R. Puram coverage is pincode-aware across 560036 and 560016, with nearby matching for Mahadevapura, Dooravani Nagar, Ramamurthy Nagar, Devasandra and Hoodi.',
      packageFit: 'Fur Bath Care helps with dust and odour, while Essential Grooming is a balanced full session for dogs that need bath, trim, brushing, paw care and nails together.',
    },
  },
  { slug: 'cv-raman-nagar', name: 'C. V. Raman Nagar', region: 'Eastern Bengaluru', aliases: ['CV Raman Nagar'], pincodes: ['560093'], nearbyAreas: ['Indiranagar', 'Kaggadasapura', 'Jeevan Bhima Nagar', 'Old Madras Road'], landmarks: ['Bagmane Tech Park', 'C. V. Raman Nagar Main Road', 'DRDO Township'] },
  {
    slug: 'varthur',
    name: 'Varthur',
    region: 'Eastern Bengaluru',
    pincodes: ['560087'],
    nearbyAreas: ['Whitefield', 'Gunjur', 'Ramagondanahalli', 'Sarjapur Road', 'Kadugodi'],
    landmarks: ['Varthur Lake', 'Varthur Main Road', 'Whitefield Road', 'Gunjur Junction', 'Ramagondanahalli'],
    content: {
      dogGrooming: 'Dog grooming in Varthur is helpful for pets in newer apartment corridors where construction dust, lake-side walks and longer commutes can affect coat hygiene. Share if your dog needs de-shedding or de-matting before bath care.',
      catGrooming: 'Cat grooming in Varthur is handled by appointment fit because some societies are farther from central grooming routes. Tell us about temperament, coat knots and whether bathing is realistic for your cat.',
      mobileGrooming: 'Doorstep grooming around Varthur Main Road and Gunjur reduces long travel toward Whitefield salons and keeps the pet calmer after drying and brushing.',
      apartmentAccess: 'For communities near Varthur Lake, Gunjur Junction or Ramagondanahalli, add exact gate and map pin details before the slot.',
      localCoverage: 'Varthur coverage is pincode-aware for 560087, with nearby checks for Whitefield, Gunjur, Kadugodi, Ramagondanahalli and Sarjapur Road.',
      packageFit: 'Fur Bath Care fits routine dust and odour control, while Complete Care is better for long coats needing haircut, face styling and hygiene trimming.',
    },
  },
  { slug: 'brookefield', name: 'Brookefield', region: 'Eastern Bengaluru', aliases: ['AECS Layout Brookefield'], pincodes: ['560037', '560066'], nearbyAreas: ['Whitefield', 'Kundalahalli', 'Marathahalli', 'Hoodi'], landmarks: ['Brookefield Mall', 'AECS Layout', 'Kundalahalli Gate'] },
  {
    slug: 'kadugodi',
    name: 'Kadugodi',
    region: 'Eastern Bengaluru',
    pincodes: ['560067'],
    nearbyAreas: ['Whitefield', 'Seegehalli', 'Channasandra', 'Hoodi', 'ITPL'],
    landmarks: ['Kadugodi Metro', 'Hope Farm Junction', 'Whitefield Railway Station', 'Channasandra'],
    content: {
      dogGrooming: 'Dog grooming in Kadugodi often supports families near Hope Farm, Whitefield station and newer gated communities. Dofurs confirms package and pincode fit before assigning a groomer for bath care, nails, coat brushing or haircut needs.',
      catGrooming: 'Cat grooming in Kadugodi needs careful confirmation because travel distance and temperament both matter. Share if your cat allows nail trims, brushing or drying before choosing a package.',
      mobileGrooming: 'Mobile pet grooming in Kadugodi helps avoid Whitefield commute pressure and keeps post-grooming pets away from traffic and heat.',
      apartmentAccess: 'For homes near Kadugodi Metro, Hope Farm or Channasandra, include tower, gate, parking and visitor approval instructions in the booking notes.',
      localCoverage: 'Kadugodi coverage is pincode-aware for 560067, with nearby matching for Whitefield, Seegehalli, Channasandra, Hoodi and ITPL when slots are available.',
      packageFit: 'Monthly Care works for regular maintenance, while Fur Bath Care and Essential Grooming are better for pets that need full bath, drying, de-shedding and hygiene care.',
    },
  },
  { slug: 'itpl', name: 'ITPL', region: 'Eastern Bengaluru', aliases: ['International Tech Park Bangalore', 'ITPB'], pincodes: ['560066'], nearbyAreas: ['Whitefield', 'Hoodi', 'Kadugodi', 'Brookefield'], landmarks: ['International Tech Park', 'ITPL Main Road', 'Pattandur Agrahara Metro'] },
  { slug: 'kundalahalli', name: 'Kundalahalli', region: 'Eastern Bengaluru', pincodes: ['560037'], nearbyAreas: ['Brookefield', 'Marathahalli', 'Whitefield', 'Doddanekkundi'], landmarks: ['Kundalahalli Gate', 'AECS Layout', 'Kundalahalli Lake'] },
  { slug: 'doddanekkundi', name: 'Doddanekkundi', region: 'Eastern Bengaluru', pincodes: ['560037'], nearbyAreas: ['Marathahalli', 'Mahadevapura', 'Kaggadasapura', 'Brookefield'], landmarks: ['Doddanekkundi Main Road', 'Outer Ring Road', 'Bagmane World Technology Center'] },
  { slug: 'panathur', name: 'Panathur', region: 'Eastern Bengaluru', pincodes: ['560103'], nearbyAreas: ['Bellandur', 'Varthur', 'Kadubeesanahalli', 'Gunjur'], landmarks: ['Panathur Main Road', 'Kadubeesanahalli', 'Balagere Road'] },
  { slug: 'gunjur', name: 'Gunjur', region: 'Eastern Bengaluru', pincodes: ['560087'], nearbyAreas: ['Varthur', 'Sarjapur Road', 'Whitefield', 'Panathur'], landmarks: ['Gunjur Junction', 'Gunjur Palya', 'Varthur Road'] },
  { slug: 'yemalur', name: 'Yemalur', region: 'Eastern Bengaluru', aliases: ['Yemlur'], pincodes: ['560037'], nearbyAreas: ['Bellandur', 'HAL', 'Old Airport Road', 'Marathahalli'], landmarks: ['Yemalur Main Road', 'HAL Airport Road', 'Bellandur Lake'] },
  { slug: 'hal', name: 'HAL', region: 'Eastern Bengaluru', aliases: ['HAL Airport Area'], pincodes: ['560017'], nearbyAreas: ['Old Airport Road', 'Domlur', 'Indiranagar', 'Yemalur'], landmarks: ['HAL Airport Road', 'HAL Museum', 'Old Airport Road'] },
  { slug: 'hal-2nd-stage', name: 'HAL 2nd Stage', region: 'Eastern Bengaluru', aliases: ['HAL Second Stage'], pincodes: ['560008'], nearbyAreas: ['Indiranagar', 'Domlur', 'Jeevan Bhima Nagar', 'Old Airport Road'], landmarks: ['12th Main', 'CMH Road', 'Defence Colony'] },
  { slug: 'old-airport-road', name: 'Old Airport Road', region: 'Eastern Bengaluru', pincodes: ['560017'], nearbyAreas: ['Domlur', 'HAL', 'Murugeshpalya', 'Indiranagar'], landmarks: ['Old Airport Road', 'Leela Palace', 'HAL Museum'] },
  { slug: 'new-thippasandra', name: 'New Thippasandra', region: 'Eastern Bengaluru', pincodes: ['560075'], nearbyAreas: ['Jeevan Bhima Nagar', 'Indiranagar', 'C. V. Raman Nagar', 'HAL'], landmarks: ['New Thippasandra Main Road', 'HAL Market', 'BEML Gate'] },
  { slug: 'ramagondanahalli', name: 'Ramagondanahalli', region: 'Eastern Bengaluru', pincodes: ['560066'], nearbyAreas: ['Whitefield', 'Varthur', 'Gunjur', 'Nallurhalli'], landmarks: ['Ramagondanahalli Main Road', 'Whitefield Road', 'Nallurhalli'] },
  { slug: 'devasandra', name: 'Devasandra', region: 'Eastern Bengaluru', pincodes: ['560036'], nearbyAreas: ['K. R. Puram', 'Mahadevapura', 'Dooravani Nagar', 'Ayyappa Nagar'], landmarks: ['Devasandra Main Road', 'KR Puram', 'Ayyappa Nagar'] },
  { slug: 'dooravani-nagar', name: 'Dooravani Nagar', region: 'Eastern Bengaluru', pincodes: ['560016'], nearbyAreas: ['K. R. Puram', 'Ramamurthy Nagar', 'Banaswadi', 'Old Madras Road'], landmarks: ['Dooravani Nagar Post Office', 'Old Madras Road', 'Tin Factory'] },
  { slug: 'bhattarahalli', name: 'Bhattarahalli', region: 'Eastern Bengaluru', pincodes: ['560049'], nearbyAreas: ['K. R. Puram', 'Bidrahalli', 'Hoskote Road', 'Avalahalli'], landmarks: ['Bhattarahalli Junction', 'Old Madras Road', 'Hoskote Road'] },
  { slug: 'bidrahalli', name: 'Bidrahalli', region: 'Eastern Bengaluru', pincodes: ['560049'], nearbyAreas: ['Bhattarahalli', 'Hoskote Road', 'Avalahalli', 'K. R. Puram'], landmarks: ['Bidrahalli Main Road', 'Avalahalli', 'Old Madras Road'] },

  { slug: 'banaswadi', name: 'Banaswadi', region: 'North-Eastern Bengaluru', pincodes: ['560043'], nearbyAreas: ['Kalyan Nagar', 'Kammanahalli', 'Ramamurthy Nagar', 'Cox Town'], landmarks: ['Banaswadi Main Road', 'OMBR Layout', 'Banaswadi Railway Station'] },
  { slug: 'hbr-layout', name: 'HBR Layout', region: 'North-Eastern Bengaluru', pincodes: ['560043', '560045'], nearbyAreas: ['Kalyan Nagar', 'Nagavara', 'Kammanahalli', 'Banaswadi'], landmarks: ['HBR Layout BDA Complex', 'Outer Ring Road', 'Nagavara Junction'] },
  { slug: 'horamavu', name: 'Horamavu', region: 'North-Eastern Bengaluru', pincodes: ['560043'], nearbyAreas: ['Ramamurthy Nagar', 'Banaswadi', 'Kalyan Nagar', 'Kalkere'], landmarks: ['Horamavu Main Road', 'Kalkere Lake', 'Banjara Layout'] },
  {
    slug: 'kalyan-nagar',
    name: 'Kalyan Nagar',
    region: 'North-Eastern Bengaluru',
    pincodes: ['560043'],
    nearbyAreas: ['HRBR Layout', 'Kammanahalli', 'Banaswadi', 'HBR Layout', 'Horamavu'],
    landmarks: ['Kalyan Nagar Ring Road', 'HRBR Layout', 'Kammanahalli Main Road', 'Banaswadi'],
    content: {
      dogGrooming: 'Dog grooming in Kalyan Nagar often supports pets in HRBR Layout, HBR Layout and busy cafe streets where outdoor walks can leave paws dusty and coats oily. Share coat length, skin sensitivity and haircut expectations during booking.',
      catGrooming: 'Cat grooming in Kalyan Nagar should be paced around temperament and home noise. If your cat is sensitive to dryers or visitors, request guidance before choosing a bath-heavy service.',
      mobileGrooming: 'Doorstep grooming in Kalyan Nagar keeps pets away from Ring Road traffic and lets the session happen in a familiar corner at home.',
      apartmentAccess: 'For addresses near HRBR Layout, Kammanahalli Main Road or HBR Layout, add gate, block and parking details before the groomer starts the trip.',
      localCoverage: 'Kalyan Nagar coverage is pincode-aware for 560043, with nearby checks for HRBR Layout, Kammanahalli, Banaswadi, HBR Layout and Horamavu.',
      packageFit: 'Monthly Care suits frequent hygiene upkeep, while Essential Grooming and Complete Care fit pets needing bath, de-shedding, trim and styling in one appointment.',
    },
  },
  { slug: 'kammanahalli', name: 'Kammanahalli', region: 'North-Eastern Bengaluru', pincodes: ['560084'], nearbyAreas: ['Kalyan Nagar', 'Lingarajapuram', 'Banaswadi', 'St. Thomas Town'], landmarks: ['Kammanahalli Main Road', 'HRBR Layout', 'Lingarajapuram'] },
  { slug: 'lingarajapuram', name: 'Lingarajapuram', region: 'North-Eastern Bengaluru', pincodes: ['560084'], nearbyAreas: ['Kammanahalli', 'St. Thomas Town', 'Banaswadi', 'Frazer Town'], landmarks: ['Lingarajapuram Flyover', 'St. Thomas Town', 'Cooke Town'] },
  {
    slug: 'ramamurthy-nagar',
    name: 'Ramamurthy Nagar',
    region: 'North-Eastern Bengaluru',
    pincodes: ['560016'],
    nearbyAreas: ['Horamavu', 'Dooravani Nagar', 'K. R. Puram', 'Banaswadi', 'Kalkere'],
    landmarks: ['Ramamurthy Nagar Main Road', 'Kalkere', 'TC Palya', 'Dooravani Nagar'],
    content: {
      dogGrooming: 'Dog grooming in Ramamurthy Nagar is useful for pets around TC Palya, Kalkere and Dooravani Nagar where dust and longer road travel can make salon visits tiring. Share pet size and coat condition for package matching.',
      catGrooming: 'Cat grooming in Ramamurthy Nagar depends on a calm room and careful handling. Mention if your cat resists nail care, has knots near the belly or needs only brushing and hygiene support.',
      mobileGrooming: 'Home grooming around Ramamurthy Nagar avoids Old Madras Road and Horamavu routing stress while keeping your pet close to familiar smells and people.',
      apartmentAccess: 'For homes near Ramamurthy Nagar Main Road, TC Palya or Kalkere, include exact landmarks because lanes and apartment names can be similar.',
      localCoverage: 'Ramamurthy Nagar coverage is pincode-aware for 560016, with nearby matching for Horamavu, Dooravani Nagar, K. R. Puram, Banaswadi and Kalkere.',
      packageFit: 'Fur Bath Care handles odour and dust, while Essential Grooming is better when the pet also needs paw hair, nails, de-shedding and hygiene trimming.',
    },
  },
  { slug: 'nagavara', name: 'Nagavara', region: 'North-Eastern Bengaluru', pincodes: ['560045'], nearbyAreas: ['HBR Layout', 'Manyata Tech Park', 'Hebbal', 'Thanisandra'], landmarks: ['Manyata Tech Park', 'Nagavara Lake', 'Outer Ring Road'] },
  { slug: 'kacharakanahalli', name: 'Kacharakanahalli', region: 'North-Eastern Bengaluru', pincodes: ['560084'], nearbyAreas: ['Kammanahalli', 'HBR Layout', 'St. Thomas Town', 'Banaswadi'], landmarks: ['Kacharakanahalli Main Road', 'Hennur Main Road', 'Kammanahalli'] },
  { slug: 'st-thomas-town', name: 'St. Thomas Town', region: 'North-Eastern Bengaluru', pincodes: ['560084'], nearbyAreas: ['Kammanahalli', 'Lingarajapuram', 'Banaswadi', 'Cooke Town'], landmarks: ['St. Thomas Town Church', 'Lingarajapuram', 'Kammanahalli'] },
  { slug: 'venkateshapura', name: 'Venkateshapura', region: 'North-Eastern Bengaluru', pincodes: ['560045'], nearbyAreas: ['Nagavara', 'HBR Layout', 'Arabic College', 'Thanisandra'], landmarks: ['Venkateshapura Main Road', 'Arabic College', 'Nagavara'] },

  {
    slug: 'hebbal',
    name: 'Hebbal',
    region: 'Northern Bengaluru',
    pincodes: ['560024'],
    nearbyAreas: ['Hebbal Kempapura', 'Nagavara', 'Sahakara Nagar', 'R. T. Nagar', 'Jakkur'],
    landmarks: ['Hebbal Flyover', 'Hebbal Lake', 'Manyata Tech Park', 'Kempapura', 'Outer Ring Road'],
    content: {
      dogGrooming: 'Dog grooming in Hebbal often serves pets in high-rise homes and lake-side walking routes where dust, shedding and paw hygiene need regular attention. Share if your dog is nervous around dryers or needs extra de-shedding.',
      catGrooming: 'Cat grooming in Hebbal should be confirmed with temperament notes, especially in homes near busy flyover traffic where noise can make cats less cooperative.',
      mobileGrooming: 'Doorstep grooming in Hebbal saves travel across the flyover or ORR and keeps senior pets from long car rides before and after grooming.',
      apartmentAccess: 'For homes near Hebbal Flyover, Kempapura or Manyata-side routes, share tower, gate, parking and map pin details.',
      localCoverage: 'Hebbal coverage is pincode-aware for 560024, with nearby matching for Hebbal Kempapura, Nagavara, Sahakara Nagar, R. T. Nagar and Jakkur.',
      packageFit: 'Monthly Care suits regular nail and paw upkeep, while Essential Grooming and Complete Care support full bath, coat care, trims and styling.',
    },
  },
  { slug: 'hebbal-kempapura', name: 'Hebbal Kempapura', region: 'Northern Bengaluru', pincodes: ['560024'], nearbyAreas: ['Hebbal', 'Sahakara Nagar', 'Nagavara', 'Jakkur'], landmarks: ['Kempapura Main Road', 'Hebbal Flyover', 'Esteem Mall'] },
  { slug: 'jalahalli', name: 'Jalahalli', region: 'Northern Bengaluru', pincodes: ['560013'], nearbyAreas: ['Peenya', 'Mathikere', 'Vidyaranyapura', 'Yeshwanthpur'], landmarks: ['Jalahalli Cross', 'BEL Circle', 'Air Force Station'] },
  { slug: 'mathikere', name: 'Mathikere', region: 'Northern Bengaluru', pincodes: ['560054'], nearbyAreas: ['Yeshwanthpur', 'Jalahalli', 'Sanjay Nagar', 'GKVK'], landmarks: ['MS Ramaiah College', 'Mathikere Main Road', 'BEL Road'] },
  { slug: 'peenya', name: 'Peenya', region: 'Northern Bengaluru', pincodes: ['560058'], nearbyAreas: ['Jalahalli', 'Nagasandra', 'Yeshwanthpur', 'Dasarahalli'], landmarks: ['Peenya Industrial Area', 'Peenya Metro', 'Tumkur Road'] },
  { slug: 'vidyaranyapura', name: 'Vidyaranyapura', region: 'Northern Bengaluru', pincodes: ['560097'], nearbyAreas: ['Yelahanka', 'Jalahalli', 'Doddabommasandra', 'Sahakara Nagar'], landmarks: ['Vidyaranyapura Main Road', 'Doddabommasandra', 'BEL Layout'] },
  {
    slug: 'yelahanka',
    name: 'Yelahanka',
    region: 'Northern Bengaluru',
    pincodes: ['560064', '560063'],
    nearbyAreas: ['Jakkur', 'Attur', 'Vidyaranyapura', 'Sahakara Nagar', 'Bagalur'],
    landmarks: ['Yelahanka New Town', 'Yelahanka Railway Station', 'Allalasandra Lake', 'Jakkur Aerodrome', 'Attur Layout'],
    content: {
      dogGrooming: 'Dog grooming in Yelahanka often supports larger homes, gated communities and pets that spend time around lake-side or open walking routes. Share coat thickness, tick concerns and drying tolerance before choosing the package.',
      catGrooming: 'Cat grooming in Yelahanka should be booked with calm handling expectations because some addresses are farther from central routes. A simple brush, nail and hygiene session may be better than a full bath for first-time cats.',
      mobileGrooming: 'Home grooming in Yelahanka reduces long travel toward central Bengaluru salons and is useful for pets who get carsick or anxious on airport-road stretches.',
      apartmentAccess: 'For Yelahanka New Town, Attur, Allalasandra or Jakkur-side communities, add gate, tower and landmark notes before the groomer is assigned.',
      localCoverage: 'Yelahanka coverage is pincode-aware across 560064 and 560063, with nearby checks for Jakkur, Attur, Vidyaranyapura, Sahakara Nagar and Bagalur.',
      packageFit: 'Fur Bath Care works for dust and seasonal shedding, while Complete Care suits long-coated pets needing a haircut, face trim and fuller styling.',
    },
  },
  { slug: 'yeshwanthpur', name: 'Yeshwanthpur', region: 'Northern Bengaluru', aliases: ['Yeswanthpur'], pincodes: ['560022'], nearbyAreas: ['Mathikere', 'Malleshwaram', 'Rajajinagar', 'Goraguntepalya'], landmarks: ['Yeshwanthpur Railway Station', 'Orion Mall', 'Tumkur Road'] },
  { slug: 'amruthahalli', name: 'Amruthahalli', region: 'Northern Bengaluru', pincodes: ['560092'], nearbyAreas: ['Jakkur', 'Sahakara Nagar', 'Hebbal', 'Kodigehalli'], landmarks: ['Amruthahalli Main Road', 'Jakkur Road', 'Sahakara Nagar'] },
  { slug: 'anand-nagar', name: 'Anand Nagar', region: 'Northern Bengaluru', pincodes: ['560024'], nearbyAreas: ['Hebbal', 'R. T. Nagar', 'Sahakara Nagar', 'Kempapura'], landmarks: ['Anand Nagar Main Road', 'Hebbal', 'Bangalore Baptist Hospital'] },
  { slug: 'attur', name: 'Attur', region: 'Northern Bengaluru', pincodes: ['560064'], nearbyAreas: ['Yelahanka', 'Jakkur', 'Allalasandra', 'Bagalur'], landmarks: ['Attur Layout', 'Attur Lake', 'Yelahanka New Town'] },
  { slug: 'bagalgunte', name: 'Bagalgunte', region: 'Northern Bengaluru', pincodes: ['560073'], nearbyAreas: ['Nagasandra', 'Peenya', 'Dasarahalli', 'Tumkur Road'], landmarks: ['Bagalgunte Main Road', 'Nagasandra Metro', 'Tumkur Road'] },
  { slug: 'chikkabettahalli', name: 'Chikkabettahalli', region: 'Northern Bengaluru', pincodes: ['560097'], nearbyAreas: ['Vidyaranyapura', 'Yelahanka', 'Doddabommasandra', 'Jalahalli'], landmarks: ['Chikkabettahalli Main Road', 'Vidyaranyapura', 'Doddabommasandra'] },
  { slug: 'chikkajala', name: 'Chikkajala', region: 'Northern Bengaluru', pincodes: ['562157'], nearbyAreas: ['Doddajala', 'Bagalur', 'Devanahalli', 'Yelahanka'], landmarks: ['Chikkajala', 'Airport Road', 'Kempegowda International Airport Road'], coverageTier: 'confirm' },
  { slug: 'doddajala', name: 'Doddajala', region: 'Northern Bengaluru', pincodes: ['562157'], nearbyAreas: ['Chikkajala', 'Devanahalli', 'Bagalur', 'Yelahanka'], landmarks: ['Doddajala', 'Airport Road', 'Doddajala Railway Station'], coverageTier: 'confirm' },
  { slug: 'jakkur', name: 'Jakkur', region: 'Northern Bengaluru', pincodes: ['560064'], nearbyAreas: ['Hebbal', 'Yelahanka', 'Amruthahalli', 'Sahakara Nagar'], landmarks: ['Jakkur Aerodrome', 'Jakkur Lake', 'Jakkur Main Road'] },
  { slug: 'kodigehalli', name: 'Kodigehalli', region: 'Northern Bengaluru', pincodes: ['560092', '560097'], nearbyAreas: ['Sahakara Nagar', 'Vidyaranyapura', 'Hebbal', 'Jakkur'], landmarks: ['Kodigehalli Gate', 'Sahakara Nagar', 'BEL Road'] },
  { slug: 'sahakara-nagar', name: 'Sahakara Nagar', region: 'Northern Bengaluru', pincodes: ['560092'], nearbyAreas: ['Hebbal', 'Jakkur', 'Kodigehalli', 'Amruthahalli'], landmarks: ['Sahakara Nagar Main Road', 'CQAL Layout', 'Kodigehalli Gate'] },
  { slug: 'rmv-extension', name: 'R. M. V. Extension', region: 'Northern Bengaluru', aliases: ['RMV Extension'], pincodes: ['560080', '560094'], nearbyAreas: ['Sadashivanagar', 'Sanjay Nagar', 'Dollars Colony', 'Hebbal'], landmarks: ['Dollars Colony', 'New BEL Road', 'Sanjay Nagar'] },
  { slug: 'gkvk', name: 'GKVK', region: 'Northern Bengaluru', aliases: ['University of Agricultural Sciences Bengaluru'], pincodes: ['560065'], nearbyAreas: ['Yelahanka', 'Jakkur', 'Sahakara Nagar', 'Kodigehalli'], landmarks: ['GKVK Campus', 'UAS Bengaluru', 'Bellary Road'] },
  { slug: 'nagasandra', name: 'Nagasandra', region: 'Northern Bengaluru', pincodes: ['560073'], nearbyAreas: ['Peenya', 'Bagalgunte', 'Dasarahalli', 'Tumkur Road'], landmarks: ['Nagasandra Metro', 'Tumkur Road', 'IKEA Nagasandra'] },
  { slug: 'hmt', name: 'HMT', region: 'Northern Bengaluru', aliases: ['HMT Layout'], pincodes: ['560013'], nearbyAreas: ['Jalahalli', 'Mathikere', 'Yeshwanthpur', 'Peenya'], landmarks: ['HMT Factory', 'Jalahalli', 'BEL Circle'] },
  { slug: 'goraguntepalya', name: 'Goraguntepalya', region: 'Northern Bengaluru', pincodes: ['560022'], nearbyAreas: ['Yeshwanthpur', 'Peenya', 'Rajajinagar', 'Nagasandra'], landmarks: ['Goraguntepalya Metro', 'Tumkur Road', 'Outer Ring Road'] },
  { slug: 'dasarahalli', name: 'Dasarahalli', region: 'Northern Bengaluru', aliases: ['T. Dasarahalli'], pincodes: ['560057'], nearbyAreas: ['Peenya', 'Nagasandra', 'Bagalgunte', 'Jalahalli'], landmarks: ['Dasarahalli Metro', 'Tumkur Road', 'T. Dasarahalli'] },
  { slug: 'bagalur', name: 'Bagalur', region: 'Northern Bengaluru', pincodes: ['562149'], nearbyAreas: ['Yelahanka', 'Doddajala', 'Chikkajala', 'Kannuru'], landmarks: ['Bagalur Main Road', 'Airport Road', 'KIADB Aerospace Park'], coverageTier: 'confirm' },

  {
    slug: 'koramangala',
    name: 'Koramangala',
    region: 'South-Eastern Bengaluru',
    pincodes: ['560034', '560095', '560047'],
    nearbyAreas: ['HSR Layout', 'Adugodi', 'Madiwala', 'BTM Layout', 'Sarjapur Road'],
    landmarks: ['1st Block', '5th Block', '7th Block', '80 Feet Road', 'Sony World Junction', 'Forum Mall'],
    content: {
      dogGrooming: 'Dog grooming in Koramangala often serves active pets around 5th Block, 7th Block and 80 Feet Road where walks, cafes and traffic dust can build up quickly. Share coat type, matting and haircut preferences before booking.',
      catGrooming: 'Cat grooming in Koramangala should be matched carefully because apartments can be compact and weekend noise is common. Share whether your cat tolerates brushing, nail trims and drying.',
      mobileGrooming: 'Doorstep dog grooming in Koramangala keeps pets away from salon queues, parking hunts and busy junctions around Sony World and Forum Mall.',
      apartmentAccess: 'For homes across Koramangala blocks, mention block number, cross road, parking and security instructions so the groomer can arrive without repeated calls.',
      localCoverage: 'Koramangala coverage is pincode-aware across 560034, 560095 and 560047, with nearby matching for HSR Layout, Adugodi, Madiwala, BTM Layout and Sarjapur Road.',
      packageFit: 'Monthly Care supports regular nail and paw upkeep, Fur Makeover fits haircut-focused sessions, and Complete Care suits full styling before events or photo days.',
    },
  },
  {
    slug: 'hsr-layout',
    name: 'HSR Layout',
    shortName: 'HSR',
    region: 'South-Eastern Bengaluru',
    aliases: ['HSR'],
    pincodes: ['560102', '560068'],
    nearbyAreas: ['Koramangala', 'Sarjapur Road', 'BTM Layout', 'Agara', 'Bommanahalli'],
    landmarks: ['27th Main', 'Agara Lake', 'BDA Complex', 'Sector 1', 'Sector 2', 'Sector 7'],
    content: {
      dogGrooming: 'Dog grooming in HSR Layout often supports pets that walk near Agara Lake, 27th Main and sector parks. Dofurs confirms package fit for de-shedding, paw cleaning, bath care, nail work and full grooming based on coat condition.',
      catGrooming: 'Cat grooming in HSR Layout is best planned in quieter weekday windows. Tell us if your cat is used to grooming, has knots under the belly or needs only nail and brushing support.',
      mobileGrooming: 'Home pet grooming in HSR Layout saves pet parents from crossing Silk Board, Agara and Koramangala traffic with an anxious pet.',
      apartmentAccess: 'For HSR sectors and gated communities, add sector, cross road, tower, parking and service-lift notes in the booking flow.',
      localCoverage: 'HSR Layout coverage is pincode-aware across 560102 and 560068, with nearby checks for Koramangala, Sarjapur Road, BTM Layout, Agara and Bommanahalli.',
      packageFit: 'Fur Bath Care helps after lake-side or park walks, Essential Grooming is the routine full-care choice, and Complete Care fits heavier coats or styling requests.',
    },
  },
  {
    slug: 'btm-layout',
    name: 'BTM Layout',
    shortName: 'BTM',
    region: 'South-Eastern Bengaluru',
    aliases: ['BTM'],
    pincodes: ['560076', '560068'],
    nearbyAreas: ['Jayanagar', 'JP Nagar', 'Madiwala', 'HSR Layout', 'Bommanahalli'],
    landmarks: ['BTM 2nd Stage', 'Udupi Garden', 'Madiwala Lake', 'Silk Board', 'Bannerghatta Road'],
    content: {
      dogGrooming: 'Dog grooming in BTM Layout is useful for pets moving between busy residential lanes, Silk Board traffic and park walks. Share coat and temperament details so Dofurs can match bath care, de-shedding or haircut needs.',
      catGrooming: 'Cat grooming in BTM works best when the room is quiet and the cat has time to settle. If your cat is new to grooming, start with nail, brushing and hygiene expectations before a bath.',
      mobileGrooming: 'Doorstep grooming in BTM Layout avoids the Silk Board and Madiwala commute and lets the pet recover at home after drying and brushing.',
      apartmentAccess: 'For BTM 1st and 2nd Stage apartments, include cross road, landmark and parking notes so routing is clear.',
      localCoverage: 'BTM Layout coverage is pincode-aware across 560076 and 560068, with nearby matching for Jayanagar, JP Nagar, Madiwala, HSR Layout and Bommanahalli.',
      packageFit: 'Monthly Care is useful between full sessions, while Fur Makeover and Essential Grooming suit pets needing trims, paw cleaning and bath care together.',
    },
  },
  { slug: 'bommanahalli', name: 'Bommanahalli', region: 'South-Eastern Bengaluru', pincodes: ['560068'], nearbyAreas: ['HSR Layout', 'BTM Layout', 'Hongasandra', 'Begur', 'Electronic City'], landmarks: ['Bommanahalli Junction', 'Hosur Road', 'Begur Road'] },
  { slug: 'bommasandra', name: 'Bommasandra', region: 'South-Eastern Bengaluru', pincodes: ['560099'], nearbyAreas: ['Electronic City', 'Chandapura', 'Attibele', 'Hebbagodi'], landmarks: ['Bommasandra Industrial Area', 'Hosur Road', 'Hebbagodi'], coverageTier: 'confirm' },
  {
    slug: 'electronic-city',
    name: 'Electronic City',
    region: 'South-Eastern Bengaluru',
    aliases: ['E City', 'Electronics City'],
    pincodes: ['560100', '560099'],
    nearbyAreas: ['Bommasandra', 'Hosa Road', 'Singasandra', 'Chandapura', 'Begur'],
    landmarks: ['Phase 1', 'Phase 2', 'Neeladri Road', 'Infosys', 'Wipro Gate', 'Hosur Road'],
    content: {
      dogGrooming: 'Dog grooming in Electronic City often serves pets in Phase 1, Phase 2 and Neeladri Road apartments where long commutes make salon visits hard. Share coat type, pet size and society access before choosing bath care or full grooming.',
      catGrooming: 'Cat grooming in Electronic City should be confirmed with temperament notes and distance-aware slot matching. Cats who dislike travel often do better with a home visit and a calm room.',
      mobileGrooming: 'Mobile dog grooming in Electronic City keeps pets away from Hosur Road travel and post-grooming cab rides, especially after bath and drying sessions.',
      apartmentAccess: 'For tech-park apartments and villas near Infosys, Wipro Gate or Neeladri Road, add visitor approval and gate instructions before the slot.',
      localCoverage: 'Electronic City coverage is pincode-aware across 560100 and 560099, with nearby matching for Bommasandra, Hosa Road, Singasandra, Chandapura and Begur.',
      packageFit: 'Fur Bath Care handles dust and odour, Essential Grooming is a balanced routine package, and Complete Care suits long-coated pets needing haircut and styling.',
    },
  },
  { slug: 'madiwala', name: 'Madiwala', region: 'South-Eastern Bengaluru', pincodes: ['560068'], nearbyAreas: ['Koramangala', 'BTM Layout', 'Silk Board', 'Adugodi'], landmarks: ['Madiwala Lake', 'Silk Board', 'Hosur Road'] },
  { slug: 'adugodi', name: 'Adugodi', region: 'South-Eastern Bengaluru', pincodes: ['560030'], nearbyAreas: ['Koramangala', 'Shanthinagar', 'Austin Town', 'Wilson Garden'], landmarks: ['Adugodi Junction', 'Hosur Road', 'Forum Mall'] },
  { slug: 'agara', name: 'Agara', region: 'South-Eastern Bengaluru', pincodes: ['560102'], nearbyAreas: ['HSR Layout', 'Bellandur', 'Sarjapur Road', 'Koramangala'], landmarks: ['Agara Lake', 'Agara Flyover', 'Outer Ring Road'] },
  { slug: 'hosur-road', name: 'Hosur Road', region: 'South-Eastern Bengaluru', pincodes: ['560068', '560100'], nearbyAreas: ['Electronic City', 'Bommanahalli', 'Adugodi', 'Madiwala'], landmarks: ['Hosur Road', 'Silk Board', 'Elevated Expressway'] },
  { slug: 'hongasandra', name: 'Hongasandra', region: 'South-Eastern Bengaluru', pincodes: ['560068'], nearbyAreas: ['Bommanahalli', 'Begur', 'BTM Layout', 'Kudlu'], landmarks: ['Hongasandra Main Road', 'Begur Road', 'Bommanahalli'] },
  { slug: 'begur', name: 'Begur', region: 'South-Eastern Bengaluru', pincodes: ['560068', '560076'], nearbyAreas: ['Bommanahalli', 'Electronic City', 'Hongasandra', 'Hulimavu'], landmarks: ['Begur Road', 'Begur Lake', 'Begur Fort'] },
  { slug: 'singasandra', name: 'Singasandra', region: 'South-Eastern Bengaluru', pincodes: ['560068'], nearbyAreas: ['Electronic City', 'Hosa Road', 'Bommanahalli', 'Begur'], landmarks: ['Singasandra Metro', 'Hosur Road', 'Hosa Road'] },
  { slug: 'chandapura', name: 'Chandapura', region: 'South-Eastern Bengaluru', pincodes: ['560099', '562107'], nearbyAreas: ['Electronic City', 'Bommasandra', 'Attibele', 'Anekal'], landmarks: ['Chandapura Circle', 'Hosur Road', 'Chandapura Market'], coverageTier: 'confirm' },
  { slug: 'jigani', name: 'Jigani', region: 'South-Eastern Bengaluru', pincodes: ['560105'], nearbyAreas: ['Anekal', 'Bannerghatta', 'Bommasandra', 'Electronic City'], landmarks: ['Jigani Industrial Area', 'Bannerghatta Road', 'Anekal Road'], coverageTier: 'confirm' },
  { slug: 'muthanallur', name: 'Muthanallur', region: 'South-Eastern Bengaluru', pincodes: ['562125'], nearbyAreas: ['Sarjapura', 'Gunjur', 'Chandapura', 'Anekal'], landmarks: ['Muthanallur Cross', 'Sarjapur Road', 'Dommasandra'], coverageTier: 'confirm' },
  {
    slug: 'sarjapur-road',
    name: 'Sarjapur Road',
    region: 'South-Eastern Bengaluru',
    pincodes: ['560035', '560103', '562125'],
    nearbyAreas: ['HSR Layout', 'Bellandur', 'Gunjur', 'Dommasandra', 'Sarjapura'],
    landmarks: ['Wipro Corporate Office', 'Kaikondrahalli', 'Doddakannelli', 'Dommasandra', 'Carmelaram'],
    content: {
      dogGrooming: 'Dog grooming on Sarjapur Road often serves pets in long residential stretches where travel time varies sharply by hour. Share exact pincode, apartment gate and coat condition so the slot can be matched realistically.',
      catGrooming: 'Cat grooming near Sarjapur Road should be confirmed with temperament and distance in mind. Cats who dislike visitors may need a lighter hygiene-focused plan before any bath or drying step.',
      mobileGrooming: 'Home pet grooming on Sarjapur Road reduces travel toward HSR, Bellandur or Whitefield salons and keeps pets comfortable after bath, brushing and trimming.',
      apartmentAccess: 'For communities near Wipro, Kaikondrahalli, Doddakannelli or Dommasandra, add gate, tower, parking and visitor approval instructions.',
      localCoverage: 'Sarjapur Road coverage is pincode-aware across 560035, 560103 and 562125, with availability depending on the exact stretch, groomer route and package duration.',
      packageFit: 'Fur Bath Care is useful after muddy or dusty walks, Essential Grooming fits routine full care, and Complete Care is best for haircut plus styling needs.',
    },
  },
  { slug: 'sarjapura', name: 'Sarjapura', region: 'South-Eastern Bengaluru', aliases: ['Sarjapur Town'], pincodes: ['562125'], nearbyAreas: ['Sarjapur Road', 'Dommasandra', 'Muthanallur', 'Anekal'], landmarks: ['Sarjapura Town', 'NH 648', 'Dommasandra'], coverageTier: 'confirm' },

  {
    slug: 'jayanagar',
    name: 'Jayanagar',
    region: 'Southern Bengaluru',
    pincodes: ['560041', '560011', '560069', '560070'],
    nearbyAreas: ['JP Nagar', 'Basavanagudi', 'Banashankari', 'BTM Layout', 'Wilson Garden'],
    landmarks: ['4th Block', '8th Block', 'Jayanagar Shopping Complex', 'Madhavan Park', 'South End Circle'],
    content: {
      dogGrooming: 'Dog grooming in Jayanagar is often chosen for senior pets, family dogs and multi-pet homes that do better in familiar surroundings. Share coat, age and handling notes for bath care, de-shedding, nails and hygiene trims.',
      catGrooming: 'Cat grooming in Jayanagar works best when household movement is controlled and the cat has time to settle. Share whether your cat accepts brushing or nail care before adding bath expectations.',
      mobileGrooming: 'Doorstep grooming in Jayanagar avoids 4th Block traffic, parking pressure and salon waiting time while keeping pets close to home.',
      apartmentAccess: 'For homes near 4th Block, 8th Block or South End Circle, add cross road, floor and parking instructions before the appointment.',
      localCoverage: 'Jayanagar coverage is pincode-aware across 560041, 560011, 560069 and 560070, with nearby matching for JP Nagar, Basavanagudi, Banashankari, BTM Layout and Wilson Garden.',
      packageFit: 'Monthly Care is useful between full sessions, Essential Grooming suits routine full care, and Complete Care works well for long coats or special styling requests.',
    },
  },
  {
    slug: 'jp-nagar',
    name: 'JP Nagar',
    region: 'Southern Bengaluru',
    aliases: ['J. P. Nagar', 'Jayaprakash Narayan Nagar'],
    pincodes: ['560078', '560076', '560069'],
    nearbyAreas: ['Jayanagar', 'Bannerghatta Road', 'BTM Layout', 'Banashankari', 'Arekere'],
    landmarks: ['JP Nagar 6th Phase', 'JP Nagar 7th Phase', 'Puttenahalli Lake', 'Brigade Millennium', 'RBI Layout'],
    content: {
      dogGrooming: 'Dog grooming in JP Nagar often serves pets across multiple phases, where exact phase and cross-road details matter. Share coat length, shedding and preferred haircut style before booking.',
      catGrooming: 'Cat grooming in JP Nagar should be planned gently, especially for cats in high-rise homes or multi-pet households. Share whether your cat can tolerate brushing, nails and drying.',
      mobileGrooming: 'Home grooming in JP Nagar saves travel toward Bannerghatta Road or Jayanagar salons and keeps the pet calmer before and after the session.',
      apartmentAccess: 'For JP Nagar phases, RBI Layout or Brigade Millennium-side homes, include phase, block, gate and parking details.',
      localCoverage: 'JP Nagar coverage is pincode-aware across 560078, 560076 and 560069, with nearby checks for Jayanagar, Bannerghatta Road, BTM Layout, Banashankari and Arekere.',
      packageFit: 'Fur Makeover works for trim-focused sessions, Essential Grooming is the full routine choice, and Complete Care fits styling plus hygiene needs.',
    },
  },
  {
    slug: 'banashankari',
    name: 'Banashankari',
    shortName: 'BSK',
    region: 'Southern Bengaluru',
    aliases: ['BSK', 'Banashankari 2nd Stage', 'Banashankari 3rd Stage'],
    pincodes: ['560050', '560085', '560070'],
    nearbyAreas: ['Jayanagar', 'Basavanagudi', 'JP Nagar', 'Padmanabhanagar', 'Kathriguppe'],
    landmarks: ['Banashankari Temple', 'Banashankari BDA Complex', 'Kathriguppe', 'Devegowda Petrol Bunk', 'Outer Ring Road'],
    content: {
      dogGrooming: 'Dog grooming in Banashankari varies by stage, apartment type and road access. Share stage, cross road and pet coat condition so Dofurs can match bath care, paw work, de-shedding or haircut requirements.',
      catGrooming: 'Cat grooming in Banashankari should be booked with temperament notes and a calm room ready. If your cat hides from visitors, mention that before choosing a bath package.',
      mobileGrooming: 'Doorstep grooming in Banashankari avoids stage-to-stage traffic and lets pets stay home after drying, nail care and coat brushing.',
      apartmentAccess: 'For homes near Kathriguppe, BDA Complex, Devegowda Petrol Bunk or Outer Ring Road, share exact landmark and parking instructions.',
      localCoverage: 'Banashankari coverage is pincode-aware across 560050, 560085 and 560070, with nearby matching for Jayanagar, Basavanagudi, JP Nagar, Padmanabhanagar and Kathriguppe.',
      packageFit: 'Monthly Care handles regular upkeep, Fur Bath Care suits dusty walks, and Complete Care is better for full styling or longer coats.',
    },
  },
  {
    slug: 'basavanagudi',
    name: 'Basavanagudi',
    region: 'Southern Bengaluru',
    pincodes: ['560004', '560019'],
    nearbyAreas: ['Jayanagar', 'Banashankari', 'Chamrajpet', 'Girinagar', 'Lalbagh'],
    landmarks: ['Bull Temple', 'Gandhi Bazaar', 'National College', 'Lalbagh West Gate', 'DVG Road'],
    content: {
      dogGrooming: 'Dog grooming in Basavanagudi is useful for pets around older homes, traditional streets and Gandhi Bazaar walks where dust and heat can affect coat comfort. Share age, skin sensitivity and coat length before booking.',
      catGrooming: 'Cat grooming in Basavanagudi works best in a calm indoor room away from household activity. Share if your cat is senior, skittish or only comfortable with brushing and nails.',
      mobileGrooming: 'Home pet grooming in Basavanagudi avoids parking pressure near Gandhi Bazaar, DVG Road and Lalbagh-side routes.',
      apartmentAccess: 'For homes near Bull Temple, National College or DVG Road, mention lane width, parking and whether the groomer should carry a compact setup.',
      localCoverage: 'Basavanagudi coverage is pincode-aware across 560004 and 560019, with nearby matching for Jayanagar, Banashankari, Chamrajpet, Girinagar and Lalbagh.',
      packageFit: 'Monthly Care suits regular hygiene, Fur Bath Care helps after dusty market walks, and Essential Grooming covers bath, trim, paws and nails together.',
    },
  },
  { slug: 'girinagar', name: 'Girinagar', region: 'Southern Bengaluru', pincodes: ['560085'], nearbyAreas: ['Banashankari', 'Basavanagudi', 'Hosakerehalli', 'Vijayanagar'], landmarks: ['Girinagar Main Road', 'Avalahalli BDA Park', 'BSK 3rd Stage'] },
  { slug: 'kumaraswamy-layout', name: 'Kumaraswamy Layout', region: 'Southern Bengaluru', pincodes: ['560078'], nearbyAreas: ['JP Nagar', 'Padmanabhanagar', 'Yelachenahalli', 'Uttarahalli'], landmarks: ['Kumaraswamy Layout Main Road', 'Dayananda Sagar College', 'Yelachenahalli Metro'] },
  { slug: 'padmanabhanagar', name: 'Padmanabhanagar', region: 'Southern Bengaluru', pincodes: ['560070'], nearbyAreas: ['Banashankari', 'Uttarahalli', 'Kumaraswamy Layout', 'Chikkalasandra'], landmarks: ['Padmanabhanagar Main Road', 'Devegowda Petrol Bunk', 'Kathriguppe'] },
  { slug: 'uttarahalli', name: 'Uttarahalli', region: 'Southern Bengaluru', pincodes: ['560061'], nearbyAreas: ['Padmanabhanagar', 'Chikkalasandra', 'Subramanyapura', 'Kengeri'], landmarks: ['Uttarahalli Main Road', 'Subramanyapura Road', 'Chikkalasandra'] },
  { slug: 'chikkalasandra', name: 'Chikkalasandra', region: 'Southern Bengaluru', pincodes: ['560061'], nearbyAreas: ['Uttarahalli', 'Padmanabhanagar', 'Subramanyapura', 'Banashankari'], landmarks: ['Chikkalasandra Main Road', 'Uttarahalli Main Road', 'Padmanabhanagar'] },
  { slug: 'doddakallasandra', name: 'Doddakallasandra', region: 'Southern Bengaluru', pincodes: ['560062'], nearbyAreas: ['Konanakunte', 'Kanakapura Road', 'Yelachenahalli', 'Subramanyapura'], landmarks: ['Doddakallasandra Metro', 'Kanakapura Road', 'Konanakunte Cross'] },
  { slug: 'konanakunte', name: 'Konanakunte', region: 'Southern Bengaluru', pincodes: ['560062'], nearbyAreas: ['Doddakallasandra', 'JP Nagar', 'Kanakapura Road', 'Yelachenahalli'], landmarks: ['Konanakunte Cross', 'Kanakapura Road', 'Forum South Bengaluru'] },
  { slug: 'subramanyapura', name: 'Subramanyapura', region: 'Southern Bengaluru', pincodes: ['560061'], nearbyAreas: ['Uttarahalli', 'Vasanthapura', 'Chikkalasandra', 'Konanakunte'], landmarks: ['Subramanyapura Main Road', 'Uttarahalli', 'Vasanthapura'] },
  { slug: 'yelachenahalli', name: 'Yelachenahalli', region: 'Southern Bengaluru', pincodes: ['560078'], nearbyAreas: ['Kumaraswamy Layout', 'JP Nagar', 'Kanakapura Road', 'Konanakunte'], landmarks: ['Yelachenahalli Metro', 'Kanakapura Road', 'Kumaraswamy Layout'] },
  { slug: 'yediyur', name: 'Yediyur', region: 'Southern Bengaluru', pincodes: ['560070'], nearbyAreas: ['Jayanagar', 'Basavanagudi', 'Banashankari', 'South End Circle'], landmarks: ['Yediyur Lake', 'South End Circle', 'Jayanagar 7th Block'] },
  { slug: 'tilak-nagar', name: 'Tilak Nagar', region: 'Southern Bengaluru', pincodes: ['560041'], nearbyAreas: ['Jayanagar', 'BTM Layout', 'Wilson Garden', 'Gurappanapalya'], landmarks: ['Tilak Nagar Main Road', 'Jayanagar', 'Bannerghatta Road'] },
  { slug: 'thyagaraja-nagar', name: 'Thyagaraja Nagar', region: 'Southern Bengaluru', pincodes: ['560028'], nearbyAreas: ['Basavanagudi', 'Banashankari', 'Jayanagar', 'NR Colony'], landmarks: ['Thyagaraja Nagar Main Road', 'NR Colony', 'Gandhi Bazaar'] },
  { slug: 'banashankari-2nd-stage', name: 'Banashankari 2nd Stage', region: 'Southern Bengaluru', aliases: ['BSK 2nd Stage'], pincodes: ['560070'], nearbyAreas: ['Banashankari', 'Jayanagar', 'Basavanagudi', 'Kathriguppe'], landmarks: ['Banashankari 2nd Stage', 'BDA Complex', 'Devegowda Petrol Bunk'] },
  { slug: 'banashankari-3rd-stage', name: 'Banashankari 3rd Stage', region: 'Southern Bengaluru', aliases: ['BSK 3rd Stage'], pincodes: ['560085'], nearbyAreas: ['Kathriguppe', 'Girinagar', 'Hosakerehalli', 'Ittamadu'], landmarks: ['Banashankari 3rd Stage', 'Kathriguppe', 'Girinagar'] },
  { slug: 'kathriguppe', name: 'Kathriguppe', region: 'Southern Bengaluru', pincodes: ['560085'], nearbyAreas: ['Banashankari', 'Girinagar', 'Hosakerehalli', 'Ittamadu'], landmarks: ['Kathriguppe Main Road', 'Big Bazaar Kathriguppe', 'BSK 3rd Stage'] },
  { slug: 'hosakerehalli', name: 'Hosakerehalli', region: 'Southern Bengaluru', pincodes: ['560085'], nearbyAreas: ['Banashankari', 'Girinagar', 'Ittamadu', 'Rajarajeshwari Nagar'], landmarks: ['Hosakerehalli Lake', 'Outer Ring Road', 'BSK 3rd Stage'] },
  { slug: 'ittamadu', name: 'Ittamadu', region: 'Southern Bengaluru', pincodes: ['560085'], nearbyAreas: ['Banashankari', 'Kathriguppe', 'Girinagar', 'Padmanabhanagar'], landmarks: ['Ittamadu Main Road', 'Kathriguppe', 'BSK 3rd Stage'] },
  { slug: 'mico-layout', name: 'Mico Layout', region: 'Southern Bengaluru', pincodes: ['560076'], nearbyAreas: ['BTM Layout', 'Bannerghatta Road', 'Jayanagar', 'JP Nagar'], landmarks: ['Mico Layout Main Road', 'BTM 2nd Stage', 'Bannerghatta Road'] },

  { slug: 'anjanapura', name: 'Anjanapura', region: 'Southern Suburbs', pincodes: ['560108'], nearbyAreas: ['JP Nagar', 'Gottigere', 'Konanakunte', 'Bannerghatta Road'], landmarks: ['Anjanapura Township', 'Kanakapura Road', 'Anjanapura Lake'] },
  { slug: 'arekere', name: 'Arekere', region: 'Southern Suburbs', pincodes: ['560076'], nearbyAreas: ['Bannerghatta Road', 'Hulimavu', 'JP Nagar', 'BTM Layout'], landmarks: ['Arekere Gate', 'Bannerghatta Road', 'IIM Bangalore'] },
  { slug: 'hulimavu', name: 'Hulimavu', region: 'Southern Suburbs', pincodes: ['560076'], nearbyAreas: ['Arekere', 'Bannerghatta Road', 'Gottigere', 'Begur'], landmarks: ['Hulimavu Gate', 'Bannerghatta Road', 'Meenakshi Mall'] },
  { slug: 'gottigere', name: 'Gottigere', region: 'Southern Suburbs', pincodes: ['560083'], nearbyAreas: ['Bannerghatta Road', 'Hulimavu', 'Kothnur', 'Anjanapura'], landmarks: ['Gottigere Main Road', 'Bannerghatta Road', 'Nice Road'] },
  { slug: 'kothnur', name: 'Kothnur', region: 'Southern Suburbs', pincodes: ['560077', '560078'], nearbyAreas: ['Gottigere', 'JP Nagar', 'Jambusavari Dinne', 'Bannerghatta Road'], landmarks: ['Kothnur Main Road', 'Jambusavari Dinne', 'Gottigere'] },
  { slug: 'bannerghatta', name: 'Bannerghatta', region: 'Southern Suburbs', pincodes: ['560083'], nearbyAreas: ['Gottigere', 'Jigani', 'Bannerghatta Road', 'Anekal'], landmarks: ['Bannerghatta National Park Road', 'Bannerghatta Town', 'Jigani Road'], coverageTier: 'confirm' },
  {
    slug: 'bannerghatta-road',
    name: 'Bannerghatta Road',
    region: 'Southern Suburbs',
    pincodes: ['560076', '560083'],
    nearbyAreas: ['JP Nagar', 'Arekere', 'Hulimavu', 'Gottigere', 'BTM Layout'],
    landmarks: ['IIM Bangalore', 'Apollo Hospital', 'Meenakshi Mall', 'Arekere Gate', 'Hulimavu Gate'],
    content: {
      dogGrooming: 'Dog grooming on Bannerghatta Road often serves pets across JP Nagar, Arekere, Hulimavu and Gottigere stretches where exact location changes travel time. Share coat, pet size and pincode before selecting full grooming.',
      catGrooming: 'Cat grooming around Bannerghatta Road depends on temperament and home setup. A calm room and clear handling notes are important before bath, drying or de-matting steps.',
      mobileGrooming: 'Home grooming on Bannerghatta Road reduces long travel through busy hospital, mall and IIM-side traffic and keeps pets settled after grooming.',
      apartmentAccess: 'For homes near IIM Bangalore, Apollo, Meenakshi Mall, Arekere Gate or Hulimavu, add exact gate and parking instructions.',
      localCoverage: 'Bannerghatta Road coverage is pincode-aware across 560076 and 560083, with nearby checks for JP Nagar, Arekere, Hulimavu, Gottigere and BTM Layout.',
      packageFit: 'Fur Bath Care handles dust and odour, Essential Grooming fits regular full care, and Complete Care is best for heavier coat styling.',
    },
  },

  { slug: 'vijayanagar', name: 'Vijayanagar', region: 'Western Bengaluru', pincodes: ['560040'], nearbyAreas: ['Chandra Layout', 'Rajajinagar', 'Magadi Road', 'Nagarbhavi'], landmarks: ['Vijayanagar Metro', 'Chord Road', 'RPC Layout'] },
  {
    slug: 'rajajinagar',
    name: 'Rajajinagar',
    region: 'Western Bengaluru',
    pincodes: ['560010', '560021'],
    nearbyAreas: ['Malleshwaram', 'Yeshwanthpur', 'Basaveshwaranagar', 'Mahalakshmi Layout', 'Vijayanagar'],
    landmarks: ['Rajajinagar Metro', 'Navarang Theatre', 'Orion Mall', 'Dr. Rajkumar Road', 'Chord Road'],
    content: {
      dogGrooming: 'Dog grooming in Rajajinagar often serves pets around Chord Road, Orion Mall and older residential blocks where traffic and parking vary by lane. Share coat condition and building access before booking.',
      catGrooming: 'Cat grooming in Rajajinagar should be kept calm and low-noise, especially in homes with narrow bathrooms or frequent visitors. Mention if your cat is senior or new to grooming.',
      mobileGrooming: 'Home pet grooming in Rajajinagar avoids Chord Road and Malleshwaram-side salon travel while giving pets a familiar place to settle.',
      apartmentAccess: 'For addresses near Navarang, Dr. Rajkumar Road or Orion Mall, add cross road, gate and parking instructions before the appointment.',
      localCoverage: 'Rajajinagar coverage is pincode-aware across 560010 and 560021, with nearby matching for Malleshwaram, Yeshwanthpur, Basaveshwaranagar, Mahalakshmi Layout and Vijayanagar.',
      packageFit: 'Monthly Care supports regular paw and nail care, while Essential Grooming and Complete Care handle full bath, trim, de-shedding and styling.',
    },
  },
  {
    slug: 'rajarajeshwari-nagar',
    name: 'Rajarajeshwari Nagar',
    shortName: 'RR Nagar',
    region: 'Western Bengaluru',
    aliases: ['RR Nagar', 'Raja Rajeshwari Nagar'],
    pincodes: ['560098'],
    nearbyAreas: ['Kengeri', 'Nagarbhavi', 'Ullalu Upanagara', 'Kumbalgodu', 'Hosakerehalli'],
    landmarks: ['Rajarajeshwari Temple', 'Global Village Tech Park', 'RR Nagar Arch', 'Mysore Road', 'BEML Layout'],
    content: {
      dogGrooming: 'Dog grooming in Rajarajeshwari Nagar is useful for pets in larger layouts, villas and apartment communities where travel to central salons can be long. Share coat type, size and grooming history before choosing a package.',
      catGrooming: 'Cat grooming in RR Nagar should be confirmed with temperament and travel-distance considerations. A calm bathroom or utility area makes brushing, nails and hygiene work easier.',
      mobileGrooming: 'Doorstep grooming in RR Nagar helps avoid Mysore Road travel and lets pets rest at home after bath, drying and trimming.',
      apartmentAccess: 'For homes near RR Nagar Arch, Global Village or BEML Layout, add gate, tower, parking and landmark details.',
      localCoverage: 'Rajarajeshwari Nagar coverage is pincode-aware for 560098, with nearby checks for Kengeri, Nagarbhavi, Ullalu Upanagara, Kumbalgodu and Hosakerehalli.',
      packageFit: 'Fur Bath Care fits routine dust control, Essential Grooming is the balanced full package, and Complete Care supports long coats and styling requests.',
    },
  },
  { slug: 'basaveshwaranagar', name: 'Basaveshwaranagar', region: 'Western Bengaluru', pincodes: ['560079'], nearbyAreas: ['Rajajinagar', 'Vijayanagar', 'Mahalakshmi Layout', 'Kamakshipalya'], landmarks: ['Basaveshwaranagar Main Road', 'Shankar Mutt', 'Chord Road'] },
  { slug: 'nagarbhavi', name: 'Nagarbhavi', region: 'Western Bengaluru', pincodes: ['560072'], nearbyAreas: ['Rajarajeshwari Nagar', 'Vijayanagar', 'Kengeri', 'Chandra Layout'], landmarks: ['Nagarbhavi Circle', 'Bangalore University', 'Outer Ring Road'] },
  { slug: 'nayandahalli', name: 'Nayandahalli', region: 'Western Bengaluru', pincodes: ['560039'], nearbyAreas: ['Mysore Road', 'Rajarajeshwari Nagar', 'Kengeri', 'Deepanjali Nagar'], landmarks: ['Nayandahalli Metro', 'Mysore Road', 'NICE Road Junction'] },
  { slug: 'mahalakshmi-layout', name: 'Mahalakshmi Layout', region: 'Western Bengaluru', pincodes: ['560086'], nearbyAreas: ['Rajajinagar', 'Nandini Layout', 'Yeshwanthpur', 'Basaveshwaranagar'], landmarks: ['ISKCON Temple', 'Mahalakshmi Layout Metro', 'West of Chord Road'] },
  { slug: 'nandini-layout', name: 'Nandini Layout', region: 'Western Bengaluru', pincodes: ['560096'], nearbyAreas: ['Mahalakshmi Layout', 'Rajajinagar', 'Yeshwanthpur', 'Peenya'], landmarks: ['Nandini Layout Main Road', 'Kanteerava Studio', 'Mahalakshmi Layout'] },
  { slug: 'kamakshipalya', name: 'Kamakshipalya', region: 'Western Bengaluru', pincodes: ['560079'], nearbyAreas: ['Basaveshwaranagar', 'Magadi Road', 'Vijayanagar', 'Nagarbhavi'], landmarks: ['Kamakshipalya Junction', 'Magadi Road', 'Outer Ring Road'] },
  {
    slug: 'kengeri',
    name: 'Kengeri',
    region: 'Western Bengaluru',
    pincodes: ['560060'],
    nearbyAreas: ['Rajarajeshwari Nagar', 'Nayandahalli', 'Kumbalgodu', 'Ullalu Upanagara', 'Mysore Road'],
    landmarks: ['Kengeri Satellite Town', 'Kengeri Railway Station', 'Kengeri Metro', 'Mysore Road', 'BGS Hospital'],
    content: {
      dogGrooming: 'Dog grooming in Kengeri is helpful for pets in Satellite Town, Mysore Road apartments and villa pockets where central salon travel can be long. Share exact pincode, size and coat details before the groomer is matched.',
      catGrooming: 'Cat grooming in Kengeri should be planned with distance and temperament in mind. Cats who dislike travel often benefit from a quiet home setup and a lighter grooming plan.',
      mobileGrooming: 'Doorstep grooming in Kengeri reduces Mysore Road travel and keeps pets comfortable after bath, drying, nail work and coat brushing.',
      apartmentAccess: 'For Kengeri Satellite Town, BGS Hospital-side or metro-adjacent homes, add block, gate, parking and landmark instructions.',
      localCoverage: 'Kengeri coverage is pincode-aware for 560060, with nearby checks for Rajarajeshwari Nagar, Nayandahalli, Kumbalgodu, Ullalu Upanagara and Mysore Road.',
      packageFit: 'Fur Bath Care suits routine dust and odour control, while Essential Grooming or Complete Care fit fuller coat and haircut needs.',
    },
  },
  { slug: 'chandra-layout', name: 'Chandra Layout', region: 'Western Bengaluru', pincodes: ['560040'], nearbyAreas: ['Vijayanagar', 'Nagarbhavi', 'Attiguppe', 'Hampinagar'], landmarks: ['Chandra Layout Main Road', 'Attiguppe Metro', 'Vijayanagar'] },
  { slug: 'hampinagar', name: 'Hampinagar', region: 'Western Bengaluru', pincodes: ['560104'], nearbyAreas: ['Vijayanagar', 'RPC Layout', 'Chandra Layout', 'Basaveshwaranagar'], landmarks: ['Hampinagar Main Road', 'RPC Layout', 'Vijayanagar'] },
  { slug: 'magadi-road', name: 'Magadi Road', region: 'Western Bengaluru', pincodes: ['560023'], nearbyAreas: ['Kamakshipalya', 'Vijayanagar', 'Rajajinagar', 'Sunkadakatte'], landmarks: ['Magadi Road Metro', 'Prasanna Theatre', 'Kamakshipalya'] },
  { slug: 'ullalu-upanagara', name: 'Ullalu Upanagara', region: 'Western Bengaluru', pincodes: ['560110'], nearbyAreas: ['Kengeri', 'Rajarajeshwari Nagar', 'Nagarbhavi', 'Viswaneedam'], landmarks: ['Ullalu Main Road', 'Bangalore University', 'Kengeri'] },
  { slug: 'kumbalgodu', name: 'Kumbalgodu', region: 'Western Bengaluru', pincodes: ['560074'], nearbyAreas: ['Kengeri', 'Rajarajeshwari Nagar', 'Bidadi', 'Mysore Road'], landmarks: ['Kumbalgodu Industrial Area', 'Mysore Road', 'Nice Road'], coverageTier: 'confirm' },
  { slug: 'viswaneedam', name: 'Viswaneedam', region: 'Western Bengaluru', pincodes: ['560091'], nearbyAreas: ['Ullalu Upanagara', 'Sunkadakatte', 'Magadi Road', 'Kengeri'], landmarks: ['Viswaneedam Post Office', 'Magadi Road', 'Ullalu'] },
  { slug: 'bapujinagar', name: 'Bapujinagar', region: 'Western Bengaluru', pincodes: ['560026'], nearbyAreas: ['Mysore Road', 'Deepanjali Nagar', 'Vijayanagar', 'Chamrajpet'], landmarks: ['Bapujinagar Main Road', 'Mysore Road', 'Deepanjali Nagar Metro'] },
  { slug: 'deepanjali-nagar', name: 'Deepanjali Nagar', region: 'Western Bengaluru', pincodes: ['560026'], nearbyAreas: ['Mysore Road', 'Bapujinagar', 'Nayandahalli', 'Vijayanagar'], landmarks: ['Deepanjali Nagar Metro', 'Mysore Road', 'BHEL'] },

  { slug: 'attibele', name: 'Attibele', region: confirmRegion, pincodes: ['562107'], nearbyAreas: ['Anekal', 'Chandapura', 'Bommasandra', 'Hosur Road'], landmarks: ['Attibele Toll', 'NH 44', 'Karnataka Tamil Nadu Border'], coverageTier: 'confirm' },
  { slug: 'anekal', name: 'Anekal', region: confirmRegion, pincodes: ['562106'], nearbyAreas: ['Attibele', 'Jigani', 'Chandapura', 'Sarjapura'], landmarks: ['Anekal Town', 'Anekal Road', 'SH 35'], coverageTier: 'confirm' },
  { slug: 'tavarekere', name: 'Tavarekere', region: confirmRegion, aliases: ['Thavarekere'], pincodes: ['562130'], nearbyAreas: ['Magadi Road', 'Kengeri', 'Nelamangala', 'Bidadi'], landmarks: ['Tavarekere', 'Magadi Road', 'Tavarekere Lake'], coverageTier: 'confirm' },
  { slug: 'thavarekere', name: 'Thavarekere', region: confirmRegion, aliases: ['Tavarekere'], pincodes: ['562130'], nearbyAreas: ['Magadi Road', 'Kengeri', 'Nelamangala', 'Bidadi'], landmarks: ['Thavarekere', 'Magadi Road', 'Tavarekere Lake'], coverageTier: 'confirm' },
  { slug: 'chikkabanavara', name: 'Chikkabanavara', region: confirmRegion, pincodes: ['560090'], nearbyAreas: ['Hesaraghatta', 'Jalahalli', 'Nagasandra', 'Dasarahalli'], landmarks: ['Chikkabanavara Railway Station', 'Hesaraghatta Road', 'Soladevanahalli'], coverageTier: 'confirm' },
  { slug: 'hesaraghatta', name: 'Hesaraghatta', region: confirmRegion, pincodes: ['560088'], nearbyAreas: ['Chikkabanavara', 'Yelahanka', 'Nelamangala', 'Doddaballapur Road'], landmarks: ['Hesaraghatta Lake', 'Hesaraghatta Main Road', 'Nrityagram'], coverageTier: 'confirm' },
  { slug: 'nelamangala', name: 'Nelamangala', region: confirmRegion, pincodes: ['562123'], nearbyAreas: ['Nagasandra', 'Tumkur Road', 'Hesaraghatta', 'Doddaballapur Road'], landmarks: ['Nelamangala Toll', 'NH 48', 'Tumkur Road'], coverageTier: 'confirm' },
  { slug: 'devanahalli', name: 'Devanahalli', region: confirmRegion, pincodes: ['562110'], nearbyAreas: ['Chikkajala', 'Doddajala', 'Airport Road', 'Bagalur'], landmarks: ['Kempegowda International Airport', 'Devanahalli Fort', 'Airport Road'], coverageTier: 'confirm' },
  { slug: 'hoskote', name: 'Hoskote', region: confirmRegion, pincodes: ['562114'], nearbyAreas: ['Bhattarahalli', 'Bidrahalli', 'Old Madras Road', 'Whitefield'], landmarks: ['Hoskote Toll', 'Old Madras Road', 'Hoskote Lake'], coverageTier: 'confirm' },
];

export const bengaluruAreaRegions: BengaluruRegion[] = [
  'Central Bengaluru',
  'Eastern Bengaluru',
  'North-Eastern Bengaluru',
  'Northern Bengaluru',
  'South-Eastern Bengaluru',
  'Southern Bengaluru',
  'Southern Suburbs',
  'Western Bengaluru',
  'Peripheral / Confirm Availability',
];

export const bengaluruAreas: BengaluruArea[] = areaSeeds.map(buildArea);

export const publishedBengaluruPetGroomingAreas = bengaluruAreas.filter((area) => area.pageStatus === 'published');
export const coverageOnlyBengaluruPetGroomingAreas = bengaluruAreas.filter((area) => area.pageStatus === 'coverage_only');

export const bengaluruAreaBySlug: Record<string, BengaluruArea> = Object.fromEntries(
  bengaluruAreas.map((area) => [area.slug, area]),
);

export function getPetGroomingAreaPath(area: Pick<BengaluruArea, 'slug'>) {
  return `/pet-grooming/${area.slug}`;
}

export function isPublishedPetGroomingArea(area: BengaluruArea | null | undefined): area is BengaluruArea {
  return Boolean(area && area.pageStatus === 'published');
}

export function groupBengaluruAreasByRegion(areas: BengaluruArea[] = bengaluruAreas) {
  return bengaluruAreaRegions
    .map((region) => ({
      region,
      areas: areas.filter((area) => area.region === region),
    }))
    .filter((group) => group.areas.length > 0);
}
