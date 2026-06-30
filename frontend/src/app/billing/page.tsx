'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Invoice {
  id: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      loadInvoices(savedToken);
    }
  }, []);

  const loadInvoices = async (authToken: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/billing/invoices`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setInvoices(response.data.invoices);
    } catch (err) {
      console.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">Billing & Invoices</h1>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="card">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Period</th>
                  <th className="text-left py-3">Subtotal</th>
                  <th className="text-left py-3">Tax</th>
                  <th className="text-left py-3">Total</th>
                  <th className="text-left py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-gray-50">
                    <td className="py-3">
                      {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                    </td>
                    <td className="py-3">${invoice.subtotal.toFixed(2)}</td>
                    <td className="py-3">${invoice.tax.toFixed(2)}</td>
                    <td className="py-3 font-semibold">${invoice.total.toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
