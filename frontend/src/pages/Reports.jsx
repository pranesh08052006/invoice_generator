import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import { 
  BarChart3, Download, FileText, TrendingUp, 
  CreditCard, AlertCircle, Package, Users
} from 'lucide-react';

const Reports = ({ user, company }) => {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/reports/summary`);
        setReportData(response.data);
      } catch (err) {
        console.error("Failed to fetch reports", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const downloadCSV = (type) => {
    if (!reportData) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = "report.csv";

    if (type === 'sales') {
      filename = "sales_report.csv";
      csvContent += "Client,Invoiced Amount,Paid Amount,Invoices Count\n";
      reportData.client_breakdown.forEach(c => {
        csvContent += `${c.name},${c.invoiced},${c.paid},${c.count}\n`;
      });
    } else if (type === 'inventory') {
      filename = "low_inventory_report.csv";
      csvContent += "Product ID,Product Name,Stock Level,Unit\n";
      reportData.low_stock_products.forEach(p => {
        csvContent += `${p.id},${p.name},${p.stock},${p.unit}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = (type) => {
    if (!reportData) return;
    const printWindow = window.open('', '_blank');
    const label = type === 'sales' ? 'Client Sales Breakdown' : 'Low Stock Alert';
    
    const html = `
      <html>
        <head>
          <title>${label} Report - ${company?.name || 'Digital Viyabari'}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111827; padding: 40px; margin: 0; }
            .header { border-bottom: 2px solid #eaedf3; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 24px; font-weight: 800; color: #1e3a8a; margin: 0; }
            .company-info { text-align: right; }
            .date { font-size: 12px; color: #6b7280; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { padding: 12px 16px; font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; background-color: #f8fafc; border-bottom: 1px solid #eaedf3; text-align: left; }
            td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .text-right { text-align: right; }
            .total-row { background-color: #fafafa; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${label.toUpperCase()}</h1>
              <div class="date">Generated on ${new Date().toLocaleDateString('en-IN')}</div>
            </div>
            <div class="company-info">
              <strong style="font-size: 16px;">${company?.name || 'Digital Viyabari'}</strong><br/>
              <span style="font-size: 12px; color: #6b7280;">${company?.address || ''}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${type === 'sales' ? `
                  <th>Client Name</th>
                  <th class="text-right">Invoiced Amount</th>
                  <th class="text-right">Paid Amount</th>
                  <th class="text-right">Balance</th>
                ` : `
                  <th>Product Name</th>
                  <th>Product ID</th>
                  <th class="text-right">Current Stock</th>
                `}
              </tr>
            </thead>
            <tbody>
              ${type === 'sales' ? reportData.client_breakdown.map(c => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td class="text-right">₹${(c.invoiced || 0).toLocaleString()}</td>
                  <td class="text-right">₹${(c.paid || 0).toLocaleString()}</td>
                  <td class="text-right">₹${((c.invoiced || 0) - (c.paid || 0)).toLocaleString()}</td>
                </tr>
              `).join('') : reportData.low_stock_products.map(p => `
                <tr>
                  <td><strong>${p.name}</strong></td>
                  <td>${p.id}</td>
                  <td class="text-right" style="color: ${p.stock <= 5 ? '#ef4444' : '#f59e0b'}">${p.stock} ${p.unit}</td>
                </tr>
              `).join('')}
            </tbody>
            ${type === 'sales' ? `
              <tfoot>
                <tr class="total-row">
                  <td>TOTAL</td>
                  <td class="text-right">₹${reportData.total_invoiced.toLocaleString()}</td>
                  <td class="text-right">₹${reportData.total_revenue.toLocaleString()}</td>
                  <td class="text-right">₹${reportData.total_outstanding.toLocaleString()}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 'calc(100vh - 64px)' }}>
        <p style={{ color: '#6b7280', fontSize: '15px', fontWeight: '500' }}>Loading Reports...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div style={{ padding: '32px 40px' }}>
        <p style={{ color: '#ef4444' }}>Error loading reports data.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
            Reports & Analytics
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', fontWeight: '500' }}>
            Comprehensive overview of your business performance
          </p>
        </div>
      </div>

      {/* Grid row of 4 Premium Metrics cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Revenue
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#10b981' }}>
            ₹{reportData.total_revenue.toLocaleString()}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} style={{ color: '#10b981' }} />
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Outstanding Balance
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#ef4444' }}>
            ₹{reportData.total_outstanding.toLocaleString()}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Invoiced
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#3b82f6' }}>
            ₹{reportData.total_invoiced.toLocaleString()}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} style={{ color: '#3b82f6' }} />
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Invoices Paid
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '8px', color: '#8b5cf6' }}>
            {reportData.paid_count} / {reportData.total_invoices}
          </div>
          <div style={{ position: 'absolute', right: '24px', top: '24px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={18} style={{ color: '#8b5cf6' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Client Sales Breakdown */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: 'var(--primary-color)' }} />
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>Client Sales Breakdown</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => downloadPDF('sales')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
              >
                <FileText size={14} /> Export PDF
              </button>
              <button 
                onClick={() => downloadCSV('sales')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          <div style={{ padding: '0', overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eaedf3' }}>Client</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eaedf3' }}>Invoiced</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eaedf3' }}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {reportData.client_breakdown.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eaedf3' }}>
                    <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>{c.name}</td>
                    <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '700', color: '#374151', textAlign: 'right' }}>₹{(c.invoiced || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '700', color: '#10b981', textAlign: 'right' }}>₹{(c.paid || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {reportData.client_breakdown.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>No client data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Inventory Report */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #eaedf3', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #eaedf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} style={{ color: '#f59e0b' }} />
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>Low Stock Alert</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => downloadPDF('inventory')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
              >
                <FileText size={14} /> Export PDF
              </button>
              <button 
                onClick={() => downloadCSV('inventory')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          <div style={{ padding: '0', overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eaedf3' }}>Product</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eaedf3' }}>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {reportData.low_stock_products.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eaedf3' }}>
                    <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>{p.name}</td>
                    <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '800', color: p.stock <= 5 ? '#ef4444' : '#f59e0b', textAlign: 'right' }}>
                      {p.stock} {p.unit}
                    </td>
                  </tr>
                ))}
                {reportData.low_stock_products.length === 0 && (
                  <tr>
                    <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>All inventory items are sufficiently stocked.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
