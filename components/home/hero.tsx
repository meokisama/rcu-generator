import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

export default function Hero() {
  return (
    <div className="p-4 lg:px-10">
      <Card className="w-full shadow-sm">
        <CardContent>
          <Image
            src="/banner.jpg"
            alt="Hero Image"
            width={600}
            height={171}
            className="h-auto mb-5 mx-auto"
          />
          <p className="text-center -mt-10 text-gray-700 italic">
            ㅡ Scenes & Schedules Generator ㅡ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
