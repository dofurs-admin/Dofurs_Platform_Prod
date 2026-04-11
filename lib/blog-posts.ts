export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishedOn: string;
  heroImageSrc: string;
  heroImageAlt: string;
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'first-time-pet-grooming-checklist',
    title: 'First-Time Pet Grooming Checklist: What Pet Parents Should Confirm Before Booking',
    excerpt:
      'A practical checklist to evaluate hygiene standards, handling quality, and after-care guidance before your first grooming appointment.',
    category: 'Grooming',
    readTime: '6 min read',
    publishedOn: '28 Feb 2026',
    heroImageSrc: '/Birthday/book-a-service.png',
    heroImageAlt: 'First-time pet grooming checklist',
    sections: [
      {
        heading: 'Why this matters',
        paragraphs: [
          'The first grooming session shapes your pet’s comfort with future appointments. A rushed or poorly managed session can create stress, while a structured and gentle experience builds trust.',
          'Before you book, evaluate the provider on safety, hygiene, communication, and the ability to adapt service based on your pet’s temperament.'
        ]
      },
      {
        heading: 'Checklist before booking',
        paragraphs: ['Use this shortlist while comparing providers.'],
        bullets: [
          'Ask if tools are sanitised between every appointment.',
          'Confirm handling approach for anxious or first-time pets.',
          'Check if skin/coat condition is assessed before service starts.',
          'Verify that post-grooming notes and care suggestions are shared.',
          'Confirm transparent pricing with no hidden add-ons.'
        ]
      },
      {
        heading: 'How to make the first session smooth',
        paragraphs: [
          'Keep your pet lightly active before the session and avoid heavy feeding immediately before grooming. Share any triggers, medical notes, or behavioural patterns in advance.',
          'After service, monitor your pet for comfort and hydration. A good provider will help you with home-care steps for coat, ears, and paws.'
        ]
      }
    ]
  },
  {
    slug: 'home-vet-visit-preparation-guide',
    title: 'How to Prepare for a Home Vet Visit: A Simple Guide for Pet Parents',
    excerpt:
      'Get better outcomes from at-home consultations with a clear prep routine covering symptoms, records, and follow-up questions.',
    category: 'Veterinary Care',
    readTime: '5 min read',
    publishedOn: '28 Feb 2026',
    heroImageSrc: '/Birthday/partners-with-dofurs.png',
    heroImageAlt: 'Home vet visit preparation',
    sections: [
      {
        heading: 'What to prepare before the visit',
        paragraphs: [
          'A home consultation can be efficient and low-stress when the vet gets clear context quickly. Keep vaccination history, current medications, and symptom timeline ready.',
          'If possible, note appetite changes, water intake, stool changes, and activity levels over the last 48 hours.'
        ],
        bullets: [
          'Keep previous prescriptions and reports in one place.',
          'Take photos/videos of unusual symptoms if intermittent.',
          'List all supplements and treats currently given.',
          'Prepare two to three key questions you want answered.'
        ]
      },
      {
        heading: 'During the consultation',
        paragraphs: [
          'Give short, clear observations rather than assumptions. Mention when symptoms started and what changed right before that.',
          'Request a simple treatment and monitoring plan with clear red flags for urgent escalation.'
        ]
      },
      {
        heading: 'After-care follow-up',
        paragraphs: [
          'Set reminders for medications and follow-up checks. Track progress daily so updates can be shared accurately if another consultation is needed.',
          'Consistent follow-up helps prevent minor issues from turning into emergency cases.'
        ]
      }
    ]
  },
  {
    slug: 'pet-care-during-bengaluru-monsoon',
    title: 'Pet Care During Bengaluru Monsoon: Paw, Coat, and Skin Protection Tips',
    excerpt:
      'Monsoon moisture raises infection risks. Learn practical grooming and hygiene steps to keep pets healthy in rainy weeks.',
    category: 'Seasonal Care',
    readTime: '7 min read',
    publishedOn: '28 Feb 2026',
    heroImageSrc: '/Birthday/dofurs-about-us.webp',
    heroImageAlt: 'Monsoon pet care tips',
    sections: [
      {
        heading: 'Common monsoon risks',
        paragraphs: [
          'In humid weather, paws stay damp longer and skin folds trap moisture. This can increase chances of fungal irritation, itching, and odour.',
          'Outdoor walks during rain also expose pets to dirty puddles and hidden sharp debris.'
        ]
      },
      {
        heading: 'Monsoon routine that works',
        paragraphs: ['A simple daily routine reduces most preventable issues.'],
        bullets: [
          'Dry paws fully after every walk, especially between toes.',
          'Use a separate towel for coat and paw cleaning.',
          'Keep nails trimmed to avoid mud buildup and slips.',
          'Schedule regular coat checks for hotspots and redness.',
          'Wash bedding more frequently during high humidity weeks.'
        ]
      },
      {
        heading: 'When to seek professional support',
        paragraphs: [
          'If licking, scratching, or redness persists for more than a day, consult a vet early. Early intervention usually reduces treatment time and discomfort.',
          'Professional grooming in monsoon should focus on hygiene and skin observation, not just appearance.'
        ]
      }
    ]
  },
  {
    slug: 'reduce-pet-anxiety-before-grooming',
    title: 'How to Reduce Pet Anxiety Before Grooming Appointments',
    excerpt:
      'Calm preparation routines can make grooming safer and easier for both pets and groomers.',
    category: 'Behaviour',
    readTime: '5 min read',
    publishedOn: '28 Feb 2026',
    heroImageSrc: '/Birthday/contact-us.webp',
    heroImageAlt: 'Reducing pet anxiety before grooming',
    sections: [
      {
        heading: 'Understand early anxiety signs',
        paragraphs: [
          'Panting, restlessness, whining, and repeated licking are common pre-grooming stress signals. Spotting these early helps you reduce pressure before the session starts.',
          'Your goal is not to force calmness instantly, but to build familiarity with the routine over time.'
        ]
      },
      {
        heading: 'Pre-grooming calm routine',
        paragraphs: ['Try this simple routine on appointment day.'],
        bullets: [
          'Take a short walk 30–45 minutes before service.',
          'Avoid loud environments right before grooming.',
          'Use familiar commands and reward calm behaviour.',
          'Share known triggers with the groomer in advance.',
          'Keep handover quick and confident to reduce transfer anxiety.'
        ]
      },
      {
        heading: 'Build long-term confidence',
        paragraphs: [
          'Consistency helps. Booking with trained professionals and maintaining regular intervals usually improves comfort over successive visits.',
          'Track what worked after each session and update your routine gradually.'
        ]
      }
    ]
  },
  {
    slug: 'questions-before-booking-pet-sitter',
    title: '10 Questions to Ask Before Booking a Pet Sitter',
    excerpt:
      'A decision framework that helps you choose a reliable sitter and reduce last-minute surprises.',
    category: 'Pet Sitting',
    readTime: '6 min read',
    publishedOn: '28 Feb 2026',
    heroImageSrc: '/Birthday/faq-page.webp',
    heroImageAlt: 'Questions for hiring a pet sitter',
    sections: [
      {
        heading: 'Why asking the right questions matters',
        paragraphs: [
          'Pet sitting is about trust, safety, and consistency. A strong pre-booking conversation can reveal whether the sitter can handle your pet’s actual needs, not just routine feeding.',
          'Clear expectations upfront reduce confusion during your travel dates.'
        ]
      },
      {
        heading: 'Key questions pet parents should ask',
        paragraphs: ['Use these questions before finalising.'],
        bullets: [
          'Have you handled my pet’s breed/age profile before?',
          'How do you manage medication reminders and updates?',
          'What is your protocol for emergencies?',
          'How often will I receive photo/video updates?',
          'Can you follow custom feeding and walk instructions?',
          'How do you handle pets with separation anxiety?',
          'What backup support is available if you are delayed?',
          'Do you provide check-in/check-out summaries?',
          'What hygiene measures do you follow across visits?',
          'What is your cancellation and rescheduling policy?'
        ]
      },
      {
        heading: 'Booking confidently',
        paragraphs: [
          'Choose sitters who answer clearly and document plans. Professional communication quality often predicts service quality.',
          'A platform with verified providers and structured support gives additional peace of mind.'
        ]
      }
    ]
  },
  {
    slug: 'pet-grooming-frequency-india-guide',
    title: 'How Often Should You Groom Your Pet? Practical Frequency Guide for Indian Pet Parents',
    excerpt:
      'Understand grooming frequency by coat type, weather, and lifestyle to maintain comfort and hygiene all year.',
    category: 'Grooming',
    readTime: '7 min read',
    publishedOn: '28 Feb 2026',
    heroImageSrc: '/Birthday/pet-birthday.png',
    heroImageAlt: 'Pet grooming frequency guide',
    sections: [
      {
        heading: 'There is no one-size-fits-all frequency',
        paragraphs: [
          'Grooming schedules depend on coat length, shedding level, activity, and local climate. In warm and humid conditions, hygiene-focused grooming often needs shorter intervals.',
          'Regular brushing at home plus scheduled professional grooming usually gives the best outcomes.'
        ]
      },
      {
        heading: 'General frequency benchmarks',
        paragraphs: ['Use these as a starting point and adjust with your groomer or vet.'],
        bullets: [
          'Short coat: professional grooming every 6–8 weeks.',
          'Medium/long coat: every 4–6 weeks.',
          'High-shedding breeds: frequent brushing plus routine de-shedding sessions.',
          'Monsoon periods: additional hygiene checks for paws and skin.',
          'Senior pets: gentler sessions with shorter handling windows.'
        ]
      },
      {
        heading: 'Signs your pet needs an earlier session',
        paragraphs: [
          'Persistent odour, matting, itchy skin, greasy coat texture, or overgrown nails are indicators that grooming should not be delayed.',
          'A proactive schedule improves comfort, reduces skin issues, and makes each session easier for your pet.'
        ]
      }
    ]
  }
];

export const blogPostBySlug = Object.fromEntries(blogPosts.map((post) => [post.slug, post]));
