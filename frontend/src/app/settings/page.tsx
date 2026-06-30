'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div>
      <Navbar />
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <div className="grid gap-4 max-w-2xl">
          <Link href="#" className="card hover:shadow-lg transition">
            <h3 className="font-semibold mb-2">Account Settings</h3>
            <p className="text-sm text-gray-600">Manage your profile and personal information</p>
          </Link>

          <Link href="#" className="card hover:shadow-lg transition">
            <h3 className="font-semibold mb-2">API Keys</h3>
            <p className="text-sm text-gray-600">Manage API keys and tokens for programmatic access</p>
          </Link>

          <Link href="#" className="card hover:shadow-lg transition">
            <h3 className="font-semibold mb-2">Security</h3>
            <p className="text-sm text-gray-600">Manage passwords and two-factor authentication</p>
          </Link>

          <Link href="#" className="card hover:shadow-lg transition">
            <h3 className="font-semibold mb-2">Notifications</h3>
            <p className="text-sm text-gray-600">Configure email and alert preferences</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
