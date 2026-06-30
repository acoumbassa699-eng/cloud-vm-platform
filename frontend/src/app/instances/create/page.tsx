'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import LoadingSpinner from '@/components/LoadingSpinner';
import Alert from '@/components/Alert';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

export default function CreateInstancePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    imageId: 'ubuntu-22.04',
    flavorId: 'm1.small',
    networkId: '',
    cpu: 2,
    ram: 4,
    storage: 20,
    keypairName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      router.push('/login');
    } else {
      setToken(savedToken);
    }
  }, [router]);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/instances`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      router.push(`/instances/${response.data.instanceId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create instance');
    } finally {
      setLoading(false);
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

        <div className="card max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Create New Instance</h1>

          {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}

          <form onSubmit={handleCreateInstance} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Instance Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="input-field"
                required
                placeholder="e.g., web-server-01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">CPU (vCPU)</label>
                <input
                  type="number"
                  value={formData.cpu}
                  onChange={(e) => setFormData({...formData, cpu: parseInt(e.target.value)})}
                  className="input-field"
                  min="1"
                  max="64"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">RAM (GB)</label>
                <input
                  type="number"
                  value={formData.ram}
                  onChange={(e) => setFormData({...formData, ram: parseInt(e.target.value)})}
                  className="input-field"
                  min="1"
                  max="256"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Storage (GB)</label>
              <input
                type="number"
                value={formData.storage}
                onChange={(e) => setFormData({...formData, storage: parseInt(e.target.value)})}
                className="input-field"
                min="10"
                max="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Operating System</label>
              <select
                value={formData.imageId}
                onChange={(e) => setFormData({...formData, imageId: e.target.value})}
                className="input-field"
              >
                <option value="ubuntu-22.04">Ubuntu 22.04 LTS</option>
                <option value="ubuntu-20.04">Ubuntu 20.04 LTS</option>
                <option value="centos-8">CentOS 8</option>
                <option value="debian-11">Debian 11</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">SSH Keypair (Optional)</label>
              <input
                type="text"
                value={formData.keypairName}
                onChange={(e) => setFormData({...formData, keypairName: e.target.value})}
                className="input-field"
                placeholder="keypair-name"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading || !formData.name}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Instance'}
              </button>
              <Link href="/instances" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
