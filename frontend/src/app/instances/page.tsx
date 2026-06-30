'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import LoadingSpinner from '@/components/LoadingSpinner';
import Alert from '@/components/Alert';
import Link from 'next/link';
import { Server, Plus, RefreshCw } from 'lucide-react';

interface Instance {
  id: string;
  name: string;
  state: string;
  cpu: number;
  ram: number;
  storage: number;
  ip_address: string;
  created_at: string;
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      loadInstances(savedToken);
    }
  }, []);

  const loadInstances = async (authToken: string) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/instances`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      setInstances(response.data.instances);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load instances');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      RUNNING: 'bg-green-100 text-green-800',
      STOPPED: 'bg-gray-100 text-gray-800',
      CREATING: 'bg-blue-100 text-blue-800',
      ERROR: 'bg-red-100 text-red-800',
    };
    return colors[state] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <Navbar />
      <div className="container-custom py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Instances</h1>
          <div className="flex gap-2">
            <button
              onClick={() => loadInstances(token)}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <Link href="/instances/create" className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Instance
            </Link>
          </div>
        </div>

        {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}

        {loading ? (
          <LoadingSpinner />
        ) : instances.length === 0 ? (
          <div className="card text-center py-12">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No instances found</p>
            <Link href="/instances/create" className="btn-primary mt-4 inline-block">
              Create your first instance
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {instances.map((instance) => (
              <Link
                key={instance.id}
                href={`/instances/${instance.id}`}
                className="card hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{instance.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">ID: {instance.id}</p>
                    <div className="flex gap-4 mt-3 text-sm text-gray-600">
                      <span>CPU: {instance.cpu} vCPU</span>
                      <span>RAM: {instance.ram}GB</span>
                      <span>Storage: {instance.storage}GB</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStateColor(instance.state)}`}>
                      {instance.state}
                    </span>
                    {instance.ip_address && (
                      <p className="text-sm text-gray-600 mt-2">{instance.ip_address}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
