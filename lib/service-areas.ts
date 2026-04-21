/**
 * Service-area data for Bangalore neighbourhood landing pages.
 *
 * Each entry powers a long-form, SEO-optimised page at /locations/[slug]
 * with unique, locally-anchored content. Do not turn these into boilerplate —
 * keep each area's narrative specific to its real geography and pet-parent needs.
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
  // One-paragraph intro specific to the neighbourhood — 2–3 sentences.
  intro: string;
  // Unique paragraphs about living and caring for pets in the area.
  sections: {
    heading: string;
    paragraphs: string[];
  }[];
  // Local tips, constraints, or opportunities that matter for pet parents.
  localNotes: string[];
  // FAQ entries specific to this neighbourhood.
  faqs: { question: string; answer: string }[];
};

export const bangaloreAreas: BangaloreArea[] = [
  {
    slug: 'indiranagar',
    name: 'Indiranagar',
    pincodes: ['560038', '560008'],
    nearbyAreas: ['Domlur', 'HAL', 'CV Raman Nagar', 'Jeevan Bhima Nagar', 'Ulsoor'],
    landmarks: [
      '100 Feet Road',
      '12th Main',
      'Defence Colony',
      'HAL 2nd Stage',
      'CMH Road',
      'Chinmaya Mission Hospital Road',
    ],
    metaTitle: 'Pet Services in Indiranagar, Bangalore — Grooming, Vet, Boarding | Dofurs',
    metaDescription:
      'Book doorstep pet grooming, vet home visits, boarding, sitting and training in Indiranagar. Verified Dofurs professionals covering 100 Feet Road, 12th Main, CMH Road, Defence Colony and Domlur.',
    heroTagline: 'Doorstep pet care across Indiranagar — from 100 Feet Road to Domlur.',
    intro:
      'Indiranagar is one of Bangalore\'s densest pet-parent neighbourhoods — apartment pets, independent bungalow dogs, and rescue communities share a few narrow streets and a lot of traffic. Dofurs brings verified pet care to your door so you skip the CMH Road jam and the Sunday evening 100 Feet Road chaos.',
    sections: [
      {
        heading: 'What pet care looks like in Indiranagar',
        paragraphs: [
          'Most pet parents here live in builder-floor apartments or older independent homes, which means grooming at home is usually easier than hauling your dog to a salon. Our mobile groomers arrive with pet-safe shampoos, blow dryers, and nail-trim kits, and set up a clean bathing station in your bathroom or balcony.',
          'Vet home visits are especially valuable here because getting a reactive or senior pet into a crowded Indiranagar clinic on a Saturday morning can be more stressful than the illness itself. Our on-call vets cover wellness checkups, vaccinations, and basic diagnostics without your pet ever leaving home.',
          'For travel, Dofurs pet sitters handle feeding, walks, and companionship while you\'re away — and boarding partners operate in CV Raman Nagar and HAL where there\'s a bit more space and less traffic noise than the core of Indiranagar.',
        ],
      },
      {
        heading: 'Common Indiranagar pet concerns we help with',
        paragraphs: [
          'Heat stress on the 100 Feet Road pavement in April and May is real — our groomers and trainers always recommend pre-7 AM or post-7 PM walks in summer, and we can fit de-shedding packages around your schedule.',
          'Many apartments around 12th Main and Defence Colony don\'t allow large dogs to use community lifts, so we coordinate groomer arrival times to avoid peak lift hours. Our providers are used to the flow.',
        ],
      },
    ],
    localNotes: [
      'Parking: our providers typically use two-wheelers, so your apartment visitor parking is enough.',
      'Lift access: we coordinate a time that avoids peak lift hours (7–9 AM and 6–9 PM) for large-dog grooming.',
      'Noise: Indiranagar pubs create Sunday night stress for anxious pets. We can schedule vet anti-anxiety consults for event-heavy weeks.',
    ],
    faqs: [
      {
        question: 'Do you serve all parts of Indiranagar?',
        answer:
          'Yes — we cover pincodes 560038 and 560008 including 1st to 12th Main, Defence Colony, HAL 2nd Stage, CV Raman Nagar, Jeevan Bhima Nagar, Ulsoor and Domlur.',
      },
      {
        question: 'How fast can I book a groomer in Indiranagar?',
        answer:
          'Same-day slots are usually available on weekdays. Saturdays fill up fastest — book by Thursday for best choice of time.',
      },
      {
        question: 'Are your providers comfortable with apartment-building security?',
        answer:
          'Yes. Our groomers carry ID and share their live location from 30 minutes before the appointment so your building security can verify entry.',
      },
    ],
  },
  {
    slug: 'koramangala',
    name: 'Koramangala',
    pincodes: ['560034', '560095', '560047'],
    nearbyAreas: ['Adugodi', 'Ejipura', 'Sarjapur Road', 'HSR Layout', 'BTM Layout'],
    landmarks: ['1st Block', '3rd Block', '5th Block', '7th Block', '80 Feet Road', 'Sony World Junction', 'Forum Mall'],
    metaTitle: 'Pet Services in Koramangala, Bangalore — Doorstep Grooming & Vet | Dofurs',
    metaDescription:
      'Dofurs brings pet grooming, vet home visits, boarding, sitting and training to every block of Koramangala. Verified professionals, transparent pricing, and doorstep service across 1st, 3rd, 4th, 5th, 6th and 7th Blocks.',
    heroTagline: 'Pet grooming, vet visits, and sitting — every block of Koramangala.',
    intro:
      'Koramangala\'s 1st through 8th Blocks are home to thousands of young working pet parents — mostly apartment dogs and indoor cats with busy weekday schedules. Dofurs is built for exactly this: book online in two minutes, get a verified provider at your door, pay digitally.',
    sections: [
      {
        heading: 'Koramangala\'s pet-parent reality',
        paragraphs: [
          'Traffic on 80 Feet Road and Sarjapur Road makes driving your dog to a salon or clinic a 90-minute ordeal on weekends. That is why our doorstep grooming is the fastest-growing service in 5th Block, 6th Block and 7th Block — you get the same quality without the transport stress.',
          'Startup culture here also means a lot of late-night work followed by weekend travel. Our Koramangala pet sitters handle daily visits (feeding, walks, play, and photo updates) while you\'re out of town, and our boarding partners in BTM and Bannerghatta Road offer overnight stays when you need them.',
          'For vaccinations and routine vet care, our home-visit vets cover everything short of surgery or imaging. You avoid the waiting room, and your cat avoids a cat carrier.',
        ],
      },
      {
        heading: 'What makes Koramangala different',
        paragraphs: [
          'High apartment density means every provider we send here is comfortable with tight parking, elevator etiquette, and apartment-association rules. We schedule big dogs outside the 8–10 AM morning walk rush in 3rd Block where the walking tracks get crowded.',
          'Indie and rescue dogs are common in Koramangala. Our trainers handle reactive-dog desensitisation, and our vets are used to the specific parasite load that rescues often come in with.',
        ],
      },
    ],
    localNotes: [
      'We serve all blocks — 1st, 3rd, 4th, 5th, 6th, 7th and 8th — plus Jakkasandra and Ejipura.',
      'Providers carry GST-compliant digital invoices; most apartment societies accept these for reimbursement.',
      'Peak booking hours on Saturday mornings — book by Friday afternoon for the Saturday 8–10 AM slots.',
    ],
    faqs: [
      {
        question: 'Do you cover 7th Block and 8th Block Koramangala?',
        answer:
          'Yes — all 8 blocks of Koramangala are in our standard service area, including Jakkasandra and Ejipura.',
      },
      {
        question: 'How do you handle apartment society restrictions?',
        answer:
          'Our providers carry verified ID, send advance intimation with their live location, and can wait for security clearance before entering.',
      },
      {
        question: 'Are same-day appointments possible?',
        answer:
          'For grooming, yes on weekdays. For vet home visits, 3–6 hour lead time is typical depending on vet availability.',
      },
    ],
  },
  {
    slug: 'hsr-layout',
    name: 'HSR Layout',
    shortName: 'HSR',
    pincodes: ['560102', '560068'],
    nearbyAreas: ['Sarjapur Road', 'BTM Layout', 'Bommanahalli', 'Agara', 'Koramangala'],
    landmarks: ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 7', 'Agara Lake', '27th Main', 'BDA Complex'],
    metaTitle: 'Pet Services in HSR Layout, Bangalore — Grooming, Vet, Boarding | Dofurs',
    metaDescription:
      'Book verified pet grooming, vet home visits, boarding, sitting and training in HSR Layout. Dofurs covers all HSR Sectors, 27th Main, Agara and BDA Complex with doorstep pet care.',
    heroTagline: 'Trusted pet care in every sector of HSR Layout.',
    intro:
      'HSR Layout\'s grid of sectors and 27th Main corridor has become one of Bangalore\'s fastest-growing pet neighbourhoods. New parents, remote workers and rescue families all share the walking paths around Agara Lake — and Dofurs covers every sector with doorstep pet care.',
    sections: [
      {
        heading: 'Why HSR works so well for home pet care',
        paragraphs: [
          'HSR\'s apartment complexes typically have better common-area access and less parking pressure than Indiranagar or Koramangala, which makes grooming setups quicker. Many of our regular HSR customers prefer the Summer Bonanza or Complete Care packages because their complexes have open balconies that work well for full-bath grooming.',
          'The Agara Lake walking loop is one of the best in the city for socialising young dogs — our trainers often structure leash-training sessions there, especially pre-7 AM when the path is quiet.',
          'Vets covering HSR understand the specific tick and flea load from the lake-adjacent grass in July and August — we factor this into preventive plans for dogs that walk there regularly.',
        ],
      },
      {
        heading: 'Sector coverage',
        paragraphs: [
          'We serve Sectors 1, 2, 3, 4, 5, 6 and 7 including the BDA Complex stretch along 27th Main. Sitters, groomers, and vets are routed dynamically so your appointment is handled by the nearest available provider — typically within 15 minutes of your pincode.',
        ],
      },
    ],
    localNotes: [
      'Agara Lake walks: best times are 5:30–7 AM and 6–7:30 PM. Avoid mid-morning heat on the western path in summer.',
      'HSR Sector 2 has several pet-friendly cafés — we can brief you on current pet-policy status for each.',
      'Most providers operate on two-wheelers so parking in gated communities is rarely an issue.',
    ],
    faqs: [
      {
        question: 'Does Dofurs cover all HSR sectors?',
        answer:
          'Yes — we serve Sectors 1 through 7 including the stretch along 27th Main and BDA Complex.',
      },
      {
        question: 'Can I combine grooming and vet in one visit?',
        answer:
          'We schedule them back-to-back when possible. Grooming first, then the vet visit — this keeps the pet in a calm state for the exam.',
      },
      {
        question: 'Is overnight boarding available in HSR?',
        answer:
          'Our boarding partners are typically in BTM Layout and Bommanahalli. We arrange pickup and drop from HSR.',
      },
    ],
  },
  {
    slug: 'whitefield',
    name: 'Whitefield',
    pincodes: ['560066', '560067', '560048'],
    nearbyAreas: ['ITPL', 'Varthur', 'Kadugodi', 'Mahadevapura', 'Brookefield'],
    landmarks: ['Phoenix Marketcity', 'ITPL Main Road', 'Brookefield', 'Forum Shantiniketan', 'Nallurhalli', 'Varthur Road'],
    metaTitle: 'Pet Services in Whitefield, Bangalore — Doorstep Grooming & Vet | Dofurs',
    metaDescription:
      'Book verified pet grooming, vet home visits, boarding, sitting and training across Whitefield, ITPL, Brookefield, Varthur and Kadugodi. Dofurs serves gated communities and apartments with doorstep pet care.',
    heroTagline: 'Pet care for Whitefield\'s gated communities and tech corridors.',
    intro:
      'Whitefield\'s tech-park footprint and gated community layout mean most pet parents here live in large townships — Prestige Shantiniketan, Brigade Cosmopolis, Palm Meadows — where pulling your dog out for a salon trip means navigating a second round of traffic after Sarjapur. Doorstep pet care is built for Whitefield.',
    sections: [
      {
        heading: 'Working with Whitefield\'s gated communities',
        paragraphs: [
          'Our providers are registered with security desks at most major townships and apartment complexes — Prestige Shantiniketan, Brigade Cosmopolis, Palm Meadows, Divya Sree Elan, Adarsh Palm Retreat. They show up with printed ID, and entry is typically a five-minute formality.',
          'Because Whitefield apartments are often larger than central Bangalore flats, full grooming sessions (Essential and Complete Care) are especially popular — there\'s usually space to set up cleanly and let the pet dry before post-bath play.',
          'Vet home visits are huge here for anyone who has tried getting to a clinic from ITPL during evening traffic. Our vets carry portable diagnostic kits for basic blood work and ultrasound-free wellness exams, limiting the need for clinic trips.',
        ],
      },
      {
        heading: 'Life with a pet in Whitefield',
        paragraphs: [
          'Walking paths inside most gated societies make daily exercise easy, but stray-dog confrontations on Varthur and Kadugodi stretches are a common concern. Our trainers help with leash reactivity, and our sitters stick to the internal community loops by default.',
          'For boarding, we use partners within Whitefield so there\'s no long transport needed — one of the few service areas where everything including boarding happens inside the neighbourhood.',
        ],
      },
    ],
    localNotes: [
      'Gated community access: we submit a daily visitor list to your society security if your complex requires it.',
      'Monsoon: Whitefield\'s low-lying patches flood quickly. We may re-time visits if your building sits in a known flooding stretch.',
      'Evening traffic: we avoid 5:30–8 PM Varthur Road slots whenever possible — book morning or late-evening for consistency.',
    ],
    faqs: [
      {
        question: 'Which Whitefield pincodes are covered?',
        answer:
          'Primarily 560066, 560067 and 560048 — covering ITPL, Varthur, Kadugodi, Mahadevapura and Brookefield.',
      },
      {
        question: 'Do you enter gated communities directly?',
        answer:
          'Yes. Our providers send ID and live-location pings so your society security can verify and grant entry smoothly.',
      },
      {
        question: 'Is Whitefield-to-boarding pickup included?',
        answer:
          'For boarding bookings within Whitefield, pickup and drop is arranged at a transparent flat fee — no surprise charges.',
      },
    ],
  },
  {
    slug: 'electronic-city',
    name: 'Electronic City',
    shortName: 'Electronic City',
    pincodes: ['560100', '560099'],
    nearbyAreas: ['Bommasandra', 'Hosa Road', 'Begur', 'Chandapura', 'Singasandra'],
    landmarks: ['Phase 1', 'Phase 2', 'Neeladri Road', 'Hosur Road', 'Infosys', 'Wipro'],
    metaTitle: 'Pet Services in Electronic City, Bangalore — Grooming, Vet, Boarding | Dofurs',
    metaDescription:
      'Book pet grooming, vet home visits, boarding, sitting and training in Electronic City Phase 1 and Phase 2. Dofurs serves Neeladri Road, Bommasandra, Hosa Road and Begur with verified providers at your door.',
    heroTagline: 'Doorstep pet care across Electronic City Phase 1 and Phase 2.',
    intro:
      'Electronic City\'s Phase 1 and Phase 2 communities are packed with pet parents who\'d rather spend their post-Infosys hours with the dog than stuck in Hosur Road traffic getting to a clinic in Jayanagar. Dofurs is built for that tradeoff — verified pet pros delivered to Neeladri Nagar, Bommasandra or Hosa Road.',
    sections: [
      {
        heading: 'Pet parenting in Electronic City',
        paragraphs: [
          'Phase 1 apartments and Phase 2 villa layouts have very different setups for home grooming. We tailor package recommendations to your exact floor plan — balcony grooming works well for larger Phase 2 homes, bathroom grooming is the default for most Phase 1 flats.',
          'Vet home visits remove the Hosur Road problem completely. Our vets also carry the paperwork required for Karnataka rabies vaccination certificates, which matters for gated-community compliance in Phase 2.',
          'Boarding partners in nearby Bommasandra and Chandapura offer safe, affordable overnight stays for travellers catching early flights out of Bengaluru airport — we handle pickup and drop.',
        ],
      },
      {
        heading: 'Things to know',
        paragraphs: [
          'E-City\'s stray dog population is high on Neeladri Road — our trainers recommend structured leash desensitisation for puppies. We can pair this with weekly sitter visits to build consistency.',
          'Summer heat on Hosur Road can push pavement temperatures to unsafe levels after 9 AM. Our providers always adjust walk timings to before 7 AM or after 7 PM in April and May.',
        ],
      },
    ],
    localNotes: [
      'Phase 1 elevator coordination: we send advance notice so grooming setups don\'t conflict with morning office rush.',
      'Phase 2 villa layouts: larger setups let us use outdoor grooming on dry days — coat dries faster, less indoor cleanup.',
      'For airport-bound travellers from Bommasandra, we arrange pickup the night before your flight.',
    ],
    faqs: [
      {
        question: 'Does Dofurs serve Phase 2 villas?',
        answer:
          'Yes — Phase 2 villa communities along Neeladri Road and Doddathogur are in our regular route.',
      },
      {
        question: 'What\'s the response time from Electronic City?',
        answer:
          'Standard weekday grooming bookings get confirmed within 2–3 hours, with visits scheduled as early as the same evening.',
      },
      {
        question: 'Is there a distance charge for Electronic City?',
        answer:
          'No. Phase 1 and Phase 2 are part of our flat-rate Bangalore coverage — no distance fee.',
      },
    ],
  },
  {
    slug: 'jayanagar',
    name: 'Jayanagar',
    pincodes: ['560041', '560011', '560069', '560070'],
    nearbyAreas: ['JP Nagar', 'BTM Layout', 'Banashankari', 'Basavanagudi', 'Wilson Garden'],
    landmarks: ['4th Block', '8th Block', '9th Block', 'Jayanagar Shopping Complex', 'Cool Joint', '30th Cross', 'Madhavan Park'],
    metaTitle: 'Pet Services in Jayanagar, Bangalore — Grooming, Vet, Boarding | Dofurs',
    metaDescription:
      'Book verified pet grooming, vet home visits, boarding, sitting and training across Jayanagar 4th, 8th and 9th Blocks. Dofurs serves Madhavan Park, 30th Cross and Basavanagudi with doorstep pet care.',
    heroTagline: 'Bengaluru\'s oldest pet-parent neighbourhoods, served with modern care.',
    intro:
      'Jayanagar and Basavanagudi hold some of Bengaluru\'s oldest pet-parent families — retirees with senior dogs, multi-generation homes with multiple pets, and thriving community pet groups around Madhavan Park. Dofurs brings modern doorstep pet care to these established neighbourhoods without disrupting routines that work.',
    sections: [
      {
        heading: 'Senior pets and multi-pet homes',
        paragraphs: [
          'Jayanagar has a higher proportion of senior pets than most other Bangalore localities — our vets and groomers are trained for low-stress handling, mobility support, and age-appropriate grooming pressure.',
          'Multi-pet households are also common here (two dogs, or a dog and one or two cats). We schedule back-to-back sessions in one visit so you\'re not paying for multiple call-outs, and we ensure same-species pets get handled together for faster, calmer sessions.',
        ],
      },
      {
        heading: 'Walking, parks and the park-dog community',
        paragraphs: [
          'Madhavan Park and Lalbagh are the social centres of Jayanagar\'s dog-walking community. Our trainers know the regular crowd well and can coordinate group training walks, particularly in 4th Block and 8th Block loops.',
          'For older homes with narrow compounds, our providers carry compact grooming setups that work without needing large floor space.',
        ],
      },
    ],
    localNotes: [
      'Traffic: Jayanagar 4th Block shopping complex peaks 11 AM–1 PM and 6–8 PM. Appointments outside these windows are smoother.',
      'Parks: Madhavan Park and Lalbagh Rose Garden are both within walking distance of most of Jayanagar — our trainers use them for weekend group sessions.',
      'Community: Basavanagudi has an active pet-parent WhatsApp group; ask our support team to share the invite if you\'re new to the area.',
    ],
    faqs: [
      {
        question: 'Does Dofurs cover older independent homes in Basavanagudi?',
        answer:
          'Yes. Our providers handle both apartments and independent homes. For homes without compound access, we coordinate a quick walk-through on arrival.',
      },
      {
        question: 'Is Dofurs experienced with senior-pet grooming?',
        answer:
          'Absolutely — we operate special "senior comfort" sessions that use gentler pressure and shorter session lengths. Ask for this when booking.',
      },
      {
        question: 'Can you handle multi-pet households in one visit?',
        answer:
          'Yes. Book all your pets in a single reservation and the provider plans the session to cover everyone in one call-out.',
      },
    ],
  },
];

export const bangaloreAreaBySlug = Object.fromEntries(
  bangaloreAreas.map((area) => [area.slug, area]),
);
