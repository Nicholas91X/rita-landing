import { getContentHierarchy } from '@/app/actions/content'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Section from '@/components/Section'

export default async function DashboardPage() {
    // We assume this will redirect to /login if not authenticated
    const levels = await getContentHierarchy()

    return (
        <main className="min-h-screen bg-background">
            <Section className="section py-10">
                <h1 className="h1 text-[var(--foreground)] mb-8">Dashboard</h1>

                {levels.length === 0 ? (
                    <p className="text-muted-foreground">Nessun contenuto disponibile al momento.</p>
                ) : (
                    levels.map((level) => (
                        <div key={level.id} className="mb-16">
                            <div className="mb-8 border-b border-[var(--border)] pb-4">
                                <h2 className="h2 text-[var(--foreground)] mb-2">{level.title}</h2>
                                <p className="text-lg text-[var(--muted-foreground)]">{level.description}</p>
                            </div>

                            <div className="space-y-12">
                                {level.courses.map((course) => (
                                    <div key={course.id}>
                                        <h3 className="h3 text-[var(--foreground)] mb-6 pl-4 border-l-4 border-[var(--brand)]">
                                            {course.title}
                                        </h3>
                                        <p className="text-[var(--muted-foreground)] mb-6 pl-4">
                                            {course.description}
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {course.packages.map((pkg) => (
                                                <Card key={pkg.id} className="flex flex-col h-full border-[var(--border)] bg-[var(--panel)]">
                                                    <CardHeader>
                                                        <CardTitle className="text-xl font-bold text-[var(--foreground)]">
                                                            {pkg.title}
                                                        </CardTitle>
                                                        <CardDescription className="text-[var(--muted-foreground)]">
                                                            {pkg.description}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="mt-auto pt-6">
                                                        <p className="text-3xl font-bold text-[var(--brand)]">
                                                            €{pkg.price}
                                                        </p>
                                                    </CardContent>
                                                    <CardFooter>
                                                        <button className="w-full rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] hover:opacity-90 transition-opacity">
                                                            Acquista
                                                        </button>
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
