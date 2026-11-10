// New-customer gift pack popup. Rows: [English, Malay, Chinese].

const rows = {
  "gift.badge": ["New customer gift", "Hadiah pelanggan baharu", "新人礼包"],
  "gift.title": ["A welcome gift for you", "Hadiah alu-aluan untuk anda", "送你一份见面礼"],
  "gift.subtitle": ["{n} vouchers inside. Tap to open.", "{n} baucar di dalam. Tekan untuk buka.", "里面有 {n} 张优惠券，点一下打开"],
  "gift.open": ["Open my gift", "Buka hadiah saya", "打开礼包"],
  "gift.revealTitle": ["Your new customer vouchers", "Baucar pelanggan baharu anda", "你的新人优惠券"],
  "gift.anyProduct": ["Use on any product · one voucher per order", "Guna untuk semua produk · satu baucar setiap pesanan", "全场商品可用 · 每张订单限用一张"],
  "gift.signUpClaim": ["Sign up & claim", "Daftar & tuntut", "注册并领取"],
  "gift.haveAccount": ["Already have an account? Log in", "Sudah ada akaun? Log masuk", "已有账号？登录"],
  "gift.claimAll": ["Claim all", "Tuntut semua", "全部领取"],
  "gift.claiming": ["Claiming…", "Sedang menuntut…", "领取中…"],
  "gift.claimedTitle": ["Vouchers claimed!", "Baucar telah dituntut!", "领取成功！"],
  "gift.claimedText": [
    "They're in your account. Pick one at checkout — they work on any product.",
    "Baucar sudah dalam akaun anda. Pilih satu semasa checkout — boleh digunakan untuk semua produk.",
    "优惠券已放进你的账号，结账时选择使用，全场商品都可以用。",
  ],
  "gift.alreadyTitle": ["You already have this gift", "Anda sudah menuntut hadiah ini", "你已经领过这个礼包了"],
  "gift.alreadyText": [
    "Each account can claim the new customer gift once. Your vouchers are waiting in My vouchers.",
    "Setiap akaun hanya boleh menuntut hadiah pelanggan baharu sekali. Baucar anda ada dalam Baucar saya.",
    "每个账号只能领一次新人礼包，你的优惠券在「我的优惠券」里。",
  ],
  "gift.someFailed": ["Some vouchers couldn't be added: {reason}", "Sebahagian baucar tidak dapat ditambah: {reason}", "部分优惠券未能领取：{reason}"],
  "gift.shopNow": ["Shop now", "Beli sekarang", "去逛逛"],
  "gift.myVouchers": ["My vouchers", "Baucar saya", "我的优惠券"],
  "gift.close": ["Close", "Tutup", "关闭"],
  "gift.later": ["Maybe later", "Lain kali", "下次再说"],
  "gift.freeShipping": ["Free shipping", "Penghantaran percuma", "免运费"],
  "gift.percentOff": ["{n}% off", "Diskaun {n}%", "{n}% 折扣"],
  "gift.rmOff": ["RM{n} off", "Diskaun RM{n}", "减 RM{n}"],
  "gift.times": ["×{n}", "×{n}", "×{n}"],
  "gift.minSpend": ["Min. spend {amount}", "Belanja min. {amount}", "满 {amount} 可用"],
  "gift.noMin": ["No min. spend", "Tiada belanja minimum", "无最低消费"],
  "gift.cap": ["Up to {amount}", "Sehingga {amount}", "最多减 {amount}"],
  "gift.firstOrder": ["First order", "Pesanan pertama", "首单可用"],
  "gift.useBy": ["Use by {date}", "Guna sebelum {date}", "{date} 前使用"],
  "gift.claimed": ["Claimed", "Dituntut", "已领取"],
  "gift.loginHint": [
    "Sign up or log in and your new customer vouchers are added straight away.",
    "Daftar atau log masuk dan baucar pelanggan baharu anda terus ditambah.",
    "注册或登录后，新人优惠券会马上放进你的账号。",
  ],
} as const;

type K = keyof typeof rows;

const pick = (i: 0 | 1 | 2) =>
  Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v[i]])) as Record<K, string>;

export const en = pick(0);
export const ms: Partial<Record<K, string>> = pick(1);
export const zh: Partial<Record<K, string>> = pick(2);
