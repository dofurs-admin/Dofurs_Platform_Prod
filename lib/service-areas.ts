/**
 * Service-area data for Bangalore neighbourhood grooming landing pages.
 *
 * Each entry powers locally anchored routes at /locations/[slug]. Keep the data
 * grooming-specific so retired service lines do not leak back into public SEO.
 */

export type BangaloreArea = {
  slug: string;
  name: string;
  shortName?: string;
  pincodes: string[];
  nearbyAreas: string[];
  landmarks: string[];
  metaTitle: string;
  metaDescription: string;
  heroTagline: string;
  intro: string;
  sections: {
    heading: string;
    paragraphs: string[];
  }[];
  localNotes: string[];
  faqs: { question: string; answer: string }[];
};

function buildArea({
  slug,
  name,
  shortName,
  pincodes,
  nearbyAreas,
  landmarks,
  setupNote,
}: {
  slug: string;
  name: string;
  shortName?: string;
  pincodes: string[];
  nearbyAreas: string[];
  landmarks: string[];
  setupNote: string;
}): BangaloreArea {
  const areaLabel = shortName ?? name;
  const landmarkSummary = landmarks.slice(0, 3).join(', ');
  const nearbySummary = nearbyAreas.slice(0, 4).join(', ');

  return {
    slug,
    name,
    shortName,
    pincodes,
    nearbyAreas,
    landmarks,
    metaTitle: `Pet Grooming in ${name}, Bangalore — Doorstep Groomers | Dofurs`,
    metaDescription: `Book verified doorstep pet grooming in ${name}, Bangalore. Dofurs serves ${pincodes.join(', ')} and nearby ${nearbySummary} with grooming packages from Rs.699.`,
    heroTagline: `Doorstep grooming across ${areaLabel} near ${landmarkSummary}.`,
    intro: `Dofurs brings verified doorstep pet grooming to ${name}, with package-led bath care, haircuts, de-shedding, nail care, ear cleaning and hygiene trims handled at home.`,
    sections: [
      {
        heading: `Doorstep grooming in ${name}`,
        paragraphs: [
          `Our groomers coordinate appointments around ${landmarkSummary} and nearby ${nearbySummary}, so arrival windows are practical for local traffic and building access.`,
          setupNote,
        ],
      },
    ],
    localNotes: [
      `Share society entry rules or landmark instructions near ${landmarks[0]} before your ${areaLabel} grooming appointment.`,
      `Keep water access, a plug point and a safe grooming corner ready before the groomer arrives.`,
      `For anxious pets, choose a quieter slot and mention handling triggers in the booking notes.`,
    ],
    faqs: [
      {
        question: `Do you provide pet grooming in ${name}?`,
        answer: `Yes. Dofurs provides doorstep grooming in ${name} and nearby areas including ${nearbySummary}.`,
      },
      {
        question: `Which pincodes do you serve in ${name}?`,
        answer: `Standard ${areaLabel} coverage includes ${pincodes.join(', ')}. Share your exact pincode during booking so availability can be confirmed.`,
      },
      {
        question: `Can I book same-day grooming in ${name}?`,
        answer: `Same-day grooming depends on groomer availability. Weekdays usually have more flexibility than weekend full-grooming slots.`,
      },
    ],
  };
}

export const bangaloreAreas: BangaloreArea[] = [
  buildArea({
    slug: 'indiranagar',
    name: 'Indiranagar',
    pincodes: ['560038', '560008'],
    nearbyAreas: ['Domlur', 'HAL', 'CV Raman Nagar', 'Jeevan Bhima Nagar', 'Ulsoor'],
    landmarks: ['100 Feet Road', '12th Main', 'Defence Colony', 'HAL 2nd Stage', 'CMH Road', 'Chinmaya Mission Hospital Road'],
    setupNote: 'Home grooming helps pet parents avoid the CMH Road and 100 Feet Road salon commute while keeping pets in a familiar space.',
  }),
  buildArea({
    slug: 'koramangala',
    name: 'Koramangala',
    pincodes: ['560034', '560095', '560047'],
    nearbyAreas: ['Adugodi', 'Ejipura', 'Sarjapur Road', 'HSR Layout', 'BTM Layout'],
    landmarks: ['1st Block', '3rd Block', '5th Block', '7th Block', '80 Feet Road', 'Sony World Junction', 'Forum Mall'],
    setupNote: 'Apartment-friendly grooming is useful across Koramangala blocks, where weekend traffic can turn a salon visit into a long errand.',
  }),
  buildArea({
    slug: 'hsr-layout',
    name: 'HSR Layout',
    shortName: 'HSR',
    pincodes: ['560102', '560068'],
    nearbyAreas: ['Sarjapur Road', 'BTM Layout', 'Bommanahalli', 'Agara', 'Koramangala'],
    landmarks: ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 7', 'Agara Lake', '27th Main', 'BDA Complex'],
    setupNote: 'HSR homes often have practical balcony or bathroom setups for Fur Bath Care, Essential Grooming and Complete Care appointments.',
  }),
  buildArea({
    slug: 'whitefield',
    name: 'Whitefield',
    pincodes: ['560066', '560067', '560048'],
    nearbyAreas: ['ITPL', 'Varthur', 'Kadugodi', 'Mahadevapura', 'Brookefield'],
    landmarks: ['Phoenix Marketcity', 'ITPL Main Road', 'Brookefield', 'Forum Shantiniketan', 'Nallurhalli', 'Varthur Road'],
    setupNote: 'Whitefield grooming works best when society visitor approvals are shared early, especially in larger gated communities and tech-corridor apartments.',
  }),
  buildArea({
    slug: 'electronic-city',
    name: 'Electronic City',
    shortName: 'Electronic City',
    pincodes: ['560100', '560099'],
    nearbyAreas: ['Bommasandra', 'Hosa Road', 'Begur', 'Chandapura', 'Singasandra'],
    landmarks: ['Phase 1', 'Phase 2', 'Neeladri Road', 'Hosur Road', 'Infosys', 'Wipro'],
    setupNote: 'Doorstep grooming helps Electronic City pet parents avoid Hosur Road travel while still keeping coat care, paw care and hygiene trims on schedule.',
  }),
  buildArea({
    slug: 'jayanagar',
    name: 'Jayanagar',
    pincodes: ['560041', '560011', '560069', '560070'],
    nearbyAreas: ['JP Nagar', 'BTM Layout', 'Banashankari', 'Basavanagudi', 'Wilson Garden'],
    landmarks: ['4th Block', '8th Block', '9th Block', 'Jayanagar Shopping Complex', 'Cool Joint', '30th Cross', 'Madhavan Park'],
    setupNote: 'Jayanagar grooming appointments often work well for senior pets and multi-pet homes because the session happens in a known environment.',
  }),
];

export const bangaloreAreaBySlug = Object.fromEntries(
  bangaloreAreas.map((area) => [area.slug, area]),
);
