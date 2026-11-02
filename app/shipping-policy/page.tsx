import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { type PolicySection } from "@/components/PolicyPage";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

const meta: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Shipping Policy | MIVO",
    description:
      "Delivery coverage, shipping fees, dispatch times and tracking for MIVO orders in Malaysia.",
  },
  ms: {
    title: "Polisi Penghantaran | MIVO",
    description:
      "Kawasan penghantaran, caj penghantaran, tempoh pemprosesan dan penjejakan untuk pesanan MIVO di Malaysia.",
  },
  zh: {
    title: "运送政策 | MIVO",
    description: "MIVO 马来西亚订单的配送范围、运费、发货时间及物流追踪说明。",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: meta[locale].title,
    description: meta[locale].description,
    alternates: { canonical: "/shipping-policy" },
  };
}

const content: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    intro: string;
    updated: string;
    sections: PolicySection[];
  }
> = {
  en: {
    eyebrow: "SHIPPING",
    title: "Shipping Policy",
    intro:
      "MIVO ships automotive parts across Malaysia. Here is how delivery, fees and tracking work.",
    updated: "30 October 2026",
    sections: [
      {
        title: "Delivery coverage",
        body: (
          <p>
            We deliver to addresses in Peninsular Malaysia, Sabah and Sarawak.
            Some bulky or restricted parts can only be shipped to certain
            states. If so, checkout will tell you before you pay.
          </p>
        ),
      },
      {
        title: "Shipping fees",
        body: (
          <>
            <p>
              Shipping is calculated at checkout from your state and postcode,
              the courier you choose, and the weight and size of the parts in
              your order. Bulky items may carry a surcharge.
            </p>
            <p>
              Some zones offer free shipping above a minimum order value. When
              it applies, checkout shows the fee as &ldquo;FREE&rdquo;.
            </p>
          </>
        ),
      },
      {
        title: "Dispatch time",
        body: (
          <p>
            Paid orders are usually packed and handed to the courier within{" "}
            <strong>1–3 working days</strong>. Orders placed on weekends or
            public holidays are processed on the next working day.
          </p>
        ),
      },
      {
        title: "Delivery time",
        body: (
          <div className="policyTable">
            <div>
              <strong>Peninsular Malaysia</strong>
              <span>Usually 2–4 working days after dispatch.</span>
            </div>
            <div>
              <strong>Sabah, Sarawak &amp; Labuan</strong>
              <span>Usually 4–7 working days after dispatch.</span>
            </div>
          </div>
        ),
      },
      {
        title: "Tracking your order",
        body: (
          <p>
            Once your order ships, the courier and tracking number appear on
            the order page. Sign in and go to{" "}
            <Link href="/orders">Track Order</Link> to follow it.
          </p>
        ),
      },
      {
        title: "Receiving your parcel",
        body: (
          <p>
            Please check the parcel when it arrives. If the box is visibly
            damaged or the item is wrong or broken, take photos and submit a
            claim through View Warranty on the order page within 7 days of
            delivery. See the{" "}
            <Link href="/returns-policy">Returns &amp; Refunds Policy</Link>{" "}
            for details.
          </p>
        ),
      },
    ],
  },
  ms: {
    eyebrow: "PENGHANTARAN",
    title: "Polisi Penghantaran",
    intro:
      "MIVO menghantar alat ganti kenderaan ke seluruh Malaysia. Berikut ialah cara penghantaran, caj dan penjejakan berfungsi.",
    updated: "30 Oktober 2026",
    sections: [
      {
        title: "Kawasan penghantaran",
        body: (
          <p>
            Kami menghantar ke alamat di Semenanjung Malaysia, Sabah dan
            Sarawak. Sesetengah alat ganti yang besar atau terhad hanya boleh
            dihantar ke negeri tertentu. Jika begitu, halaman pembayaran akan
            memaklumkan anda sebelum anda membayar.
          </p>
        ),
      },
      {
        title: "Caj penghantaran",
        body: (
          <>
            <p>
              Caj penghantaran dikira semasa pembayaran berdasarkan negeri dan
              poskod anda, kurier yang anda pilih, serta berat dan saiz alat
              ganti dalam pesanan anda. Barangan besar mungkin dikenakan caj
              tambahan.
            </p>
            <p>
              Sesetengah zon menawarkan penghantaran percuma bagi pesanan yang
              melebihi nilai minimum. Jika layak, halaman pembayaran akan
              memaparkan caj tersebut sebagai &ldquo;PERCUMA&rdquo;.
            </p>
          </>
        ),
      },
      {
        title: "Tempoh pemprosesan",
        body: (
          <p>
            Pesanan yang telah dibayar biasanya dibungkus dan diserahkan kepada
            kurier dalam tempoh <strong>1–3 hari bekerja</strong>. Pesanan yang
            dibuat pada hujung minggu atau cuti umum akan diproses pada hari
            bekerja berikutnya.
          </p>
        ),
      },
      {
        title: "Tempoh penghantaran",
        body: (
          <div className="policyTable">
            <div>
              <strong>Semenanjung Malaysia</strong>
              <span>Biasanya 2–4 hari bekerja selepas dihantar.</span>
            </div>
            <div>
              <strong>Sabah, Sarawak &amp; Labuan</strong>
              <span>Biasanya 4–7 hari bekerja selepas dihantar.</span>
            </div>
          </div>
        ),
      },
      {
        title: "Menjejak pesanan anda",
        body: (
          <p>
            Sebaik sahaja pesanan anda dihantar, nama kurier dan nombor
            penjejakan akan dipaparkan di halaman pesanan. Log masuk dan pergi
            ke <Link href="/orders">Jejak Pesanan</Link> untuk mengikutinya.
          </p>
        ),
      },
      {
        title: "Menerima bungkusan anda",
        body: (
          <p>
            Sila periksa bungkusan sebaik sahaja ia tiba. Jika kotak jelas
            rosak atau barang yang diterima salah atau pecah, ambil gambar dan
            hantar tuntutan melalui Lihat Waranti di halaman pesanan dalam
            tempoh 7 hari dari tarikh penghantaran diterima. Rujuk{" "}
            <Link href="/returns-policy">
              Polisi Pulangan &amp; Bayaran Balik
            </Link>{" "}
            untuk butiran lanjut.
          </p>
        ),
      },
      {
        title: "Nota terjemahan",
        body: (
          <p>
            Ini ialah terjemahan. Sekiranya terdapat sebarang percanggahan,
            versi Bahasa Inggeris akan diguna pakai.
          </p>
        ),
      },
    ],
  },
  zh: {
    eyebrow: "运送",
    title: "运送政策",
    intro: "MIVO 为全马来西亚配送汽车零件。以下说明配送、运费及物流追踪的安排。",
    updated: "2026年10月30日",
    sections: [
      {
        title: "配送范围",
        body: (
          <p>
            我们配送至西马（马来西亚半岛）、沙巴及砂拉越的地址。部分大件或受限零件只能寄往特定州属；如有此情况，结账页面会在您付款前告知。
          </p>
        ),
      },
      {
        title: "运费",
        body: (
          <>
            <p>
              运费在结账时根据您的州属和邮区编号、您选择的快递公司，以及订单中零件的重量和尺寸计算。大件商品可能需支付附加费。
            </p>
            <p>
              部分地区在订单满最低金额后可享免运费。符合条件时，结账页面会将运费显示为&ldquo;免运费&rdquo;。
            </p>
          </>
        ),
      },
      {
        title: "发货时间",
        body: (
          <p>
            已付款订单通常会在 <strong>1–3 个工作日</strong>
            内完成包装并交给快递公司。在周末或公共假期下的订单，将于下一个工作日处理。
          </p>
        ),
      },
      {
        title: "送达时间",
        body: (
          <div className="policyTable">
            <div>
              <strong>西马（马来西亚半岛）</strong>
              <span>发货后通常 2–4 个工作日送达。</span>
            </div>
            <div>
              <strong>沙巴、砂拉越及纳闽</strong>
              <span>发货后通常 4–7 个工作日送达。</span>
            </div>
          </div>
        ),
      },
      {
        title: "追踪您的订单",
        body: (
          <p>
            订单发货后，快递公司和追踪号码会显示在订单页面上。请登录并前往
            <Link href="/orders">追踪订单</Link>查看物流进度。
          </p>
        ),
      },
      {
        title: "签收包裹",
        body: (
          <p>
            包裹送达时请检查。如外箱有明显损坏，或商品错误或破损，请拍照并于签收后
            7 天内通过订单页面上的&ldquo;查看保修&rdquo;提交索赔。详情请参阅
            <Link href="/returns-policy">退货与退款政策</Link>。
          </p>
        ),
      },
      {
        title: "翻译说明",
        body: <p>本页为翻译版本，如与英文版本有任何出入，以英文版本为准。</p>,
      },
    ],
  },
};

export default async function ShippingPolicyPage() {
  const locale = await getLocale();
  const page = content[locale];
  return (
    <PolicyPage
      locale={locale}
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      updated={page.updated}
      current="/shipping-policy"
      sections={page.sections}
    />
  );
}
