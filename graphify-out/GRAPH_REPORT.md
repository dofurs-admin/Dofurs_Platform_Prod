# Graph Report - .  (2026-06-24)

## Corpus Check
- 739 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5292 nodes · 13377 edges · 98 communities detected
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
Nodes (695): a(), aa(), Ac(), Ad(), add(), addChangeListener(), addEventListener(), addListener() (+687 more)

### Community 1 - "Community 1"
Cohesion: 0
Nodes (158): getErrorCode(), isMissingColumnError(), loadBookingAddonRowsByBookingIds(), formatBookingDateTime(), formatDate(), formatDateTime(), formatTime(), formatMode() (+150 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (180): ajax(), alpha(), Ao(), appendParams(), applyTransformOptsToQuery(), ar(), batchSend(), binaryEncode() (+172 more)

### Community 3 - "Community 3"
Cohesion: 0.01
Nodes (76): clampSidebarWidth(), handlePointerMove(), getRelatedPosts(), getRelatedPostsFromCollection(), formatDisplayDate(), getPublicSupabaseClient(), getPublishedBlogPostBySlug(), getPublishedBlogPosts() (+68 more)

### Community 4 - "Community 4"
Cohesion: 0.01
Nodes (19): __addChild(), ct(), __debouncedOnEnd(), find(), _getAccessToken(), __getAnimatedValue(), __getChildren(), __getNativeConfig() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (81): a(), add(), addEventListener(), addListener(), ae(), assertIsReady(), at(), b() (+73 more)

### Community 6 - "Community 6"
Cohesion: 0.01
Nodes (133): forbidden(), getApiAuthContext(), getCurrentApiRole(), isRoleAllowed(), normalizeRoleName(), requireApiRole(), resolveRoleWithProviderPrecedence(), createRoleResolutionSupabase() (+125 more)

### Community 7 - "Community 7"
Cohesion: 0.02
Nodes (145): bucketTemplate(), getDaysSince(), isRecord(), runBillingReminderAutomation(), toBucket(), createCustomerProfileForBooking(), CustomerIntakeError, ensureOwnerProfileForBookingCustomer() (+137 more)

### Community 8 - "Community 8"
Cohesion: 0.02
Nodes (28): __addChild(), canRun(), continue(), ct(), execute(), find(), __getAnimatedValue(), __getChildren() (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (14): binaryDecode(), current(), decodeBroadcast(), decodePush(), decodeReply(), _getAccessToken(), _initRealtimeClient(), _initSupabaseAuthClient() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.02
Nodes (54): cancelTimeout(), canPush(), channel(), clearHeartbeats(), connect(), connectWithFallback(), disconnect(), f() (+46 more)

### Community 11 - "Community 11"
Cohesion: 0.03
Nodes (124): Ac(), Ad(), Al(), an(), as(), bd(), bf(), bn() (+116 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (129): aa(), af(), ai(), ba(), bc(), bi(), bo(), br() (+121 more)

### Community 13 - "Community 13"
Cohesion: 0.02
Nodes (49): adminRequest(), appendAvailabilitySlot(), applyBengaluruCityCoveragePreset(), applyBillingBulkStatus(), applyBillingEscalationAction(), applyBookingAdjustment(), applyBookingStatusForIds(), applyBulkStatus() (+41 more)

### Community 14 - "Community 14"
Cohesion: 0.02
Nodes (46): collectUniqueAddressSegments(), formatAddressParts(), formatSavedAddress(), normalizeSegment(), sanitizeAddressText(), canMoveToStep(), formatCreditAmount(), goToStep() (+38 more)

### Community 15 - "Community 15"
Cohesion: 0.03
Nodes (69): ApiClientError, apiRequest(), buildFetchInit(), extractErrorMessage(), tryRefreshAndRetry(), apiDelete(), apiGet(), apiPatch() (+61 more)

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (56): addObserver(), build(), cancel(), cancelRefEvent(), clearGcTimeout(), componentWillUnmount(), createResult(), defaultMutationOptions() (+48 more)

### Community 17 - "Community 17"
Cohesion: 0.03
Nodes (19): addChangeListener(), clear(), closeAndRetry(), configureNextLayoutAnimation(), decode(), delete(), mount(), onJoin() (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.04
Nodes (17): clearInterval(), clearTimeout(), close(), __debouncedOnEnd(), Eo(), fetchInfiniteQuery(), getSize(), He() (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (12): Be(), cancelQueries(), ep(), fetchThenEvalAsync(), g(), ge, le, Me() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (14): countBookingServiceUnits(), countDistinctBookingCustomers(), countEffectiveBookingStatus(), isMissingFunctionError(), isMissingTableError(), isRecord(), loadAdminDashboardBusinessStats(), loadAdminDashboardBusinessStatsFallback() (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (24): buildDedupeKey(), buildDiscordBookingWebhookPayload(), compactText(), firstRelation(), formatCurrency(), formatSchedule(), formatTimeLabel(), getAdminBookingUrl() (+16 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (21): buildPaymentSummary(), loadInvoiceDetailForAdmin(), loadInvoiceDetailForUser(), parseRazorpayMethod(), sentenceCase(), toText(), buildInvoicePdfBuffer(), buildInvoicePrintHtml() (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (18): buildAddOnLines(), extractPetIdsFromPayloadNode(), extractPetIdsFromPaymentMetadata(), extractProviderServiceIdsFromPayloadNode(), extractProviderServiceIdsFromPaymentMetadata(), getBookingConfirmationStatusLabel(), loadBookingConfirmationData(), normalizeStatus() (+10 more)

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
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 28 - "Community 28"
Cohesion: 0.4
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.4
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (2): defaultAsyncState(), useAsyncState()

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (2): bootstrapAndRoute(), handleVerifyOtp()

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 0.67
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

## Knowledge Gaps
- **Thin community `Community 51`** (2 nodes): `global-error.tsx`, `GlobalError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `robots.ts`, `robots()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `QuickBookWidget.tsx`, `handleFind()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `DashboardShell.tsx`, `DashboardShell()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `BookingSummarySidebar.tsx`, `formatDate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `PageLayout.tsx`, `PageLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `CreditBalanceWidget.tsx`, `formatServiceType()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `LoadingScreen.tsx`, `handleLoad()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `SlotPickerGrid.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `onboarding.tsx`, `CustomerOnboardingScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `sign-in.tsx`, `handleSendOtp()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `pets.tsx`, `toPetRow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `profile.tsx`, `handleSignOut()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `invoice.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `review.tsx`, `handleSubmitReview()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `addons.tsx`, `handleContinue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `pet.tsx`, `handleContinue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (2 nodes): `edit.tsx`, `handleSave()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (2 nodes): `passport.tsx`, `PlaceholderScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (2 nodes): `add.tsx`, `handleCreatePet()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (2 nodes): `settings.tsx`, `handleSignOut()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (2 nodes): `plans.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (2 nodes): `application-status.tsx`, `handleCheckStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (2 nodes): `collect.tsx`, `handleCollect()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (2 nodes): `complete.tsx`, `handleComplete()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (2 nodes): `documents.tsx`, `handleCreate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (2 nodes): `auth.ts`, `auth-store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (2 nodes): `google-ads.test.ts`, `importGoogleAdsModule()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `DashboardLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `NotificationCenter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `SummaryCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `MetricGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `SectionHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `ServiceSelectionStep.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `BookingFlowLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `EditorLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `SettingsLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `BookingStatusTimeline.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `SubscriptionUpsellBanner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `help.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `schedule.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `dashboard-queries.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `owner-profile.database.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `u()` connect `Community 8` to `Community 2`, `Community 16`, `Community 10`, `Community 19`, `Community 5`, `Community 9`, `Community 11`, `Community 18`, `Community 12`, `Community 17`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `u()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `r()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._