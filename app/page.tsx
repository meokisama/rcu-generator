import Generator from "@/components/home/generator";
import Hero from "@/components/home/hero";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f3f4f641]">
      <div className="absolute inset-0 -z-[9]">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      </div>
      <Hero />
      <Generator />
    </div>
  );
}
