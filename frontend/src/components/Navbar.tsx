import React from 'react';
import Link from 'next/link';
import { Cloud, LogOut } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="container-custom">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center gap-2">
            <Cloud className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold">CloudVM</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link href="/instances" className="hover:text-blue-600">Instances</Link>
            <Link href="/projects" className="hover:text-blue-600">Projects</Link>
            <Link href="/billing" className="hover:text-blue-600">Billing</Link>
            <Link href="/settings" className="hover:text-blue-600">Settings</Link>
            <button className="flex items-center gap-2 text-gray-600 hover:text-red-600">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
