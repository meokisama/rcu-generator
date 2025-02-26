import React, { memo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, PenLine, Sun, Book } from "lucide-react";
import { LightListDialog } from "./light-dialog";
import { Card, CardContent } from "@/components/ui/card";
import ExcelImportDialog from "./import-dialog";

// Types
interface Light {
  group: number;
  value: number;
  name: string;
}

interface Scene {
  name: string;
  amount: number;
  lights: Light[];
  isSequential: boolean;
  startGroup?: number;
}

// Light component for individual light controls
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
      <div className="flex gap-2">
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

// Props for LightList component
interface LightListProps {
  scene: Scene;
  sceneIndex: number;
  handleAmountChange: (sceneIndex: number, value: string) => void;
  handleStartGroupChange: (sceneIndex: number, value: string) => void;
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
  // Thêm prop mới để xử lý import hàng loạt
  handleBulkAddLights?: (sceneIndex: number, lights: Light[]) => void;
}

// Optimized LightList component
const LightList = memo<LightListProps>(
  ({
    scene,
    sceneIndex,
    handleAmountChange,
    handleStartGroupChange,
    handleLightChange,
    handleLightNameChange,
    handleDeleteLight,
    handleAddLight,
    handleBulkAddLights, // Prop mới
  }) => {
    const onAmountChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleAmountChange(sceneIndex, e.target.value);
      },
      [handleAmountChange, sceneIndex]
    );

    const onStartGroupChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleStartGroupChange(sceneIndex, e.target.value);
      },
      [handleStartGroupChange, sceneIndex]
    );

    const onAddLight = useCallback(() => {
      handleAddLight(sceneIndex);
    }, [handleAddLight, sceneIndex]);

    // Handler cho chức năng import từ Excel
    const onImportLights = useCallback(
      (lights: Light[]) => {
        if (handleBulkAddLights) {
          handleBulkAddLights(sceneIndex, lights);
        }
      },
      [handleBulkAddLights, sceneIndex]
    );

    const isLargeList = scene.lights.length > 10;

    return (
      <div className="space-y-4">
        {scene.isSequential ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Số lượng đèn trong nhóm:</Label>
              <Input
                type="number"
                min="1"
                value={scene.amount}
                onChange={onAmountChange}
              />
            </div>
            <div>
              <Label>Group đèn bắt đầu từ:</Label>
              <Input
                type="number"
                min="1"
                value={scene.startGroup || 1}
                onChange={onStartGroupChange}
              />
            </div>
            <div className="col-span-2">
              <Label>Độ sáng cho tất cả đèn (%):</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={scene.lights[0].value}
                onChange={(e) =>
                  handleLightChange(sceneIndex, 0, "value", e.target.value)
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <div className="flex-1">
                <Label>Nhập số lượng đèn (nếu cần): </Label>
                <Input
                  type="number"
                  min="1"
                  value={scene.amount}
                  onChange={onAmountChange}
                  className="mt-2"
                />
              </div>

              {/* Thêm nút import từ Excel ở đây */}
              {handleBulkAddLights && (
                <div className="flex items-end">
                  <ExcelImportDialog
                    sceneIndex={sceneIndex}
                    onImport={onImportLights}
                  />
                </div>
              )}
            </div>

            {isLargeList ? (
              // Render dialog for large list
              <Card>
                <CardContent className="p-4 bg-[#f3f4f641]">
                  <div className="space-y-4">
                    <LightListDialog
                      lights={scene.lights}
                      sceneIndex={sceneIndex}
                      handleLightChange={handleLightChange}
                      handleLightNameChange={handleLightNameChange}
                      handleDeleteLight={handleDeleteLight}
                      handleAddLight={handleAddLight}
                    />
                    {/* Show first few lights as preview */}
                    <div className="space-y-2">
                      {scene.lights.slice(0, 3).map((light, lightIndex) => (
                        <LightItem
                          key={lightIndex}
                          light={light}
                          lightIndex={lightIndex}
                          sceneIndex={sceneIndex}
                          handleLightChange={handleLightChange}
                          handleLightNameChange={handleLightNameChange}
                          handleDeleteLight={handleDeleteLight}
                          showDeleteButton={false} // Don't show delete in preview
                        />
                      ))}
                      {scene.lights.length > 3 && (
                        <div className="text-sm text-center text-gray-500">
                          ... và {scene.lights.length - 3} đèn khác
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Render inline list for small list
              <div className="space-y-2">
                {scene.lights.map((light, lightIndex) => (
                  <LightItem
                    key={lightIndex}
                    light={light}
                    lightIndex={lightIndex}
                    sceneIndex={sceneIndex}
                    handleLightChange={handleLightChange}
                    handleLightNameChange={handleLightNameChange}
                    handleDeleteLight={handleDeleteLight}
                    showDeleteButton={scene.lights.length > 1}
                  />
                ))}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={onAddLight}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm đèn
                  </Button>

                  {/* Thêm nút import từ Excel ở cuối danh sách đèn khi không có nhiều đèn */}
                  {/* {handleBulkAddLights && !isLargeList && (
                    <ExcelImportDialog
                      sceneIndex={sceneIndex}
                      onImport={onImportLights}
                    />
                  )} */}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
LightList.displayName = "LightList";

export default LightList;
