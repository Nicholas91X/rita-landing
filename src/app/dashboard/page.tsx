import { getContentHierarchy } from '@/app/actions/content'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Section from '@/components/Section'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
    const levels = await getContentHierarchy()

    return (
        <main className="min-h-screen bg-background text-[var(--foreground)]">
            <Section className="py-10">
                <h1 className="text-4xl font-bold mb-8">La tua Area Riservata</h1>

                {levels.length === 0 ? (
                    <p className="text-muted-foreground text-center py-10">
                        Nessun contenuto disponibile al momento.
                    </p>
                ) : (
                    levels.map((level) => (
                        <div key={level.id} className="mb-16">
                            {/* Livello */}
                            <div className="mb-8 border-b border-[var(--border)] pb-4">
                                <h2 className="text-3xl font-bold text-[var(--brand)] uppercase tracking-wider">
                                    {level.name}
                                </h2>
                            </div>

                            <div className="space-y-12">
                                {level.courses.map((course) => (
                                    <div key={course.id}>
                                        {/* Corso */}
                                        <h3 className="text-xl font-semibold mb-6 pl-4 border-l-4 border-[var(--brand)]">
                                            {course.name}
                                        </h3>

                                        {/* Grid Pacchetti */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {course.packages.map((pkg) => (
                                                <Card key={pkg.id} className="flex flex-col h-full border-[var(--border)] bg-[var(--panel)]">
                                                    <CardHeader>
                                                        <CardTitle className="text-xl font-bold">
                                                            {pkg.name}
                                                        </CardTitle>
                                                        <CardDescription className="text-[var(--muted-foreground)]">
                                                            {pkg.isPurchased ? '✅ Accesso Sbloccato' : pkg.description}
                                                        </CardDescription>
                                                    </CardHeader>

                                                    <CardFooter className="mt-auto">
                                                        {pkg.isPurchased ? (
                                                            /* Se acquistato: porta ai video */
                                                            <Button asChild className="w-full bg-[var(--brand)] text-white hover:opacity-90">
                                                                <Link href={`/dashboard/package/${pkg.id}`}>
                                                                    Guarda i Video
                                                                </Link>
                                                            </Button>
                                                        ) : (
                                                            /* Se non acquistato: attiva Stripe (da collegare) */
                                                            <Button className="w-full bg-[var(--foreground)] text-[var(--background)] hover:opacity-90">
                                                                Sblocca Pacchetto
                                                            </Button>
                                                        )}
                                                    </CardFooter>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </Section>
        </main>
    )
}