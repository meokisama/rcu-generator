"use client";
import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Light {
  group: number;
  value: number;
}

interface Scene {
  amount: number;
  lights: Light[];
  isSequential: boolean;
  startGroup?: number;
}

interface Schedule {
  enable: boolean;
  sceneAmount: number;
  sceneGroup: number[];
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  hour: number;
  minute: number;
}

export default function Generator() {
  // Scene state
  const [numScenes, setNumScenes] = useState<number>(1);
  const [scenes, setScenes] = useState<Scene[]>([
    {
      amount: 1,
      lights: [{ group: 1, value: 100 }],
      isSequential: false,
    },
  ]);

  // Schedule state
  const [numSchedules, setNumSchedules] = useState<number>(1);
  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      enable: true,
      sceneAmount: 1,
      sceneGroup: [1],
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
      hour: 0,
      minute: 0,
    },
  ]);

  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("scene");

  // Scene handlers
  const handleNumScenesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value) || 1;
    setNumScenes(num);

    const newScenes = Array(num)
      .fill(null)
      .map((_, i) => ({
        amount: scenes[i]?.amount || 1,
        lights: scenes[i]?.lights || [{ group: 1, value: 100 }],
        isSequential: scenes[i]?.isSequential || false,
        startGroup: scenes[i]?.startGroup || 1,
      }));
    setScenes(newScenes);
  };

  const handleAmountChange = (sceneIndex: number, value: string) => {
    const newScenes = [...scenes];
    const amount = parseInt(value) || 1;

    if (newScenes[sceneIndex].isSequential) {
      newScenes[sceneIndex].amount = amount;
    } else {
      if (amount > newScenes[sceneIndex].lights.length) {
        while (newScenes[sceneIndex].lights.length < amount) {
          newScenes[sceneIndex].lights.push({
            group: 1,
            value: 100,
          });
        }
      } else {
        newScenes[sceneIndex].lights = newScenes[sceneIndex].lights.slice(
          0,
          amount
        );
      }
      newScenes[sceneIndex].amount = amount;
    }

    setScenes(newScenes);
  };

  const handleLightChange = (
    sceneIndex: number,
    lightIndex: number,
    field: keyof Light,
    value: string
  ) => {
    const newScenes = [...scenes];
    newScenes[sceneIndex].lights[lightIndex][field] = parseInt(value) || 0;
    setScenes(newScenes);
  };

  const handleSequentialToggle = (sceneIndex: number) => {
    const newScenes = [...scenes];
    newScenes[sceneIndex].isSequential = !newScenes[sceneIndex].isSequential;
    if (newScenes[sceneIndex].isSequential) {
      newScenes[sceneIndex].startGroup = 1;
      newScenes[sceneIndex].lights = [{ group: 1, value: 100 }];
    }
    setScenes(newScenes);
  };

  const handleStartGroupChange = (sceneIndex: number, value: string) => {
    const newScenes = [...scenes];
    newScenes[sceneIndex].startGroup = parseInt(value) || 1;
    setScenes(newScenes);
  };

  // Schedule handlers
  const handleNumSchedulesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value) || 1;
    setNumSchedules(num);

    const newSchedules = Array(num)
      .fill(null)
      .map((_, i) => ({
        ...(schedules[i] || {
          enable: true,
          sceneAmount: 1,
          sceneGroup: [1],
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
          hour: 0,
          minute: 0,
        }),
      }));
    setSchedules(newSchedules);
  };

  const handleScheduleChange = (
    scheduleIndex: number,
    field: keyof Schedule,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any
  ) => {
    const newSchedules = [...schedules];
    if (field === "sceneAmount") {
      const amount = parseInt(value) || 1;
      newSchedules[scheduleIndex].sceneAmount = amount;
      // Adjust sceneGroup array
      if (amount > newSchedules[scheduleIndex].sceneGroup.length) {
        while (newSchedules[scheduleIndex].sceneGroup.length < amount) {
          newSchedules[scheduleIndex].sceneGroup.push(1);
        }
      } else {
        newSchedules[scheduleIndex].sceneGroup = newSchedules[
          scheduleIndex
        ].sceneGroup.slice(0, amount);
      }
    } else {
      newSchedules[scheduleIndex][field as keyof Schedule] = value as never;
    }
    setSchedules(newSchedules);
  };

  // const handleSceneGroupChange = (
  //   scheduleIndex: number,
  //   groupIndex: number,
  //   value: string
  // ) => {
  //   const newSchedules = [...schedules];
  //   newSchedules[scheduleIndex].sceneGroup[groupIndex] = parseInt(value) || 1;
  //   setSchedules(newSchedules);
  // };

  // Generate code based on active tab
  const generateCode = React.useCallback((): string => {
    const generateSceneCode = (): string => {
      let code = "";
      scenes.forEach((scene, sceneIndex) => {
        code += `sceneObj[${sceneIndex}].amount = ${scene.amount};\n`;

        if (scene.isSequential) {
          code += `for(let i=0; i<sceneObj[${sceneIndex}].amount; i++) {\n`;
          code += `\tsceneObj[${sceneIndex}].outputObj[i].type = OBJ_LIGHTING;\n`;
          code += `\tsceneObj[${sceneIndex}].outputObj[i].group = i + ${scene.startGroup};\n`;
          code += `\tsceneObj[${sceneIndex}].outputObj[i].value = ${scene.lights[0].value}*255/100;\n`;
          code += `}\n`;
        } else {
          scene.lights.forEach((light, lightIndex) => {
            code += `sceneObj[${sceneIndex}].outputObj[${lightIndex}].type = OBJ_LIGHTING;\n`;
            code += `sceneObj[${sceneIndex}].outputObj[${lightIndex}].group = ${light.group};\n`;
            code += `sceneObj[${sceneIndex}].outputObj[${lightIndex}].value = ${light.value}*255/100;\n`;
          });
        }
        code += "\n";
      });
      return code;
    };

    const generateScheduleCode = (): string => {
      let code = "";
      schedules.forEach((schedule, index) => {
        code += `schedule[${index}].enable = ${schedule.enable ? 1 : 0};\n`;
        code += `schedule[${index}].sceneAmount = ${schedule.sceneAmount};\n`;
        schedule.sceneGroup.forEach((group, groupIndex) => {
          code += `schedule[${index}].sceneGroup[${groupIndex}] = ${group};\n`;
        });
        code += "\n";
        code += `schedule[${index}].monday = ${schedule.monday ? 1 : 0};\n`;
        code += `schedule[${index}].tuesday = ${schedule.tuesday ? 1 : 0};\n`;
        code += `schedule[${index}].wednesday = ${
          schedule.wednesday ? 1 : 0
        };\n`;
        code += `schedule[${index}].thursday = ${schedule.thursday ? 1 : 0};\n`;
        code += `schedule[${index}].friday = ${schedule.friday ? 1 : 0};\n`;
        code += `schedule[${index}].saturday = ${schedule.saturday ? 1 : 0};\n`;
        code += `schedule[${index}].sunday = ${schedule.sunday ? 1 : 0};\n`;
        code += `schedule[${index}].hour = ${schedule.hour};\n`;
        code += `schedule[${index}].minute = ${schedule.minute};\n\n`;
      });
      return code;
    };
    if (activeTab === "scene") {
      return generateSceneCode();
    } else {
      return generateScheduleCode();
    }
  }, [activeTab, scenes, schedules]);

  const handleSceneSelection = (
    scheduleIndex: number,
    selectedScenes: number[]
  ) => {
    const newSchedules = [...schedules];
    newSchedules[scheduleIndex] = {
      ...newSchedules[scheduleIndex],
      sceneAmount: selectedScenes.length,
      sceneGroup: selectedScenes,
    };
    setSchedules(newSchedules);
  };

  useEffect(() => {
    setGeneratedCode(generateCode());
  }, [scenes, schedules, activeTab, generateCode]);

  return (
    <div className="p-4">
      <div className="lg:grid grid-cols-2 gap-4">
        {/* Left Column - Input Form */}
        <div className="space-y-4 mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="scene" className="flex-1">
                Ngữ cảnh (Scene)
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1">
                Lịch trình (Schedule)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scene">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Số lượng Scene cần tạo:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={numScenes}
                        onChange={handleNumScenesChange}
                        className="mt-2"
                      />
                    </div>

                    {scenes.map((scene, sceneIndex) => (
                      <div
                        key={sceneIndex}
                        className="border p-4 rounded-lg shadow-md"
                      >
                        <h3 className="font-bold mb-4 text-red-600 lg:text-lg">
                          Scene {sceneIndex + 1}
                        </h3>

                        <div className="flex items-center space-x-2 mb-4">
                          <Switch
                            checked={scene.isSequential}
                            onCheckedChange={() =>
                              handleSequentialToggle(sceneIndex)
                            }
                          />
                          <Label>Group đèn liên tục</Label>
                        </div>

                        <Alert className="mb-4">
                          <Terminal className="h-4 w-4" />
                          <AlertTitle className="font-bold">
                            Các anh chú ý!
                          </AlertTitle>
                          <AlertDescription>
                            Nếu scene cần tạo có line đèn là các địa chỉ group
                            liên tiếp nhau một mạch, ví dụ từ group 1 → group
                            10, thì bật chế độ{" "}
                            <strong className="text-red-700">
                              Group đèn liên tục
                            </strong>{" "}
                            này lên. Và, độ sáng các đèn này phải đồng nhất bằng
                            nhau thì mới được, còn các đèn độ sáng khác nhau thì
                            hãy tắt cái này và điền thủ công bên dưới.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-4">
                          <div>
                            <Label>Số line đèn:</Label>
                            <Input
                              type="number"
                              min="1"
                              value={scene.amount}
                              onChange={(e) =>
                                handleAmountChange(sceneIndex, e.target.value)
                              }
                            />
                          </div>

                          {scene.isSequential ? (
                            <div className="space-y-4">
                              <div>
                                <Label>Group bắt đầu:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={scene.startGroup}
                                  onChange={(e) =>
                                    handleStartGroupChange(
                                      sceneIndex,
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label>Độ sáng (%):</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={scene.lights[0].value}
                                  onChange={(e) =>
                                    handleLightChange(
                                      sceneIndex,
                                      0,
                                      "value",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            scene.lights.map((light, lightIndex) => (
                              <div
                                key={lightIndex}
                                className="grid grid-cols-2 gap-4"
                              >
                                <div>
                                  <Label>Group Đèn {lightIndex + 1}:</Label>
                                  <Input
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
                                  />
                                </div>
                                <div>
                                  <Label>
                                    Độ sáng (%) Đèn {lightIndex + 1}:
                                  </Label>
                                  <Input
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
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Số lượng Schedule cần tạo:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={numSchedules}
                        onChange={handleNumSchedulesChange}
                        className="mt-2"
                      />
                    </div>

                    {schedules.map((schedule, scheduleIndex) => (
                      <div
                        key={scheduleIndex}
                        className="border p-4 rounded-lg space-y-4 shadow-md"
                      >
                        <h3 className="font-bold mb-4 lg:text-lg text-red-600">
                          Schedule {scheduleIndex + 1}
                        </h3>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={schedule.enable}
                            onCheckedChange={(checked) =>
                              handleScheduleChange(
                                scheduleIndex,
                                "enable",
                                checked
                              )
                            }
                          />
                          <Label>Kích hoạt</Label>
                        </div>

                        <div className="space-y-2">
                          <Label>Chọn các Scene cho Schedule này:</Label>
                          <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg bg-gray-50">
                            {Array.from({ length: numScenes }, (_, i) => (
                              <div
                                key={i}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  checked={schedule.sceneGroup.includes(i + 1)}
                                  onCheckedChange={(checked) => {
                                    const newSelection = checked
                                      ? [...schedule.sceneGroup, i + 1].sort(
                                          (a, b) => a - b
                                        )
                                      : schedule.sceneGroup.filter(
                                          (num) => num !== i + 1
                                        );
                                    handleSceneSelection(
                                      scheduleIndex,
                                      newSelection
                                    );
                                  }}
                                />
                                <Label>Scene {i + 1}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* <div>
                          <Label>Số lượng Scene của Schedule:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={schedule.sceneAmount}
                            onChange={(e) =>
                              handleScheduleChange(
                                scheduleIndex,
                                "sceneAmount",
                                e.target.value
                              )
                            }
                          />
                        </div> */}

                        <Alert>
                          <Terminal className="h-4 w-4" />
                          <AlertTitle className="font-bold">
                            Các anh chú ý!
                          </AlertTitle>
                          <AlertDescription>
                            Ở phần chọn Scene này sẽ liệt kê{" "}
                            <strong className="text-red-700">
                              tất cả các scene đã được tạo
                            </strong>{" "}
                            ở tab Ngữ cảnh (Scene) bên trên, và giờ chỉ cần tick
                            chọn những scene tương ứng cho Schedule này là được.
                          </AlertDescription>
                        </Alert>

                        {/* {schedule.sceneGroup.map((group, groupIndex) => (
                          <div key={groupIndex}>
                            <Label className="font-bold">
                              Scene {groupIndex + 1}:
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              value={group}
                              onChange={(e) =>
                                handleSceneGroupChange(
                                  scheduleIndex,
                                  groupIndex,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        ))} */}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Giờ kích hoạt:</Label>
                            <Input
                              type="number"
                              min="0"
                              max="23"
                              value={schedule.hour}
                              onChange={(e) =>
                                handleScheduleChange(
                                  scheduleIndex,
                                  "hour",
                                  parseInt(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>Phút (nếu có):</Label>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              value={schedule.minute}
                              onChange={(e) =>
                                handleScheduleChange(
                                  scheduleIndex,
                                  "minute",
                                  parseInt(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            "monday",
                            "tuesday",
                            "wednesday",
                            "thursday",
                            "friday",
                            "saturday",
                            "sunday",
                          ].map((day) => (
                            <div
                              key={day}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                checked={
                                  schedule[day as keyof Schedule] as boolean
                                }
                                onCheckedChange={(checked) =>
                                  handleScheduleChange(
                                    scheduleIndex,
                                    day as keyof Schedule,
                                    checked
                                  )
                                }
                              />
                              <Label className="capitalize">{day}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Generated Code */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Copy gửi anh Hoài An</CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigator.clipboard.writeText(generatedCode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
              {generatedCode}
            </pre>
          </CardContent>
          <CardFooter>
            <Alert>
              <Terminal className="h-4 w-4" />
              <AlertTitle className="font-bold">Các anh chú ý!</AlertTitle>
              <AlertDescription>
                Để tránh rườm rà khó nhìn giữa hai bước nên phần code sẽ được
                hiển thị tách biệt giữ Scene và Schedule, tức là phải copy 2
                lần, một lần copy cho Scene và một lần copy cho Schedule. Rồi
                mới gửi cho anh Hoài An.
              </AlertDescription>
            </Alert>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
