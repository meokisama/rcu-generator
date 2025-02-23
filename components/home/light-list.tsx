import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus, Trash2, PenLine, Settings2 } from "lucide-react";

interface Light {
  group: number;
  value: number;
  name: string;
}

interface LightListProps {
  scene: {
    amount: number;
    lights: Light[];
    isSequential: boolean;
    startGroup?: number;
  };
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
    newName: string
  ) => void;
  handleDeleteLight: (sceneIndex: number, lightIndex: number) => void;
  handleAddLight: (sceneIndex: number) => void;
}

const LightList: React.FC<LightListProps> = ({
  scene,
  sceneIndex,
  handleAmountChange,
  handleStartGroupChange,
  handleLightChange,
  handleLightNameChange,
  handleDeleteLight,
  handleAddLight,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Số line đèn:</Label>
        <Input
          type="number"
          min="1"
          value={scene.amount}
          onChange={(e) => handleAmountChange(sceneIndex, e.target.value)}
        />
      </div>

      {scene.isSequential ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <Label>Group bắt đầu:</Label>
            <Input
              type="number"
              min="1"
              value={scene.startGroup}
              onChange={(e) =>
                handleStartGroupChange(sceneIndex, e.target.value)
              }
            />
          </div>
          <div>
            <Label>Độ sáng các đèn (%):</Label>
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
          {scene.lights.map((light, lightIndex) => (
            <div key={lightIndex}>
              {/* Desktop View */}
              <div className="hidden md:flex items-center gap-4">
                <div className="space-y-4 flex-1">
                  <div className="flex gap-6">
                    <div className="relative flex-1">
                      <PenLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={light.name}
                        onChange={(e) =>
                          handleLightNameChange(
                            sceneIndex,
                            lightIndex,
                            e.target.value
                          )
                        }
                        className="pl-10 font-medium bg-gray-50 border-gray-200 focus:bg-white"
                        placeholder={`Đèn ${lightIndex + 1}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`group-${lightIndex}`}
                        className="text-sm font-medium text-gray-600"
                      >
                        Group
                      </Label>
                      <Input
                        id={`group-${lightIndex}`}
                        type="number"
                        min="1"
                        value={light.group}
                        onChange={(e) =>
                          handleLightChange(
                            sceneIndex,
                            lightIndex,
                            "group",
                            e.target.value
                          )
                        }
                        className="bg-gray-50 border-gray-200 focus:bg-white lg:w-20 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`brightness-${lightIndex}`}
                        className="text-sm font-medium text-gray-600"
                      >
                        Độ sáng (%)
                      </Label>
                      <Input
                        id={`brightness-${lightIndex}`}
                        type="number"
                        min="0"
                        max="100"
                        value={light.value}
                        onChange={(e) =>
                          handleLightChange(
                            sceneIndex,
                            lightIndex,
                            "value",
                            e.target.value
                          )
                        }
                        className="bg-gray-50 border-gray-200 focus:bg-white lg:w-20 text-center"
                      />
                    </div>
                  </div>
                </div>
                {scene.lights.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteLight(sceneIndex, lightIndex)}
                    className="border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Mobile View */}
              <div className="flex md:hidden items-center gap-2 p-2">
                <div className="relative flex-1">
                  <PenLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={light.name}
                    onChange={(e) =>
                      handleLightNameChange(
                        sceneIndex,
                        lightIndex,
                        e.target.value
                      )
                    }
                    className="pl-10 font-medium bg-gray-50 border-gray-200 focus:bg-white"
                    placeholder={`Đèn ${lightIndex + 1}`}
                  />
                </div>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-gray-200"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side={"bottom"}>
                    <SheetHeader>
                      <SheetTitle>Cài đặt đèn {light.name}</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-6 mt-6">
                      <div className="space-y-2">
                        <Label htmlFor={`mobile-group-${lightIndex}`}>
                          Group
                        </Label>
                        <Input
                          id={`mobile-group-${lightIndex}`}
                          type="number"
                          min="1"
                          value={light.group}
                          onChange={(e) =>
                            handleLightChange(
                              sceneIndex,
                              lightIndex,
                              "group",
                              e.target.value
                            )
                          }
                          className="bg-gray-50 border-gray-200 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`mobile-brightness-${lightIndex}`}>
                          Độ sáng (%)
                        </Label>
                        <Input
                          id={`mobile-brightness-${lightIndex}`}
                          type="number"
                          min="0"
                          max="100"
                          value={light.value}
                          onChange={(e) =>
                            handleLightChange(
                              sceneIndex,
                              lightIndex,
                              "value",
                              e.target.value
                            )
                          }
                          className="bg-gray-50 border-gray-200 focus:bg-white"
                        />
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                {scene.lights.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteLight(sceneIndex, lightIndex)}
                    className="border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            onClick={() => handleAddLight(sceneIndex)}
            variant="outline"
            className="w-full mt-2 mb-4"
          >
            <Plus className="h-4 w-4" />
            Thêm line đèn mới
          </Button>
        </>
      )}
    </div>
  );
};

export default LightList;
