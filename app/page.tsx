import Generator from "@/components/home/generator";
import Hero from "@/components/home/hero";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f3f4f663]">
      <Hero />
      <Generator />
    </div>
  );
}
