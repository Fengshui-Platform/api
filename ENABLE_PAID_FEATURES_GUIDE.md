# Hướng dẫn bật lại hệ thống tính phí (Credit System)

> Tài liệu này mô tả cách khôi phục đầy đủ hệ thống mua lượt / credit sau khi đã bị tắt tạm thời để
> cho người dùng xem miễn phí. Tìm kiếm tag `[PAID_FEATURE_DISABLED]` trong codebase để định vị
> nhanh tất cả các vị trí cần sửa.

---

## 1. API — `api/src/services/reading.service.ts`

**Vị trí:** hàm `performPaidReading` (~dòng 220)

**Việc cần làm:**

1. Uncomment 2 dòng trừ lượt:
   ```ts
   await UserModel.deductCredit(userId)
   const updatedUser = await UserModel.findById(userId)
   ```

2. Đổi `is_free: true` → `is_free: false` và `credits_used: 0` → `credits_used: 1` trong `ReadingModel.create(...)`.

3. Uncomment toàn bộ khối `CreditUsageLogModel.create(...)`:
   ```ts
   await CreditUsageLogModel.create({
     userId,
     readingId,
     module,
     creditsUsed: 1,
     balanceAfter: updatedUser?.credits_balance ?? 0,
   })
   ```

---

## 2. API — `api/src/routes/reading.routes.ts`

**Vị trí:** route `POST /paid/:module` (~dòng 19)

**Việc cần làm:**

Uncomment `requireCredits` trong danh sách middleware:

```ts
router.post(
  '/paid/:module',
  apiRateLimit,
  verifyToken,
  requireCredits,       // ← uncomment dòng này
  validate(readingInputSchema),
  ReadingController.paidReading
)
```

---

## 3. Frontend — `fe/src/pages/HomePage.vue`

**Tìm kiếm:** `[PAID_FEATURE_DISABLED]`

### 3a. Logic submit (hàm `submit`, ~dòng 55)

Đổi lại điều kiện kiểm tra từ `auth.isLoggedIn` → `auth.hasActiveCredits`:

```ts
// TRƯỚC (miễn phí):
if (auth.isLoggedIn) { ... }

// SAU (tính phí):
if (auth.hasActiveCredits) { ... }
```

Khôi phục lại xử lý lỗi đầy đủ trong khối `catch`:
- Lỗi `FREE_LIMIT` khi chưa đăng nhập: toast "Đăng nhập và mua lượt..."
- Lỗi `FREE_LIMIT` khi đã đăng nhập: toast "Mua lượt..." + redirect `/buy-credits`
- Lỗi `402` (CREDITS_FROZEN / NO_CREDITS): redirect `/buy-credits`

### 3b. Badge sub-text Thần số học (~dòng 174)

```html
<!-- TRƯỚC (miễn phí): -->
{{ auth.isLoggedIn ? 'Đăng nhập · Xem đầy đủ miễn phí' : 'Miễn phí · 1 lần / ngày' }}

<!-- SAU (tính phí): -->
{{ auth.hasActiveCredits ? 'Luận giải đầy đủ · 1 lượt' : 'Miễn phí · 1 lần / ngày' }}
```

### 3c. Nút submit Thần số học (~dòng 228)

Thêm lại nhánh `v-else-if="auth.hasActiveCredits"`:

```html
<template v-else-if="auth.hasActiveCredits">
  ✦ Xem đầy đủ — 1 lượt
</template>
```

### 3d. Sub-text dưới nút submit (~dòng 241)

```html
<template v-if="auth.hasActiveCredits">
  Tốn 1 lượt · Kết quả đầy đủ · Còn {{ auth.user?.credits_balance }} lượt
</template>
<template v-else>
  Miễn phí 1 lần / ngày · Không cần đăng ký
</template>
```

### 3e. Description section "Thiên Cơ Huyền Học" (~dòng 283)

```html
<!-- SAU (tính phí): -->
<p class="text-text-secondary max-w-lg mx-auto">
  6 bộ môn phân tích chuyên sâu — trả phí 1 lượt, cá nhân hoá hoàn toàn
</p>
```

### 3f. Badge "Miễn phí" trên module cards (~dòng 314)

Khôi phục badge `1 lượt` màu gold cho các module có `free: false`:

```html
<span
  v-else
  class="text-xs px-2 py-0.5 bg-gold/8 text-gold/80 border border-gold/20 rounded-full"
>
  1 lượt
</span>
```

### 3g. CTA mua lượt (~dòng 338)

Uncomment toàn bộ khối:

```html
<div class="text-center mt-12">
  <RouterLink to="/buy-credits">
    <AppButton size="lg">
      ✦ Mua lượt — {{ cheapestFromLabel || 'Xem ngay' }}
    </AppButton>
  </RouterLink>
  <p class="text-xs text-text-muted mt-3">Không giới hạn · Không hết hạn trong 50 ngày · Hoàn tiền nếu lỗi</p>
</div>
```

---

## 4. Frontend — `fe/src/pages/ReadingPage.vue`

**Tìm kiếm:** `[PAID_FEATURE_DISABLED]`

### 4a. Kiểm tra credits trước khi submit (~dòng 88)

Uncomment khối kiểm tra `credits_status`:

```ts
if (auth.user?.credits_status !== 'active') {
  ui.toast.warning('Bạn cần có lượt xem còn hiệu lực. Mua lượt để tiếp tục.')
  router.push({ name: 'BuyCredits' })
  return
}
```

### 4b. Xử lý lỗi 402 trong `catch` (~dòng 115)

Uncomment lại khối xử lý lỗi 402:

```ts
const code = e.response?.data?.error?.code
if (e.response?.status === 402) {
  if (code === 'CREDITS_FROZEN') {
    ui.toast.warning('Lượt của bạn đang bị đóng băng. Mua thêm để giải băng.')
  } else {
    ui.toast.warning('Bạn đã hết lượt xem. Mua thêm để tiếp tục.')
  }
  router.push({ name: 'BuyCredits' })
} else {
  ui.toast.error(e.response?.data?.error?.message ?? 'Có lỗi xảy ra, vui lòng thử lại')
}
```

### 4c. Badge số lượt (~dòng 157)

```html
<span class="text-gold text-xs font-medium">1 lượt · Bạn còn {{ auth.user?.credits_balance ?? 0 }} lượt</span>
```

### 4d. Sub-text dưới form (~dòng 298)

```html
<p class="text-xs text-text-muted text-center mt-4">
  Sẽ tiêu 1 lượt · Kết quả được lưu trong lịch sử
</p>
```

---

## 5. Frontend — `fe/src/components/layout/TheNavbar.vue`

**Tìm kiếm:** `[PAID_FEATURE_DISABLED]`

### 5a. Credits badge trên desktop navbar (~dòng 82)

Uncomment RouterLink badge số dư lượt:

```html
<RouterLink v-if="auth.hasActiveCredits" to="/buy-credits" class="hover:opacity-80 transition-opacity">
  <AppBadge variant="active">
    ✦ {{ creditsLabel }}
  </AppBadge>
</RouterLink>
```

### 5b. Menu dropdown — Mua lượt + Lịch sử giao dịch (~dòng 124)

Uncomment 2 RouterLink:

```html
<RouterLink to="/buy-credits" @click="menuOpen = false" ...>
  <span>✦</span> Mua lượt
</RouterLink>
<RouterLink to="/history?tab=orders" @click="menuOpen = false" ...>
  <span>💳</span> Lịch sử giao dịch
</RouterLink>
```

### 5c. Mobile menu — link mua lượt (~dòng 203)

Uncomment RouterLink:

```html
<RouterLink
  v-if="auth.hasActiveCredits"
  to="/buy-credits"
  @click="menuOpen=false"
  class="..."
>
  ✦ {{ creditsLabel }}
</RouterLink>
```

---

## 6. Frontend — `fe/src/pages/ProfilePage.vue`

**Tìm kiếm:** `[PAID_FEATURE_DISABLED]`

### 6a. Badge số dư bên cạnh avatar (~dòng 151)

Uncomment `<AppBadge>`:

```html
<AppBadge :variant="auth.user?.credits_status ?? 'empty'">
  ✦ {{ auth.user?.credits_balance }} lượt
</AppBadge>
```

### 6b. Khối Credits Info (~dòng 159)

Uncomment toàn bộ khối `div` chứa số dư, ngày hết hạn và nút "Mua thêm lượt".

## 7. Frontend — `fe/src/pages/ResultPage.vue`

**Tìm kiếm:** `[PAID_FEATURE_DISABLED]`

### 7a. upsellState computed (~dòng 154)

Khôi phục lại logic gốc bao gồm 4 trạng thái `active | frozen | empty | guest`:

```ts
const upsellState = computed<'active' | 'frozen' | 'empty' | 'guest'>(() => {
  if (!auth.isLoggedIn) return 'guest'
  if (auth.hasActiveCredits) return 'active'
  if (auth.hasFrozenCredits) return 'frozen'
  return 'empty'
})
```

### 7b. upsellHeading + upsellDesc (~dòng 165)

Khôi phục text gốc hiển thị số lượt và các nhánh frozen/empty.

### 7c. Locked sections — nút Mua lượt (~dòng 532)

Khôi phục lại 2 nút:

```html
<div v-if="!auth.isLoggedIn" class="flex gap-2">
  <RouterLink to="/login"><AppButton size="sm" variant="secondary">Đăng nhập</AppButton></RouterLink>
  <RouterLink to="/buy-credits"><AppButton size="sm">Mua lượt</AppButton></RouterLink>
</div>
<RouterLink v-else to="/buy-credits">
  <AppButton size="sm">Mua lượt{{ cheapestFromLabel ? ` — ${cheapestFromLabel}` : '' }}</AppButton>
</RouterLink>
```

### 7d. Upsell CTA (~dòng 596)

Uncomment các RouterLink tới `/buy-credits`:

```html
<RouterLink v-if="upsellState === 'frozen'" to="/buy-credits">
  <AppButton size="lg" class="w-full">🔥 Gia hạn lượt — tiếp tục xem ngay</AppButton>
</RouterLink>
<RouterLink v-else-if="upsellState === 'empty'" to="/buy-credits">
  <AppButton size="lg" class="w-full">⚡ {{ cheapestBuyLabel || 'Mua lượt ngay' }} — Xem ngay</AppButton>
</RouterLink>
<RouterLink v-else-if="upsellState === 'guest'" to="/login">
  <AppButton size="lg" class="w-full" variant="secondary">Đăng nhập để bắt đầu</AppButton>
</RouterLink>
```

---

## Checklist xác minh sau khi bật lại

- [ ] Người dùng 0 lượt truy cập `/reading/love` → bị chặn, hiển thị toast lỗi + redirect `/buy-credits`
- [ ] Người dùng có lượt → xem thành công, bị trừ 1 lượt, CreditUsageLog được ghi
- [ ] Trang chủ: badge module hiển thị `1 lượt` (màu gold)
- [ ] Trang chủ: nút CTA "Mua lượt" hiển thị
- [ ] Navbar: badge số dư hiện khi credits đang active
- [ ] Dropdown menu: có link "Mua lượt" và "Lịch sử giao dịch"
- [ ] Trang Profile: hiển thị số dư lượt và nút "Mua thêm lượt"
- [ ] Trang Result: locked sections hiện nút "Mua lượt", upsell hiện CTA mua/gia hạn
