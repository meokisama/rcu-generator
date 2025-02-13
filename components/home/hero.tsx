import Image from "next/image";

export default function Hero() {
  return (
    <div className="w-full flex justify-center">
      <div className="mb-10">
        <Image
          src="/banner.jpg"
          alt="Hero Image"
          width={600}
          height={171}
          className="h-auto"
        />
        <p className="text-center -mt-5 text-gray-700 italic">
          ㅡ Scenes & Schedules Generator ㅡ
        </p>
      </div>
    </div>
  );
}
