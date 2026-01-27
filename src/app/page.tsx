import Hero from "@/components/sections/Hero";
import Metodo from "@/components/sections/Metodo";
import PerChi from "@/components/sections/PerChi";
import Storia from "@/components/sections/Storia";
import Faq from "@/components/sections/Faq";
import Contact from "@/components/sections/Contact";
import SideMarquees from "@/components/SideMarquees";

import { createClient } from "@/utils/supabase/server";

const leftImgs = [
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-1.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-2.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-3.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-4.png",
];


const rightImgs = [
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-1.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-2.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-3.png",
];

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let hasUsedTrial = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_used_trial')
      .eq('id', user.id)
      .single();

    if (profile) {
      hasUsedTrial = profile.has_used_trial;
    }
  }

  return (
    <main className="relative">
      <SideMarquees
        left={leftImgs}
        right={rightImgs}
        width={240}
        gap={12}
        speedSec={22}
      />

      <Hero />
      <Metodo />
      <PerChi />
      <Storia isLoggedIn={!!user} hasUsedTrial={hasUsedTrial} />
      <Faq />
      <Contact />
    </main>
  );
}
