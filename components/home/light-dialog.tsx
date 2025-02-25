import React, { memo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, List, PenLine, Sun, Book } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Types
interface Light {
  group: number;
  value: number;
  name: string;
}

// Props for LightItem component
interface LightItemProps {
  light: Light;
  lightIndex: number;
  sceneIndex: number;
  handleLightChange: (
    sceneIndex: number,
    lightIndex: number,
    field: "group" | "value",
    value: string
  ) => void;
  handleLightNameChange: (
    sceneIndex: number,
    lightIndex: number,
    name: string
  ) => void;
  handleDeleteLight: (sceneIndex: number, lightIndex: number) => void;
  showDeleteButton: boolean;
}

// Light component for individual light controls
const LightItem = memo<LightItemProps>(
  ({
    light,
    lightIndex,
    sceneIndex,
    handleLightChange,
    handleLightNameChange,
    handleDeleteLight,
    showDeleteButton,
  }) => {
    const onGroupChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleLightChange(sceneIndex, lightIndex, "group", e.target.value);
      },
      [handleLightChange, sceneIndex, lightIndex]
    );

    const onValueChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleLightChange(sceneIndex, lightIndex, "value", e.target.value);
      },
      [handleLightChange, sceneIndex, lightIndex]
    );

    const onNameChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleLightNameChange(sceneIndex, lightIndex, e.target.value);
      },
      [handleLightNameChange, sceneIndex, lightIndex]
    );

    const onDelete = useCallback(() => {
      handleDeleteLight(sceneIndex, lightIndex);
    }, [handleDeleteLight, sceneIndex, lightIndex]);

    return (
      <div className="flex gap-2 mb-3 w-full">
        <div className="flex-1 relative">
          <PenLine className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input value={light.name} onChange={onNameChange} className="pl-8" />
        </div>
        <div className="flex items-center gap-3 relative">
          <Book className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            type="number"
            min="1"
            value={light.group}
            onChange={onGroupChange}
            className="w-20 pl-8"
          />
        </div>
        <div className="flex items-center gap-3 relative">
          <Sun className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            type="number"
            min="0"
            max="100"
            value={light.value}
            onChange={onValueChange}
            className="w-20 pl-8"
          />
        </div>
        {showDeleteButton && (
          <div className="flex items-end">
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              className="border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }
);
LightItem.displayName = "LightItem";

// Props for LightListDialog component
interface LightListDialogProps {
  lights: Light[];
  sceneIndex: number;
  handleLightChange: (
    sceneIndex: number,
    lightIndex: number,
    field: "group" | "value",
    value: string
  ) => void;
  handleLightNameChange: (
    sceneIndex: number,
    lightIndex: number,
    name: string
  ) => void;
  handleDeleteLight: (sceneIndex: number, lightIndex: number) => void;
  handleAddLight: (sceneIndex: number) => void;
}

// Dialog component for displaying a large list of lights
export const LightListDialog = memo<LightListDialogProps>(
  ({
    lights,
    sceneIndex,
    handleLightChange,
    handleLightNameChange,
    handleDeleteLight,
    handleAddLight,
  }) => {
    const onAddLight = useCallback(() => {
      handleAddLight(sceneIndex);
    }, [handleAddLight, sceneIndex]);

    return (
      <Dialog>
        <div className="flex flex-row items-center justify-between">
          <div>
            <h3 className="font-semibold">Danh sách đèn</h3>
            <h4 className="text-sm font-medium text-gray-500">
              Tổng cộng có {lights.length} đèn
            </h4>
          </div>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Danh sách đèn ({lights.length})
            </Button>
          </DialogTrigger>
        </div>
        <Separator />
        <DialogContent
          className="max-w-3xl max-h-[90vh]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Danh sách đèn</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-2 m-2">
              {lights.map((light, lightIndex) => (
                <LightItem
                  key={lightIndex}
                  light={light}
                  lightIndex={lightIndex}
                  sceneIndex={sceneIndex}
                  handleLightChange={handleLightChange}
                  handleLightNameChange={handleLightNameChange}
                  handleDeleteLight={handleDeleteLight}
                  showDeleteButton={lights.length > 1}
                />
              ))}
            </div>
          </ScrollArea>
          <Button
            variant="outline"
            onClick={onAddLight}
            className="w-full flex items-center justify-center gap-2 mt-4"
          >
            <Plus className="h-4 w-4" />
            Thêm đèn
          </Button>
        </DialogContent>
      </Dialog>
    );
  }
);
LightListDialog.displayName = "LightListDialog";
