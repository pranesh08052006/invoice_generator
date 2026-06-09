import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

import { 
  Plus, Trash2, X, Package, ChevronDown, UserPlus, Info, 
  Save, FileText, Layout, Download, Share2, CheckCircle, Eye, Send, Calendar
} from 'lucide-react';

const CreateInvoice = ({ user, type = 'invoice' }) => {
  const prefixMap = { invoice: 'INV', quotation: 'QT', proforma: 'PI' };
  const endpointMap = { invoice: 'invoices', quotation: 'quotations', proforma: 'proformas' };
  const titleMap = { invoice: 'Create Invoice', quotation: 'Create Quotation', proforma: 'Create Proforma' };
  const getPrefix = () => prefixMap[type] || 'INV';
  
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newClient, setNewClient] = useState({ 
    company_name: '', contact_person: '', mobile: '', whatsapp: '', 
    email: '', address: '', shipping_address: '', gst_number: '', state: '' 
  });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  
  const [categories, setCategories] = useState(['Product', 'Service', 'Parts', 'General']);
  const [units, setUnits] = useState(['Units', 'Pcs', 'Hrs', 'Nos', 'Kg', 'Ltr', 'Mtr']);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newUnitInput, setNewUnitInput] = useState('');
  
  const [newProduct, setNewProduct] = useState({ 
    name: '', category: '', unit: 'Units', hsn_code: '', 
    price: '', tax_type: 'without_tax',
    discount_value: 0, discount_type: 'percentage', gst_percent: 0, stock: 0 
  });
  
  const [invoice, setInvoice] = useState({ 
    client_id: '', 
    invoice_number: `${getPrefix()}-${Date.now().toString().slice(-4)}`, 
    date: (() => {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}-${mm}-${d.getFullYear()}`;
    })(),
    discount_type: 'percentage',
    discount_value: 0, 
    paid_amount: 0, 
    status: 'UNPAID',
    payment_mode: 'CASH',
    is_gst: true,
    payment_terms: '',
    delivery_details: '',
    notes: '',
    source_type: '',
    source_id: ''
  });
  
  const [items, setItems] = useState([{ 
    product_id: '', product_name: '', quantity: '', price: '', 
    discount_value: 0, discount_type: 'percentage', gst_percent: 0 
  }]);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedId, setGeneratedId] = useState(null);
  const [generatedNumber, setGeneratedNumber] = useState('');

  // Dual State for Due Date as displayed in Stitch design specs
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  });
  
  const [showDeliveryDetails, setShowDeliveryDetails] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem('custom_payment_methods');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { value: 'CASH', label: 'Liquid Cash' },
      { value: 'ONLINE', label: 'Digital Transfer' }
    ];
  });
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, pRes, iRes, payRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/clients`),
          axios.get(`${API_BASE_URL}/products`),
          axios.get(`${API_BASE_URL}/invoices`),
          axios.get(`${API_BASE_URL}/payments`)
        ]);
        
        const allInvoices = iRes.data;
        const allPayments = payRes.data;

        // Calculate outstanding balance for each client and sort descending
        const sortedClients = [...cRes.data].sort((a, b) => {
          const aInvs = allInvoices.filter(inv => inv.client_id === a.id);
          const aBilled = aInvs.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
          
          // Total paid = (paid on invoices) + (general payments for this client)
          const aInvoicePaid = aInvs.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
          const aGeneralPaid = allPayments
            .filter(p => p.client_id === a.id && !p.invoice_id)
            .reduce((sum, p) => sum + (p.amount || 0), 0);
          const aBal = aBilled - (aInvoicePaid + aGeneralPaid);
          
          const bInvs = allInvoices.filter(inv => inv.client_id === b.id);
          const bBilled = bInvs.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
          const bInvoicePaid = bInvs.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
          const bGeneralPaid = allPayments
            .filter(p => p.client_id === b.id && !p.invoice_id)
            .reduce((sum, p) => sum + (p.amount || 0), 0);
          const bBal = bBilled - (bInvoicePaid + bGeneralPaid);
          
          return bBal - aBal; // Descending
        });

        setClients(sortedClients);
        setProducts(pRes.data);
        setInvoices(allInvoices);
        setPayments(allPayments);
      } catch (err) {
        console.error("FAILED TO FETCH DATA:", err);
      }
    };
    fetchData();
  }, []);

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        newItems[index] = { 
          ...newItems[index], 
          product_id: value, 
          product_name: prod.name, 
          price: prod.price, 
          quantity: newItems[index].quantity && parseFloat(newItems[index].quantity) > 0
            ? newItems[index].quantity   // keep existing quantity if already set
            : 1,                         // default to 1 when item first selected
          discount_value: prod.discount_value || 0,
          discount_type: prod.discount_type || 'percentage',
          gst_percent: prod.gst_percent 
        };
      }
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const calculate = () => {
    let grossTotal = 0, itemDiscountsTotal = 0, taxableTotal = 0, totalGst = 0;
    
    items.forEach(i => {
      const p = parseFloat(i.price) || 0;
      const q = parseFloat(i.quantity) || 0;
      const lineGross = p * q;
      
      let lineDiscount = 0;
      if (i.discount_type === 'percentage') {
        lineDiscount = (lineGross * (parseFloat(i.discount_value) || 0)) / 100;
      } else {
        lineDiscount = parseFloat(i.discount_value) || 0;
      }
      
      const taxableValue = lineGross - lineDiscount;
      const itemGst = (taxableValue * (parseFloat(i.gst_percent) || 0)) / 100;
      
      grossTotal += lineGross;
      itemDiscountsTotal += lineDiscount;
      taxableTotal += taxableValue;
      totalGst += itemGst;
    });
    
    const grandTotal = taxableTotal + totalGst;
    return { 
      gross: grossTotal, 
      itemDiscount: itemDiscountsTotal, 
      taxable: taxableTotal, 
      gst: totalGst, 
      total: grandTotal
    };
  };

  const { gross, itemDiscount, taxable, gst, total } = calculate();

  useEffect(() => {
    if (type === 'invoice') {
      setInvoice(prev => ({ ...prev, paid_amount: total }));
    }
  }, [total, type]);

  const selectedClientInvoices = invoices.filter(inv => inv.client_id === invoice.client_id);
  const selectedClientTotal = selectedClientInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const selectedClientInvoicePaid = selectedClientInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const selectedClientGeneralPaid = payments
    .filter(p => p.client_id === invoice.client_id && !p.invoice_id)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const selectedClientPaid = selectedClientInvoicePaid + selectedClientGeneralPaid;
  const selectedClientOutstanding = selectedClientTotal - selectedClientPaid;

  const handleQuickClientSave = async (e) => {
    e.preventDefault();
    const payload = { ...newClient };
    if (whatsappSameAsPhone) payload.whatsapp = payload.mobile;
    if (shippingSameAsBilling) payload.shipping_address = payload.address;
    
    try {
      const res = await axios.post(`${API_BASE_URL}/clients`, payload);
      setClients([...clients, res.data]);
      setInvoice({...invoice, client_id: res.data.id});
      setShowClientModal(false);
      setNewClient({ 
        company_name: '', contact_person: '', mobile: '', whatsapp: '', 
        email: '', address: '', shipping_address: '', gst_number: '', state: '' 
      });
      setWhatsappSameAsPhone(true);
      setShippingSameAsBilling(true);
    } catch (err) {
      console.error("FAILED TO SAVE QUICK CLIENT:", err);
      alert("Error saving customer profile");
    }
  };

  const handleQuickProductSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newProduct,
        price: parseFloat(newProduct.price) || 0,
        discount_value: parseFloat(newProduct.discount_value) || 0,
        gst_percent: parseFloat(newProduct.gst_percent) || 0,
        stock: parseInt(newProduct.stock) || 0
      };
      const res = await axios.post(`${API_BASE_URL}/products`, payload);
      
      const updatedProductsList = [...products, res.data];
      setProducts(updatedProductsList);
      setShowProductModal(false);

      // Auto-prefill / auto-add this product to the current list of invoice items
      const newProductItem = {
        product_id: res.data.id,
        product_name: res.data.name,
        quantity: 1,
        price: res.data.price,
        discount_value: res.data.discount_value || 0,
        discount_type: res.data.discount_type || 'percentage',
        gst_percent: res.data.gst_percent
      };

      const updatedItems = [...items];
      if (updatedItems.length > 0 && !updatedItems[updatedItems.length - 1].product_id && !updatedItems[updatedItems.length - 1].product_name) {
        updatedItems[updatedItems.length - 1] = newProductItem;
      } else {
        updatedItems.push(newProductItem);
      }
      setItems(updatedItems);

      setNewProduct({ 
        name: '', category: '', unit: 'Units', hsn_code: '', 
        price: '', tax_type: 'without_tax',
        discount_value: 0, discount_type: 'percentage', gst_percent: 0, stock: 0 
      });
    } catch (err) {
      console.error("FAILED TO SAVE QUICK PRODUCT:", err);
      alert("Error saving item to inventory");
    }
  };

  const handleAddPaymentMethod = (e) => {
    e.preventDefault();
    if (!newPaymentMethodName.trim()) return;
    const value = newPaymentMethodName.trim().toUpperCase().replace(/\s+/g, '_');
    const label = newPaymentMethodName.trim();
    
    if (paymentMethods.some(pm => pm.value === value)) {
      alert("Payment method already exists!");
      return;
    }
    
    const updated = [...paymentMethods, { value, label }];
    setPaymentMethods(updated);
    localStorage.setItem('custom_payment_methods', JSON.stringify(updated));
    setInvoice({ ...invoice, payment_mode: value });
    setNewPaymentMethodName('');
    setShowPaymentMethodModal(false);
  };

  const handleSubmit = async (e, isDraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (items.length === 0) return alert('Add at least one item');
    if (!invoice.client_id) return alert('Select a customer');

    setLoading(true);
    try {
      const computedStatus = isDraft 
        ? 'DRAFT' 
        : (parseFloat(invoice.paid_amount || 0) >= total ? 'PAID' : (parseFloat(invoice.paid_amount || 0) > 0 ? 'PARTIAL' : 'UNPAID'));

      const data = { 
        ...invoice, 
        discount: 0,
        total_amount: total, 
        status: computedStatus,
        items: items.map(i => ({
          product_id: i.product_id || null,
          product_name: i.product_name,
          quantity: Math.round(parseFloat(i.quantity) || 0),
          price: parseFloat(i.price) || 0,
          discount_value: parseFloat(i.discount_value) || 0,
          discount_type: i.discount_type,
          gst_percent: parseFloat(i.gst_percent) || 0
        }))
      };

      const payload = { ...data };
      if (type === 'quotation') {
        payload.quotation_number = payload.invoice_number;
        delete payload.invoice_number;
      } else if (type === 'proforma') {
        payload.proforma_number = payload.invoice_number;
        delete payload.invoice_number;
      }

      const res = await axios.post(`${API_BASE_URL}/${endpointMap[type]}`, payload);
      
      const pdfRes = await axios.get(`${API_BASE_URL}/${endpointMap[type]}/${res.data.id}/pdf?t=${Date.now()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }));
      
      setGeneratedId(res.data.id);
      setGeneratedNumber(data.invoice_number);
      setPreviewUrl(url);
      setShowPreview(true);
      
      // Clear form for next entry
      resetForm();
    } catch (err) {
      console.error('INVOICE SAVE ERROR:', err);
      alert('Error saving invoice');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInvoice({ 
      client_id: '', 
      invoice_number: `${getPrefix()}-${Date.now().toString().slice(-4)}`, 
      date: (() => {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}-${mm}-${d.getFullYear()}`;
      })(),
      discount_type: 'percentage',
      discount_value: 0, 
      paid_amount: 0, 
      status: 'UNPAID',
      payment_mode: 'CASH',
      payment_terms: '',
      delivery_details: '',
      notes: ''
    });
    
    setItems([{ 
      product_id: '', product_name: '', quantity: '', price: '', 
      discount_value: 0, discount_type: 'percentage', gst_percent: 0 
    }]);
    
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDueDate(`${dd}-${mm}-${yyyy}`);
    setShowDeliveryDetails(false);
  };

  const handleDiscard = () => {
    if (!window.confirm("Are you sure you want to discard all changes?")) return;
    resetForm();
  };

  const handlePreview = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (items.length === 0) return alert('Add at least one item');
    if (!invoice.client_id) return alert('Select a customer');

    setLoading(true);
    try {
      const data = { 
        ...invoice, 
        discount: 0,
        total_amount: total, 
        status: 'DRAFT',
        items: items.map(i => ({
          product_id: i.product_id || null,
          product_name: i.product_name,
          quantity: Math.round(parseFloat(i.quantity) || 0),
          price: parseFloat(i.price) || 0,
          discount_value: parseFloat(i.discount_value) || 0,
          discount_type: i.discount_type,
          gst_percent: parseFloat(i.gst_percent) || 0
        }))
      };

      const payload = { ...data };
      if (type === 'quotation') {
        payload.quotation_number = payload.invoice_number;
        delete payload.invoice_number;
      } else if (type === 'proforma') {
        payload.proforma_number = payload.invoice_number;
        delete payload.invoice_number;
      }
      
      const res = await axios.post(`${API_BASE_URL}/${endpointMap[type]}/preview`, payload, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      
      setGeneratedId(null);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err) {
      console.error('PREVIEW ERROR:', err);
      alert('Error generating preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDueDateChange = (e) => {
    const val = e.target.value;
    
    // Automatically fall back to free text if they type letters
    if (/[a-zA-Z]/.test(val)) {
      setDueDate(val);
      return;
    }

    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setDueDate(val);
      return;
    }

    let formatted = digits;
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + '-' + formatted.slice(2);
    }
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5) + '-' + formatted.slice(5, 9);
    }
    setDueDate(formatted);
  };

  const handleIssueDateChange = (e) => {
    const val = e.target.value;
    if (/[a-zA-Z]/.test(val)) {
      setInvoice({...invoice, date: val});
      return;
    }
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setInvoice({...invoice, date: val});
      return;
    }
    let formatted = digits;
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + '-' + formatted.slice(2);
    }
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5) + '-' + formatted.slice(5, 9);
    }
    setInvoice({...invoice, date: formatted});
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Redesigned Premium Header Workspace */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
            {titleMap[type]}
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Fill in the details below to generate a new {type === 'invoice' ? 'invoice' : type === 'quotation' ? 'estimate' : 'proforma invoice'}.
          </p>
        </div>
        <button 
          onClick={() => navigate(`/${endpointMap[type]}`)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '1px solid #eaedf3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#fef2f2';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = '#fee2e2';
            e.currentTarget.style.transform = 'rotate(90deg)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.color = '#6b7280';
            e.currentTarget.style.borderColor = '#eaedf3';
            e.currentTarget.style.transform = 'none';
          }}
          title="Exit and return to list"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Grid: Parameters / Lines on left, Summary / Action sidebar on right */}
      <div className="invoice-layout-grid">
        
        {/* Left Column Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minWidth: 0 }}>
          
          {/* Card: Invoice Parameters */}
          <div className="card" style={{ padding: '32px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Layout size={18} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>{type === 'invoice' ? 'Invoice' : type === 'quotation' ? 'Quotation' : 'Proforma'} Parameters</h3>
            </div>
            
            <div className="responsive-grid-2-1" style={{ display: 'grid', gap: '24px', marginBottom: '24px' }}>
              {/* Customer Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Customer</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select 
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '10px 32px 10px 14px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827',
                        appearance: 'none',
                        cursor: 'pointer',
                        fontWeight: '500',
                        outline: 'none',
                        transition: 'border-color 0.15s ease'
                      }}
                      required 
                      value={invoice.client_id} 
                      onChange={e => setInvoice({...invoice, client_id: e.target.value})}
                    >
                      <option value="">Choose Client...</option>
                      {clients.map(c => {
                        const cInvs = invoices.filter(inv => inv.client_id === c.id);
                        const cBilled = cInvs.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
                        const cInvoicePaid = cInvs.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
                        const cGeneralPaid = payments
                          .filter(p => p.client_id === c.id && !p.invoice_id)
                          .reduce((sum, p) => sum + (p.amount || 0), 0);
                        const cBal = cBilled - (cInvoicePaid + cGeneralPaid);
                        const balStr = cBal > 0 ? ` (Due: ₹${cBal.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : '';
                        return (
                          <option key={c.id} value={c.id}>
                            {c.company_name}{balStr}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowClientModal(true)} 
                    style={{
                      height: '42px',
                      width: '42px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4b5563',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <UserPlus size={18} />
                  </button>
                </div>
                {invoice.client_id && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginTop: '6px', 
                    backgroundColor: selectedClientOutstanding > 0 ? '#fef2f2' : '#f0fdf4', 
                    border: `1px solid ${selectedClientOutstanding > 0 ? '#fee2e2' : '#dcfce7'}`, 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    width: 'fit-content' 
                  }}>
                    <span style={{ fontSize: '11px', color: selectedClientOutstanding > 0 ? '#b91c1c' : '#15803d', fontWeight: '700' }}>
                      Outstanding Balance:
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: selectedClientOutstanding > 0 ? '#b91c1c' : '#16a34a' }}>
                      ₹{selectedClientOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Reference ID (INV Number) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Reference Number</label>
                <input 
                  style={{
                    height: '42px',
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#eff6ff',
                    color: '#1e3a8a',
                    fontWeight: '600',
                    outline: 'none',
                    width: '100%'
                  }}
                  value={invoice.invoice_number} 
                  readOnly 
                />
              </div>
            </div>

            <div className="responsive-grid-1-1" style={{ display: 'grid', gap: '24px' }}>
              {/* Issue Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Issue Date</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input 
                    type="text" 
                    placeholder="dd-mm-yyyy"
                    style={{
                      height: '42px',
                      padding: '10px 42px 10px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      outline: 'none',
                      width: '100%',
                      cursor: 'text'
                    }}
                    value={invoice.date} 
                    onChange={handleIssueDateChange} 
                  />
                  <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '34px', height: '34px' }}>
                    <Calendar size={18} style={{ color: '#9ca3af', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
                    <input 
                      type="date"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%'
                      }}
                      onChange={e => {
                        if (e.target.value) {
                          const [yyyy, mm, dd] = e.target.value.split('-');
                          setInvoice({...invoice, date: `${dd}-${mm}-${yyyy}`});
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Due Date</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input 
                    type="text" 
                    placeholder="dd-mm-yyyy"
                    style={{
                      height: '42px',
                      padding: '10px 42px 10px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      outline: 'none',
                      width: '100%',
                      cursor: 'text'
                    }}
                    value={dueDate} 
                    onChange={handleDueDateChange} 
                  />
                  <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '34px', height: '34px' }}>
                    <Calendar size={18} style={{ color: '#9ca3af', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
                    <input 
                      type="date"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%'
                      }}
                      onChange={e => {
                        if (e.target.value) {
                          const [yyyy, mm, dd] = e.target.value.split('-');
                          setDueDate(`${dd}-${mm}-${yyyy}`);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Line Items Table */}
          <div className="card" style={{ padding: '0', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: 'var(--primary-color)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>Line Items</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowProductModal(true)}
                  style={{
                    backgroundColor: 'var(--primary-light)',
                    border: '1px solid var(--primary-light)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: 'var(--primary-color)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <Package size={14} /> Add Item
                </button>
                <button 
                  type="button" 
                  onClick={() => setItems([...items, { product_id: '', product_name: '', quantity: '', price: '', gst_percent: 0, discount_value: 0, discount_type: 'percentage' }])}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--primary-color)',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--primary-color)'}
                >
                  <Plus size={14} /> Add Item Row
                </button>
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: '0', margin: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
                    <th rowSpan={2} style={{ padding: '12px 18px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '30%', paddingLeft: '32px', borderBottom: '1px solid #eaedf3' }}>Item / Description</th>
                    <th rowSpan={2} style={{ padding: '12px 18px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '9%', textAlign: 'center', borderBottom: '1px solid #eaedf3' }}>Qty</th>
                    <th rowSpan={2} style={{ padding: '12px 18px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '12%', textAlign: 'right', borderBottom: '1px solid #eaedf3' }}>Unit Price</th>
                    <th rowSpan={2} style={{ padding: '12px 18px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '9%', textAlign: 'center', borderBottom: '1px solid #eaedf3' }}>GST %</th>
                    <th colSpan={2} style={{ padding: '8px 18px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderBottom: '1px solid #eaedf3' }}>Discount</th>
                    <th rowSpan={2} style={{ padding: '12px 18px', fontSize: '11px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '14%', textAlign: 'right', paddingRight: '32px', borderBottom: '1px solid #eaedf3' }}>Amount</th>
                  </tr>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaedf3' }}>
                    <th style={{ padding: '6px 18px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '8%', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>%</th>
                    <th style={{ padding: '6px 18px', fontSize: '10px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%', textAlign: 'center' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const lineGross = (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
                    let lineDiscount = 0;
                    if (item.discount_type === 'percentage') {
                      lineDiscount = (lineGross * (parseFloat(item.discount_value) || 0)) / 100;
                    } else {
                      lineDiscount = parseFloat(item.discount_value) || 0;
                    }
                    const lineAmount = lineGross - lineDiscount;

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.15s ease' }}>
                        {/* Selector Product */}
                        <td style={{ padding: '12px 18px', paddingLeft: '32px' }}>
                          <div style={{ position: 'relative' }}>
                            <select 
                              style={{
                                width: '100%',
                                minWidth: '150px',
                                border: '1px solid transparent',
                                borderRadius: '6px',
                                padding: '8px 24px 8px 8px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: '#111827',
                                backgroundColor: 'transparent',
                                outline: 'none',
                                appearance: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              value={item.product_id} 
                              onChange={e => updateItem(index, 'product_id', e.target.value)}
                              onFocus={e => {
                                e.currentTarget.style.borderColor = 'var(--primary-color)';
                                e.currentTarget.style.backgroundColor = '#ffffff';
                              }}
                              onBlur={e => {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <option value="">Select Item...</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <ChevronDown size={14} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                          </div>
                        </td>

                        {/* Qty Input */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            style={{
                              width: '100%',
                              minWidth: '60px',
                              border: '1px solid transparent',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '13px',
                              textAlign: 'center',
                              fontWeight: '600',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            placeholder="0" 
                            value={item.quantity === 0 || item.quantity === '' ? '' : item.quantity} 
                            onChange={e => updateItem(index, 'quantity', e.target.value)}
                            onFocus={e => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                            onBlur={e => {
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          />
                        </td>

                        {/* Price Input */}
                        <td style={{ padding: '12px 18px' }}>
                          <input 
                            type="number" 
                            style={{
                              width: '100%',
                              minWidth: '80px',
                              border: '1px solid transparent',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '13px',
                              textAlign: 'right',
                              fontWeight: '600',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            placeholder="0.00" 
                            value={item.price === 0 || item.price === '' ? '' : item.price} 
                            onChange={e => updateItem(index, 'price', e.target.value)}
                            onFocus={e => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                            onBlur={e => {
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          />
                        </td>

                        {/* GST Input */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            style={{
                              width: '100%',
                              minWidth: '60px',
                              border: '1px solid transparent',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '13px',
                              textAlign: 'center',
                              fontWeight: '500',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            placeholder="18" 
                            value={item.gst_percent} 
                            onChange={e => updateItem(index, 'gst_percent', e.target.value)}
                            onFocus={e => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                            onBlur={e => {
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          />
                        </td>

                        {/* Discount % Input */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            style={{
                              width: '100%',
                              minWidth: '60px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '13px',
                              textAlign: 'center',
                              fontWeight: '600',
                              backgroundColor: '#ffffff',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            placeholder="0" 
                            value={
                              item.discount_type === 'percentage'
                                ? (item.discount_value || '')
                                : (lineGross > 0 ? parseFloat(((item.discount_value / lineGross) * 100).toFixed(2)) : '')
                            }
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              updateItem(index, 'discount_type', 'percentage');
                              updateItem(index, 'discount_value', val);
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                          />
                        </td>

                        {/* Discount Amount Input */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            style={{
                              width: '100%',
                              minWidth: '80px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '13px',
                              textAlign: 'right',
                              fontWeight: '600',
                              backgroundColor: '#ffffff',
                              outline: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            placeholder="0.00" 
                            value={
                              item.discount_type === 'amount'
                                ? (item.discount_value || '')
                                : (lineGross > 0 ? parseFloat(((lineGross * (item.discount_value || 0)) / 100).toFixed(2)) : '')
                            }
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              updateItem(index, 'discount_type', 'amount');
                              updateItem(index, 'discount_value', val);
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                          />
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '12px 18px', paddingRight: '32px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', minWidth: '90px' }}>
                            <span style={{ fontWeight: '800', fontSize: '13px', color: '#111827' }}>
                              ₹{lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <button 
                              type="button" 
                              style={{ padding: '4px', border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', opacity: 0.6, transition: 'all 0.15s ease' }} 
                              onClick={() => setItems(items.filter((_, i) => i !== index))}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {items.length === 0 && (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <Package size={40} style={{ color: '#cbd5e1', marginBottom: '16px', display: 'inline-block' }} />
                <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>No items added yet. Start by adding a line item.</p>
              </div>
            )}

            <div style={{ 
              padding: '16px 32px', 
              borderTop: '1px solid #eaedf3', 
              backgroundColor: '#f8fafc',
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <button 
                type="button" 
                onClick={() => setItems([...items, { product_id: '', product_name: '', quantity: '', price: '', gst_percent: 0, discount_value: 0, discount_type: 'percentage' }])}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                <Plus size={14} style={{ color: 'var(--primary-color)' }} /> Add Item Row
              </button>
              <button 
                type="button" 
                onClick={() => setShowProductModal(true)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--primary-color)',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--primary-color)'}
              >
                <Package size={14} /> Add from Inventory
              </button>
            </div>
          </div>

          {/* Card: Payment Context */}
          <div className="card" style={{ padding: '32px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Info size={18} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>Payment Context</h3>
            </div>
            
            <div className="responsive-grid-1-1" style={{ display: 'grid', gap: '24px', marginBottom: '24px' }}>
              {/* Payment Method select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Payment Method</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select 
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '10px 32px 10px 14px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        color: '#111827',
                        appearance: 'none',
                        cursor: 'pointer',
                        fontWeight: '500',
                        outline: 'none',
                        transition: 'border-color 0.15s ease'
                      }}
                      value={invoice.payment_mode} 
                      onChange={e => setInvoice({...invoice, payment_mode: e.target.value})}
                    >
                      {paymentMethods.map(pm => (
                        <option key={pm.value} value={pm.value}>{pm.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowPaymentMethodModal(true)} 
                    style={{
                      height: '42px',
                      width: '42px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4b5563',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Amount Paid Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Amount Paid (Advance)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '600', color: '#4b5563' }}>₹</span>
                  <input 
                    type="number" 
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '10px 14px 10px 28px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      outline: 'none',
                      fontWeight: '600',
                      transition: 'border-color 0.15s ease'
                    }}
                    placeholder="0.00" 
                    value={invoice.paid_amount === 0 || invoice.paid_amount === '' ? '' : invoice.paid_amount} 
                    onChange={e => setInvoice({...invoice, paid_amount: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            {/* Inventory Sync Alert Box */}
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--primary-light)',
              borderRadius: '8px',
              borderLeft: '4px solid var(--primary-color)',
              display: 'flex',
              alignItems: 'start',
              gap: '12px'
            }}>
              <Info size={18} style={{ color: 'var(--primary-color)', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>Inventory Update Enabled</span>
                <span style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
                  Generating this invoice will automatically deduct the quantities listed above from your main inventory ledger.
                </span>
              </div>
            </div>
          </div>

          {/* Card: Additional Details */}
          <div className="card" style={{ padding: '32px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <FileText size={18} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>Additional Details</h3>
            </div>

            <div className="responsive-grid-1-1" style={{ display: 'grid', gap: '24px', marginBottom: '24px' }}>
              {/* Payment Terms Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Payment Terms</label>
                <input 
                  placeholder="e.g. Net 30, Due on Receipt" 
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  value={invoice.payment_terms || ''} 
                  onChange={e => setInvoice({...invoice, payment_terms: e.target.value})} 
                />
              </div>

              {/* Notes / Terms Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Notes & Terms</label>
                <textarea 
                  placeholder="Additional notes or terms to print on PDF..." 
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    outline: 'none',
                    resize: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  value={invoice.notes || ''} 
                  onChange={e => setInvoice({...invoice, notes: e.target.value})} 
                />
              </div>
            </div>

            {/* Delivery Details Toggle Checkbox */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4b5563', fontWeight: '700', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showDeliveryDetails} 
                  onChange={e => {
                    const checked = e.target.checked;
                    setShowDeliveryDetails(checked);
                    if (!checked) {
                      setInvoice(prev => ({ ...prev, delivery_details: '' }));
                    }
                  }}
                  style={{ accentColor: 'var(--primary-color)', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                Include Delivery Details
              </label>

              {showDeliveryDetails && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: 'fadeIn 0.2s ease-out' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Delivery Details</label>
                  <textarea 
                    placeholder="Enter dispatch vehicle info, tracking number, or shipping instructions..." 
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '10px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      outline: 'none',
                      resize: 'none',
                      transition: 'border-color 0.15s ease'
                    }}
                    value={invoice.delivery_details || ''} 
                    onChange={e => setInvoice({...invoice, delivery_details: e.target.value})} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="invoice-summary-col">
          
          {/* Card: Summary Details */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 16px 0', letterSpacing: '-0.01em' }}>Invoice Summary</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Gross Total</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>₹{gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#ef4444', fontWeight: '600' }}>Discounts</span>
                <span style={{ fontWeight: '700', color: '#ef4444' }}>-₹{itemDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Taxable Value</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>₹{taxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Total Tax (GST)</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>₹{gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ height: '1.5px', backgroundColor: '#e2e8f0', margin: '8px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>Final Total</span>
                <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-color)', letterSpacing: '-0.03em' }}>₹{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Amount Paid</span>
                <span style={{ fontWeight: '700', color: '#16a34a' }}>₹{parseFloat(invoice.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280', fontWeight: '500' }}>Balance Due</span>
                <span style={{ 
                  fontWeight: '800', 
                  color: (total - parseFloat(invoice.paid_amount || 0)) > 0 ? '#ef4444' : '#16a34a' 
                }}>
                  ₹{(total - parseFloat(invoice.paid_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Action Panel */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#111827',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <Save size={16} /> Save Draft
            </button>
            
            <button 
              type="button"
              onClick={handlePreview}
              disabled={loading}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: 'var(--primary-color)',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <Eye size={16} /> Preview
            </button>

            <button 
              type="button"
              onClick={handleDiscard}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: '#ffffff',
                border: '1px solid #fee2e2',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <Trash2 size={16} /> Discard
            </button>

            <button 
              type="button"
              onClick={handleSubmit} 
              disabled={loading}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              <CheckCircle size={16} />
              {loading ? 'Processing...' : 'Finalize & Generate'}
            </button>

            <button 
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={loading}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: 'var(--primary-color)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 4px var(--primary-light)'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
            >
              <Send size={16} /> Send to Customer
            </button>
          </div>
        </div>
      </div>

      {/* Quick Customer Creation Modal */}
      {showClientModal && createPortal((
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowClientModal(false); }}
        >
          <div style={{
            backgroundColor: '#ffffff', maxHeight: '90vh', width: '100%', maxWidth: '580px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '16px', display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out', overflow: 'hidden', border: '1px solid #eaedf3'
          }}>
            {/* Header */}
            <div style={{ 
               padding: '24px 32px', 
               borderBottom: '1px solid #eaedf3', 
               display: 'flex', 
               justifyContent: 'space-between', 
               alignItems: 'center',
               backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserPlus size={18} style={{ color: 'var(--primary-color)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
                    Quick Add Customer
                  </h2>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowClientModal(false)} 
                style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body without browser scrollbar */}
            <div className="no-scrollbar" style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <form onSubmit={handleQuickClientSave} id="quick-client-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Section 1: Identity & Contact */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Identity & Contact</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Company Name *</label>
                      <input 
                        placeholder="Legal Entity Name" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.company_name} 
                        onChange={e => setNewClient({...newClient, company_name: e.target.value})} 
                        required 
                      />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Contact Person</label>
                        <input 
                          placeholder="Primary Name" 
                          style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                          value={newClient.contact_person} 
                          onChange={e => setNewClient({...newClient, contact_person: e.target.value})} 
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email Address</label>
                        <input 
                          placeholder="billing@email.com" 
                          style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                          value={newClient.email} 
                          onChange={e => setNewClient({...newClient, email: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mobile Number *</label>
                        <input 
                          placeholder="+91..." 
                          style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                          value={newClient.mobile} 
                          onChange={e => {
                            const val = e.target.value;
                            setNewClient(prev => ({
                              ...prev,
                              mobile: val,
                              whatsapp: whatsappSameAsPhone ? val : prev.whatsapp
                            }));
                          }}
                          required 
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>WhatsApp</label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer' }}>
                            <input type="checkbox" checked={whatsappSameAsPhone} onChange={e => {
                              const checked = e.target.checked;
                              setWhatsappSameAsPhone(checked);
                              if (checked) setNewClient(prev => ({ ...prev, whatsapp: prev.mobile }));
                            }} />
                            SAME
                          </label>
                        </div>
                        <input 
                          placeholder="WhatsApp number" 
                          style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: whatsappSameAsPhone ? '#f8fafc' : '#ffffff' }}
                          value={whatsappSameAsPhone ? newClient.mobile : newClient.whatsapp} 
                          onChange={e => setNewClient({...newClient, whatsapp: e.target.value})}
                          disabled={whatsappSameAsPhone}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Address Details */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Location & Taxation</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>State / Jurisdiction *</label>
                      <input 
                        placeholder="e.g. Tamil Nadu" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newClient.state} 
                        onChange={e => setNewClient({...newClient, state: e.target.value})} 
                        required 
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Billing Address</label>
                      <textarea 
                        placeholder="Enter full billing address..." 
                        style={{ height: '70px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'none' }}
                        value={newClient.address} 
                        onChange={e => {
                          const val = e.target.value;
                          setNewClient(prev => ({
                            ...prev,
                            address: val,
                            shipping_address: shippingSameAsBilling ? val : prev.shipping_address
                          }));
                        }} 
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Shipping Address</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer' }}>
                          <input type="checkbox" checked={shippingSameAsBilling} onChange={e => {
                            const checked = e.target.checked;
                            setShippingSameAsBilling(checked);
                            if (checked) setNewClient(prev => ({ ...prev, shipping_address: prev.address }));
                          }} />
                          SAME AS BILLING
                        </label>
                      </div>
                      <textarea 
                        placeholder="Leave empty if same as billing" 
                        style={{ height: '70px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'none', backgroundColor: shippingSameAsBilling ? '#f8fafc' : '#ffffff' }}
                        value={shippingSameAsBilling ? newClient.address : newClient.shipping_address} 
                        onChange={e => setNewClient({...newClient, shipping_address: e.target.value})} 
                        disabled={shippingSameAsBilling}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, var(--primary-light) 100%)',
                  border: '1px solid #eaedf3',
                  borderRadius: '12px',
                  padding: '16px',
                }}>
                  <div style={{ fontSize: '9px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Customer Preview</div>
                  <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>{newClient.company_name || 'Legal Entity Name'}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{newClient.mobile ? `+91 ${newClient.mobile}` : 'Contact detail will appear here'}</div>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '20px 32px', 
              borderTop: '1px solid #eaedf3', 
              backgroundColor: '#ffffff',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button 
                type="button" 
                style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: '#4b5563', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }} 
                onClick={() => setShowClientModal(false)}
              >
                Discard
              </button>
              <button 
                type="submit" 
                form="quick-client-form" 
                style={{ padding: '8px 28px', backgroundColor: 'var(--primary-color)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                Create & Select
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Quick Product Addition Modal */}
      {showProductModal && createPortal((
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowProductModal(false); }}
        >
          <div style={{
            backgroundColor: '#ffffff', maxHeight: '90vh', width: '100%', maxWidth: '580px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: '16px', display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out', overflow: 'hidden', border: '1px solid #eaedf3'
          }}>
            {/* Header */}
            <div style={{ 
               padding: '24px 32px', 
               borderBottom: '1px solid #eaedf3', 
               display: 'flex', 
               justifyContent: 'space-between', 
               alignItems: 'center',
               backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={18} style={{ color: 'var(--primary-color)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>
                    New Inventory Item
                  </h2>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowProductModal(false)} 
                style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body without browser scrollbar */}
            <div className="no-scrollbar" style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <form onSubmit={handleQuickProductSave} id="quick-product-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Section 1: Item Identity */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Product Identity</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Item Name *</label>
                      <input 
                        placeholder="e.g. Premium Wireless Keyboard" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newProduct.name} 
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                        required 
                      />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Category</label>
                          <button type="button" onClick={() => setShowAddCategory(true)}
                            style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          ><Plus size={10} /></button>
                        </div>
                        {showAddCategory ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input 
                              autoFocus
                              placeholder="New..."
                              style={{ flex: 1, height: '34px', padding: '0 8px', border: '1px solid var(--primary-color)', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                              value={newCategoryInput}
                              onChange={e => setNewCategoryInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = newCategoryInput.trim();
                                  if (val && !categories.includes(val)) {
                                    setCategories(prev => [...prev, val]);
                                    setNewProduct(p => ({ ...p, category: val }));
                                  }
                                  setNewCategoryInput(''); setShowAddCategory(false);
                                }
                                if (e.key === 'Escape') setShowAddCategory(false);
                              }}
                            />
                            <button type="button" onClick={() => setShowAddCategory(false)} style={{ height: '34px', padding: '0 8px', background: '#f1f5f9', border: 'none', borderRadius: '6px' }}><X size={12} /></button>
                          </div>
                        ) : (
                          <select 
                            style={{ height: '42px', padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }}
                            value={newProduct.category} 
                            onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                          >
                            <option value="">General</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Unit</label>
                          <button type="button" onClick={() => setShowAddUnit(true)}
                            style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          ><Plus size={10} /></button>
                        </div>
                        {showAddUnit ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input 
                              autoFocus 
                              placeholder="New..."
                              style={{ flex: 1, height: '34px', padding: '0 8px', border: '1px solid var(--primary-color)', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                              value={newUnitInput}
                              onChange={e => setNewUnitInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = newUnitInput.trim();
                                  if (val && !units.includes(val)) {
                                    setUnits(prev => [...prev, val]);
                                    setNewProduct(p => ({ ...p, unit: val }));
                                  }
                                  setNewUnitInput(''); setShowAddUnit(false);
                                }
                                if (e.key === 'Escape') setShowAddUnit(false);
                              }}
                            />
                            <button type="button" onClick={() => setShowAddUnit(false)} style={{ height: '34px', padding: '0 8px', background: '#f1f5f9', border: 'none', borderRadius: '6px' }}><X size={12} /></button>
                          </div>
                        ) : (
                          <select 
                            style={{ height: '42px', padding: '0 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }}
                            value={newProduct.unit} 
                            onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                          >
                            {units.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Pricing & Inventory */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Pricing & Inventory</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sale Price *</label>
                      <div style={{ display: 'flex', height: '42px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '13px', color: '#6b7280', fontWeight: '700' }}>₹</span>
                        <input 
                          type="number"
                          step="any"
                          style={{ flex: 1, height: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '0 8px 8px 0', fontSize: '14px', outline: 'none' }}
                          value={newProduct.price} 
                          onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                          required 
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>GST Rate (%)</label>
                      <div style={{ display: 'flex', height: '42px' }}>
                        <input 
                          type="number" 
                          style={{ flex: 1, height: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px 0 0 8px', fontSize: '14px', outline: 'none' }}
                          value={newProduct.gst_percent} 
                          onChange={e => setNewProduct({...newProduct, gst_percent: e.target.value})} 
                        />
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: '13px', color: '#6b7280', fontWeight: '700' }}>%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>HSN Code</label>
                      <input 
                        placeholder="Optional" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newProduct.hsn_code || ''} 
                        onChange={e => setNewProduct({...newProduct, hsn_code: e.target.value})} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Current Stock</label>
                      <input 
                        type="number" 
                        style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                        value={newProduct.stock} 
                        onChange={e => setNewProduct({...newProduct, stock: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Live Preview details */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, var(--primary-light) 100%)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Item Preview</div>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newProduct.name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Unit Price</div>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>₹{parseFloat(newProduct.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '20px 32px', 
              borderTop: '1px solid #eaedf3', 
              backgroundColor: '#ffffff',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button 
                type="button" 
                style={{
                  padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: '#4b5563',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer'
                }} 
                onClick={() => setShowProductModal(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="quick-product-form" 
                style={{
                  padding: '8px 28px', backgroundColor: 'var(--primary-color)', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
              >
                Add Product
              </button>
            </div>

          </div>
        </div>
      ), document.body)}

      {/* Invoice Preview PDF Overlay Modal */}
      {showPreview && createPortal((
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #eaedf3', width: '95%', maxWidth: '1000px', height: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 32px', borderBottom: '1px solid #eaedf3',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  padding: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: generatedId ? '#dcfce7' : 'var(--primary-light)', 
                  color: generatedId ? '#16a34a' : 'var(--primary-color)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  {generatedId ? <CheckCircle size={20} /> : <Eye size={20} />}
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', margin: 0 }}>
                    {generatedId ? 'Invoice Generated Successfully' : 'Invoice Preview'}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>
                    {generatedId ? `Order ID: ${generatedNumber}` : `Invoice Number: ${invoice.invoice_number}`}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  className="btn" 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewUrl;
                    link.setAttribute('download', `INV_${generatedNumber || invoice.invoice_number}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                  }}
                  style={{
                    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#4b5563',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Download size={15} /> Download
                </button>
                <button 
                  className="btn"
                  onClick={async () => {
                    try {
                      const response = await fetch(previewUrl);
                      const blob = await response.blob();
                      const file = new File([blob], `INV_${generatedNumber || invoice.invoice_number}.pdf`, { type: 'application/pdf' });
                      if (navigator.share) {
                        await navigator.share({ files: [file], title: `Invoice ${generatedNumber || invoice.invoice_number}` });
                      } else {
                        alert('Sharing is not supported on this browser context.');
                      }
                    } catch (err) {
                      console.error('Share error:', err);
                    }
                  }}
                  style={{
                    backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#4b5563',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Share2 size={15} /> Share
                </button>
                {generatedId && (
                  <button 
                    onClick={() => navigate(`/${endpointMap[type]}`)}
                    style={{
                      backgroundColor: 'var(--primary-color)', border: 'none', borderRadius: '8px',
                      padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#ffffff',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
                  >
                    Go to {type === 'invoice' ? 'Invoices' : type === 'quotation' ? 'Quotations' : 'Proformas'}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewUrl(null);
                  }}
                  style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div style={{ flex: '1', backgroundColor: '#525659', overflow: 'hidden' }}>
              <iframe 
                src={`${previewUrl}#view=FitH`} 
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Invoice Preview"
              />
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Quick Payment Method Addition Modal */}
      {showPaymentMethodModal && createPortal((
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #eaedf3', width: '100%', maxWidth: '400px',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.02em', color: '#111827', margin: 0 }}>Add Payment Method</h2>
              <button 
                onClick={() => setShowPaymentMethodModal(false)} 
                style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <form onSubmit={handleAddPaymentMethod} id="quick-payment-method-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563' }}>Payment Method Name *</label>
                  <input 
                    placeholder="e.g. PhonePe, GPay, Credit Card" 
                    style={{ height: '42px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    value={newPaymentMethodName} 
                    onChange={e => setNewPaymentMethodName(e.target.value)} 
                    required 
                    autoFocus
                  />
                </div>
              </form>
            </div>
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid #eaedf3', 
              backgroundColor: '#ffffff',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button 
                type="button" 
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#4b5563',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer'
                }} 
                onClick={() => setShowPaymentMethodModal(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="quick-payment-method-form" 
                style={{
                  padding: '8px 20px', backgroundColor: 'var(--primary-color)', color: '#ffffff',
                  border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
              >
                Add Method
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default CreateInvoice;
