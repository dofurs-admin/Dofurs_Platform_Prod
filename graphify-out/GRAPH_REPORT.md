# Graph Report - .  (2026-04-24)

## Corpus Check
- 594 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1563 nodes · 2411 edges · 66 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `GET()` - 36 edges
2. `POST()` - 28 edges
3. `openConfirm()` - 13 edges
4. `createBookingWithLegacyServiceFallback()` - 12 edges
5. `isMissingColumnError()` - 9 edges
6. `applyBookingStatusTransition()` - 9 edges
7. `PATCH()` - 7 edges
8. `getErrorCode()` - 7 edges
9. `handleSendOtp()` - 6 edges
10. `isLikelyStorageObjectPath()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `getEscalationState()` --calls--> `isRecord()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/escalations/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/payments/transactions/route.ts
- `POST()` --calls--> `buildInvoiceNumber()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/invoices/route.ts
- `POST()` --calls--> `getDaysSince()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/reminders/route.ts
- `POST()` --calls--> `safeTokenEqual()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/reminders/schedule/route.ts
- `POST()` --calls--> `maybeSendSchedulerFailureAlert()`  [EXTRACTED]
  /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/user/pets/route.ts → /Users/himansu/Documents/GitHub/Dofurs_Platform_Prod/app/api/admin/billing/reminders/schedule/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (90): addAddress(), addEmergencyContact(), addMedicalRecord(), addMinutesToTimeString(), addVaccination(), applyBookingStatusTransition(), cancelBooking(), cancelBookingAsProvider() (+82 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (13): formatDateLabel(), formatDateTime(), formatTimeLabel(), calculateCompletion(), loadProfile(), normalizePetGenderValue(), saveCurrentStep(), mapProfileToDraft() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (29): collectUniqueAddressSegments(), formatAddressParts(), formatSavedAddress(), normalizeSegment(), sanitizeAddressText(), canMoveToStep(), goToStep(), resolveBookingMode() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (35): adminRequest(), appendAvailabilitySlot(), applyBillingBulkStatus(), applyBillingEscalationAction(), applyBookingAdjustment(), applyBookingStatusForIds(), applyBulkStatus(), clearSelectedSla() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (78): haversineDistanceKm(), toRadians(), normalizeOptionalString(), validateEmergencyPhones(), addDays(), buildBundleSummaryNote(), buildCalendarCacheKey(), buildCandidateQueue() (+70 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (12): getReadableAuthError(), getRetryAfterSeconds(), isRateLimitError(), normalizeStoragePathCandidate(), parseSelectedPetId(), ProviderDashboardPage(), ProviderTodayPage(), resolveBookingId() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (8): shouldTrackRequest(), toRequestUrl(), isNavHidden(), MobileBottomNav(), isInvalidRefreshTokenError(), loadCurrentUser(), getNotificationHref(), getNumberFromUnknown()

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (33): calculateAgeFromDOB(), formatDateInputValue(), formatISTDateTimeParts(), getISTTimestamp(), getPetDateOfBirthBounds(), isPetDateOfBirthWithinBounds(), createServiceInvoice(), createSubscriptionInvoice() (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (17): getErrorCode(), isMissingColumnError(), loadBookingAddonRowsByBookingIds(), formatBookingDateTime(), formatBookingMode(), formatDate(), formatDateTime(), formatTime() (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (15): formatMode(), formatTransactionType(), isInferredFallbackTransaction(), modeLabel(), cancelEdit(), fetchPlans(), handleCreate(), handleDelete() (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (20): forbidden(), getApiAuthContext(), getCurrentApiRole(), isRoleAllowed(), normalizeRoleName(), requireApiRole(), resolveRoleWithProviderPrecedence(), unauthorized() (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (17): bucketTemplate(), getDaysSince(), isRecord(), runBillingReminderAutomation(), toBucket(), applyDiscount(), calculateDiscountAmount(), roundCurrency() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (9): handleAutofillCoordinatesFromAddress(), handleClose(), handleCoordinateSelection(), handleNext(), handleSubmit(), resetLocationUiState(), validateStep(), formatUploadError() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (10): extractIndianPhoneDigits(), toIndianE164(), isValidIndianPincode(), lookupPincode(), fieldError(), isFieldRequired(), submitApplication(), validateForm() (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (12): buildStepPayload(), canLeaveCurrentContext(), handleNextOrComplete(), handler(), isTypingTarget(), jumpToFirstError(), jumpToStepWithHighlight(), loadPetShares() (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (6): applyBillingEscalationAction(), createManualInvoice(), doApplyBillingEscalationAction(), doResolveReconciliationMismatch(), resetManualInvoiceComposer(), resolveReconciliationMismatch()

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (16): addAddon(), clamp(), reloadAfterMutation(), removeItem(), updateItem(), buildBookingPricingSummary(), buildServiceLineBreakdown(), reconcileServiceLineTotals() (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (9): getGroomingPackageByServiceType(), normalizeServiceType(), deriveIncludedHint(), deriveIncludedSummary(), derivePrimaryServiceType(), formatPriceInr(), formatServiceType(), onCreditsUpdated() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (17): buildMrzLines(), buildPassportNumber(), formatDate(), toPassportCode(), toTitleCase(), absolutizeStorageUrl(), createSignedReadUrl(), extractStorageTarget() (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (7): buildBusinessReferralSignupLink(), getActiveBusinessReferralCampaignByCode(), getBusinessReferralCampaign(), getBusinessReferralCampaignSnapshot(), getBusinessReferralCampaignStats(), normalizeReferralCode(), upsertBusinessReferralCampaign()

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (7): openCreateServiceModal(), parseOptionalInteger(), parseOptionalNumber(), resetServiceDraft(), saveService(), openCreateCategoryModal(), resetCategoryDraft()

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (21): buildPaymentSummary(), loadInvoiceDetailForAdmin(), loadInvoiceDetailForUser(), parseRazorpayMethod(), sentenceCase(), toText(), buildInvoicePdfBuffer(), buildInvoicePrintHtml() (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (9): canTransition(), transitionFlow(), getReadableAuthError(), getRetryAfterSeconds(), handleSendOtp(), handleVerifyOtp(), isRateLimitError(), normalizeErrorMessage() (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.19
Nodes (9): calculateLightweightPetCompletion(), calculatePetCompletionFromSections(), derivePetCompletionSections(), hasText(), claimPendingPetShares(), hasText(), listAccessiblePetsForUser(), normalizeEmail() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (7): addDays(), getDayName(), getDayOfWeek(), getIstNowParts(), resolveAvailableSlots(), resolveAvailableSlotsMultiDay(), resolveDayAvailability()

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 29 - "Community 29"
Cohesion: 0.53
Nodes (3): checkDistributedRateLimit(), checkLocalRateLimit(), isRateLimited()

### Community 30 - "Community 30"
Cohesion: 0.7
Nodes (4): mapKnownMessageToStatus(), mapSupabaseErrorCode(), sanitizeDatabaseError(), toFriendlyApiError()

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (2): defaultAsyncState(), useAsyncState()

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 0.5
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1
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

## Knowledge Gaps
- **Thin community `Community 37`** (2 nodes): `global-error.tsx`, `GlobalError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `not-found.tsx`, `NotFound()`
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
- **Thin community `Community 46`** (2 nodes): `SlotPickerGrid.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `DashboardLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `NotificationCenter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `SummaryCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `MetricGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `SectionHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `ServiceSelectionStep.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `BookingFlowLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `EditorLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `SettingsLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `BookingStatusTimeline.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `SubscriptionUpsellBanner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `dashboard-queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `owner-profile.database.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._