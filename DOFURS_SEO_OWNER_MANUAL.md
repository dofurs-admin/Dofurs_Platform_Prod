# Dofurs SEO Owner Manual

**Last rechecked:** 13 May 2026  
**Goal:** finish the owner-side work needed to get the Dofurs SEO launch indexed, trusted, and monitored.

This is the practical execution manual. The implementation exists in the repo, but production is not serving it yet.

---

## 1. Current Recheck Result

### What is complete in the local repo

- The repo is clean: no staged or unstaged file changes were present during the recheck.
- Local lint passes with `npm run lint`.
- Local SEO routes are working on `localhost:3000`:
  - `/sitemap.xml` returns 200.
  - `/robots.txt` returns 200.
  - `/manifest.webmanifest` returns 200.
  - `/locations/indiranagar` returns 200.
  - `/blog/pet-grooming-cost-bangalore-2026` returns 200.
- The local sitemap has 40 URLs and 17 blog image entries.
- The local sitemap includes the new blog and location pages.
- The local sitemap correctly excludes `/search` and `/refund-cancellation-policy`.
- Representative pages contain JSON-LD structured data locally.
- There are 17 blog posts and 6 neighbourhood landing pages in the local codebase.

### What is not complete yet

- Production at `https://dofurs.in` is not serving the SEO update yet. During recheck, these returned 404 or not found:
  - `https://dofurs.in/sitemap.xml`
  - `https://dofurs.in/robots.txt`
  - `https://dofurs.in/site.webmanifest`
  - `https://dofurs.in/manifest.webmanifest`
  - `https://dofurs.in/locations/indiranagar`
  - `https://dofurs.in/blog/pet-grooming-cost-bangalore-2026`
- The current local branch is `V-1.2.0`, and it does not exist on the remote yet.
- `origin/main` is behind the local branch that contains the SEO work.
- The previous handoff says the manifest lives at `/site.webmanifest`; with Next.js `app/manifest.ts`, the working local URL is `/manifest.webmanifest`.
- The manifest icon paths exist, but the actual image dimensions do not match the declared square icon sizes:
  - `public/logo/fav0d.png` is 525x578, declared as 192x192.
  - `public/logo/brand-logo.png` is 3614x1146, declared as 512x512.
- The footer social links and JSON-LD `sameAs` links do not fully match. Confirm the official profile URLs before final indexing.
- All 17 blog hero images are SVG placeholders. This is acceptable for launch, but real JPG/WebP photography should replace them for image SEO.
- Only Grooming, Boarding, and Pet Birthday currently have priced `Offer` data in service schema. Vet Visits, Pet Sitting, and Training need final package names/prices before offer schema can be completed.

---

## 2. Fastest Path To Finish SEO

Do these in order.

1. Deploy the branch that contains the SEO work.
2. Verify the live SEO URLs.
3. Set up Google Search Console and submit the sitemap.
4. Create or update Google Business Profile.
5. Confirm social profile URLs and service prices.
6. Replace placeholder SVG blog images with real photos.
7. Start reviews, backlinks, and weekly monitoring.

---

## 3. Deploy The SEO Work

### Option A: deploy the current branch directly

Use this if you want Render to deploy `V-1.2.0`.

```bash
git status -sb
npm run lint
git push -u origin V-1.2.0
```

Then in Render:

1. Open the Dofurs web service.
2. Go to **Settings**.
3. Change the deployed branch to `V-1.2.0`.
4. Trigger **Manual Deploy**.
5. Use **Clear build cache & deploy** if Render still shows old routes.

### Option B: merge the SEO work into `main`

Use this if Render deploys only `main`.

```bash
git status -sb
git checkout main
git pull origin main
git merge V-1.2.0
npm run lint
git push origin main
```

If Git reports conflicts, stop and resolve them before pushing. Do not force-push unless you are intentionally replacing remote history.

### Before deploy

- Make sure `.env.local` is not staged.
- Run `npm run lint`.
- Run `npm run build` only after stopping any local `next dev` server, because a dev server can write to `.next` while the build is reading it.

---

## 4. Verify Production After Deploy

Open these URLs in the browser after Render finishes deploying.

### Technical files

- `https://dofurs.in/sitemap.xml`
  - Expected: 200 response.
  - Expected: around 40 `<url>` entries.
  - Must include `https://dofurs.in/locations/indiranagar`.
  - Must include `https://dofurs.in/blog/pet-grooming-cost-bangalore-2026`.
  - Must not include `https://dofurs.in/search`.
  - Must not include `https://dofurs.in/refund-cancellation-policy`.
- `https://dofurs.in/robots.txt`
  - Expected: points to `https://dofurs.in/sitemap.xml`.
  - Expected: blocks `/api/`, `/auth/`, `/dashboard/`, `/forms/`, `/search`, and query-parameter duplicates.
- `https://dofurs.in/manifest.webmanifest`
  - Expected: JSON manifest.
  - Note: `/site.webmanifest` is not the active URL unless a separate route/static file is added.

### Sample public pages

- `https://dofurs.in/`
- `https://dofurs.in/services`
- `https://dofurs.in/services/grooming`
- `https://dofurs.in/locations`
- `https://dofurs.in/locations/indiranagar`
- `https://dofurs.in/blog`
- `https://dofurs.in/blog/pet-grooming-cost-bangalore-2026`
- `https://dofurs.in/faqs`
- `https://dofurs.in/about`
- `https://dofurs.in/contact-us`

### Structured data checks

Use these tools after deploy:

- Google Rich Results Test: `https://search.google.com/test/rich-results`
- Schema Markup Validator: `https://validator.schema.org/`

Test at least these URLs:

- `https://dofurs.in/`
- `https://dofurs.in/services/grooming`
- `https://dofurs.in/locations/indiranagar`
- `https://dofurs.in/blog/pet-grooming-cost-bangalore-2026`
- `https://dofurs.in/blog/puppy-vaccination-schedule-india`

Important: Google no longer shows every rich-result type for every site. FAQ, HowTo, and sitelinks search box reports may be limited or absent in Search Console even when schema is technically valid. Treat validator errors as action items; treat missing enhancement reports as normal unless Google reports an error.

---

## 5. Google Search Console Setup

### Create the property

1. Go to `https://search.google.com/search-console`.
2. Add `dofurs.in` as a **Domain property**.
3. Verify ownership with the DNS TXT record from Google.
4. If DNS access is not available immediately, use a URL-prefix property for `https://dofurs.in/` as a temporary fallback.

### Submit sitemap

1. Open **Sitemaps**.
2. Submit `https://dofurs.in/sitemap.xml`.
3. Confirm the status becomes **Success**.

### Request indexing

Use **URL Inspection** and request indexing for these first:

- `https://dofurs.in/`
- `https://dofurs.in/services`
- `https://dofurs.in/services/grooming`
- `https://dofurs.in/services/pet-boarding`
- `https://dofurs.in/services/pet-sitting`
- `https://dofurs.in/services/pet-birthday`
- `https://dofurs.in/services/training`
- `https://dofurs.in/services/vet-visits`
- `https://dofurs.in/locations`
- `https://dofurs.in/locations/indiranagar`
- `https://dofurs.in/locations/koramangala`
- `https://dofurs.in/locations/hsr-layout`
- `https://dofurs.in/locations/whitefield`
- `https://dofurs.in/locations/electronic-city`
- `https://dofurs.in/locations/jayanagar`
- `https://dofurs.in/blog`
- `https://dofurs.in/blog/pet-grooming-cost-bangalore-2026`
- `https://dofurs.in/blog/summer-pet-care-bangalore`
- `https://dofurs.in/blog/pet-boarding-vs-pet-sitting-bangalore`
- `https://dofurs.in/blog/puppy-vaccination-schedule-india`
- `https://dofurs.in/blog/golden-retriever-grooming-bangalore`
- `https://dofurs.in/blog/finding-trusted-vet-bangalore`
- `https://dofurs.in/blog/pet-friendly-bangalore-guide`
- `https://dofurs.in/blog/emergency-pet-care-bangalore`
- `https://dofurs.in/about`
- `https://dofurs.in/contact-us`
- `https://dofurs.in/faqs`

Do not request indexing for:

- `/api/*`
- `/auth/*`
- `/dashboard/*`
- `/forms/*`
- `/search`
- `/refund-cancellation-policy`

### What to monitor in Search Console

Check weekly for the first 8 weeks:

- **Indexing > Pages:** public SEO URLs should move from discovered/crawled to indexed.
- **Sitemaps:** sitemap should stay successful.
- **Performance:** impressions should appear before clicks.
- **Queries:** watch for Bangalore local-intent terms.
- **Page Experience/Core Web Vitals:** flag any poor URLs for a performance pass.
- **Manual actions/Security issues:** should stay clean.

---

## 6. Google Business Profile Setup

This is the highest-impact owner-side SEO task for Bangalore local search.

### Core profile details

Use the same details everywhere:

```text
Business name: Dofurs
Website: https://dofurs.in
Phone: +91 70083 65175
Email: petcare@dofurs.in
Hours: Monday to Sunday, 8:00 AM to 9:00 PM
Primary category: Pet Care Service
Secondary categories: Pet Groomer, Pet Sitter, Dog Trainer, Pet Boarding Service
Veterinarian category: use only if Dofurs directly provides licensed veterinary service under proper supervision
Service area: Bengaluru plus Indiranagar, Koramangala, HSR Layout, Whitefield, Electronic City, Jayanagar
```

### Business description

Use this as the first version:

```text
Dofurs connects Bangalore pet parents with verified pet care professionals for doorstep grooming, vet home visits, pet boarding, pet sitting, dog training, and pet birthday celebrations. Book trusted pet services with transparent pricing, digital support, and convenient scheduling across Bengaluru.
```

### Services to add

Add these as Google Business services:

- Pet Grooming
  - Starting price: INR 899
  - Description: Doorstep pet grooming with bath, brushing, nail trimming, ear cleaning, haircuts, de-shedding, and pet-safe products from verified groomers.
- Pet Boarding
  - Starting price: INR 999 per night
  - Description: Safe overnight pet boarding with verified caregivers, walks, feeding, supervision, and daily updates.
- Pet Birthday Celebrations
  - Starting price: INR 1,999
  - Description: Pet birthday party setup with decor, pet-safe treats or cake, and celebration support.
- Vet Home Visits
  - Add final starting price after confirming your vet pricing.
  - Description: Veterinary home visits for wellness checks, vaccination guidance, preventive care, and non-emergency consultations.
- Pet Sitting
  - Add final starting price after confirming your sitting pricing.
  - Description: In-home pet sitting with feeding, walks, playtime, companionship, and photo updates while pet parents travel or work.
- Dog Training
  - Add final starting price after confirming your training pricing.
  - Description: Positive-reinforcement dog training for puppy basics, obedience, leash manners, behaviour correction, and confidence building.

### Photos to upload

Upload 8 to 12 real photos immediately:

- Grooming in progress.
- Before/after grooming.
- Happy pet parent with pet.
- Dofurs team/provider photo.
- Pet-safe grooming products.
- Boarding/sitting environment.
- Branded uniform, kit, backdrop, or vehicle if available.
- Close-up of a clean, happy pet after service.

Use real Dofurs photos, not stock photos. Avoid dark, blurry, heavily filtered, or cropped images.

### Reviews

Ask 15 to 20 real happy customers for reviews in week 1.

Suggested WhatsApp message:

```text
Hi [Name], thank you for trusting Dofurs with [Pet Name]. If the service helped you, could you leave us a quick Google review? It helps other Bangalore pet parents find safe and verified care. Here is the link: [Google review link]
```

Do not offer discounts, gifts, or rewards in exchange for reviews. Google can remove incentivized reviews.

### Weekly Google Business posts

Post once per week for 8 weeks:

1. Week 1: Doorstep grooming in Bangalore.
2. Week 2: Indiranagar/Koramangala coverage.
3. Week 3: Pet grooming cost guide.
4. Week 4: Puppy vaccination schedule.
5. Week 5: Summer pet care.
6. Week 6: Pet boarding vs pet sitting.
7. Week 7: Whitefield/HSR/Electronic City coverage.
8. Week 8: Customer review or real service photo.

---

## 7. Social Profile Cleanup

Confirm the official Dofurs social URLs before Google finishes indexing.

Visible footer links currently point to:

- X/Twitter: `https://x.com/dofurs`
- YouTube: `https://www.youtube.com/@dofurspetcare`
- LinkedIn: `https://www.linkedin.com/company/dofurs-petcare/`
- Instagram: `https://www.instagram.com/dofurs.petcare/`
- Facebook: `https://www.facebook.com/profile.php?id=61568180277956`

JSON-LD currently uses different hardcoded `sameAs` URLs for Instagram, Facebook, and LinkedIn. After you confirm the official profile URLs, update the schema to match the real profiles exactly.

Fill this in:

```text
Official Instagram:
Official Facebook:
Official LinkedIn:
Official YouTube:
Official X/Twitter:
```

Then update:

- `app/layout.tsx` Organization `sameAs`.
- `app/layout.tsx` LocalBusiness `sameAs`.
- `components/Footer.tsx`, if any visible footer URL is wrong.

---

## 8. Image And Icon Tasks

### Replace blog SVGs with real photos

There are 17 SVG blog hero images. Replace the 8 newest SEO posts first:

- `pet-grooming-cost-bangalore-2026`
- `summer-pet-care-bangalore`
- `pet-boarding-vs-pet-sitting-bangalore`
- `puppy-vaccination-schedule-india`
- `golden-retriever-grooming-bangalore`
- `finding-trusted-vet-bangalore`
- `pet-friendly-bangalore-guide`
- `emergency-pet-care-bangalore`

Image spec:

- Format: WebP or JPG.
- Size: 1200x630.
- File size target: under 250 KB each.
- Use real photos from Dofurs services or locally relevant Bangalore pet-care contexts.
- Avoid stock-looking, dark, blurry, or purely decorative images.
- Keep alt text descriptive and location-aware.

If you keep the same public path, no code change is needed. If you rename files, update `heroImageSrc` in `lib/blog-posts.ts`.

### Replace the default OG image only if you have a better one

Current `public/logo/og-default.jpg` is correctly 1200x630.

Optional upgrade:

- Use a polished branded real-photo image.
- Keep it 1200x630.
- Keep the same filename unless you also update every metadata reference.

### Fix PWA icons

Prepare these square assets:

- `public/logo/icon-192.png` - 192x192.
- `public/logo/icon-512.png` - 512x512.
- `public/logo/icon-maskable-512.png` - 512x512 with safe padding around the logo.

After assets are ready, update `app/manifest.ts` to reference them. This avoids manifest warnings from non-square logo files.

---

## 9. Service Price Data To Confirm

Confirm the final public starting prices for these services:

```text
Vet home visit starting price:
Vet teleconsult starting price:
Pet sitting per visit starting price:
Pet sitting overnight or full-day starting price:
Dog training single session starting price:
Dog training package starting price:
```

Once confirmed, add the same prices in three places:

- Google Business Profile services.
- Service page visible copy, if needed.
- Service JSON-LD offers in the relevant service pages.

Current priced schema coverage:

- Grooming: priced offers present.
- Pet Boarding: priced offers present.
- Pet Birthday: priced offers present.
- Vet Visits: no priced offers yet.
- Pet Sitting: no priced offers yet.
- Training: no priced offers yet.

---

## 10. Directory And Backlink Work

Use the same NAP details everywhere:

```text
Name: Dofurs
Phone: +91 70083 65175
Website: https://dofurs.in
Area served: Bengaluru
Description: Dofurs connects Bangalore pet parents with verified pet care professionals for grooming, vet visits, boarding, sitting, training, and pet birthday celebrations.
```

### Week 1 to 2: core business listings

- Google Business Profile.
- Bing Places.
- Apple Business Connect.
- Facebook Business Page.
- LinkedIn Company Page.
- Instagram Business account.

### Week 3: local Indian directories

- Justdial.
- Sulekha.
- UrbanPro.
- IndiaMART, if relevant.
- Yellow Pages India.
- Trustpilot or similar review profile.

### Week 4: pet and Bangalore relevance

- Pet industry directories.
- Bangalore pet shops willing to list Dofurs as a partner.
- Non-competing vet clinics.
- Apartment community vendor lists.
- Local pet parent Instagram/community pages.

Track every listing in a spreadsheet with these columns:

```text
Platform | URL | Login email | Status | Phone verified | Website linked | Notes | Next follow-up date
```

Avoid low-quality paid backlinks and random spam directories. Local relevance and real customer trust matter more.

---

## 11. Content Cadence

Publish one new blog per week for 12 weeks after launch.

Recommended queue:

1. Best dog breeds for apartments in Bangalore.
2. Cat boarding cost in Bangalore 2026.
3. How to relocate pets to or from Bangalore.
4. Monsoon skin infections in Bangalore pets.
5. Top 10 pet shops in Bangalore.
6. Home remedies Bangalore vets actually recommend.
7. Indie dog adoption in Bangalore.
8. Pet diet for Bangalore's climate.
9. Senior dog care in Bangalore.
10. Training a reactive dog in Bangalore.
11. Stray cat care in Bangalore.
12. First week with a new puppy in Bangalore.

Each post should include:

- A clear local search target.
- Bangalore-specific details.
- Practical guidance, not generic filler.
- At least 4 to 7 strong H2 sections.
- A real hero photo.
- Internal links to services and location pages.

---

## 12. Weekly Monitoring Checklist

Run this every week for the first 8 weeks after deploy.

- Search Console: sitemap status is successful.
- Search Console: public SEO pages are being indexed.
- Search Console: impressions are increasing.
- Search Console: no manual actions or security issues.
- Search Console: Core Web Vitals has no poor URLs.
- Google Business Profile: check calls, website clicks, direction requests, and searches.
- Google Business Profile: add one new post or photo.
- Google Business Profile: ask 3 to 5 customers for reviews.
- Google search: run `site:dofurs.in` and confirm the new blog/location URLs appear.
- Rich Results Test: spot-check one service, one location, and one blog page.

---

## 13. Red Flags To Fix Quickly

Fix these immediately if they appear:

- Live `/sitemap.xml` returns 404.
- Live `/robots.txt` returns 404.
- Any public SEO page returns 404 after deployment.
- Search Console says submitted URL is blocked by robots.txt for a public SEO page.
- Search Console indexes `/search`, `/auth`, `/dashboard`, or `/forms` pages.
- Google Business Profile phone, hours, or website do not match the website.
- Reviews mention a different brand name, phone number, or location.
- Social profiles point to inactive or wrong handles.

---

## 14. What To Ask Copilot To Do Next

After you finish the owner-side items, ask for these code follow-ups:

1. Update schema `sameAs` links with confirmed social URLs.
2. Add final priced offer schema for Vet Visits, Pet Sitting, and Training.
3. Add square PWA icons and update `app/manifest.ts`.
4. Add a footer link to `/locations` after the pages are live.
5. Replace blog SVG paths with real WebP/JPG paths if filenames change.
6. Update homepage AggregateRating only after Google Business Profile has real review count/rating data.
