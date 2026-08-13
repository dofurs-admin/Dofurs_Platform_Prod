# Graph Report - .  (2026-08-13)

## Corpus Check
- 762 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5433 nodes · 13572 edges · 104 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `u()` - 187 edges
2. `u()` - 186 edges
3. `r()` - 137 edges
4. `T()` - 136 edges
5. `r()` - 136 edges
6. `f()` - 135 edges
7. `f()` - 135 edges
8. `T()` - 134 edges
9. `c()` - 127 edges
10. `c()` - 126 edges

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
Cohesion: 0
Nodes (699): a(), aa(), Ac(), Ad(), add(), addChangeListener(), addEventListener(), addListener() (+691 more)

### Community 1 - "Community 1"
Cohesion: 0
Nodes (148): getErrorCode(), isMissingColumnError(), loadBookingAddonRowsByBookingIds(), formatBookingDateTime(), formatDate(), formatDateTime(), formatPaymentModeForDisplay(), formatTime() (+140 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (198): forbidden(), getApiAuthContext(), getCurrentApiRole(), isRoleAllowed(), normalizeRoleName(), requireApiRole(), resolveRoleWithProviderPrecedence(), createRoleResolutionSupabase() (+190 more)

### Community 3 - "Community 3"
Cohesion: 0.01
Nodes (164): Ad(), addObserver(), ajax(), Ao(), batchSend(), blur(), blurTextInput(), cancel() (+156 more)

### Community 4 - "Community 4"
Cohesion: 0.01
Nodes (65): canTransition(), transitionFlow(), extractStoragePath(), hydrateProfilePhoto(), resolveImmediatePhotoUrl(), shouldTrackRequest(), toRequestUrl(), getGroomingPackageByServiceType() (+57 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (15): __addChild(), find(), _getAccessToken(), __getAnimatedValue(), __getChildren(), __getNativeConfig(), __getNativeTag(), __getPlatformConfig() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.01
Nodes (57): collectUniqueAddressSegments(), formatAddressParts(), formatSavedAddress(), normalizeSegment(), sanitizeAddressText(), canMoveToStep(), formatCreditAmount(), goToStep() (+49 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (165): aa(), Ac(), af(), ai(), ba(), bc(), bi(), bo() (+157 more)

### Community 8 - "Community 8"
Cohesion: 0.02
Nodes (99): addAddress(), addEmergencyContact(), addMedicalRecord(), addMinutesToTimeString(), addVaccination(), applyBookingStatusTransition(), cancelBooking(), cancelBookingAsProvider() (+91 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (90): a(), add(), addEventListener(), addListener(), applyTransformOptsToQuery(), assertIsReady(), at(), b() (+82 more)

### Community 10 - "Community 10"
Cohesion: 0.02
Nodes (71): addDays(), adminRequest(), appendAvailabilitySlot(), applyBengaluruCityCoveragePreset(), applyBillingBulkStatus(), applyBillingEscalationAction(), applyBookingAdjustment(), applyBookingDatePreset() (+63 more)

### Community 11 - "Community 11"
Cohesion: 0.02
Nodes (28): Be(), bf(), cancelQueries(), canRun(), ce, ct(), ep(), fetchRequest() (+20 more)

### Community 12 - "Community 12"
Cohesion: 0.02
Nodes (38): addChangeListener(), appendParams(), clear(), clearInteractionHandle(), closeAndRetry(), configureNextLayoutAnimation(), connect(), connectWithFallback() (+30 more)

### Community 13 - "Community 13"
Cohesion: 0.03
Nodes (14): binaryDecode(), current(), decodeBroadcast(), decodePush(), decodeReply(), _getAccessToken(), _initRealtimeClient(), _initSupabaseAuthClient() (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.02
Nodes (52): cancelTimeout(), canPush(), channel(), clearHeartbeats(), f(), flushSendBuffer(), getChannels(), _handleTokenChanged() (+44 more)

### Community 15 - "Community 15"
Cohesion: 0.03
Nodes (25): ae(), alpha(), computeBlankness(), deactivateAndFlush(), deviceName(), _dispatchEvent(), emit(), fade() (+17 more)

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (69): apiDelete(), apiGet(), apiPatch(), apiPost(), apiPut(), bootstrapProfile(), buildPath(), calculateServicePrice() (+61 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (74): Al(), an(), ar(), as(), bn(), bp(), Bt(), Cd() (+66 more)

### Community 18 - "Community 18"
Cohesion: 0.04
Nodes (18): clearInterval(), clearTimeout(), close(), __debouncedOnEnd(), Eo(), __getNativeAnimationConfig(), getSize(), He() (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (11): __addChild(), __getAnimatedValue(), __getChildren(), __getNativeConfig(), __getNativeTag(), __getPlatformConfig(), __onAnimatedValueUpdateReceived(), __removeChild() (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (28): getRelatedPosts(), getRelatedPostsFromCollection(), formatDisplayDate(), getPublicSupabaseClient(), getPublishedBlogPostBySlug(), getPublishedBlogPosts(), getRelatedPublishedBlogPosts(), loadPublishedDatabaseBlogPosts() (+20 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (28): build(), defaultMutationOptions(), defaultQueryOptions(), enqueueTasks(), ensureInfiniteQueryData(), ensureQueryData(), fetch(), fetchInfiniteQuery() (+20 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (27): buildAddOnLines(), extractPetIdsFromPayloadNode(), extractPetIdsFromPaymentMetadata(), extractProviderServiceIdsFromPayloadNode(), extractProviderServiceIdsFromPaymentMetadata(), getBookingConfirmationStatusLabel(), loadBookingConfirmationData(), normalizeStatus() (+19 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (24): buildDedupeKey(), buildDiscordBookingWebhookPayload(), compactText(), firstRelation(), formatCurrency(), formatSchedule(), formatTimeLabel(), getAdminBookingUrl() (+16 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (21): buildPaymentSummary(), loadInvoiceDetailForAdmin(), loadInvoiceDetailForUser(), parseRazorpayMethod(), sentenceCase(), toText(), buildInvoicePdfBuffer(), buildInvoicePrintHtml() (+13 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (3): bootstrapAndRoute(), handleOtpChange(), handleVerifyOtp()

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (3): findMatchingCatalogService(), handleBookPackage(), toNormalizedMode()

### Community 27 - "Community 27"
Cohesion: 0.2
Nodes (2): hydratePhoto(), resolveImmediatePhotoUrl()

### Community 28 - "Community 28"
Cohesion: 0.2
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.62
Nodes (7): gs(), hs(), ms(), ps(), vs(), Yl(), ys()

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 0.4
Nodes (2): hydratePhoto(), resolveImmediatePhotoUrl()

### Community 34 - "Community 34"
Cohesion: 0.4
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.4
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 0.4
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 0.4
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (2): defaultAsyncState(), useAsyncState()

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 0.5
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 0.5
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 0.5
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 0.5
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 0.67
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

### Community 67 - "Community 67"
Cohesion: 1
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1
Nodes (0): 

### Community 82 - "Community 82"
Cohesion: 1
Nodes (0): 

### Community 83 - "Community 83"
Cohesion: 1
Nodes (0): 

### Community 84 - "Community 84"
Cohesion: 1
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 1
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 1
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1
Nodes (0): 

### Community 88 - "Community 88"
Cohesion: 1
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 1
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1
Nodes (0): 

### Community 95 - "Community 95"
Cohesion: 1
Nodes (0): 

### Community 96 - "Community 96"
Cohesion: 1
Nodes (0): 

### Community 97 - "Community 97"
Cohesion: 1
Nodes (0): 

### Community 98 - "Community 98"
Cohesion: 1
Nodes (0): 

### Community 99 - "Community 99"
Cohesion: 1
Nodes (0): 

### Community 100 - "Community 100"
Cohesion: 1
Nodes (0): 

### Community 101 - "Community 101"
Cohesion: 1
Nodes (0): 

### Community 102 - "Community 102"
Cohesion: 1
Nodes (0): 

### Community 103 - "Community 103"
Cohesion: 1
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 54`** (2 nodes): `global-error.tsx`, `GlobalError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `robots.ts`, `robots()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `QuickBookWidget.tsx`, `handleFind()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `DashboardShell.tsx`, `DashboardShell()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `BookingSummarySidebar.tsx`, `formatDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `PageLayout.tsx`, `PageLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `CreditBalanceWidget.tsx`, `formatServiceType()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `LoadingScreen.tsx`, `handleLoad()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `SlotPickerGrid.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `onboarding.tsx`, `CustomerOnboardingScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `profile.tsx`, `handleSignOut()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `invoice.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `review.tsx`, `handleSubmitReview()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `addons.tsx`, `PlaceholderScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (2 nodes): `payment.tsx`, `PlaceholderScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (2 nodes): `pet.tsx`, `PlaceholderScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (2 nodes): `edit.tsx`, `handleSave()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (2 nodes): `add.tsx`, `handleCreatePet()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (2 nodes): `settings.tsx`, `handleSignOut()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (2 nodes): `contact.tsx`, `openUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (2 nodes): `plans.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (2 nodes): `brand-logo-header.tsx`, `BrandLogoHeader()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (2 nodes): `application-status.tsx`, `handleCheckStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (2 nodes): `schedule.tsx`, `handleRefresh()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (2 nodes): `collect.tsx`, `handleCollect()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (2 nodes): `complete.tsx`, `handleComplete()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (2 nodes): `documents.tsx`, `handleCreate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (2 nodes): `google-ads.test.ts`, `importGoogleAdsModule()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `DashboardLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `NotificationCenter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `SummaryCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `BookingsTabChunkV2.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `MetricGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `SectionHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `ServiceSelectionStep.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `BookingFlowLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `EditorLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `SettingsLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `BookingStatusTimeline.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `SubscriptionUpsellBanner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `help.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `faqs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `env.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `dashboard-queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (1 nodes): `owner-profile.database.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 101`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `u()` connect `Community 11` to `Community 3`, `Community 19`, `Community 21`, `Community 14`, `Community 12`, `Community 9`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 7`, `Community 30`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `u()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `r()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._