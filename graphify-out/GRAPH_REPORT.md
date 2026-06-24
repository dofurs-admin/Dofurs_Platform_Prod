# Graph Report - .  (2026-06-24)

## Corpus Check
- 742 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5297 nodes · 13382 edges · 112 communities detected
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
Cohesion: 0.01
Nodes (136): getErrorCode(), isMissingColumnError(), loadBookingAddonRowsByBookingIds(), formatBookingDateTime(), formatDate(), formatDateTime(), formatTime(), formatMode() (+128 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (70): getRelatedPosts(), getRelatedPostsFromCollection(), formatDisplayDate(), getPublicSupabaseClient(), getPublishedBlogPostBySlug(), getPublishedBlogPosts(), getRelatedPublishedBlogPosts(), loadPublishedDatabaseBlogPosts() (+62 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (147): Ad(), ajax(), alpha(), an(), ar(), as(), batchSend(), binaryEncode() (+139 more)

### Community 3 - "Community 3"
Cohesion: 0.01
Nodes (142): Ad(), addListener(), ajax(), alpha(), ar(), batchSend(), binaryEncode(), blur() (+134 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (15): __addChild(), find(), _getAccessToken(), __getAnimatedValue(), __getChildren(), __getNativeConfig(), __getNativeTag(), __getPlatformConfig() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.01
Nodes (129): forbidden(), getApiAuthContext(), getCurrentApiRole(), isRoleAllowed(), normalizeRoleName(), requireApiRole(), resolveRoleWithProviderPrecedence(), createRoleResolutionSupabase() (+121 more)

### Community 6 - "Community 6"
Cohesion: 0.01
Nodes (153): bucketTemplate(), getDaysSince(), isRecord(), runBillingReminderAutomation(), toBucket(), buildBusinessReferralSignupLink(), getActiveBusinessReferralCampaignByCode(), getBusinessReferralCampaign() (+145 more)

### Community 7 - "Community 7"
Cohesion: 0.01
Nodes (83): collectUniqueAddressSegments(), formatAddressParts(), formatSavedAddress(), normalizeSegment(), sanitizeAddressText(), canMoveToStep(), formatCreditAmount(), goToStep() (+75 more)

### Community 8 - "Community 8"
Cohesion: 0.02
Nodes (199): aa(), Ac(), af(), ai(), Al(), ba(), bc(), bi() (+191 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (14): binaryDecode(), current(), decodeBroadcast(), decodePush(), decodeReply(), _getAccessToken(), _initRealtimeClient(), _initSupabaseAuthClient() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.02
Nodes (49): adminRequest(), appendAvailabilitySlot(), applyBengaluruCityCoveragePreset(), applyBillingBulkStatus(), applyBillingEscalationAction(), applyBookingAdjustment(), applyBookingStatusForIds(), applyBulkStatus() (+41 more)

### Community 11 - "Community 11"
Cohesion: 0.03
Nodes (69): cancel(), cancelRefEvent(), cancelTimeout(), canPush(), clearGcTimeout(), clearHeartbeats(), clearTimeout(), close() (+61 more)

### Community 12 - "Community 12"
Cohesion: 0.03
Nodes (89): add(), addChangeListener(), addEventListener(), addListener(), addObserver(), Al(), at(), bd() (+81 more)

### Community 13 - "Community 13"
Cohesion: 0.02
Nodes (22): __addChild(), an(), channel(), clear(), clearInteractionHandle(), configureNextLayoutAnimation(), createInteractionHandle(), delete() (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.03
Nodes (40): add(), addChangeListener(), addEventListener(), applyTransformOptsToQuery(), csv(), download(), enabled(), Eo() (+32 more)

### Community 15 - "Community 15"
Cohesion: 0.03
Nodes (32): a(), assertIsReady(), computeBlankness(), computeViewableItems(), deactivateAndFlush(), __debouncedOnEnd(), deviceName(), _dispatchEvent() (+24 more)

### Community 16 - "Community 16"
Cohesion: 0.03
Nodes (22): canRun(), continue(), ct(), execute(), find(), __getChildren(), __getNativeConfig(), __getNativeTag() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.03
Nodes (32): Ao(), bindMethods(), canPush(), decode(), exists(), getCurrentResult(), _getFinalPath(), h() (+24 more)

### Community 18 - "Community 18"
Cohesion: 0.04
Nodes (102): aa(), ai(), ba(), bc(), bi(), br(), Bt(), ci() (+94 more)

### Community 19 - "Community 19"
Cohesion: 0.03
Nodes (58): a(), assertIsReady(), b(), continue(), createTable(), createTableIfNotExists(), current(), defaultMutationOptions() (+50 more)

### Community 20 - "Community 20"
Cohesion: 0.03
Nodes (31): ae(), Be(), bf(), cancelQueries(), catch(), ep(), fetchInfiniteQuery(), fetchThenEvalAsync() (+23 more)

### Community 21 - "Community 21"
Cohesion: 0.03
Nodes (16): channel(), clearInteractionHandle(), configureNextLayoutAnimation(), createInteractionHandle(), delete(), f(), focus(), focusTextInput() (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.04
Nodes (45): Be(), build(), cancelQueries(), cancelTasks(), catch(), clone(), defaultQueryOptions(), ensureInfiniteQueryData() (+37 more)

### Community 23 - "Community 23"
Cohesion: 0.03
Nodes (42): appendParams(), applyTransformOptsToQuery(), binaryDecode(), bindMethods(), clear(), decode(), decodeBroadcast(), decodePush() (+34 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (74): as(), at(), bd(), bn(), br(), Bt(), Cd(), cn() (+66 more)

### Community 25 - "Community 25"
Cohesion: 0.05
Nodes (59): addObserver(), cancel(), cancelRefEvent(), cancelTimeout(), clearGcTimeout(), clearHeartbeats(), clearTimeout(), close() (+51 more)

### Community 26 - "Community 26"
Cohesion: 0.04
Nodes (12): ae(), computeBlankness(), deactivateAndFlush(), deviceName(), emitChange(), __getValue(), measureLayout(), o() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.04
Nodes (47): appendParams(), b(), cancelTasks(), clone(), createTable(), createTableIfNotExists(), dropNamespace(), dropTable() (+39 more)

### Community 28 - "Community 28"
Cohesion: 0.05
Nodes (49): Ac(), af(), bu(), cc(), ce, ct(), dc(), De() (+41 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (56): apiDelete(), apiGet(), apiPatch(), apiPost(), apiPut(), bootstrapProfile(), buildPath(), calculateServicePrice() (+48 more)

### Community 30 - "Community 30"
Cohesion: 0.06
Nodes (51): Ao(), bo(), c(), co(), copy(), createBucket(), createIndex(), createSignedUploadUrl() (+43 more)

### Community 31 - "Community 31"
Cohesion: 0.05
Nodes (12): clearInterval(), Eo(), __getNativeAnimationConfig(), getSize(), hex(), hexa(), load(), measure() (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (14): countBookingServiceUnits(), countDistinctBookingCustomers(), countEffectiveBookingStatus(), isMissingFunctionError(), isMissingTableError(), isRecord(), loadAdminDashboardBusinessStats(), loadAdminDashboardBusinessStatsFallback() (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (24): buildDedupeKey(), buildDiscordBookingWebhookPayload(), compactText(), firstRelation(), formatCurrency(), formatSchedule(), formatTimeLabel(), getAdminBookingUrl() (+16 more)

### Community 34 - "Community 34"
Cohesion: 0.14
Nodes (21): buildPaymentSummary(), loadInvoiceDetailForAdmin(), loadInvoiceDetailForUser(), parseRazorpayMethod(), sentenceCase(), toText(), buildInvoicePdfBuffer(), buildInvoicePrintHtml() (+13 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (18): buildAddOnLines(), extractPetIdsFromPayloadNode(), extractPetIdsFromPaymentMetadata(), extractProviderServiceIdsFromPayloadNode(), extractProviderServiceIdsFromPaymentMetadata(), getBookingConfirmationStatusLabel(), loadBookingConfirmationData(), normalizeStatus() (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (7): addDays(), getDayName(), getDayOfWeek(), getIstNowParts(), resolveAvailableSlots(), resolveAvailableSlotsMultiDay(), resolveDayAvailability()

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 0.42
Nodes (7): gs(), hs(), ms(), ps(), vs(), Yl(), ys()

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 41 - "Community 41"
Cohesion: 0.4
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 0.4
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 0.4
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 0.5
Nodes (2): defaultAsyncState(), useAsyncState()

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 0.5
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 0.5
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (2): bootstrapAndRoute(), handleVerifyOtp()

### Community 49 - "Community 49"
Cohesion: 0.5
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 0.5
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 0.67
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

### Community 104 - "Community 104"
Cohesion: 1
Nodes (0): 

### Community 105 - "Community 105"
Cohesion: 1
Nodes (0): 

### Community 106 - "Community 106"
Cohesion: 1
Nodes (0): 

### Community 107 - "Community 107"
Cohesion: 1
Nodes (0): 

### Community 108 - "Community 108"
Cohesion: 1
Nodes (0): 

### Community 109 - "Community 109"
Cohesion: 1
Nodes (0): 

### Community 110 - "Community 110"
Cohesion: 1
Nodes (0): 

### Community 111 - "Community 111"
Cohesion: 1
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 64`** (2 nodes): `global-error.tsx`, `GlobalError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `robots.ts`, `robots()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `QuickBookWidget.tsx`, `handleFind()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `DashboardShell.tsx`, `DashboardShell()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (2 nodes): `BookingSummarySidebar.tsx`, `formatDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (2 nodes): `PageLayout.tsx`, `PageLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (2 nodes): `CreditBalanceWidget.tsx`, `formatServiceType()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (2 nodes): `LoadingScreen.tsx`, `handleLoad()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (2 nodes): `SlotPickerGrid.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (2 nodes): `onboarding.tsx`, `CustomerOnboardingScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (2 nodes): `sign-in.tsx`, `handleSendOtp()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (2 nodes): `pets.tsx`, `toPetRow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (2 nodes): `profile.tsx`, `handleSignOut()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (2 nodes): `invoice.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (2 nodes): `review.tsx`, `handleSubmitReview()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (2 nodes): `addons.tsx`, `handleContinue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (2 nodes): `pet.tsx`, `handleContinue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (2 nodes): `edit.tsx`, `handleSave()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (2 nodes): `passport.tsx`, `PlaceholderScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (2 nodes): `add.tsx`, `handleCreatePet()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (2 nodes): `settings.tsx`, `handleSignOut()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (2 nodes): `plans.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (2 nodes): `application-status.tsx`, `handleCheckStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (2 nodes): `collect.tsx`, `handleCollect()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (2 nodes): `complete.tsx`, `handleComplete()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (2 nodes): `documents.tsx`, `handleCreate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (2 nodes): `auth.ts`, `auth-store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (2 nodes): `google-ads.test.ts`, `importGoogleAdsModule()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `DashboardLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `NotificationCenter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `SummaryCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `MetricGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `SectionHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `ServiceSelectionStep.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `BookingFlowLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (1 nodes): `EditorLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 101`** (1 nodes): `SettingsLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (1 nodes): `BookingStatusTimeline.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (1 nodes): `SubscriptionUpsellBanner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (1 nodes): `help.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (1 nodes): `schedule.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (1 nodes): `dashboard-queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 108`** (1 nodes): `owner-profile.database.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 109`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 110`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `u()` connect `Community 16` to `Community 3`, `Community 27`, `Community 13`, `Community 14`, `Community 20`, `Community 17`, `Community 9`, `Community 8`, `Community 15`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `u()` connect `Community 4` to `Community 2`, `Community 21`, `Community 12`, `Community 19`, `Community 22`, `Community 23`, `Community 28`, `Community 26`, `Community 18`, `Community 31`, `Community 30`, `Community 38`, `Community 11`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `r()` connect `Community 4` to `Community 2`, `Community 22`, `Community 19`, `Community 31`, `Community 23`, `Community 18`, `Community 21`, `Community 30`, `Community 12`, `Community 26`, `Community 11`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._