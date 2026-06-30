'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import LoadingSpinner from '@/components/LoadingSpinner';
import Alert from '@/components/Alert';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Power, RotateCcw, Trash2, Camera } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Instance {
  id: string;
  name: string;
  state: string;
  cpu: number;
  ram: number;
  storage: number;
  ip_address: string;
  created_at: string;
  provider_id: string;
}

interface Metrics {
  cpu: number;
  memory: number;
  disk: number;
  collected_at: string;
}

export default function InstanceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.id as string;
  
  const [instance, setInstance] = useState<Instance | null>(null);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      loadInstance(savedToken);
      loadMetrics(savedToken);
    }
  }, [instanceId]);

  const loadInstance = async (authToken: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/instances/${instanceId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setInstance(response.data.instance);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load instance');
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (authToken: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/monitoring/${instanceId}/latest`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (response.data.metrics) {
        setMetrics([response.data.metrics]);
      }
    } catch (err) {
      console.error('Failed to load metrics');
    }
  };

  const handleInstanceAction = async (action: 'start' | 'stop' | 'reboot') => {
    setActionLoading(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/instances/${instanceId}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInstance(prev => prev ? {...prev, state: action === 'reboot' ? 'REBOOTING' : action === 'start' ? 'STARTING' : 'STOPPING'} : null);
      setTimeout(() => loadInstance(token), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} instance`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this instance?')) return;
    
    setActionLoading(true);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/instances/${instanceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      router.push('/instances');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete instance');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container-custom py-8">
        <Link href="/instances" className="flex items-center gap-2 text-blue-600 hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Instances
        </Link>

        {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}

        {loading ? (
          <LoadingSpinner />
        ) : instance ? (
          <div className="space-y-6">
            <div className="card">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold">{instance.name}</h1>
                  <p className="text-gray-600 mt-1">ID: {instance.id}</p>
                </div>
                <span className="px-4 py-2 rounded-full font-medium bg-green-100 text-green-800">
                  {instance.state}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">CPU</p>
                  <p className="text-2xl font-bold">{instance.cpu} vCPU</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">RAM</p>
                  <p className="text-2xl font-bold">{instance.ram} GB</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Storage</p>
                  <p className="text-2xl font-bold">{instance.storage} GB</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">IP Address</p>
                  <p className="text-lg font-mono">{instance.ip_address || 'N/A'}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {instance.state !== 'RUNNING' && (
                  <button
                    onClick={() => handleInstanceAction('start')}
                    disabled={actionLoading}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    <Power className="w-4 h-4" />
                    Start
                  </button>
                )}
                {instance.state === 'RUNNING' && (
                  <button
                    onClick={() => handleInstanceAction('stop')}
                    disabled={actionLoading}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    <Power className="w-4 h-4" />
                    Stop
                  </button>
                )}
                <button
                  onClick={() => handleInstanceAction('reboot')}
                  disabled={actionLoading}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reboot
                </button>
                <button
                  disabled={actionLoading}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  Snapshot
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>

            {metrics.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Metrics</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="collected_at" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#8884d8" />
                    <Line type="monotone" dataKey="memory" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-600">Instance not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
