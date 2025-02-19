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
import { Copy, Download, Plus, Trash2, PenLine } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { CodeBlock } from "@/components/ui/code-block";
import OverviewDialog from "@/components/home/drag-dialog";
import { cloneDeep } from "lodash";

interface Light {
  group: number;
  value: number;
}

interface Scene {
  name: string;
  amount: number;
  lights: Light[];
  isSequential: boolean;
  startGroup?: number;
}

interface Schedule {
  name: string;
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
      name: "Scene 1",
      amount: 1,
      lights: [{ group: 1, value: 100 }],
      isSequential: false,
    },
  ]);

  // Schedule state
  const [numSchedules, setNumSchedules] = useState<number>(1);
  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      name: "Schedule 1",
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
        name: scenes[i]?.name || `Scene ${i + 1}`,
        amount: scenes[i]?.amount || 1,
        lights: scenes[i]?.lights || [{ group: 1, value: 100 }],
        isSequential: scenes[i]?.isSequential || false,
        startGroup: scenes[i]?.startGroup || 1,
      }));
    setScenes(newScenes);
  };

  const handleSceneNameChange = (sceneIndex: number, name: string) => {
    const newScenes = [...scenes];
    newScenes[sceneIndex].name = name;
    setScenes(newScenes);
  };

  const handleScheduleNameChange = (scheduleIndex: number, name: string) => {
    const newSchedules = [...schedules];
    newSchedules[scheduleIndex].name = name;
    setSchedules(newSchedules);
  };

  const handleCopyScene = (sceneIndex: number) => {
    const sceneToCopy = cloneDeep(scenes[sceneIndex]);
    const newScene = {
      ...sceneToCopy,
      name: `${sceneToCopy.name} (Copy)`,
    };
    setScenes([...scenes, newScene]);
    setNumScenes(scenes.length + 1);
    toast.success("Sao chép scene thành công!", {
      description: "Scene được sao chép sẽ nằm ở cuối danh sách.",
      duration: 6000,
    });
  };

  const handleCopySchedule = (scheduleIndex: number) => {
    const scheduleToCopy = cloneDeep(schedules[scheduleIndex]);
    const newSchedule = {
      ...scheduleToCopy,
      name: `${scheduleToCopy.name} (Copy)`,
    };
    setSchedules([...schedules, newSchedule]);
    setNumSchedules(schedules.length + 1);
    toast.success("Sao chép schedule thành công!", {
      description: "Schedule được sao chép sẽ nằm ở cuối danh sách.",
      duration: 6000,
    });
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
          name: `Schedule ${i + 1}`,
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

  const generateSceneCode = (): string => {
    let code = "";
    scenes.forEach((scene, sceneIndex) => {
      code += `// ${scene.name}\n`;
      code += `sceneObj[${sceneIndex}].amount = ${scene.amount};\n`;

      if (scene.isSequential) {
        code += `for(uint8_t j=0; j<sceneObj[${sceneIndex}].amount; j++) {\n`;
        code += `\tsceneObj[${sceneIndex}].outputObj[j].type = OBJ_LIGHTING;\n`;
        code += `\tsceneObj[${sceneIndex}].outputObj[j].group = j + ${scene.startGroup};\n`;
        code += `\tsceneObj[${sceneIndex}].outputObj[j].value = ${scene.lights[0].value}*255/100;\n`;
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
      code += `// ${schedule.name}\n`;
      code += `schedule[${index}].enable = ${schedule.enable ? 1 : 0};\n`;
      code += `schedule[${index}].sceneAmount = ${schedule.sceneAmount};\n`;
      schedule.sceneGroup.forEach((group, groupIndex) => {
        code += `schedule[${index}].sceneGroup[${groupIndex}] = ${group};\n`;
      });
      code += "\n";
      code += `schedule[${index}].monday = ${schedule.monday ? 1 : 0};\n`;
      code += `schedule[${index}].tuesday = ${schedule.tuesday ? 1 : 0};\n`;
      code += `schedule[${index}].wednesday = ${schedule.wednesday ? 1 : 0};\n`;
      code += `schedule[${index}].thursday = ${schedule.thursday ? 1 : 0};\n`;
      code += `schedule[${index}].friday = ${schedule.friday ? 1 : 0};\n`;
      code += `schedule[${index}].saturday = ${schedule.saturday ? 1 : 0};\n`;
      code += `schedule[${index}].sunday = ${schedule.sunday ? 1 : 0};\n`;
      code += `schedule[${index}].hour = ${schedule.hour};\n`;
      code += `schedule[${index}].minute = ${schedule.minute};\n\n`;
    });
    return code;
  };

  // Generate code based on active tab
  const generateCode = React.useCallback((): string => {
    if (activeTab === "scene") {
      return generateSceneCode();
    } else {
      return generateScheduleCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAddScene = () => {
    setNumScenes((prev) => prev + 1);
    setScenes((prev) => [
      ...prev,
      {
        name: `Scene ${prev.length + 1}`,
        amount: 1,
        lights: [{ group: 1, value: 100 }],
        isSequential: false,
      },
    ]);
    toast.success("Thêm scene mới thành công!", {
      description: "Scene được tạo sẽ nằm ở cuối danh sách.",
      duration: 6000,
    });
  };

  const handleAddSchedule = () => {
    setNumSchedules((prev) => prev + 1);
    setSchedules((prev) => [
      ...prev,
      {
        name: `Schedule ${prev.length + 1}`,
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
    toast.success("Thêm schedule mới thành công!", {
      description: "Schedule được tạo sẽ nằm ở cuối danh sách.",
      duration: 6000,
    });
  };

  const handleDownload = () => {
    const sceneCode = generateSceneCode();
    const scheduleCode = generateScheduleCode();
    const fullCode = `// Scene Configuration\n${sceneCode}\n// Schedule Configuration\n${scheduleCode}`;

    // Create blob and download
    const blob = new Blob([fullCode], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene-schedule.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Tải xuống thành công!", {
      description:
        "Code đã được tải xuống, đọc phần chú ý và gửi file này cho anh Hoài An.",
      duration: 8000,
    });
  };

  // Delete handlers
  const handleDeleteScene = (sceneIndex: number) => {
    if (scenes.length > 1) {
      const newScenes = scenes.filter((_, index) => index !== sceneIndex);
      setScenes(newScenes);
      setNumScenes((prev) => prev - 1);

      // Update schedules to remove references to the deleted scene
      const deletedSceneNumber = sceneIndex + 1;
      const newSchedules = schedules.map((schedule) => {
        const newSceneGroup = schedule.sceneGroup
          .filter((group) => group !== deletedSceneNumber)
          .map((group) => (group > deletedSceneNumber ? group - 1 : group));

        return {
          ...schedule,
          sceneGroup: newSceneGroup,
          sceneAmount: newSceneGroup.length,
        };
      });
      setSchedules(newSchedules);
      toast.success("Đã xóa scene!", {
        description: "Scene đã được xóa khỏi danh sách.",
        duration: 6000,
      });
    }
  };

  const handleDeleteSchedule = (scheduleIndex: number) => {
    if (schedules.length > 1) {
      const newSchedules = schedules.filter(
        (_, index) => index !== scheduleIndex
      );
      setSchedules(newSchedules);
      setNumSchedules((prev) => prev - 1);
      toast.success("Đã xóa schedule!", {
        description: "Schedule đã được xóa khỏi danh sách.",
        duration: 6000,
      });
    }
  };

  useEffect(() => {
    setGeneratedCode(generateCode());
  }, [scenes, schedules, activeTab, generateCode]);

  return (
    <div className="p-4 lg:px-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Input Form */}
        <div className="space-y-4">
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
                        className="border p-4 rounded-lg shadow-md relative"
                      >
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex-1 mr-6 lg:mr-12 relative">
                            <PenLine className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                              value={scene.name}
                              onChange={(e) =>
                                handleSceneNameChange(
                                  sceneIndex,
                                  e.target.value
                                )
                              }
                              className="font-bold text-red-600 lg:text-lg shadow-sm pl-8"
                            />
                          </div>
                          <div className="flex gap-2">
                            {scenes.length > 1 && (
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteScene(sceneIndex)}
                                className="shadow-sm"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCopyScene(sceneIndex)}
                              className="shadow-sm"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                                <Label>Độ sáng các đèn (%):</Label>
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
                                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
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
                  <div className="mt-10 w-full">
                    <Button
                      onClick={handleAddScene}
                      className="flex items-center gap-2 w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm Scene
                    </Button>
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
                        className="border p-4 rounded-lg space-y-4 shadow-md relative"
                      >
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex-1 mr-6 lg:mr-12 relative">
                            <PenLine className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <Input
                              value={schedule.name}
                              onChange={(e) =>
                                handleScheduleNameChange(
                                  scheduleIndex,
                                  e.target.value
                                )
                              }
                              className="font-bold text-red-600 lg:text-lg shadow-sm pl-8"
                            />
                          </div>
                          <div className="flex gap-2">
                            {schedules.length > 1 && (
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() =>
                                  handleDeleteSchedule(scheduleIndex)
                                }
                                className="shadow-sm"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCopySchedule(scheduleIndex)}
                              className="shadow-sm"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

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
                            {scenes.map((scene, i) => (
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
                                <Label>{scene.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

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
                  <div className="mt-6 w-full">
                    <Button
                      onClick={handleAddSchedule}
                      className="flex items-center gap-2 w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Generated Code */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <Card className="shadow-sm flex flex-col h-full">
            <CardHeader>
              <div className="flex justify-between items-center gap-4 flex-col lg:flex-row">
                <CardTitle>Gửi anh Hoài An</CardTitle>
                <div className="flex gap-2">
                  <OverviewDialog
                    scenes={scenes}
                    setScenes={setScenes}
                    schedules={schedules}
                    setSchedules={setSchedules}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      toast.success("Đã sao chép!", {
                        description:
                          "Code của phần này đã được sao chép vào clipboard.",
                        duration: 6000,
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="h-full p-4 pl-0 bg-slate-900 rounded-lg">
                {/* <pre className="p-4 h-full overflow-auto">{generatedCode}</pre> */}
                <CodeBlock
                  language="js"
                  code={generatedCode}
                  showCopyButton={false}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle className="font-bold">Các anh chú ý!</AlertTitle>
                <AlertDescription>
                  Phần code được tạo tự động có 2 nút chức năng là{" "}
                  <strong className="text-red-600">Copy</strong> và
                  <strong className="text-red-600"> Download</strong>. <br />
                  - Copy sẽ chỉ copy mã code của tab hiện tại, tức là chỉ Scene
                  hoặc chỉ Schedule. <br />- Download sẽ ghép cả hai phần này
                  lại và lưu lại thành file &apos;
                  <strong>scene-schedule.txt</strong>&apos;. <br />
                  <>
                    Các anh thêm scene & schedule xong xuôi rồi ấn{" "}
                    <strong className="text-red-600">Download</strong> và gửi
                    file này cho anh Hoài An là được.
                  </>
                </AlertDescription>
              </Alert>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
