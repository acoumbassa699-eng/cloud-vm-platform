import Link from 'next/link';
import { Cloud, Server, BarChart, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      <nav className="bg-white shadow-md">
        <div className="container-custom py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Cloud className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold">CloudVM</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="btn-secondary">Login</Link>
            <Link href="/register" className="btn-primary">Register</Link>
          </div>
        </div>
      </nav>

      <main className="container-custom py-20 text-white">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold mb-6">Cloud VM Platform</h1>
          <p className="text-xl mb-8 text-blue-100">
            Create and manage virtual machines with real OpenStack and Proxmox integration
          </p>
          
          <div className="flex gap-4 mb-12">
            <Link href="/register" className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition">
              Get Started
            </Link>
            <Link href="/login" className="px-6 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition">
              Sign In
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white bg-opacity-10 backdrop-blur p-6 rounded-lg">
            <Server className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">Real VMs</h3>
            <p className="text-blue-100">Create actual virtual machines on OpenStack or Proxmox</p>
          </div>
          
          <div className="bg-white bg-opacity-10 backdrop-blur p-6 rounded-lg">
            <BarChart className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">Monitoring</h3>
            <p className="text-blue-100">Real-time metrics and performance monitoring</p>
          </div>
          
          <div className="bg-white bg-opacity-10 backdrop-blur p-6 rounded-lg">
            <Shield className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">Secure</h3>
            <p className="text-blue-100">Enterprise-grade security and access control</p>
          </div>
        </div>
      </main>
    </div>
  );
}
