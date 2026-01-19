
'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Activity, ShoppingBag } from "lucide-react"

// Define the stats type based on the server action return type
type AdminStatsData = {
    supabase: {
        totalUsers: number;
        activeSubscriptions: number;
        totalOneTimePurchases: number;
    };
    bunny: {
        totalVideos: number;
        totalViews: number;
        bandwidthUsed: number;
    };
};

// Formatter for bytes
function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default function AdminStats({ stats }: { stats: AdminStatsData }) {
    if (!stats) return null

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-neutral-900/80 border-white/10 backdrop-blur-md hover:bg-neutral-900 transition-colors group shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs uppercase font-black tracking-widest text-white/70">Utenti Totali</CardTitle>
                    <Users className="h-5 w-5 text-[var(--brand)] opacity-70 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-white italic tracking-tighter">{stats.supabase.totalUsers}</div>
                    <p className="text-[10px] uppercase font-bold text-neutral-300 mt-1">Registrati</p>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900/80 border-white/10 backdrop-blur-md hover:bg-neutral-900 transition-colors group shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs uppercase font-black tracking-widest text-white/70">Abbonamenti</CardTitle>
                    <CreditCard className="h-5 w-5 text-[var(--brand)] opacity-70 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-white italic tracking-tighter">{stats.supabase.activeSubscriptions}</div>
                    <p className="text-[10px] uppercase font-bold text-emerald-500/80 mt-1">Attivi Ora</p>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900/80 border-white/10 backdrop-blur-md hover:bg-neutral-900 transition-colors group shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs uppercase font-black tracking-widest text-white/70">Transazioni</CardTitle>
                    <ShoppingBag className="h-5 w-5 text-[var(--brand)] opacity-70 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-white italic tracking-tighter">{stats.supabase.totalOneTimePurchases}</div>
                    <p className="text-[10px] uppercase font-bold text-neutral-300 mt-1">Acquisti Singoli</p>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900/80 border-white/10 backdrop-blur-md hover:bg-neutral-900 transition-colors group shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs uppercase font-black tracking-widest text-white/70">Traffico Video</CardTitle>
                    <Activity className="h-5 w-5 text-emerald-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-white italic tracking-tighter">{formatBytes(stats.bunny.bandwidthUsed)}</div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[10px] uppercase font-bold text-neutral-200">{stats.bunny.totalViews} views (30gg)</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
