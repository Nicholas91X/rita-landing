import Section from "../Section";
import { Card } from "@/components/ui/card";
import { storia } from "@/content/it";

export default function Storia() {
  return (
    <Section id="storia" className="section">
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <h2 className="h2">{storia.title}</h2>
          <p className="mt-4 leading-relaxed text-slate-700">{storia.body}</p>
        </div>
        <Card className="p-6">
          <ul className="text-sm text-slate-700 space-y-2">
            {storia.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>
      </div>
    </Section>
  );
}
