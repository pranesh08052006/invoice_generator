from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.units import inch
from io import BytesIO
from models import Invoice
import datetime
import os

def num_to_words(num):
    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
    
    if num == 0: return "Zero"
    
    def helper(n):
        if n < 10: return units[int(n)]
        elif n < 20: return teens[int(n)-10]
        elif n < 100: return tens[int(n)//10] + (" " + units[int(n)%10] if int(n)%10 != 0 else "")
        elif n < 1000: return units[int(n)//100] + " Hundred" + (" and " + helper(n%100) if n%100 != 0 else "")
        elif n < 100000: # Thousands
            return helper(n//1000) + " Thousand" + (" " + helper(n%1000) if n%1000 != 0 else "")
        elif n < 10000000: # Lakhs
            return helper(n//100000) + " Lakh" + (" " + helper(n%100000) if n%100000 != 0 else "")
        else: # Crores
            return helper(n//10000000) + " Crore" + (" " + helper(n%10000000) if n%10000000 != 0 else "")

    try:
        main_part = int(num)
        res = helper(main_part)
        return res + " Rupees only"
    except:
        return str(num)

def generate_invoice_pdf(invoice: Invoice, client, business_details: dict, doc_title: str = "Sale Order"):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # Colors
    primary_orange = colors.HexColor("#f59e0b")
    text_dark = colors.HexColor("#000000")
    
    # Fonts: Standard ReportLab names for Times New Roman
    reg_font = "Times-Roman"
    bold_font = "Times-Bold"
    
    # Custom Styles
    biz_name_style = ParagraphStyle('BizName', fontSize=20, textColor=text_dark, fontName=bold_font, leading=24)
    biz_info_style = ParagraphStyle('BizInfo', fontSize=10, textColor=text_dark, fontName=reg_font, leading=14)
    title_style = ParagraphStyle('Title', fontSize=22, alignment=1, textColor=primary_orange, fontName=reg_font, leading=28)
    
    label_style = ParagraphStyle('Label', fontSize=10, fontName=bold_font, textColor=text_dark, spaceAfter=2)
    value_bold_style = ParagraphStyle('ValueBold', fontSize=10, fontName=bold_font, textColor=text_dark)
    value_style = ParagraphStyle('Value', fontSize=10, fontName=reg_font, textColor=text_dark, leading=14)
    
    table_header_style = ParagraphStyle('TableHeader', fontSize=10, fontName=bold_font, textColor=colors.white, alignment=0)
    table_cell_bold_style = ParagraphStyle('TableCellBold', fontSize=10, fontName=bold_font, textColor=text_dark)
    table_cell_style = ParagraphStyle('TableCell', fontSize=10, fontName=reg_font, textColor=text_dark)
    
    # 1. Header Section
    logo_url = business_details.get("logo_url")
    logo_path = r"d:\invoice_generator\image.png"
    logo_img = None
    
    if logo_url:
        filename = os.path.basename(logo_url)
        p1 = os.path.join("uploads", "logos", filename)
        p2 = os.path.join("uploads", filename)
        if os.path.exists(p1):
            logo_path = p1
        elif os.path.exists(p2):
            logo_path = p2
            
    try:
        logo_img = Image(logo_path, width=1.0*inch, height=0.5*inch)
    except:
        pass

    biz_block = [
        Paragraph(business_details.get("name", "Mr.Saravanan Manickam"), biz_name_style),
        Spacer(1, 4),
        Paragraph(business_details.get("address", "79/G2 S.B.I COLONY ,EZHIL NAGAR MELAPALAYAM"), biz_info_style),
        Paragraph(f"Phone no. : {business_details.get('phone', '9791173375')}", biz_info_style),
        Paragraph(f"Email : {business_details.get('email', 'cometomeetme@gmail.com')}", biz_info_style),
    ]

    header_table = Table([[biz_block, logo_img if logo_img else ""]], colWidths=[380, 140])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1, color=primary_orange, spaceBefore=0, spaceAfter=15))
    
    # Title
    elements.append(Paragraph(doc_title, title_style))
    elements.append(Spacer(1, 20))

    # 2. Details Section
    client_block = [
        Paragraph("Order From", label_style),
        Paragraph(client.company_name, value_bold_style),
        Spacer(1, 4),
        Paragraph(f"Contact No. : {client.mobile}", value_style),
    ]

    order_details_block = [
        [Paragraph("Order Details", ParagraphStyle('RL', fontSize=10, fontName=bold_font, alignment=2))],
        [Paragraph(f"Order No. : {invoice.invoice_number.replace('INV-', '')}", ParagraphStyle('RV', fontSize=10, fontName=reg_font, alignment=2))],
        [Paragraph(f"Date : {invoice.date.strftime('%d-%m-%Y')}", ParagraphStyle('RV', fontSize=10, fontName=reg_font, alignment=2))],
        [Paragraph(f"Due Date : {invoice.date.strftime('%d-%m-%Y')}", ParagraphStyle('RV', fontSize=10, fontName=reg_font, alignment=2))],
    ]
    order_table = Table(order_details_block, colWidths=[200])
    order_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    info_data = [[client_block, order_table]]
    info_table = Table(info_data, colWidths=[320, 200])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # 3. Items Table
    item_header = [
        Paragraph("#", table_header_style),
        Paragraph("Item name", table_header_style),
        Paragraph("Qty", ParagraphStyle('THC', fontSize=10, fontName=bold_font, textColor=colors.white, alignment=1)),
        Paragraph("Rate", ParagraphStyle('THR', fontSize=10, fontName=bold_font, textColor=colors.white, alignment=2)),
        Paragraph("Tax", ParagraphStyle('THR', fontSize=10, fontName=bold_font, textColor=colors.white, alignment=2)),
        Paragraph("Amount", ParagraphStyle('THR', fontSize=10, fontName=bold_font, textColor=colors.white, alignment=2))
    ]
    item_data = [item_header]
    
    total_amount = invoice.total_amount
    sub_total = getattr(invoice, 'sub_total', 0)
    total_gst = getattr(invoice, 'total_gst', 0)

    for idx, item in enumerate(invoice.items, 1):
        qty = item.quantity or 1
        price = item.price or 0
        gst_p = item.gst_percent or 0
        
        # Calculate line totals like backend
        line_gross = qty * price
        line_discount = 0
        if item.discount_type == "percentage":
            line_discount = (line_gross * (item.discount_value or 0)) / 100
        else:
            line_discount = item.discount_value or 0
            
        line_taxable = line_gross - line_discount
        line_gst_amt = (line_taxable * gst_p) / 100
        line_total = line_taxable + line_gst_amt

        item_data.append([
            Paragraph(str(idx), table_cell_style),
            Paragraph(item.product_name, table_cell_style),
            Paragraph(str(qty), table_cell_style),
            Paragraph(f"{price:,.2f}", ParagraphStyle('PR', fontName=reg_font, alignment=2)),
            Paragraph(f"{line_gst_amt:,.2f} ({gst_p}%)", ParagraphStyle('PR', fontName=reg_font, alignment=2)),
            Paragraph(f"INR {line_total:,.2f}", ParagraphStyle('PRB', fontName=bold_font, alignment=2))
        ])

    item_data.append(["", Paragraph("Total", table_cell_bold_style), "", "", "", Paragraph(f"INR {total_amount:,.2f}", ParagraphStyle('PRB', fontName=bold_font, alignment=2))])

    items_table = Table(item_data, colWidths=[30, 180, 40, 70, 90, 110])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_orange),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 20))

    # 4. Summary & Terms
    summary_left = [
        Paragraph("Order Amount In Words", label_style),
        Paragraph(num_to_words(total_amount), value_style),
        Spacer(1, 15),
        Paragraph("Terms and Conditions", label_style),
        Paragraph("Thank you for doing business with us.", value_style),
        Spacer(1, 15),
        Paragraph("Pay To:", label_style),
        Paragraph(f"Bank Name : {business_details.get('bank', {}).get('bank_name', 'City Union Bank Limited, Tirunelveli Junction')}", value_style),
        Paragraph(f"Account Type : {business_details.get('bank', {}).get('account_type', 'Current')}", value_style),
        Paragraph(f"Bank Account No. : {business_details.get('bank', {}).get('account_no', '500101011467177')}", value_style),
        Paragraph(f"Bank IFSC code : {business_details.get('bank', {}).get('ifsc', 'CIUB0000524')}", value_style),
        Paragraph(f"Account holder's name : {business_details.get('bank', {}).get('account_holder_name', business_details.get('name', 'Saravanan M'))}", value_style),
    ]

    paid_amount = getattr(invoice, 'paid_amount', 0) or 0
    balance_due = total_amount - paid_amount

    totals_data = [
        [Paragraph("Sub Total", value_style), Paragraph(f"INR {sub_total:,.2f}", ParagraphStyle('PR', fontName=reg_font, alignment=2))],
        [Paragraph("Total Tax (GST)", value_style), Paragraph(f"INR {total_gst:,.2f}", ParagraphStyle('PR', fontName=reg_font, alignment=2))],
        [Paragraph("Total", ParagraphStyle('TotalL', fontSize=10, fontName=bold_font, textColor=colors.white)), 
         Paragraph(f"INR {total_amount:,.2f}", ParagraphStyle('TotalR', fontSize=10, fontName=bold_font, textColor=colors.white, alignment=2))],
        [Paragraph("Paid Amount", value_style), Paragraph(f"INR {paid_amount:,.2f}", ParagraphStyle('PR', fontName=reg_font, alignment=2))],
        [Paragraph("Balance Due", ParagraphStyle('BalanceStyle', fontSize=10, fontName=bold_font, textColor=colors.HexColor("#b91c1c") if balance_due > 0 else colors.HexColor("#15803d"))), Paragraph(f"INR {balance_due:,.2f}", ParagraphStyle('PRB', fontName=bold_font, alignment=2))],
    ]
    totals_table = Table(totals_data, colWidths=[110, 90])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BACKGROUND', (0, 2), (1, 2), primary_orange),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (1, 3), 0.5, colors.lightgrey),
    ]))

    sig_url = business_details.get("signature_url")
    sig_img = None
    if sig_url:
        filename = os.path.basename(sig_url)
        p1 = os.path.join("uploads", filename)
        p2 = os.path.join("uploads", "logos", filename)
        
        actual_path = None
        if os.path.exists(p1):
            actual_path = p1
        elif os.path.exists(p2):
            actual_path = p2
        elif os.path.exists(sig_url):
            actual_path = sig_url
            
        print(f"DEBUG SIG URL: {sig_url} -> actual: {actual_path}, exists: {actual_path is not None}")
        if actual_path:
            try: 
                sig_img = Image(actual_path, width=1.2*inch, height=0.4*inch)
                print("DEBUG SIG: Image loaded successfully")
            except Exception as e: 
                print(f"DEBUG SIG ERROR: {e}")

    sign_inner_data = [
        [Paragraph(f"For :{business_details.get('name', 'Mr.Saravanan Manickam')}", ParagraphStyle('SignFor', fontSize=10, fontName=reg_font, alignment=2))],
        [Spacer(1, 5)],
        [sig_img if sig_img else Spacer(1, 30)],
        [Paragraph("Authorized Signatory", ParagraphStyle('SignLabel', fontSize=10, fontName=bold_font, alignment=2))]
    ]
    sign_table = Table(sign_inner_data, colWidths=[200])
    sign_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    main_summary_data = [
        [summary_left, totals_table],
        ["", sign_table]
    ]
    main_summary_table = Table(main_summary_data, colWidths=[320, 200])
    main_summary_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (1, 1), (1, 1), 20),
    ]))
    elements.append(main_summary_table)

    # --- Additional Details Section (Payment Terms, Delivery, Notes) ---
    extra_sections = []
    payment_terms = getattr(invoice, 'payment_terms', None)
    delivery_details = getattr(invoice, 'delivery_details', None)
    notes = getattr(invoice, 'notes', None)
    
    if payment_terms or delivery_details or notes:
        elements.append(Spacer(1, 15))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceBefore=0, spaceAfter=10))
    
    if payment_terms:
        elements.append(Paragraph("Payment Terms", label_style))
        elements.append(Paragraph(payment_terms, value_style))
        elements.append(Spacer(1, 8))
    
    if delivery_details:
        elements.append(Paragraph("Delivery Details", label_style))
        elements.append(Paragraph(delivery_details, value_style))
        elements.append(Spacer(1, 8))
    
    if notes:
        elements.append(Paragraph("Notes / Messages", label_style))
        elements.append(Paragraph(notes, value_style))
        elements.append(Spacer(1, 8))

    doc.build(elements)
    buffer.seek(0)
    return buffer
