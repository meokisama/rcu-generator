import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

export default function Hero() {
  return (
    <div className="p-4 lg:px-10">
      <Card className="w-full shadow-sm relative">
        <CardContent>
          <Image
            src="/banner.png"
            alt="Hero Image"
            width={600}
            height={103}
            className="h-auto mb-5 mx-auto"
          />
          <p className="text-center -mt-10 text-gray-700 italic">
            ㅡ Scenes & Schedules Generator ㅡ
          </p>
          <Image
            src="/uwu.png"
            alt="UwU Solutions"
            width={200}
            height={154}
            quality={100}
            className="h-auto absolute bottom-0 right-10 hidden sm:block"
          />
        </CardContent>
      </Card>
    </div>
  );
}
