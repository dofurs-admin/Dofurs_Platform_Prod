# Graph Report - .  (2026-08-18)

## Corpus Check
- 659 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1938 nodes · 3077 edges · 67 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `POST()` - 38 edges
2. `GET()` - 36 edges
3. `PATCH()` - 15 edges
4. `buildDiscordBookingWebhookPayload()` - 14 edges
5. `openConfirm()` - 13 edges
6. `loadBookingConfirmationData()` - 13 edges
7. `createBookingWithLegacyServiceFallback()` - 12 edges
8. `middleware()` - 10 edges
9. `isMissingColumnError()` - 9 edges
10. `applyBookingStatusTransition()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `getEscalationState()` --calls--> `isRecord()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/escalations/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/payments/transactions/route.ts
- `POST()` --calls--> `getDaysSince()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/reminders/route.ts
- `POST()` --calls--> `safeTokenEqual()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/payments/cleanup-stale-transactions/route.ts
- `POST()` --calls--> `maybeSendSchedulerFailureAlert()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/reminders/schedule/route.ts
- `PATCH()` --calls--> `replaceProviderServiceIdsInNotes()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/profile/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/bookings/[id]/reassign/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (46): hasValidPetAgePrecision(), isValidPetAgeValue(), formatDateLabel(), formatDateTime(), formatTimeLabel(), buildBookingPricingSummary(), buildServiceLineBreakdown(), reconcileServiceLineTotals() (+38 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (92): addAddress(), addEmergencyContact(), addMedicalRecord(), addMinutesToTimeString(), addVaccination(), applyBookingStatusTransition(), cancelBooking(), cancelBookingAsProvider() (+84 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (26): BookingConfirmationPage(), buildCalendarHref(), buildDateFromParts(), formatBookingTime(), formatTimeValue(), getReadableAuthError(), getRetryAfterSeconds(), isRateLimitError() (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (31): collectUniqueAddressSegments(), formatAddressParts(), formatSavedAddress(), normalizeSegment(), sanitizeAddressText(), canMoveToStep(), formatCreditAmount(), goToStep() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (49): addDays(), adminRequest(), appendAvailabilitySlot(), applyBengaluruCityCoveragePreset(), applyBillingBulkStatus(), applyBillingEscalationAction(), applyBookingAdjustment(), applyBookingDatePreset() (+41 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (97): haversineDistanceKm(), toRadians(), normalizeOptionalString(), validateEmergencyPhones(), addDays(), appendInternalNote(), assertCampaignReferralCodeAvailable(), buildBundleSummaryNote() (+89 more)

### Community 6 - "Community 6"
Cohesion: 0.02
Nodes (17): formatMode(), formatTransactionType(), isInferredFallbackTransaction(), modeLabel(), cancelEdit(), fetchPlans(), handleCreate(), handleDelete() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (23): getErrorCode(), isMissingColumnError(), loadBookingAddonRowsByBookingIds(), formatBookingDateTime(), formatDate(), formatDateTime(), formatPaymentModeForDisplay(), formatTime() (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (34): forbidden(), getApiAuthContext(), getCurrentApiRole(), isRoleAllowed(), normalizeRoleName(), requireApiRole(), resolveRoleWithProviderPrecedence(), createRoleResolutionSupabase() (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (8): shouldTrackRequest(), toRequestUrl(), isNavHidden(), MobileBottomNav(), isInvalidRefreshTokenError(), loadCurrentUser(), getNotificationHref(), getNumberFromUnknown()

### Community 10 - "Community 10"
Cohesion: 0.04
Nodes (38): calculateAgeFromDOB(), formatDateInputValue(), formatISTDateTimeParts(), getISTTimestamp(), getPetDateOfBirthBounds(), isPetDateOfBirthWithinBounds(), evaluateDiscountForBooking(), normalizeServiceType() (+30 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (27): createCustomerProfileForBooking(), CustomerIntakeError, ensureOwnerProfileForBookingCustomer(), firstTrimmedString(), isPrivilegedRole(), normalizeExistingUser(), normalizeOwnerProfileGender(), normalizeRoleName() (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (15): buildBusinessReferralSignupLink(), getActiveBusinessReferralCampaignByCode(), getBusinessReferralCampaign(), getBusinessReferralCampaignSnapshot(), getBusinessReferralCampaignStats(), normalizeReferralCode(), upsertBusinessReferralCampaign(), formatServiceCoveragePincode() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (20): openCreateServiceModal(), parseOptionalInteger(), parseOptionalNumber(), resetServiceDraft(), saveService(), openCreateCategoryModal(), resetCategoryDraft(), absolutizeStorageUrl() (+12 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (28): getRelatedPosts(), getRelatedPostsFromCollection(), formatDisplayDate(), getPublicSupabaseClient(), getPublishedBlogPostBySlug(), getPublishedBlogPosts(), getRelatedPublishedBlogPosts(), loadPublishedDatabaseBlogPosts() (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (14): countBookingServiceUnits(), countDistinctBookingCustomers(), countEffectiveBookingStatus(), isMissingFunctionError(), isMissingTableError(), isRecord(), loadAdminDashboardBusinessStats(), loadAdminDashboardBusinessStatsFallback() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.05
Nodes (6): applyBillingEscalationAction(), createManualInvoice(), doApplyBillingEscalationAction(), doResolveReconciliationMismatch(), resetManualInvoiceComposer(), resolveReconciliationMismatch()

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (21): applyDiscount(), calculateDiscountAmount(), roundCurrency(), calculateAddOnTotal(), calculateBookingPriceWithSupabase(), isSchemaMissingError(), loadAddonServiceTypes(), normalizeErrorCode() (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (13): getGroomingPackageByServiceType(), getGroomingPackagePriceByServiceType(), normalizeSearchText(), normalizeServiceType(), deriveIncludedHint(), deriveIncludedSummary(), derivePlanFamilyLabel(), derivePlanSessionCount() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (27): buildAddOnLines(), extractPetIdsFromPayloadNode(), extractPetIdsFromPaymentMetadata(), extractProviderServiceIdsFromPayloadNode(), extractProviderServiceIdsFromPaymentMetadata(), getBookingConfirmationStatusLabel(), loadBookingConfirmationData(), normalizeStatus() (+19 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (24): buildDedupeKey(), buildDiscordBookingWebhookPayload(), compactText(), firstRelation(), formatCurrency(), formatSchedule(), formatTimeLabel(), getAdminBookingUrl() (+16 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (21): buildPaymentSummary(), loadInvoiceDetailForAdmin(), loadInvoiceDetailForUser(), parseRazorpayMethod(), sentenceCase(), toText(), buildInvoicePdfBuffer(), buildInvoicePrintHtml() (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (9): canTransition(), transitionFlow(), getReadableAuthError(), getRetryAfterSeconds(), handleSendOtp(), handleVerifyOtp(), isRateLimitError(), normalizeErrorMessage() (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.22
Nodes (7): addDays(), getDayName(), getDayOfWeek(), getIstNowParts(), resolveAvailableSlots(), resolveAvailableSlotsMultiDay(), resolveDayAvailability()

### Community 24 - "Community 24"
Cohesion: 0.23
Nodes (5): buildMrzLines(), buildPassportNumber(), formatDate(), toPassportCode(), toTitleCase()

### Community 25 - "Community 25"
Cohesion: 0.27
Nodes (5): claimPendingPetShares(), hasText(), listAccessiblePetsForUser(), normalizeEmail(), upsertPetShareForOwner()

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (5): bucketTemplate(), getDaysSince(), isRecord(), runBillingReminderAutomation(), toBucket()

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 30 - "Community 30"
Cohesion: 0.53
Nodes (3): checkDistributedRateLimit(), checkLocalRateLimit(), isRateLimited()

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (2): loadSubscriptions(), onCreditsUpdated()

### Community 32 - "Community 32"
Cohesion: 0.7
Nodes (4): mapKnownMessageToStatus(), mapSupabaseErrorCode(), sanitizeDatabaseError(), toFriendlyApiError()

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (2): defaultAsyncState(), useAsyncState()

### Community 34 - "Community 34"
Cohesion: 0.5
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 38`** (2 nodes): `global-error.tsx`, `GlobalError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `robots.ts`, `robots()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `QuickBookWidget.tsx`, `handleFind()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `DashboardShell.tsx`, `DashboardShell()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `BookingSummarySidebar.tsx`, `formatDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `PageLayout.tsx`, `PageLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `CreditBalanceWidget.tsx`, `formatServiceType()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `LoadingScreen.tsx`, `handleLoad()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `SlotPickerGrid.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `google-ads.test.ts`, `importGoogleAdsModule()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `DashboardLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `NotificationCenter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `SummaryCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `BookingsTabChunkV2.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `MetricGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `SectionHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `ServiceSelectionStep.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `BookingFlowLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `EditorLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `SettingsLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `BookingStatusTimeline.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `SubscriptionUpsellBanner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `dashboard-queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `owner-profile.database.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._