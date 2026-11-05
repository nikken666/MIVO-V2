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
    updated: "5 November 2026",
    sections: [
      {
        title: "Return window",
        body: (
          <>
            <p>
              Return requests must be made within <strong>15 days</strong> of
              the order being delivered. Requests made after this period are
              handled under the product warranty instead (see section 6).
            </p>
            <p>
              Orders are confirmed automatically <strong>7 days</strong> after
              delivery. A free return (MIVO books the return parcel) is only
              available for requests made within those 7 days. From day 8 to
              day 15 you can still request a return: once MIVO has reviewed and
              approved it, you pay for and post the item back yourself to the
              MIVO hub address shown on the request page.
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
                <strong>
                  Wrong, damaged, defective, not as described, missing parts or
                  not received
                </strong>
                <span>
                  Once MIVO confirms it&rsquo;s the seller&rsquo;s responsibility:
                  refund of the item price and its share of shipping. MIVO books
                  the return parcel — you drop it off at a courier point with the
                  tracking number.
                </span>
              </div>
              <div>
                <strong>
                  Item from MIVO Direct marked &ldquo;Fits your vehicle&rdquo;
                  that does not fit
                </strong>
                <span>
                  Treated as a MIVO error, same as above, provided the vehicle
                  details saved on the order are correct.
                </span>
              </div>
              <div>
                <strong>
                  Change of mind, no reason, or a part whose fitment was not
                  verified by MIVO
                </strong>
                <span>
                  The customer pays shipping both ways: the original delivery
                  fee is not refunded, the customer pays to send the item back,
                  and the payment processing fee for that item (which the
                  payment provider does not return) is deducted.
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
          <>
            <ol>
              <li>
                Sign in, open the order from{" "}
                <Link href="/orders">My Orders</Link> and tap{" "}
                <strong>Return / Refund</strong> (available once the order has
                shipped, until 15 days after delivery).
              </li>
              <li>
                Choose the items (one shop at a time), the reason, and add a
                description and clear photos or video of the item and
                packaging. You will see the estimated refund before you submit.
              </li>
              <li>
                MIVO reviews every request — whether it&rsquo;s day 1 or day
                15 — and usually replies within 2 working days. The shop can
                share its view, but MIVO makes the decision: approve the return,
                offer a partial refund (you keep the item), or reject it with a
                reason. Nothing is approved automatically.
              </li>
              <li>
                If a return is approved, send the item back within 7 days and
                enter the courier and tracking number on the request page.
                Requests not sent back in time are closed.
              </li>
              <li>
                When the returned item arrives, it is checked within 3 days. If
                there&rsquo;s no problem, your refund goes out automatically. If
                a problem is found, MIVO reviews the photos and history and
                makes the final decision.
              </li>
            </ol>
            <p>
              You can follow every step, and chat with the seller, from{" "}
              <Link href="/account/returns">My returns &amp; refunds</Link>.
            </p>
          </>
        ),
      },
      {
        title: "Refunds",
        body: (
          <>
            <p>
              Refunds go back to the original payment method once approved
              (after the returned item is received and checked, or straight
              away for refunds without a return). Banks usually take 5–10
              working days to show it.
            </p>
            <p>
              If the returned item comes back used, damaged or incomplete, the
              seller may propose a lower amount; MIVO checks the evidence before
              any amount is reduced.
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
              Card payments are only held (authorised) when you order and are
              charged when the order ships. If you cancel a card-paid order
              before it ships, the hold is released in full and nothing is
              charged — no fees.
            </li>
            <li>
              Orders paid by FPX online banking or GrabPay are charged straight
              away. If cancelled before shipping, the payment processing charge
              (non-refundable by the payment provider), a cancellation
              administration fee of 3% of the order total (capped at RM20) and a
              RM2 service fee are deducted. The exact refund is shown before you
              confirm.
            </li>
            <li>
              Once any part of an order has shipped, it can no longer be
              cancelled. Use a return request instead.
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
    updated: "5 November 2026",
    sections: [
      {
        title: "Tempoh pulangan",
        body: (
          <>
            <p>
              Permintaan pulangan mesti dibuat dalam tempoh{" "}
              <strong>15 hari</strong> dari tarikh pesanan diterima. Permintaan
              yang dibuat selepas tempoh ini akan dikendalikan di bawah waranti
              produk (rujuk bahagian 6).
            </p>
            <p>
              Pesanan disahkan secara automatik <strong>7 hari</strong> selepas
              diterima. Pulangan percuma (MIVO menempah bungkusan pulangan)
              hanya untuk permintaan dalam tempoh 7 hari itu. Dari hari ke-8
              hingga ke-15 anda masih boleh memohon pulangan: selepas MIVO
              menyemak dan meluluskannya, anda membayar dan mengepos sendiri
              barang ke alamat hab MIVO yang ditunjukkan di halaman permintaan.
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
                <strong>
                  Barang salah, rosak, cacat, tidak seperti yang diterangkan,
                  bahagian hilang atau tidak diterima
                </strong>
                <span>
                  Tanggungjawab penjual: bayaran balik penuh harga barang dan
                  bahagian kos penghantarannya. MIVO menanggung kos pos
                  pulangan.
                </span>
              </div>
              <div>
                <strong>
                  Barang daripada MIVO Direct bertanda &ldquo;Sesuai dengan
                  kenderaan anda&rdquo; tetapi tidak sesuai
                </strong>
                <span>
                  Dianggap sebagai kesilapan MIVO, sama seperti di atas, dengan
                  syarat butiran kenderaan yang disimpan pada pesanan adalah
                  betul.
                </span>
              </div>
              <div>
                <strong>
                  Tukar fikiran, tiada sebab, atau alat ganti yang kesesuaiannya
                  tidak disahkan oleh MIVO
                </strong>
                <span>
                  Pelanggan menanggung kos penghantaran bagi kedua-dua hala:
                  caj penghantaran asal tidak dikembalikan, pelanggan membayar
                  kos untuk menghantar semula barang tersebut, dan yuran
                  pemprosesan pembayaran bagi barang itu (yang tidak
                  dikembalikan oleh penyedia pembayaran) akan ditolak.
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
          <>
            <ol>
              <li>
                Log masuk, buka pesanan daripada{" "}
                <Link href="/orders">Pesanan Saya</Link> dan tekan{" "}
                <strong>Pulangan / Bayaran Balik</strong> (tersedia sebaik
                sahaja pesanan dihantar, sehingga 15 hari selepas diterima).
              </li>
              <li>
                Pilih barang (satu kedai pada satu masa), sebabnya, dan
                sertakan penerangan serta gambar atau video yang jelas bagi
                barang dan pembungkusannya. Anggaran bayaran balik akan
                dipaparkan sebelum anda menghantar permintaan.
              </li>
              <li>
                MIVO menyemak setiap permintaan — sama ada pada hari pertama
                atau hari ke-15 — dan biasanya menjawab dalam 2 hari bekerja.
                Kedai boleh memberi pandangan, tetapi MIVO yang membuat
                keputusan: meluluskan pulangan, menawarkan bayaran balik separa
                (anda menyimpan barang), atau menolak dengan sebab. Tiada
                permintaan yang diluluskan secara automatik.
              </li>
              <li>
                Jika pulangan diluluskan, hantar semula barang dalam tempoh 7
                hari dan masukkan nama kurier serta nombor penjejakan di
                halaman permintaan. Permintaan yang barangnya tidak dihantar
                semula dalam tempoh tersebut akan ditutup.
              </li>
              <li>
                Apabila barang yang dipulangkan tiba, ia disemak dalam tempoh 3
                hari. Jika tiada masalah, bayaran balik dihantar secara
                automatik. Jika ada masalah, MIVO akan menyemak gambar dan
                sejarah permintaan serta membuat keputusan muktamad.
              </li>
            </ol>
            <p>
              Anda boleh mengikuti setiap langkah, dan berbual dengan penjual,
              daripada{" "}
              <Link href="/account/returns">
                Pulangan &amp; bayaran balik saya
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        title: "Bayaran balik",
        body: (
          <>
            <p>
              Bayaran balik akan dibuat melalui kaedah pembayaran asal sebaik
              sahaja diluluskan (selepas barang yang dipulangkan diterima dan
              diperiksa, atau serta-merta bagi bayaran balik tanpa pulangan).
              Bank biasanya mengambil masa 5–10 hari bekerja untuk
              memaparkannya.
            </p>
            <p>
              Jika barang yang dipulangkan telah digunakan, rosak atau tidak
              lengkap, penjual boleh mencadangkan jumlah yang lebih rendah;
              MIVO akan menyemak bukti sebelum sebarang jumlah dikurangkan.
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
              Bayaran kad hanya ditahan (dibenarkan) semasa anda membuat pesanan
              dan dicaj apabila pesanan dihantar. Jika anda membatalkan pesanan
              yang dibayar dengan kad sebelum ia dihantar, tahanan itu akan
              dilepaskan sepenuhnya dan tiada caj dikenakan — tanpa sebarang
              yuran.
            </li>
            <li>
              Pesanan yang dibayar melalui perbankan dalam talian FPX atau
              GrabPay dicaj serta-merta. Jika dibatalkan sebelum dihantar, caj
              pemprosesan pembayaran (tidak dikembalikan oleh penyedia
              pembayaran), yuran pentadbiran pembatalan sebanyak 3% daripada
              jumlah pesanan (maksimum RM20) dan yuran perkhidmatan RM2 akan
              ditolak. Jumlah sebenar bayaran balik akan dipaparkan sebelum anda
              mengesahkan.
            </li>
            <li>
              Sebaik sahaja mana-mana bahagian pesanan telah dihantar, pesanan
              tidak boleh dibatalkan lagi. Sila buat permintaan pulangan
              sebaliknya.
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
    updated: "2026年11月5日",
    sections: [
      {
        title: "退货期限",
        body: (
          <>
            <p>
              退货申请必须在订单签收后 <strong>15 天</strong>
              内提出。超过此期限的申请将改按产品保修处理（见第 6 节）。
            </p>
            <p>
              订单签收 <strong>7 天</strong>后自动确认收货。免费退货（由 MIVO
              安排退货快递）仅限签收后 7 天内提出的申请。第 8 至第 15
              天仍可申请退货：经 MIVO 审核同意后，需自行付运费，把商品寄回申请页面显示的
              MIVO 仓库地址。
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
                <strong>
                  商品错误、损坏、有瑕疵、与描述不符、缺少零件或未收到
                </strong>
                <span>
                  属卖家责任：全额退还商品价格及其所占运费，退货邮费由 MIVO
                  承担。
                </span>
              </div>
              <div>
                <strong>
                  来自 MIVO Direct、标示&ldquo;适配您的车辆&rdquo;但实际不适配的商品
                </strong>
                <span>
                  视为 MIVO 的错误，处理方式同上（前提是订单上保存的车辆资料正确）。
                </span>
              </div>
              <div>
                <strong>改变主意、无理由，或适配性未经 MIVO 验证的零件</strong>
                <span>
                  来回运费均由顾客承担：原本的运费不予退还，寄回商品的运费由顾客支付，并将扣除该商品的支付手续费（支付服务商不予退还）。
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
          <>
            <ol>
              <li>
                登录后，从<Link href="/orders">我的订单</Link>
                打开该订单，并点击<strong>退货/退款</strong>
                （订单发货后即可申请，直至签收后 15 天）。
              </li>
              <li>
                选择商品（每次限一家店铺）及原因，并填写说明，附上商品及包装的清晰照片或视频。提交前您会看到预计退款金额。
              </li>
              <li>
                每一个退货申请（不管是签收后第 1 天还是第 15 天）都由 MIVO
                审核，通常 2 个工作日内回复。店铺可以提供意见，但由 MIVO
                作出决定：同意退货、提出部分退款（您保留商品），或说明原因后拒绝。不会自动通过。
              </li>
              <li>
                退货获批后，请在 7
                天内寄回商品，并在申请页面填写快递公司及运单号。未在期限内寄回的申请将被关闭。
              </li>
              <li>
                退回的商品到达后会在 3 天内检查；没有问题就会自动退款。如发现问题，MIVO
                将审查照片及记录，并作出最终决定。
              </li>
            </ol>
            <p>
              您可以在<Link href="/account/returns">我的退货与退款</Link>
              中跟进每个步骤，并与卖家沟通。
            </p>
          </>
        ),
      },
      {
        title: "退款",
        body: (
          <>
            <p>
              退款获批后将退回至原付款方式（退回的商品收到并检查后退款；无需退货的退款则会立即处理）。银行通常需要
              5–10 个工作日才会显示。
            </p>
            <p>
              如退回的商品已使用、损坏或不完整，卖家可提出较低的退款金额；MIVO
              会在核查证据后才决定是否减少退款。
            </p>
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
              银行卡付款在下单时仅作预授权冻结，订单发货时才正式扣款。如在发货前取消以银行卡付款的订单，冻结金额将全额释放，不会扣取任何款项——不收任何费用。
            </li>
            <li>
              以 FPX 网上银行或 GrabPay
              付款的订单会立即扣款。如在发货前取消，将扣除支付手续费（支付服务商不予退还）、订单总额
              3% 的取消行政费（最高 RM20）及 RM2
              服务费。确认取消前会显示确切的退款金额。
            </li>
            <li>订单中任何部分一经发货便无法取消，请改为申请退货。</li>
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
