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

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (separateCabinets: boolean) => void;
}

export default function ImportCSVDialog({
  open,
  onOpenChange,
  onConfirm,
}: ImportCSVDialogProps) {
  const [importMode, setImportMode] = React.useState<"combined" | "separate">(
    "combined"
  );

  const handleConfirm = () => {
    onConfirm(importMode === "separate");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chọn chế độ nhập dữ liệu CSV</DialogTitle>
          <DialogDescription>
            Chọn cách xử lý dữ liệu từ file CSV có nhiều tủ điện.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
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
                  Tất cả các tủ được nhập vào một cấu hình chung, với các scene
                  và schedule chung.
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
                  Mỗi tủ sẽ có các scene riêng (ví dụ: &quot;DAY TIME 1&quot;
                  cho tủ 1, &quot;DAY TIME 2&quot; cho tủ 2, v.v.), nhưng các
                  schedule vẫn sẽ bao gồm tất cả các scene tương ứng.
                </p>
              </div>
            </div>
          </RadioGroup>
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
