import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { type PolicySection } from "@/components/PolicyPage";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

const meta: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Returns & Refunds Policy | MIVO",
    description:
      "How returns, exchanges, refunds and cancellations work for automotive parts bought on MIVO.",
  },
  ms: {
    title: "Polisi Pulangan & Bayaran Balik | MIVO",
    description:
      "Cara pulangan, penukaran, bayaran balik dan pembatalan berfungsi bagi alat ganti kenderaan yang dibeli di MIVO.",
  },
  zh: {
    title: "退货与退款政策 | MIVO",
    description: "在 MIVO 购买的汽车零件如何办理退货、换货、退款及取消订单。",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: meta[locale].title,
    description: meta[locale].description,
    alternates: { canonical: "/returns-policy" },
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
    eyebrow: "RETURNS & REFUNDS",
    title: "Returns & Refunds Policy",
    intro:
      "We want you to get the right part the first time. If something is wrong, here is exactly how returns, refunds and cancellations work.",
    updated: "30 October 2026",
    sections: [
      {
        title: "Return window",
        body: (
          <>
            <p>
              Return requests must be made within <strong>7 days</strong> of
              the order being delivered. Requests made after this period are
              handled under the product warranty instead (see section 6).
            </p>
          </>
        ),
      },
      {
        title: "Who pays for return shipping",
        body: (
          <>
            <div className="policyTable">
              <div>
                <strong>Wrong, damaged or defective item</strong>
                <span>
                  MIVO pays the return shipping and sends the correct or
                  replacement part at no extra cost.
                </span>
              </div>
              <div>
                <strong>
                  Item marked &ldquo;Fits your vehicle&rdquo; that does not fit
                </strong>
                <span>
                  Treated as a MIVO error. MIVO pays the return shipping,
                  provided the vehicle details saved on the order are correct.
                </span>
              </div>
              <div>
                <strong>Change of mind</strong>
                <span>
                  Accepted, but the customer pays shipping both ways: the
                  original delivery fee is not refunded and the customer pays
                  to send the item back.
                </span>
              </div>
            </div>
            <p>
              Ordering a part that was marked &ldquo;Not compatible&rdquo; or
              &ldquo;Fitment not verified&rdquo; for your vehicle, or entering
              the wrong vehicle details, counts as a change of mind.
            </p>
          </>
        ),
      },
      {
        title: "Condition of returned items",
        body: (
          <ul>
            <li>Unused and not installed on a vehicle.</li>
            <li>
              In the original packaging, with all labels, accessories and
              hardware included.
            </li>
            <li>
              Packed securely. Damage caused by poor packing during the return
              trip may reduce or void the refund.
            </li>
          </ul>
        ),
      },
      {
        title: "How to request a return",
        body: (
          <ol>
            <li>
              Sign in and open the order from{" "}
              <Link href="/orders">My Orders</Link>.
            </li>
            <li>
              Tap <strong>View Warranty</strong> on the delivered order and
              submit a claim for the item. Choose the closest issue type (for
              example &ldquo;Fitment issue&rdquo; or &ldquo;Damage&rdquo;, or
              &ldquo;Other&rdquo; for a change of mind), explain the reason, and
              add clear photos of the item and its packaging.
            </li>
            <li>
              Wait for approval and return instructions before sending anything
              back. Parcels sent without approval may not be accepted.
            </li>
          </ol>
        ),
      },
      {
        title: "Refunds",
        body: (
          <>
            <p>
              Once the returned item arrives and passes inspection, the refund
              is issued to the original payment method. Banks usually take 5–10
              working days to show it on your statement.
            </p>
            <p>
              For a change-of-mind return, the refund covers the item price
              only. Shipping fees are not refunded.
            </p>
          </>
        ),
      },
      {
        title: "Warranty claims",
        body: (
          <p>
            Each product shows its warranty period on the product page. For a
            fault that appears after the return window but within the warranty
            period, submit a warranty claim from the order page. Warranty does
            not cover wear and tear, incorrect installation, accidents, or use
            outside the part&rsquo;s intended application.
          </p>
        ),
      },
      {
        title: "Cancelling an order",
        body: (
          <ul>
            <li>
              Unpaid orders are cancelled automatically 24 hours after they are
              placed.
            </li>
            <li>
              Paid orders can be cancelled from the order page until they are
              shipped. Payment processing charges are non-refundable, and a
              cancellation administration fee of 3% (capped at RM20) plus a RM2
              service fee applies. The exact refund is shown before you
              confirm.
            </li>
            <li>
              Once an order has been shipped, it can no longer be cancelled.
              Use a return request instead.
            </li>
          </ul>
        ),
      },
    ],
  },
  ms: {
    eyebrow: "PULANGAN & BAYARAN BALIK",
    title: "Polisi Pulangan & Bayaran Balik",
    intro:
      "Kami mahu anda mendapat alat ganti yang betul pada kali pertama. Jika ada masalah, berikut ialah cara pulangan, bayaran balik dan pembatalan berfungsi.",
    updated: "30 Oktober 2026",
    sections: [
      {
        title: "Tempoh pulangan",
        body: (
          <>
            <p>
              Permintaan pulangan mesti dibuat dalam tempoh{" "}
              <strong>7 hari</strong> dari tarikh pesanan diterima. Permintaan
              yang dibuat selepas tempoh ini akan dikendalikan di bawah waranti
              produk (rujuk bahagian 6).
            </p>
          </>
        ),
      },
      {
        title: "Siapa yang menanggung kos penghantaran pulangan",
        body: (
          <>
            <div className="policyTable">
              <div>
                <strong>Barang salah, rosak atau cacat</strong>
                <span>
                  MIVO menanggung kos penghantaran pulangan dan menghantar alat
                  ganti yang betul atau gantian tanpa kos tambahan.
                </span>
              </div>
              <div>
                <strong>
                  Barang bertanda &ldquo;Sesuai dengan kenderaan anda&rdquo;
                  tetapi tidak sesuai
                </strong>
                <span>
                  Dianggap sebagai kesilapan MIVO. MIVO menanggung kos
                  penghantaran pulangan, dengan syarat butiran kenderaan yang
                  disimpan pada pesanan adalah betul.
                </span>
              </div>
              <div>
                <strong>Tukar fikiran</strong>
                <span>
                  Diterima, tetapi pelanggan menanggung kos penghantaran bagi
                  kedua-dua hala: caj penghantaran asal tidak dikembalikan dan
                  pelanggan membayar kos untuk menghantar semula barang
                  tersebut.
                </span>
              </div>
            </div>
            <p>
              Memesan alat ganti yang bertanda &ldquo;Tidak sesuai&rdquo; atau
              &ldquo;Kesesuaian belum disahkan&rdquo; untuk kenderaan anda,
              atau memasukkan butiran kenderaan yang salah, dikira sebagai
              tukar fikiran.
            </p>
          </>
        ),
      },
      {
        title: "Keadaan barang yang dipulangkan",
        body: (
          <ul>
            <li>Belum digunakan dan belum dipasang pada kenderaan.</li>
            <li>
              Dalam pembungkusan asal, lengkap dengan semua label, aksesori dan
              perkakasan.
            </li>
            <li>
              Dibungkus dengan kemas. Kerosakan akibat pembungkusan yang tidak
              sempurna semasa penghantaran pulangan boleh mengurangkan atau
              membatalkan bayaran balik.
            </li>
          </ul>
        ),
      },
      {
        title: "Cara membuat permintaan pulangan",
        body: (
          <ol>
            <li>
              Log masuk dan buka pesanan daripada{" "}
              <Link href="/orders">Pesanan Saya</Link>.
            </li>
            <li>
              Tekan <strong>Lihat Waranti</strong> pada pesanan yang telah
              diterima dan hantar tuntutan untuk barang tersebut. Pilih jenis
              masalah yang paling hampir (contohnya &ldquo;Masalah
              padanan&rdquo; atau &ldquo;Kerosakan&rdquo;, atau
              &ldquo;Lain-lain&rdquo; untuk tukar fikiran), terangkan sebabnya,
              dan sertakan gambar yang jelas bagi barang serta
              pembungkusannya.
            </li>
            <li>
              Tunggu kelulusan dan arahan pulangan sebelum menghantar apa-apa
              barang. Bungkusan yang dihantar tanpa kelulusan mungkin tidak
              diterima.
            </li>
          </ol>
        ),
      },
      {
        title: "Bayaran balik",
        body: (
          <>
            <p>
              Setelah barang yang dipulangkan tiba dan lulus pemeriksaan,
              bayaran balik akan dibuat melalui kaedah pembayaran asal. Bank
              biasanya mengambil masa 5–10 hari bekerja untuk memaparkannya
              dalam penyata anda.
            </p>
            <p>
              Bagi pulangan kerana tukar fikiran, bayaran balik hanya meliputi
              harga barang. Caj penghantaran tidak dikembalikan.
            </p>
          </>
        ),
      },
      {
        title: "Tuntutan waranti",
        body: (
          <p>
            Tempoh waranti setiap produk dipaparkan di halaman produk. Bagi
            kerosakan yang berlaku selepas tempoh pulangan tetapi masih dalam
            tempoh waranti, hantar tuntutan waranti dari halaman pesanan.
            Waranti tidak meliputi haus dan lusuh biasa, pemasangan yang salah,
            kemalangan, atau penggunaan di luar tujuan asal alat ganti
            tersebut.
          </p>
        ),
      },
      {
        title: "Membatalkan pesanan",
        body: (
          <ul>
            <li>
              Pesanan yang belum dibayar akan dibatalkan secara automatik 24 jam
              selepas dibuat.
            </li>
            <li>
              Pesanan yang telah dibayar boleh dibatalkan dari halaman pesanan
              selagi belum dihantar. Caj pemprosesan pembayaran tidak akan
              dikembalikan, dan yuran pentadbiran pembatalan sebanyak 3%
              (maksimum RM20) serta yuran perkhidmatan RM2 akan dikenakan.
              Jumlah sebenar bayaran balik akan dipaparkan sebelum anda
              mengesahkan.
            </li>
            <li>
              Pesanan yang telah dihantar tidak boleh dibatalkan lagi. Sila
              buat permintaan pulangan sebaliknya.
            </li>
          </ul>
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
    eyebrow: "退货与退款",
    title: "退货与退款政策",
    intro:
      "我们希望您第一次就买对零件。如有任何问题，以下清楚说明退货、退款及取消订单的处理方式。",
    updated: "2026年10月30日",
    sections: [
      {
        title: "退货期限",
        body: (
          <>
            <p>
              退货申请必须在订单签收后 <strong>7 天</strong>
              内提出。超过此期限的申请将改按产品保修处理（见第 6 节）。
            </p>
          </>
        ),
      },
      {
        title: "退货运费由谁承担",
        body: (
          <>
            <div className="policyTable">
              <div>
                <strong>商品错误、损坏或有瑕疵</strong>
                <span>
                  由 MIVO 承担退货运费，并免费寄出正确的零件或替换零件。
                </span>
              </div>
              <div>
                <strong>标示&ldquo;适配您的车辆&rdquo;但实际不适配的商品</strong>
                <span>
                  视为 MIVO 的错误。只要订单上保存的车辆资料正确，退货运费由
                  MIVO 承担。
                </span>
              </div>
              <div>
                <strong>改变主意</strong>
                <span>
                  可以退货，但来回运费均由顾客承担：原本的运费不予退还，寄回商品的运费也由顾客支付。
                </span>
              </div>
            </div>
            <p>
              订购标示为&ldquo;不适配&rdquo;或&ldquo;适配未验证&rdquo;的零件，或填写了错误的车辆资料，均视为改变主意。
            </p>
          </>
        ),
      },
      {
        title: "退货商品的条件",
        body: (
          <ul>
            <li>未使用，且未安装在车辆上。</li>
            <li>保持原包装，所有标签、配件及安装零件齐全。</li>
            <li>
              包装稳妥。退货寄送途中因包装不当造成的损坏，可能会减少退款金额或导致无法退款。
            </li>
          </ul>
        ),
      },
      {
        title: "如何申请退货",
        body: (
          <ol>
            <li>
              登录后，从<Link href="/orders">我的订单</Link>打开该订单。
            </li>
            <li>
              在已签收的订单上点击<strong>查看保修</strong>
              ，为该商品提交索赔。选择最接近的问题类型（例如&ldquo;适配问题&rdquo;或&ldquo;损坏&rdquo;；如是改变主意，请选择&ldquo;其他&rdquo;），说明原因，并附上商品及其包装的清晰照片。
            </li>
            <li>
              请等待批准及退货指示后才寄回任何商品。未经批准寄回的包裹可能不予接收。
            </li>
          </ol>
        ),
      },
      {
        title: "退款",
        body: (
          <>
            <p>
              退回的商品送达并通过检查后，退款将退回至原付款方式。银行通常需要
              5–10 个工作日才会在您的账单上显示。
            </p>
            <p>因改变主意而退货的，退款只包括商品价格，运费不予退还。</p>
          </>
        ),
      },
      {
        title: "保修索赔",
        body: (
          <p>
            每件产品的保修期均显示在产品页面上。如故障在退货期限过后、但仍在保修期内出现，请从订单页面提交保修索赔。保修不包括正常磨损、安装不当、意外事故，或超出零件原定用途的使用。
          </p>
        ),
      },
      {
        title: "取消订单",
        body: (
          <ul>
            <li>未付款的订单将在下单 24 小时后自动取消。</li>
            <li>
              已付款的订单在发货前可从订单页面取消。支付手续费不予退还，并将收取
              3% 的取消行政费（最高 RM20）及 RM2
              服务费。确认取消前会显示确切的退款金额。
            </li>
            <li>订单一经发货便无法取消，请改为申请退货。</li>
          </ul>
        ),
      },
      {
        title: "翻译说明",
        body: <p>本页为翻译版本，如与英文版本有任何出入，以英文版本为准。</p>,
      },
    ],
  },
};

export default async function ReturnsPolicyPage() {
  const locale = await getLocale();
  const page = content[locale];
  return (
    <PolicyPage
      locale={locale}
      eyebrow={page.eyebrow}
      title={page.title}
      intro={page.intro}
      updated={page.updated}
      current="/returns-policy"
      sections={page.sections}
    />
  );
}
