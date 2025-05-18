import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: {
    separateCabinets: boolean;
    templateType: string;
  }) => void;
}

export default function ImportCSVDialog({
  open,
  onOpenChange,
  onConfirm,
}: ImportCSVDialogProps) {
  const [importMode, setImportMode] = React.useState<"combined" | "separate">(
    "combined"
  );
  const [templateType, setTemplateType] = React.useState<string>("standard");

  const handleConfirm = () => {
    onConfirm({
      separateCabinets: importMode === "separate",
      templateType: templateType,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chọn chế độ nhập dữ liệu CSV</DialogTitle>
          <DialogDescription>
            Chọn loại template và cách xử lý dữ liệu từ file CSV.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Tabs defaultValue="template" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template">Loại Template</TabsTrigger>
              <TabsTrigger value="mode">Chế độ nhập</TabsTrigger>
            </TabsList>
            <TabsContent value="template" className="py-4">
              <RadioGroup
                value={templateType}
                onValueChange={(value) => setTemplateType(value)}
                className="flex flex-col space-y-4"
              >
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="standard"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Template anh Toàn
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Dùng cho các file excel của anh Toàn.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="template2" id="template2" />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="template2"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Template anh Thắng
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Dùng cho các file excel của anh Thắng, với cấu trúc khác
                      biệt.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </TabsContent>
            <TabsContent value="mode" className="py-4">
              <RadioGroup
                value={importMode}
                onValueChange={(value) =>
                  setImportMode(value as "combined" | "separate")
                }
                className="flex flex-col space-y-4"
              >
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="combined" id="combined" />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="combined"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Điều khiển toàn bộ tủ
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Tất cả các tủ được nhập vào một cấu hình chung, với các
                      scene và schedule chung.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="separate" id="separate" />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="separate"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Điều khiển tủ riêng biệt
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Mỗi tủ sẽ có các scene riêng (ví dụ: &quot;DAY TIME
                      1&quot; cho tủ 1, &quot;DAY TIME 2&quot; cho tủ 2, v.v.),
                      nhưng các schedule vẫn sẽ bao gồm tất cả các scene tương
                      ứng.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleConfirm}>Tiếp tục</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
