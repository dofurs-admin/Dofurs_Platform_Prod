# Dofurs Grooming-Only Pivot Plan

Date: 22 May 2026
Scope: content, SEO, booking flow, service catalog, admin/provider operations, and migration safety.

## Council Used

This plan synthesizes a read-only council review from these lenses:

- Explore agent: public content and codebase inventory.
- Next.js Expert: App Router metadata, sitemap, canonical, schema, and redirect risk.
- gem-designer: information architecture, UX copy, CTAs, and trust messaging.
- Principal software engineer: service-catalog, booking, admin/provider, subscription-credit, and rollback risk.
- Main synthesis: business-positioning and phased execution plan.

## Executive Summary

Dofurs should become a clear grooming specialist across the public website and product flows. The current site already says grooming is live, but it still markets Dofurs as a broad pet-care marketplace with vet visits, boarding, sitting, training, and birthday services as coming-soon lines.

The important implementation principle is: do not hard-delete non-grooming service data first. Deactivate and filter non-grooming services while preserving old rows, bookings, invoices, payment metadata, subscription records, and reporting history. Public content can then be changed safely without leaving backend paths that still create non-grooming bookings.

Recommended primary positioning:

> Doorstep pet grooming in Bangalore by verified groomers, with transparent package pricing, hygiene-first handling, and pincode-based availability.

Recommended primary CTA language:

- Book Grooming
- View Grooming Packages
- Check My Pincode
- WhatsApp Grooming Support

Avoid public CTAs like "Book a Service", "Explore Services", "Review Service Lines", and marketplace language while only grooming is bookable.

## Current-State Findings

### Public Content Still Says Broad Pet Services

- `app/layout.tsx` root metadata title says "Premium Pet Services in Bangalore - Grooming, Vet, Boarding" and JSON-LD describes grooming, veterinary, boarding, sitting, training, and birthday professionals.
- `app/page.tsx` hero says "Premium Pet Care" and CTAs say "Book a Service" and "Review Service Lines".
- `lib/site-data.ts` exposes six nav service items: Grooming, Pet Birthday, Pet Boarding, Vet Visits, Pet Sitting, and Training.
- `lib/site-data.ts` reviews mention grooming plus sitting and vet teleconsult.
- `app/services/page.tsx` is a broad services hub and includes six service categories.
- Five non-grooming landing pages exist under `app/services/`: pet birthday, pet boarding, pet sitting, training, and vet visits.
- `app/locations/page.tsx` and `app/locations/[slug]/page.tsx` describe "pet services" and include keywords for vet, boarding, sitting, and training.
- `app/blog/page.tsx` and `lib/blog-posts.ts` include non-grooming blog topics such as vet care, boarding vs sitting, training, vaccination, and emergency pet care.
- `app/sitemap.ts` indexes non-grooming service pages with high priorities.
- `next.config.ts` redirects `/services/vet` and `/services/teleconsult` to `/services/vet-visits`, which becomes stale if vet pages are retired.

### Product Flows Are Still Service-Agnostic

- `app/forms/customer-booking/page.tsx` title is still "Book Premium Pet Care in Minutes".
- `components/forms/PremiumUserBookingFlow.tsx` still has birthday/boarding package logic and multi-service selection assumptions.
- `components/QuickBookWidget.tsx` presents multiple service choices.
- Dashboard empty states and CTAs still use generic "Book a Service" wording.
- Search suggestions include broad service terms.

### Backend Still Allows Broad Service Exposure

- `app/api/bookings/catalog/route.ts` returns all active provider services for the booking catalog.
- `app/api/bookings/create/route.ts` accepts any active provider service that passes validation; UI hiding alone is not enough.
- `app/api/services/**` public service catalog endpoints can expose non-grooming categories/services.
- Admin service APIs and provider rollout flows can recreate or reactivate non-grooming services unless guarded.
- Subscription-credit and plan surfaces still support service-type families beyond grooming.

## Strategic SEO Decision

Use a focused SEO consolidation strategy instead of abruptly deleting everything.

### Recommended Route Policy

1. Make `/services/grooming/bangalore` the primary commercial page.
2. Redirect `/services/grooming` to `/services/grooming/bangalore`, or keep it as a thin canonical alias only if needed. Avoid two competing grooming landing pages.
3. Rework `/services` into a grooming hub, not a broad services hub.
4. Remove non-grooming service pages from primary navigation and sitemap immediately after redirects/noindex decisions are implemented.
5. For non-grooming service pages, choose one policy:
   - If the service is not planned for the next 6 months: 301 redirect to `/services/grooming/bangalore` or `/services` after rewriting the destination as a grooming hub.
   - If the service may return later: keep the page as a waitlist page, add a first-screen disclaimer, mark it `noindex`, remove it from sitemap, and remove it from primary nav.
6. Do not block retired URLs in `robots.txt` if using `noindex`; Google needs to crawl the page to see the noindex directive.

### Metadata and Schema Updates

- Root title: change to "Doorstep Pet Grooming in Bangalore | Dofurs" or similar.
- Root description: focus on verified groomers, package pricing, hygiene, and Bangalore doorstep coverage.
- Root keywords: remove vet, boarding, sitting, training, birthday, and broad marketplace terms.
- Organization and LocalBusiness JSON-LD: remove non-grooming services from descriptions and `hasOfferCatalog`.
- Service JSON-LD: expose only grooming package offers.
- Services ItemList schema: list grooming packages or grooming page links only.
- Location LocalBusiness schema: rename from "Pet Services in [Area]" to "Pet Grooming in [Area]".
- Blog schema: keep article schema, but ensure off-topic posts do not funnel users into unavailable services.

### Blog and Content SEO Policy

Keep grooming-relevant content and expand it. Do not automatically delete all non-grooming blog posts, because they may have search value and backlinks.

Recommended treatments:

- Keep and prioritize grooming posts: grooming cost, breed grooming, coat care, tick control, monsoon paw/coat care, package comparison, cat grooming, apartment grooming, and pincode/location grooming posts.
- Rewrite general care posts where grooming is a legitimate part of the answer, for example monsoon care and summer pet care.
- Archive or noindex non-grooming commercial-intent posts if they create misleading demand, especially vet, boarding, sitting, training, vaccination, and emergency-care pages.
- For retained educational posts, remove CTAs to book unavailable services and point to grooming support only when relevant.

## New Information Architecture

Primary navigation:

- Grooming
- Packages & Pricing
- Locations
- FAQs
- Blog
- Contact
- Book Grooming

Secondary or footer navigation:

- About
- Refer & Earn
- Partner With Dofurs
- Policies
- Account

Homepage order:

1. Grooming-only hero with direct booking CTA.
2. Package comparison: Monthly Care, Fur Bath Care, Fur Makeover, Essential Grooming, Complete Care.
3. Pincode/coverage reassurance.
4. Hygiene and trust proof: verified groomers, sanitized tools, pet-safe products, calm handling.
5. How booking works for grooming.
6. Grooming-only testimonials.
7. Location coverage.
8. Grooming FAQs.
9. Grooming blog guides.
10. Referral or future-service waitlist content below the main conversion path.

## Copy System

Core promise:

> Doorstep pet grooming in Bangalore, done by verified groomers with transparent package pricing and calm, hygiene-first handling.

Proof pillars:

- Verified groomers.
- Sanitized grooming toolkit.
- Pet-safe shampoos and conditioners.
- Apartment-friendly doorstep setup.
- Transparent package inclusions and pricing.
- Pincode-based availability.
- WhatsApp support before and after the appointment.

Words to replace:

- "Pet services" -> "Pet grooming" where the context is bookable services.
- "Book a Service" -> "Book Grooming".
- "Explore Services" -> "View Grooming Packages".
- "Service Lines" -> "Grooming Packages".
- "Marketplace" -> "Grooming service" or "grooming provider network" only where network language is needed.

Suggested future-service disclaimer if any waitlist pages remain:

> Dofurs currently accepts grooming bookings only. This service is not bookable yet. Join the WhatsApp waitlist for launch updates.

## Implementation Plan

### Phase 0: Business and Data Inventory

Goal: know what exists before changing behavior.

Actions:

- Count active `provider_services` by `service_type` and category.
- Count historical bookings by `service_type` and status.
- Count active subscription credits by service family.
- Export active non-grooming service row IDs for rollback.
- Check Search Console or analytics for traffic/backlinks to non-grooming service/blog URLs.
- Decide if non-grooming service pages are 301 redirects or noindex waitlist pages.

Deliverable: a short inventory table and route-policy decision list.

### Phase 1: Safety Gates Before Public Cleanup

Goal: make grooming-only true in the product, not just in copy.

Actions:

- Add one central grooming predicate, for example `isGroomingServiceType`, near `lib/service-catalog/grooming-packages.ts` or a new `lib/service-catalog/service-scope.ts`.
- Filter `app/api/bookings/catalog/route.ts` to return only grooming provider services for customer/provider booking flows.
- Add a server-side guard in `app/api/bookings/create/route.ts` that rejects non-grooming provider services for user/provider-created bookings.
- Keep admin/staff override explicit only if needed for legacy support or offline corrections.
- Filter public `app/api/services/**` endpoints to grooming-only where used by public UI.
- Mark non-grooming provider service templates and rollouts inactive in data. Do not delete rows.

Tests:

- Grooming booking creation succeeds.
- Non-grooming booking creation is rejected server-side.
- Inactive historical non-grooming bookings still render in confirmation/dashboard/admin views.
- Catalog returns no non-grooming services for normal users.

### Phase 2: Public Website Repositioning

Goal: make the first impression unmistakably grooming-only.

Actions:

- Update `app/layout.tsx` metadata, OpenGraph, Twitter, and JSON-LD.
- Rewrite `app/page.tsx` hero, CTAs, service-mode cards, discovery section, booking steps, testimonials, and referral copy.
- Update `lib/site-data.ts` nav service items, services array, steps, WhatsApp text, and reviews.
- Rework `app/services/page.tsx` into a grooming hub.
- Remove non-grooming entries from nav/search/quick booking.
- Update dashboard CTAs and empty states from "service" to "grooming".
- Update `app/forms/customer-booking/page.tsx` title and hero alt text to grooming-specific language.

### Phase 3: SEO Routing, Sitemap, and Schema

Goal: consolidate authority and avoid misleading indexed pages.

Actions:

- Update `next.config.ts` redirects for retired service aliases.
- Remove redirected/noindexed non-grooming service routes from `app/sitemap.ts`.
- Update `app/robots.ts` only if needed; do not use robots disallow for noindex pages.
- Merge or redirect `/services/grooming` into `/services/grooming/bangalore`.
- Update `app/services/grooming/page.tsx` and `app/services/grooming/bangalore/page.tsx` so only one page is canonical.
- Update location page metadata, headings, schema, and FAQs to "Pet Grooming in [Area]".
- Update blog listing metadata from broad pet care to grooming-first editorial.
- Validate schema with Rich Results Test and Schema Markup Validator after deployment.

### Phase 4: Admin, Provider, Subscription, and Operations Cleanup

Goal: prevent accidental re-expansion through internal tools.

Actions:

- Add guardrails in admin service APIs so non-grooming templates cannot be created/reactivated without a deliberate internal override.
- Update admin/provider service management UI to show grooming-only creation paths.
- Update provider application forms to collect grooming capabilities only.
- Disable new non-grooming subscription-credit issuance and redemption.
- Decide how to handle existing non-grooming credits: convert to grooming credit, expire with notice, refund, or support manually.
- Preserve historical reporting labels for old bookings.

### Phase 5: Launch and Monitoring

Goal: catch SEO and conversion regressions quickly.

Actions:

- Deploy safety gates and public content changes together or safety gates first.
- Submit the updated sitemap in Google Search Console.
- Request indexing for `/`, `/services`, `/services/grooming/bangalore`, `/locations`, and high-priority location pages.
- Monitor 404s, redirect hits, indexed pages, impressions, and crawl errors for 4-8 weeks.
- Monitor product metrics: booking starts, booking completion, WhatsApp clicks, pincode failures, and rejected non-grooming booking attempts.

## Priority File Checklist

High priority public content:

- `app/layout.tsx`
- `app/page.tsx`
- `lib/site-data.ts`
- `app/services/page.tsx`
- `app/services/grooming/page.tsx`
- `app/services/grooming/bangalore/page.tsx`
- `app/locations/page.tsx`
- `app/locations/[slug]/page.tsx`
- `lib/service-areas.ts`
- `app/blog/page.tsx`
- `lib/blog-posts.ts`
- `lib/faqs-data.ts`
- `app/faqs/page.tsx`
- `app/sitemap.ts`
- `next.config.ts`

High priority product and API safety:

- `app/api/bookings/catalog/route.ts`
- `app/api/bookings/create/route.ts`
- `app/api/services/**`
- `components/forms/PremiumUserBookingFlow.tsx`
- `app/forms/customer-booking/page.tsx`
- `components/QuickBookWidget.tsx`
- `components/dashboard/UserDashboardClient.tsx`
- `components/dashboard/admin/views/AdminServicesView.tsx`
- `app/api/admin/services/**`
- `app/api/admin/providers/[id]/services/route.ts`
- `lib/provider-management/service.ts`
- `lib/subscriptions/serviceTypeMatching.ts`
- `components/ui/CreditBalanceWidget.tsx`

## Route Treatment Matrix

| Route | Recommended treatment | SEO reason |
|---|---|---|
| `/services/grooming/bangalore` | Keep as primary canonical page | Highest commercial intent for Bangalore grooming |
| `/services/grooming` | 301 to primary page or canonical alias | Avoid duplicate grooming landing pages |
| `/services` | Rewrite as grooming hub | Keeps service-hub authority but matches business focus |
| `/services/pet-boarding` | 301 or noindex waitlist | Remove misleading non-bookable service from index |
| `/services/pet-sitting` | 301 or noindex waitlist | Remove misleading non-bookable service from index |
| `/services/pet-birthday` | 301 or noindex waitlist | Remove misleading non-bookable service from index |
| `/services/training` | 301 or noindex waitlist | Remove misleading non-bookable service from index |
| `/services/vet-visits` | 301 or noindex waitlist | Avoid medical-service expectations if not operating |
| `/services/vet` | Redirect according to vet-visits decision | Current redirect points to stale broad-service page |
| `/services/teleconsult` | Redirect according to vet-visits decision | Current redirect points to stale broad-service page |
| `/locations/[slug]` | Keep and rewrite to grooming | Valuable local SEO landing pages |
| Non-grooming blog posts | Rewrite, archive, noindex, or keep educational | Preserve useful authority without misleading CTAs |

## Risk Register

| Risk | Severity | Mitigation |
|---|---:|---|
| Non-grooming bookings still created through API | Critical | Add server-side grooming guard in catalog and create endpoints |
| Historical bookings break after deleting service rows | Critical | Deactivate rows, do not delete; keep old booking service_type values |
| SEO loss from abrupt 404s | High | Use 301 redirects or noindex waitlist pages, update sitemap |
| Misleading JSON-LD advertises unavailable services | High | Remove non-grooming offers and descriptions from schema |
| Admin/provider tools recreate old services | High | Add API and UI guardrails for service creation/reactivation |
| Subscription credits become orphaned | High | Inventory active credits and define conversion/refund policy |
| Two grooming pages compete with each other | Medium | Consolidate canonical to `/services/grooming/bangalore` |
| Blog loses useful informational traffic | Medium | Rewrite or archive selectively, do not blanket-delete without traffic data |
| Support burden from old indexed pages | Medium | Use clear waitlist disclaimers or redirects |

## Success Metrics

SEO:

- Updated sitemap accepted in Google Search Console.
- No growth in 404 errors from retired service URLs.
- `/services/grooming/bangalore` and priority location pages indexed.
- Impressions grow for grooming queries such as "pet grooming Bangalore", "dog grooming at home Bangalore", "cat grooming Bangalore", and neighborhood-specific grooming queries.
- Structured data validates without non-grooming offers.

Product:

- Customer catalog contains grooming services only.
- Non-grooming booking creation attempts are rejected server-side.
- Booking start-to-complete rate improves after grooming-specific copy.
- WhatsApp clicks and pincode checks are attributable to grooming pages.

Operations:

- Active non-grooming provider_services count is zero, unless explicitly marked as legacy/admin-only.
- Admin/provider tools cannot accidentally reactivate non-grooming services.
- Existing non-grooming bookings and invoices remain readable.

## Open Decisions

1. Are vet, boarding, sitting, training, and birthday services paused temporarily or retired for the foreseeable future?
2. Should retired service pages redirect to grooming, remain as noindex waitlist pages, or return 410 after a transition period?
3. Are there active subscriptions or credits tied to non-grooming services?
4. Are there active or pending non-grooming bookings in production?
5. Which grooming page should be the single canonical URL: `/services/grooming/bangalore` is recommended.
6. Should Google Business Profile categories be narrowed to Pet Groomer as primary, with Pet Care Service secondary?

## Recommended First Sprint

1. Complete Phase 0 inventory and route-policy decisions.
2. Add the central grooming predicate and server-side booking/catalog guards.
3. Deactivate non-grooming provider service rows without deleting historical data.
4. Rewrite root metadata, homepage hero, nav, services hub, and sitemap.
5. Consolidate grooming page canonical/redirect behavior.
6. Update location page titles/descriptions to grooming-only.
7. Run lint, targeted tests for booking/catalog behavior, and schema validation.
