// Seller onboarding (/sell). Rows: [English, Malay, Chinese].

const rows = {
  "so.step1": ["Your shop", "Kedai anda", "店铺资料"],
  "so.step2": ["Seller type & identity", "Jenis penjual & identiti", "卖家类型与身份"],
  "so.step3": ["Contact & pickup address", "Hubungan & alamat pengambilan", "联系方式与取件地址"],
  "so.step4": ["Bank account for payouts", "Akaun bank untuk pembayaran", "收款银行账户"],
  "so.step5": ["Documents", "Dokumen", "证件资料"],
  "so.categories": ["What do you sell? (brands, parts)", "Apa yang anda jual? (jenama, alat ganti)", "你卖什么？（品牌、零件）"],
  "so.individual": ["Individual (MyKad)", "Individu (MyKad)", "个人（身份证）"],
  "so.business": ["Registered business (SSM)", "Perniagaan berdaftar (SSM)", "注册公司（SSM）"],
  "so.legalNameInd": ["Full name as on IC", "Nama penuh seperti dalam IC", "身份证上的全名"],
  "so.legalNameBiz": ["Company / business name as on SSM", "Nama syarikat / perniagaan seperti dalam SSM", "SSM 上的公司 / 商号名称"],
  "so.ic": ["IC number", "Nombor IC", "身份证号码"],
  "so.ssm": ["SSM registration number", "Nombor pendaftaran SSM", "SSM 注册号码"],
  "so.tin": ["Tax ID (TIN) — optional", "Nombor cukai (TIN) — pilihan", "税务编号（TIN）— 选填"],
  "so.sst": ["SST registration — optional", "Pendaftaran SST — pilihan", "SST 注册号码 — 选填"],
  "so.address": ["Business / correspondence address", "Alamat perniagaan / surat-menyurat", "营业 / 通讯地址"],
  "so.pickup": ["Pickup address (where couriers collect parcels)", "Alamat pengambilan (kurier ambil bungkusan)", "取件地址（快递上门取件的地方）"],
  "so.pickupName": ["Contact name", "Nama untuk dihubungi", "联系人"],
  "so.street": ["Street address", "Alamat jalan", "街道地址"],
  "so.postcode": ["Postcode", "Poskod", "邮编"],
  "so.city": ["City", "Bandar", "城市"],
  "so.state": ["State", "Negeri", "州属"],
  "so.bank": ["Bank", "Bank", "银行"],
  "so.accountName": ["Account holder name", "Nama pemegang akaun", "账户持有人姓名"],
  "so.accountNo": ["Account number", "Nombor akaun", "账户号码"],
  "so.bankHint": ["The account name must match your IC name or SSM business name.", "Nama akaun mesti sama dengan nama IC atau nama perniagaan SSM.", "账户名称须与身份证姓名或 SSM 商号名称一致。"],
  "so.icFront": ["IC — front", "IC — depan", "身份证正面"],
  "so.icBack": ["IC — back", "IC — belakang", "身份证背面"],
  "so.ssmDoc": ["SSM certificate (Form 9 / Form D / e-Info)", "Sijil SSM (Borang 9 / Borang D / e-Info)", "SSM 证书（Form 9 / Form D / e-Info）"],
  "so.bankDoc": ["Bank statement header (showing name & account no.)", "Bahagian atas penyata bank (nama & no. akaun)", "银行月结单抬头（显示户名和账号）"],
  "so.upload": ["Upload", "Muat naik", "上传"],
  "so.uploaded": ["Uploaded ✓", "Dimuat naik ✓", "已上传 ✓"],
  "so.privacy": ["Your documents are private: only you and the MIVO team reviewing your shop can see them.", "Dokumen anda adalah peribadi: hanya anda dan pasukan MIVO yang menyemak kedai anda boleh melihatnya.", "你的证件是保密的，只有你和审核店铺的 MIVO 团队看得到。"],
  "so.agree": ["I confirm the information is true and agree to MIVO's seller terms.", "Saya mengesahkan maklumat ini benar dan bersetuju dengan terma penjual MIVO.", "我确认以上资料属实，并同意 MIVO 卖家条款。"],
  "so.submit": ["Submit application", "Hantar permohonan", "提交申请"],
  "so.resubmit": ["Update & resubmit", "Kemas kini & hantar semula", "更新并重新提交"],
  "so.status.submitted": ["Under review", "Sedang disemak", "审核中"],
  "so.status.more_info": ["MIVO needs more information", "MIVO perlukan maklumat lanjut", "MIVO 需要补充资料"],
  "so.status.approved": ["Approved — your shop is open", "Diluluskan — kedai anda dibuka", "已通过，店铺已开通"],
  "so.status.rejected": ["Not approved", "Tidak diluluskan", "未通过"],
  "so.note": ["Message from MIVO", "Mesej daripada MIVO", "MIVO 留言"],
  "so.fix": ["Fix and resubmit", "Betulkan dan hantar semula", "修改后重新提交"],
  "so.missing": ["Please fill in all required fields and upload the documents.", "Sila isi semua maklumat wajib dan muat naik dokumen.", "请填写所有必填项并上传证件。"],
} as const;

type K = keyof typeof rows;
const pick = (i: 0 | 1 | 2) =>
  Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v[i]])) as Record<K, string>;

export const en = pick(0);
export const ms: Partial<Record<K, string>> = pick(1);
export const zh: Partial<Record<K, string>> = pick(2);
