
'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Video, Activity, HardDrive, ShoppingBag } from "lucide-react"

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Utenti Totali</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.supabase.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">
                        Registrati in piattaforma
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Abbonamenti Attivi</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.supabase.activeSubscriptions}</div>
                    <p className="text-xs text-muted-foreground">
                        Utenti paganti ricorrenti
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Acquisti Singoli</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.supabase.totalOneTimePurchases}</div>
                    <p className="text-xs text-muted-foreground">
                        Schede o Lezioni vendute
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Video in Library</CardTitle>
                    <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.bunny.totalVideos}</div>
                    <p className="text-xs text-muted-foreground">
                        Caricati su Bunny.net
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Traffico (30gg)</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatBytes(stats.bunny.bandwidthUsed)}</div>
                    <p className="text-xs text-muted-foreground">
                        {stats.bunny.totalViews} visualizzazioni
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
