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
    heroImageSrc: '/blog/first-time-grooming-checklist.svg',
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
    heroImageSrc: '/blog/home-vet-visit-guide.svg',
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
    heroImageSrc: '/blog/bengaluru-monsoon-pet-care.svg',
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
    heroImageSrc: '/blog/reduce-pet-anxiety-grooming.svg',
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
    heroImageSrc: '/blog/questions-before-booking-pet-sitter.svg',
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
    heroImageSrc: '/blog/pet-grooming-frequency-guide.svg',
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
  },
  {
    slug: 'do-vaccinated-pets-live-longer',
    title: 'Do Vaccinated Pets Live Longer? A Scientific Breakdown for Pet Parents',
    excerpt:
      'Vaccination is one of the most researched interventions in veterinary medicine. Here is what the science actually says about vaccines and your pet\'s lifespan.',
    category: 'Veterinary Care',
    readTime: '6 min read',
    publishedOn: '13 Apr 2026',
    heroImageSrc: '/blog/vaccinated-pets-live-longer.svg',
    heroImageAlt: 'Do vaccinated pets live longer — a scientific breakdown',
    sections: [
      {
        heading: 'What the research actually says',
        paragraphs: [
          'Every pet parent asks the same question at some point: am I doing enough to give my pet a long life? One of the most consistent answers in veterinary science points directly to timely vaccination.',
          'The World Small Animal Veterinary Association (WSAVA) recognises vaccination as one of the most effective methods of preventing infectious diseases in companion animals. The diseases it protects against are not minor inconveniences — canine parvovirus carries an untreated mortality rate of up to 91%, canine distemper causes severe neurological complications, and feline panleukopenia kills more than 70% of affected kittens when left unmanaged.',
          'These are not rare edge cases. They are common, preventable, and fatal — and vaccination is the primary line of defence.'
        ]
      },
      {
        heading: 'The lifespan connection',
        paragraphs: [
          'A key insight from veterinary epidemiology is that most reductions in pet lifespan occur due to early-age mortality. A large-scale study of owned dogs in the UK (O\'Neill et al., 2013, Journal of Veterinary Internal Medicine) found that median lifespan increases significantly when early deaths from preventable diseases are reduced.',
          'It is important to understand the mechanism correctly. Vaccination does not directly extend lifespan the way a supplement might claim to. What it does is prevent early death — and that matters more than it sounds. When a pet survives the most dangerous infectious disease window, they gain the opportunity to reach their natural lifespan rather than being cut short by something preventable.',
          'Population-level studies show that preventive care, including vaccination, can improve survival outcomes by 30–60% in real-world clinical settings.'
        ],
        bullets: [
          'Prevents fatal infectious diseases before they take hold.',
          'Reduces early-life mortality across puppies and kittens.',
          'Allows pets to reach their natural, age-appropriate lifespan.',
          'Lowers the probability of severe illness requiring emergency care.'
        ]
      },
      {
        heading: 'What this means for your pet in Bangalore',
        paragraphs: [
          'Bangalore\'s climate — warm, humid for much of the year, and increasingly dense in urban pet populations — creates conditions where infectious disease spreads more easily. Pets that visit parks, interact with other animals, or are boarded during travel face ongoing exposure risk.',
          'Vaccination is not a one-time event at adoption. It is a recurring protocol with core vaccines, boosters, and annual reviews. A vet who knows your pet\'s history and local disease patterns is best placed to advise on the right schedule. If you are unsure whether your pet\'s records are current, that is worth checking today — not at the next appointment.',
          'At Dofurs, our home vet consultations include vaccine record review as part of the visit. Book a consultation if you want a clear picture of where your pet\'s protection currently stands.'
        ]
      }
    ]
  },
  {
    slug: 'why-missing-vaccines-shortens-pet-life',
    title: 'Why Missing Even One Vaccine Can Shorten Your Pet\'s Life',
    excerpt:
      'Most pet parents do not skip vaccines intentionally — they forget, delay, or assume one dose was enough. Clinical evidence shows that even small gaps in vaccination schedules increase risk significantly.',
    category: 'Veterinary Care',
    readTime: '5 min read',
    publishedOn: '13 Apr 2026',
    heroImageSrc: '/blog/missed-vaccine-risk.svg',
    heroImageAlt: 'Why missing vaccines can shorten your pet\'s life',
    sections: [
      {
        heading: 'The real risk of a missed dose',
        paragraphs: [
          'Skipping a vaccine rarely feels like a serious decision in the moment. Life gets busy, the appointment slips, and the pet seems healthy, so the urgency fades. But according to the American Veterinary Medical Association (AVMA), unvaccinated pets are at significantly higher risk of contracting and spreading infectious diseases — and that risk is not hypothetical.',
          'Immunity from vaccines is not permanent and does not build from a single dose. It develops across a proper primary schedule and is maintained through timely boosters. Each missed step can interrupt that development and create a window of vulnerability that an exposure event can easily exploit.'
        ]
      },
      {
        heading: 'What mortality data tells us',
        paragraphs: [
          'Research published in Veterinary Microbiology (Decaro et al., 2005) on canine parvovirus documented significantly higher mortality rates in unvaccinated puppies compared to vaccinated dogs with comparable exposure. The gap in outcomes was not marginal — it was a defining factor in survival.',
          'For cats, feline panleukopenia outbreaks consistently show high fatality rates in unvaccinated kittens. This is well established in Greene\'s Infectious Diseases of the Dog and Cat, a foundational clinical reference. The pattern across diseases is the same: vaccination status is one of the strongest predictors of outcome when infection occurs.',
          'The American Animal Hospital Association (AAHA) further notes that incomplete vaccination protocols may leave animals unprotected — a reminder that partial compliance is not a safe middle ground.'
        ],
        bullets: [
          'Unvaccinated puppies face dramatically higher parvovirus mortality than vaccinated peers.',
          'Feline panleukopenia fatality rates are consistently high in unvaccinated kittens.',
          'Gaps in the primary series interrupt immunity development, not just maintenance.',
          'Missing a booster can reduce protection even in previously vaccinated pets.',
          'Partial compliance does not offer partial protection — immunity thresholds matter.'
        ]
      },
      {
        heading: 'Building a schedule that actually sticks',
        paragraphs: [
          'The most common reason for missed vaccines is not cost or access — it is forgetting. Vaccination schedules are not intuitive, intervals vary by vaccine type and risk category, and without a reminder system most pet parents simply lose track.',
          'The practical fix is simple: keep vaccination records in one accessible place, ask your vet to explain the upcoming schedule clearly at every visit, and set calendar reminders for the next due date before you leave the clinic. If you are unsure what your pet is currently protected against, a vet consultation is the fastest way to get clarity.',
          'Dofurs home vet visits include a vaccination and preventive care review. Our vets can check your pet\'s current records, identify any gaps, and administer overdue vaccines during the same visit — so you do not have to make a separate trip.'
        ]
      }
    ]
  },
  {
    slug: 'vaccine-tracking-increases-pet-lifespan',
    title: 'The Science of Timely Pet Care: Why Tracking Vaccines Increases Lifespan',
    excerpt:
      'Most pet owners intend to follow vaccination schedules. The ones who succeed use systems, not memory. Here is what the evidence says about adherence, consistency, and long-term outcomes.',
    category: 'Preventive Care',
    readTime: '6 min read',
    publishedOn: '13 Apr 2026',
    heroImageSrc: '/blog/vaccine-tracking-lifespan.svg',
    heroImageAlt: 'Vaccine tracking and pet lifespan — the science of timely care',
    sections: [
      {
        heading: 'Why good intentions are not enough',
        paragraphs: [
          'Preventive care fails most often not because of cost, access, or awareness — but because of human forgetting. A study published in Preventive Veterinary Medicine found that adherence to vaccination schedules drops significantly without active reminder systems. Missed care was most commonly attributed to forgetfulness, not deliberate neglect.',
          'This matters because the benefit of vaccination is entirely dependent on completing the schedule correctly. A vaccine given at the wrong interval, or a booster missed by several months, does not simply provide slightly less protection — it may leave the animal in a window of incomplete immunity when exposure happens.'
        ]
      },
      {
        heading: 'What consistent tracking actually does',
        paragraphs: [
          'Research from the CDC on preventive care adherence in human healthcare — a directly comparable domain — shows that reminder systems improve compliance by 20–40%. The mechanism transfers well to veterinary care: when owners receive timely reminders and have easy access to records, they follow through significantly more often.',
          'The outcome chain is direct. Better adherence leads to more complete vaccination coverage. More complete coverage leads to lower disease incidence. Lower disease incidence means higher survival rates. And at the population level, this translates into measurably longer average lifespans.',
          'The difference between a traditional paper-record system and a structured digital approach is not just convenience — it is a clinical outcome difference. Paper records get lost, vaccination dates become unclear, and there is no prompt when a booster is due. Digital tracking with automated reminders removes each of those failure points.'
        ],
        bullets: [
          'Digital records prevent lost or unclear vaccination histories.',
          'Automated reminders remove the single biggest compliance barrier: forgetting.',
          'Easy rescheduling reduces the gap between overdue care and completed care.',
          'Visible health timelines help vets catch missed steps during consultations.',
          'Consistent coverage means full immunity, not partial or lapsed protection.'
        ]
      },
      {
        heading: 'Practical steps for Bangalore pet parents',
        paragraphs: [
          'Start by locating your pet\'s current vaccination card or clinic records. Photograph or digitise them so they are not vulnerable to being misplaced. Ask your vet at the next visit to walk you through the upcoming schedule — what is due, when, and why — and set phone reminders for each date before you leave.',
          'If your pet\'s records have gaps or you are unsure what was administered and when, a dedicated health consultation is worth scheduling. A vet who can review records, fill gaps, and put a clear forward schedule in place is the most efficient way to reset your baseline.',
          'Dofurs offers home vet consultations specifically designed for this kind of preventive care review. Our vets bring the visit to your home, review your pet\'s complete health history, and administer any overdue vaccines on the spot — so your pet\'s protection is current without the stress of a clinic trip. Book a consultation to get started.'
        ]
      }
    ]
  }
];

export const blogPostBySlug = Object.fromEntries(blogPosts.map((post) => [post.slug, post]));
