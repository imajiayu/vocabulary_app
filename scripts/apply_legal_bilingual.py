#!/usr/bin/env python3
"""把 legal/*.json 固定搭配 section 的例句列迁移为双语 {en, zh}。

规则：
 - 只处理 heading 包含"固定搭配"的 grammar section
 - 只处理 table headers 含"例句"的列（跳过 w2d2 这类"用法说明"列）
 - 如果单元格已是 dict {en, zh}：跳过
 - 如果单元格是 "<p class=\"example\">...<span class=\"en-text\">EN</span><span class=\"translation\">— ZH</span></p>" 格式：
     自动拆解（去掉破折号前缀和 <p>/<span> 包装）
 - 如果单元格仅英文（形如 "<span class=\"en-text\">EN</span>"）：从 TRANSLATIONS 取 zh
"""
import json
import os
import re
import glob
import sys

LEGAL_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'legal')


# 纯英文例句的中文翻译
TRANSLATIONS = {
    # w1d3.json
    "This Agreement is made and entered into as of January 1, 2026.":
        "本协议由各方于 2026 年 1 月 1 日签订生效。",
    "ABC Inc., a corporation duly organized and existing under the laws of the State of Delaware.":
        "ABC 公司，一家根据特拉华州法律正式组建并存续的公司。",
    "XYZ Ltd. (hereinafter referred to as \"the Buyer\") agrees to the terms hereof.":
        "XYZ 有限公司（以下简称「买方」）同意本协议的条款。",
    "In consideration of the mutual covenants and agreements herein contained, the parties agree as follows.":
        "基于本协议所载的相互承诺与约定，各方约定如下。",
    "The parties hereto have caused this Agreement to be executed by their authorized representatives.":
        "本协议各方已促使其授权代表签署本协议。",
    "For good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged.":
        "基于已足额收到且特此确认的有效对价。",
    "A company with its principal place of business at 200 Park Avenue, New York.":
        "一家主要营业地位于纽约公园大道 200 号的公司。",
    "The Seller and the Buyer shall be collectively referred to as \"the Parties\".":
        "卖方与买方合称为「各方」。",

    # w1d4.json
    "“Services” shall mean and refer to the consulting services described in Exhibit A.":
        "「服务」是指并特指附件 A 中所述的咨询服务。",
    "“Effective Date” shall have the meaning ascribed to it in Section 12.1 hereof.":
        "「生效日」具有本协议第 12.1 条赋予的含义。",
    "As used herein, the following capitalized terms shall have the following meanings.":
        "在本协议中，以下首字母大写的术语具有下列含义。",
    "Unless the context otherwise requires, references to Sections are to sections of this Agreement.":
        "除上下文另有要求外，凡提及「条」均指本协议的条款。",
    "Losses shall include, without limitation, damages, liabilities, and reasonable attorneys’ fees.":
        "「损失」包括但不限于损害赔偿、责任及合理的律师费。",
    "The payment terms shall be as set forth in Schedule B hereto.":
        "付款条款应按照本协议附表 B 的规定执行。",
    "Each Affiliate, as defined herein, shall be bound by the terms of this Agreement.":
        "本协议所定义的每一关联方均应受本协议条款约束。",
    "Capitalized terms not defined in this Section shall bear the meaning ascribed thereto elsewhere.":
        "本条未定义的首字母大写术语应采用本协议其他部分赋予的含义。",

    # w1d5.json
    "Subject to the terms and conditions of this Agreement, Provider shall provide the Services.":
        "根据本协议的条款和条件，提供方应提供相关服务。",
    "Contractor shall perform the Services in accordance with the Specifications set forth in Exhibit A.":
        "承包方应按照附件 A 中规定的技术规范履行服务。",
    "All Deliverables shall be provided to the reasonable satisfaction of Client.":
        "所有交付成果应达到客户合理满意的标准。",
    "Time is of the essence with respect to all dates and deadlines set forth in this Agreement.":
        "本协议所规定的所有日期与期限均为要件（时间至关重要）。",
    "Provider shall use its best efforts to complete the Services by the Target Date.":
        "提供方应尽最大努力在目标日期前完成服务。",
    "Each party shall use reasonable efforts to cooperate with the other in the performance of this Agreement.":
        "各方应尽合理努力在履行本协议中相互配合。",
    "Upon receipt of the advance payment, Supplier shall commence delivery within five (5) Business Days.":
        "收到预付款后，供应方应在五（5）个营业日内开始交付。",
    "Contractor shall perform the Services in a professional and workmanlike manner consistent with industry standards.":
        "承包方应以符合行业标准的专业与熟练方式履行服务。",

    # w1d6.json
    "This Agreement shall come into effect on the date of execution by both Parties.":
        "本协议自双方签署之日起生效。",
    "This Agreement shall remain in full force and effect until terminated in accordance with the provisions hereof.":
        "本协议应保持完全效力，直至依据本协议的规定终止为止。",
    "The initial term shall be two (2) years from the Effective Date, unless earlier terminated pursuant to Section 12.":
        "初始期限自生效日起为两（2）年，除非依据第 12 条提前终止。",
    "Upon the expiration of the initial term, this Agreement shall automatically renew for successive one (1) year periods.":
        "初始期限届满后，本协议应按连续一（1）年的期限自动续期。",
    "This Agreement shall be for an initial term of three (3) years commencing on the Effective Date.":
        "本协议初始期限为三（3）年，自生效日起算。",
    "Either Party may terminate this Agreement for cause upon thirty (30) days' prior written notice.":
        "任何一方均可凭正当理由，在提前三十（30）日以书面通知后终止本协议。",
    "Client may terminate this Agreement for convenience upon ninety (90) days' prior written notice to Provider.":
        "客户方可在提前九十（90）日向提供方发出书面通知后，出于便利而终止本协议。",
    "Sections 8, 9, and 12 shall survive the termination or expiration of this Agreement.":
        "第 8 条、第 9 条和第 12 条在本协议终止或届满后仍继续有效。",

    # w2d5.json
    "The limitation of liability set forth in this Section shall apply to the fullest extent permitted by applicable law.":
        "本条款规定的责任限制应在适用法律允许的最大范围内适用。",
    "No failure to exercise or delay in exercising any right shall constitute a waiver of such right.":
        "未行使或迟延行使任何权利均不构成对该项权利的弃权。",
    "The total aggregate liability of Provider under this Agreement shall be subject to a cap on liability equal to the fees paid during the preceding twelve (12) months.":
        "提供方在本协议项下的累计总责任受责任上限约束，上限等于此前十二（12）个月内已付费用。",
    "Provider makes no warranties, express or implied, and hereby disclaims all implied warranties, including merchantability and fitness for a particular purpose.":
        "提供方不作任何明示或默示的保证，并特此否认所有默示保证，包括适销性和特定用途适用性。",
    "In no event shall either Party be liable to the other Party for any consequential, incidental, or special damages.":
        "在任何情况下，任何一方均不对另一方承担任何后果性、附带性或特殊损害赔偿责任。",
    "To the maximum extent permitted by applicable law, Provider disclaims all liability for indirect damages.":
        "在适用法律允许的最大范围内，提供方否认对任何间接损害承担责任。",
    "Provider shall indemnify and hold harmless Client from and against any and all claims, damages, and expenses arising out of Provider's breach of this Agreement.":
        "提供方应赔偿客户并使其免受因提供方违反本协议而引起的任何及所有索赔、损害和费用的侵害。",
    "The aggregate liability of either Party under this Agreement shall not exceed the total fees paid or payable hereunder during the twelve (12) month period preceding the event giving rise to such liability.":
        "任何一方在本协议项下的累计责任不得超过引起该责任的事件发生前十二（12）个月内本协议项下已付或应付费用的总额。",

    # w2d6.json
    "The Receiving Party shall not disclose any Confidential Information of the Disclosing Party to any third party.":
        "接收方不得向任何第三方披露披露方的任何保密信息。",
    "Each Party shall be bound by the non-disclosure obligations set forth in this Section 7.":
        "各方均应受本第 7 条所规定的保密义务约束。",
    "All materials provided hereunder shall be deemed proprietary and confidential.":
        "本协议项下提供的所有资料均视为专有且保密。",
    "Nothing herein shall limit any rights or remedies available under applicable trade secret protection laws.":
        "本协议中的任何内容均不限制适用商业秘密保护法下可用的任何权利或救济。",
    "Upon termination of this Agreement, the Receiving Party shall promptly return or destroy all Confidential Information.":
        "本协议终止后，接收方应立即归还或销毁所有保密信息。",
    "The Receiving Party shall use commercially reasonable efforts to protect the confidentiality of such information.":
        "接收方应尽商业上合理的努力保护该等信息的保密性。",
    "Except for permitted disclosure under Section 5.3, the Receiving Party shall maintain strict confidentiality.":
        "除第 5.3 条允许的披露外，接收方应严格保密。",
    "The Receiving Party shall use the Disclosing Party's Confidential Information solely for the purpose of this Agreement.":
        "接收方应仅为本协议之目的使用披露方的保密信息。",

    # w3d2.json
    "The parties acknowledge receipt of good and valuable consideration.":
        "各方确认已收到有效对价。",
    "In consideration of the Services to be provided by Provider, Client shall pay the Fees.":
        "作为提供方所提供服务的对价，客户方应支付相关费用。",
    "The parties acknowledge the receipt and sufficiency of the consideration hereof.":
        "各方确认已足额收到本协议项下的对价。",
    "For and in consideration of the covenants herein, each party agrees to...":
        "基于本协议所载的各项承诺作为对价，各方同意……",
    "Upon failure of consideration, the other party may seek damages.":
        "若对价未能实现，另一方可请求损害赔偿。",
    "Provider shall perform the obligations without further consideration.":
        "提供方应在不收取额外对价的情况下履行相关义务。",
    "Both parties warrant that they have received adequate consideration.":
        "双方均保证已收到足够的对价。",
    "The promises constitute a bargained-for exchange of value.":
        "该等承诺构成双方就价值进行的协商交换（对价的要件）。",

    # w3d3.json
    "All amounts shall be due and payable within thirty (30) days of invoice.":
        "所有款项应于开具发票后三十（30）日内到期应付。",
    "Client shall remit payment upon receipt of a valid invoice from Provider.":
        "客户方应在收到提供方开具的有效发票后汇付款项。",
    "Payment is due net 30 days from the date of invoice.":
        "付款期限为发票日后净 30 日到期。",
    "The License Fee shall be payable in twelve (12) equal monthly installments.":
        "许可费应分十二（12）期等额月付。",
    "Each progress payment is subject to a retention of ten percent (10%) until final acceptance.":
        "每笔进度款须保留百分之十（10%），直至最终验收。",
    "The foregoing amounts constitute payment in full and final settlement of all claims.":
        "上述款项构成对所有索赔的全额且最终的清偿。",
    "All payments shall be made by wire transfer to the designated bank account set forth in Schedule A.":
        "所有付款应通过电汇方式汇入附表 A 所指定的银行账户。",
    "Client shall make payments as per the payment schedule attached hereto as Exhibit B.":
        "客户方应按照本协议附件 B 的付款时间表付款。",

    # w3d4.json
    "Interest shall accrue from the date of default until the date of actual payment.":
        "利息应自违约之日起至实际付款之日止计收。",
    "Overdue amounts shall bear interest at the rate of six percent (6%) per annum.":
        "逾期款项应按年利率百分之六（6%）计息。",
    "Provider shall pay liquidated damages at the rate of USD 1,000 per day of delay.":
        "提供方应按每延误一日 1,000 美元的标准支付违约金。",
    "The parties agree that the foregoing liquidated damages constitute a genuine pre-estimate of the loss likely to be suffered.":
        "各方同意前述违约金构成对可能遭受损失的真实预估。",
    "Without prejudice to any other remedy available hereunder, Provider shall be entitled to charge default interest on overdue amounts.":
        "在不影响本协议项下任何其他救济的前提下，提供方有权就逾期款项收取违约利息。",
    "Liquidated damages shall be subject to a maximum aggregate of ten percent (10%) of the Contract Price.":
        "违约金累计上限为合同价款的百分之十（10%）。",
    "In the event of late payment, Client shall pay interest on the overdue amount.":
        "如发生迟付，客户方应就逾期金额支付利息。",
    "Default interest shall accrue on the outstanding balance, accruing on a daily basis from the due date.":
        "违约利息应就未偿余额自到期日起按日计收。",

    # w3d5.json
    "All payments shall be made free and clear of all taxes.":
        "所有付款均应在扣除一切税费前全额支付。",
    "Payments shall be made without any deduction or withholding on account of tax.":
        "付款不得因税款而作任何扣减或代扣代缴。",
    "The Payor shall gross up the payment so that the Recipient receives the full amount.":
        "付款方应对款项进行毛额化处理，以确保收款方收到全额款项。",
    "The price of USD 50,000 is exclusive of VAT and any applicable duties.":
        "50,000 美元的价款不含增值税及任何适用的关税。",
    "Each party hereby waives any right of set-off or counterclaim against the other.":
        "各方特此放弃对另一方行使任何抵销或反诉的权利。",
    "The Payor shall remit the withheld amount to the relevant tax authority within the required timeframe.":
        "付款方应在规定时限内将代扣款项汇交有关税务机关。",
    "Payments under this Agreement may be subject to withholding tax under applicable law.":
        "本协议项下的付款可能依据适用法律受预提税约束。",
    "The Buyer shall bear all taxes and duties arising from the importation of the Goods.":
        "买方应承担因货物进口而产生的所有税费和关税。",
}


EN_TEXT_RE = re.compile(r'<span class="en-text">(.*?)</span>', re.DOTALL)
TRANSLATION_RE = re.compile(r'<span class="translation">(.*?)</span>', re.DOTALL)


def strip_lead_dash(s):
    """去掉翻译开头的破折号（— / -— / —— ）和空白"""
    return re.sub(r'^[\s—–\-]+', '', s).strip()


def transform_cell(cell, filename, row_idx):
    """单字符串 cell → {en, zh}"""
    if isinstance(cell, dict):
        return cell  # 已是双语

    if not isinstance(cell, str):
        return cell

    # 情形 1：<p class="example">...<span class="en-text">EN</span><span class="translation">— ZH</span></p>
    if '<p class="example"' in cell and 'class="translation"' in cell:
        en_m = EN_TEXT_RE.search(cell)
        zh_m = TRANSLATION_RE.search(cell)
        if en_m and zh_m:
            en_inner = en_m.group(1).strip()
            zh_inner = strip_lead_dash(zh_m.group(1))
            return {
                'en': f'<span class="en-text">{en_inner}</span>',
                'zh': zh_inner,
            }

    # 情形 2：单 <span class="en-text">EN</span>
    en_m = EN_TEXT_RE.search(cell)
    if en_m:
        en_inner = en_m.group(1).strip()
        # 去掉全大写（合同排版）→ sentence case（如 PROVIDER → Provider）
        normalized = en_inner
        if en_inner.isupper() or (en_inner.replace(',', '').replace('.', '').replace(' ', '').replace('(', '').replace(')', '').isupper()):
            # 这种情况在 TRANSLATIONS 里已经以正常大小写做 key
            normalized = _sentence_case(en_inner)
        zh = TRANSLATIONS.get(normalized) or TRANSLATIONS.get(en_inner)
        if zh is None:
            print(f'  [MISSING zh] {filename} row {row_idx}: {en_inner[:80]}', file=sys.stderr)
            return cell
        return {
            'en': f'<span class="en-text">{normalized}</span>',
            'zh': zh,
        }

    # 没有 en-text span 的，不动
    return cell


def _sentence_case(s):
    """对纯英文全大写字符串，改为 Sentence case（首字母大写，其余小写）。
    保留全大写缩略语（>1 字母）如 USD/VAT 等。"""
    # 先整体小写
    low = s.lower()
    # 再把 ". " 和开头的字母首字母大写
    parts = re.split(r'([.!?] +)', low)
    out = []
    for p in parts:
        if p and p[0].isalpha():
            p = p[0].upper() + p[1:]
        out.append(p)
    result = ''.join(out)
    # 保留已知缩略语大写
    for abbr in ['Usd', 'Vat', 'Abc', 'Xyz', 'Usa']:
        result = result.replace(abbr, abbr.upper())
    return result


def process_file(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    changed = False
    filename = os.path.basename(path)

    for section in data.get('sections', []):
        if section.get('type') != 'grammar':
            continue
        if '固定搭配' not in (section.get('heading') or ''):
            continue

        for block in section.get('blocks', []):
            if block.get('type') != 'table':
                continue
            headers = block.get('headers') or []
            # 例句列识别：header 含"例句"；找不到则取最后一列，但要求该列至少一个 cell 含 <span class="en-text">
            col_idx = None
            for i, h in enumerate(headers):
                if '例句' in h:
                    col_idx = i
                    break
            if col_idx is None and headers:
                last = len(headers) - 1
                rows = block.get('rows', [])
                if any(isinstance(r[last], str) and '<span class="en-text"' in r[last]
                       for r in rows if len(r) > last):
                    col_idx = last
            if col_idx is None:
                continue
            for ri, row in enumerate(block.get('rows', [])):
                if col_idx >= len(row):
                    continue
                new_cell = transform_cell(row[col_idx], filename, ri)
                if new_cell is not row[col_idx]:
                    row[col_idx] = new_cell
                    changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
    return changed


def main():
    files = sorted(glob.glob(os.path.join(LEGAL_DIR, '*.json')))
    total_changed = 0
    for path in files:
        if process_file(path):
            total_changed += 1
            print(f'updated: {os.path.basename(path)}')
    print(f'Done. {total_changed} files changed.')


if __name__ == '__main__':
    main()
