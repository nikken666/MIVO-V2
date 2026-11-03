import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { type PolicySection } from "@/components/PolicyPage";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

const meta: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Privacy Policy | MIVO",
    description:
      "How MIVO collects, uses and protects your personal data under Malaysia's Personal Data Protection Act 2010.",
  },
  ms: {
    title: "Polisi Privasi | MIVO",
    description:
      "Cara MIVO mengumpul, menggunakan dan melindungi data peribadi anda di bawah Akta Perlindungan Data Peribadi 2010 Malaysia.",
  },
  zh: {
    title: "隐私政策 | MIVO",
    description: "MIVO 如何依据马来西亚2010年个人资料保护法令收集、使用及保护您的个人资料。",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: meta[locale].title,
    description: meta[locale].description,
    alternates: { canonical: "/privacy-policy" },
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
    eyebrow: "PRIVACY",
    title: "Privacy Policy",
    intro:
      "This policy explains what personal data MIVO collects, why we collect it, and how we protect it, in line with Malaysia's Personal Data Protection Act 2010 (PDPA).",
    updated: "30 October 2026",
    sections: [
      {
        title: "Data we collect",
        body: (
          <ul>
            <li>
              <strong>Account details:</strong> name, email address and
              password (stored encrypted, never visible to us).
            </li>
            <li>
              <strong>Delivery details:</strong> recipient name, phone number
              and shipping address.
            </li>
            <li>
              <strong>Vehicle details:</strong> the cars you save to My Garage,
              used to match compatible parts.
            </li>
            <li>
              <strong>Order history:</strong> items purchased, payments,
              returns, warranty claims and reviews, including any photos you
              upload.
            </li>
            <li>
              <strong>Technical data:</strong> cookies and similar storage
              needed to keep you signed in and remember your cart and vehicle.
            </li>
          </ul>
        ),
      },
      {
        title: "Payment information",
        body: (
          <p>
            Card payments are processed by our payment provider, Stripe. MIVO
            does not see or store your full card number.
          </p>
        ),
      },
      {
        title: "How we use your data",
        body: (
          <ul>
            <li>To process, deliver and support your orders.</li>
            <li>To show parts that fit your saved vehicles.</li>
            <li>To handle returns, refunds and warranty claims.</li>
            <li>
              To send order and account updates. We only send marketing
              messages if you have agreed to receive them.
            </li>
            <li>To prevent fraud and keep the platform secure.</li>
          </ul>
        ),
      },
      {
        title: "Who we share it with",
        body: (
          <>
            <p>We share only what is needed to run the service, with:</p>
            <ul>
              <li>courier partners, to deliver your parcel;</li>
              <li>our payment provider, to take and refund payments;</li>
              <li>
                hosting and database providers that store the platform&rsquo;s
                data on our behalf.
              </li>
            </ul>
            <p>
              We do not sell your personal data. We may disclose it where
              required by law.
            </p>
          </>
        ),
      },
      {
        title: "How long we keep it",
        body: (
          <p>
            We keep account data while your account is active. Order and
            payment records are kept for as long as needed for warranty,
            accounting and legal requirements, then deleted or anonymised.
          </p>
        ),
      },
      {
        title: "Your rights",
        body: (
          <p>
            Under the PDPA you may ask to access or correct your personal data,
            or withdraw consent to marketing. You can update most details
            yourself from <Link href="/account">My Account</Link>. For anything
            else, contact MIVO customer support.
          </p>
        ),
      },
      {
        title: "Changes to this policy",
        body: (
          <p>
            We may update this policy from time to time. The latest version is
            always on this page, with the date it was last updated.
          </p>
        ),
      },
    ],
  },
  ms: {
    eyebrow: "PRIVASI",
    title: "Polisi Privasi",
    intro:
      "Polisi ini menerangkan data peribadi yang dikumpul oleh MIVO, sebab kami mengumpulnya, dan cara kami melindunginya, selaras dengan Akta Perlindungan Data Peribadi 2010 (PDPA) Malaysia.",
    updated: "30 Oktober 2026",
    sections: [
      {
        title: "Data yang kami kumpul",
        body: (
          <ul>
            <li>
              <strong>Butiran akaun:</strong> nama, alamat e-mel dan kata
              laluan (disimpan dalam bentuk tersulit, tidak sekali-kali dapat
              dilihat oleh kami).
            </li>
            <li>
              <strong>Butiran penghantaran:</strong> nama penerima, nombor
              telefon dan alamat penghantaran.
            </li>
            <li>
              <strong>Butiran kenderaan:</strong> kereta yang anda simpan di
              Garaj Saya, digunakan untuk memadankan alat ganti yang sesuai.
            </li>
            <li>
              <strong>Sejarah pesanan:</strong> barang yang dibeli, pembayaran,
              pulangan, tuntutan waranti dan ulasan, termasuk sebarang gambar
              yang anda muat naik.
            </li>
            <li>
              <strong>Data teknikal:</strong> kuki dan storan seumpamanya yang
              diperlukan untuk memastikan anda kekal log masuk serta mengingati
              troli dan kenderaan anda.
            </li>
          </ul>
        ),
      },
      {
        title: "Maklumat pembayaran",
        body: (
          <p>
            Pembayaran kad diproses oleh penyedia pembayaran kami, Stripe. MIVO
            tidak melihat atau menyimpan nombor penuh kad anda.
          </p>
        ),
      },
      {
        title: "Cara kami menggunakan data anda",
        body: (
          <ul>
            <li>Untuk memproses, menghantar dan menyokong pesanan anda.</li>
            <li>
              Untuk memaparkan alat ganti yang sesuai dengan kenderaan yang anda
              simpan.
            </li>
            <li>Untuk mengendalikan pulangan, bayaran balik dan tuntutan waranti.</li>
            <li>
              Untuk menghantar makluman berkaitan pesanan dan akaun. Kami hanya
              menghantar mesej pemasaran jika anda telah bersetuju untuk
              menerimanya.
            </li>
            <li>Untuk mencegah penipuan dan memastikan platform kekal selamat.</li>
          </ul>
        ),
      },
      {
        title: "Pihak yang kami kongsikan data",
        body: (
          <>
            <p>
              Kami hanya berkongsi maklumat yang diperlukan untuk menjalankan
              perkhidmatan, dengan:
            </p>
            <ul>
              <li>rakan kongsi kurier, untuk menghantar bungkusan anda;</li>
              <li>
                penyedia pembayaran kami, untuk menerima bayaran dan membuat
                bayaran balik;
              </li>
              <li>
                penyedia pengehosan dan pangkalan data yang menyimpan data
                platform bagi pihak kami.
              </li>
            </ul>
            <p>
              Kami tidak menjual data peribadi anda. Kami mungkin
              mendedahkannya jika dikehendaki oleh undang-undang.
            </p>
          </>
        ),
      },
      {
        title: "Tempoh kami menyimpan data",
        body: (
          <p>
            Kami menyimpan data akaun selagi akaun anda aktif. Rekod pesanan
            dan pembayaran disimpan selama yang diperlukan bagi tujuan waranti,
            perakaunan dan keperluan undang-undang, kemudian dipadam atau
            dijadikan tanpa nama.
          </p>
        ),
      },
      {
        title: "Hak anda",
        body: (
          <p>
            Di bawah PDPA, anda boleh meminta untuk mengakses atau membetulkan
            data peribadi anda, atau menarik balik persetujuan untuk pemasaran.
            Anda boleh mengemas kini kebanyakan butiran sendiri melalui{" "}
            <Link href="/account">Akaun Saya</Link>. Untuk perkara lain, sila
            hubungi khidmat pelanggan MIVO.
          </p>
        ),
      },
      {
        title: "Perubahan pada polisi ini",
        body: (
          <p>
            Kami mungkin mengemas kini polisi ini dari semasa ke semasa. Versi
            terkini sentiasa tersedia di halaman ini, bersama tarikh ia
            terakhir dikemas kini.
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
    eyebrow: "隐私",
    title: "隐私政策",
    intro:
      "本政策根据马来西亚《2010年个人资料保护法令》（PDPA），说明 MIVO 收集哪些个人资料、收集的原因，以及我们如何保护这些资料。",
    updated: "2026年10月30日",
    sections: [
      {
        title: "我们收集的资料",
        body: (
          <ul>
            <li>
              <strong>账户资料：</strong>
              姓名、电邮地址及密码（加密储存，我们永远无法看到）。
            </li>
            <li>
              <strong>配送资料：</strong>收件人姓名、电话号码及送货地址。
            </li>
            <li>
              <strong>车辆资料：</strong>
              您保存在&ldquo;我的车库&rdquo;中的车辆，用于匹配适配的零件。
            </li>
            <li>
              <strong>订单记录：</strong>
              购买的商品、付款、退货、保修索赔及评价，包括您上传的任何照片。
            </li>
            <li>
              <strong>技术资料：</strong>
              维持您的登录状态、记住您的购物车和车辆所需的 Cookie 及类似储存技术。
            </li>
          </ul>
        ),
      },
      {
        title: "付款资料",
        body: (
          <p>
            信用卡/借记卡付款由我们的支付服务商 Stripe 处理。MIVO
            不会看到或储存您的完整卡号。
          </p>
        ),
      },
      {
        title: "我们如何使用您的资料",
        body: (
          <ul>
            <li>处理、配送您的订单并提供相关支持。</li>
            <li>显示适配您已保存车辆的零件。</li>
            <li>处理退货、退款及保修索赔。</li>
            <li>
              发送订单和账户相关通知。只有在您同意接收的情况下，我们才会发送营销信息。
            </li>
            <li>防范欺诈，确保平台安全。</li>
          </ul>
        ),
      },
      {
        title: "我们与谁分享资料",
        body: (
          <>
            <p>我们只分享运营服务所必需的资料，对象包括：</p>
            <ul>
              <li>快递合作伙伴，用于配送您的包裹；</li>
              <li>我们的支付服务商，用于收款及退款；</li>
              <li>代表我们储存平台资料的主机及数据库服务商。</li>
            </ul>
            <p>我们不会出售您的个人资料。在法律要求的情况下，我们可能会披露这些资料。</p>
          </>
        ),
      },
      {
        title: "资料保留期限",
        body: (
          <p>
            在您的账户有效期间，我们会保留账户资料。订单及付款记录将按保修、会计及法律要求所需的时间保留，之后予以删除或匿名化处理。
          </p>
        ),
      },
      {
        title: "您的权利",
        body: (
          <p>
            根据 PDPA，您可以要求查阅或更正您的个人资料，或撤回接收营销信息的同意。大部分资料您都可以在
            <Link href="/account">我的账户</Link>
            中自行更新。如有其他需要，请联系 MIVO 客服。
          </p>
        ),
      },
      {
        title: "本政策的修改",
        body: (
          <p>
            我们可能会不时更新本政策。最新版本将一直刊登在本页面，并注明最后更新日期。
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

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();
  const page = content[locale];
  return (
    <PolicyPage
      locale={locale}
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      updated={page.updated}
      current="/privacy-policy"
      sections={page.sections}
    />
  );
}
