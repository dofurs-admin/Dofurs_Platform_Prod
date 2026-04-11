# Service Catalog API Contract Matrix

Generated: 2026-03-05
Base URL used during smoke test: `http://localhost:3001`

## Scope
Public service catalog endpoints:
- `/api/services/categories`
- `/api/services/packages`
- `/api/services/package/[packageId]`
- `/api/services/by-category/[categoryId]`
- `/api/services/addons/[serviceId]`
- `/api/services/calculate-price`

## Live Smoke Results

| Case | Request | Expected Contract | Actual Status | Actual Result |
|---|---|---|---:|---|
| categories.baseline | `GET /api/services/categories` | `200` success payload | 200 | ✅ `success: true` |
| packages.baseline | `GET /api/services/packages` | `200` success payload | 200 | ✅ `success: true` |
| packages.invalidFeatured | `GET /api/services/packages?featured=maybe` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| categories.invalidFeatured | `GET /api/services/categories?featured=maybe` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| package.invalidPath | `GET /api/services/package/not-a-uuid?providerId=1` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| package.missingProvider | `GET /api/services/package/{validUuid}` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| package.validShapeUnknownId | `GET /api/services/package/{validUuid}?providerId=1` | `404` package not found | 404 | ✅ `error: Package not found` |
| byCategory.invalidPath | `GET /api/services/by-category/not-a-uuid?providerId=1` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| byCategory.missingProvider | `GET /api/services/by-category/{validUuid}` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| byCategory.validShape | `GET /api/services/by-category/{validUuid}?providerId=1` | `200` success payload | 200 | ✅ `success: true` |
| addons.invalidPath | `GET /api/services/addons/not-a-uuid` | `400` invalid request parameters | 400 | ✅ `error: Invalid request parameters` |
| addons.validShape | `GET /api/services/addons/{validUuid}` | `200` success payload | 200 | ✅ `success: true` |
| calculatePrice.invalidPayload | `POST /api/services/calculate-price` (invalid body) | `400` invalid request payload | 400 | ✅ `error: Invalid request payload` |

`{validUuid}` used in smoke run: `11111111-1111-4111-8111-111111111111`

## Contract Summary

- Input validation failures now consistently return **400** with `success: false` and a stable error string.
- Domain/state outcomes for package composition now map correctly (e.g. unknown package ID returns **404 Package not found**).
- Baseline public catalog reads return **200** with `success: true`.

## Regression Checklist

When modifying these endpoints, verify at minimum:
1. Invalid UUID path values return `400`.
2. Missing required query (`providerId`) returns `400`.
3. Unknown package ID in package-composition route returns `404`.
4. Invalid query enums (`featured=maybe`) return `400`.
5. Baseline category/package listing still returns `200`.
