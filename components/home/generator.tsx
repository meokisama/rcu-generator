"use client";
import React, {
  useReducer,
  useCallback,
  useState,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
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
import { Copy, Download, Plus, Trash2, PenLine, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { CodeBlock } from "@/components/ui/code-block";
import { cloneDeep } from "lodash";
import { ErrorBoundary } from "react-error-boundary";
import LightList from "./light-list";

// Lazy loaded components
const OverviewDialog = lazy(() => import("@/components/home/drag-dialog"));

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

// State interface
interface State {
  scenes: Scene[];
  schedules: Schedule[];
  activeTab: string;
}

// Action types
type Action =
  | { type: "SET_ACTIVE_TAB"; tab: string }
  | { type: "SET_SCENES"; scenes: Scene[] }
  | { type: "SET_SCHEDULES"; schedules: Schedule[] }
  | { type: "ADD_SCENE"; scene: Scene }
  | { type: "UPDATE_SCENE"; index: number; scene: Partial<Scene> }
  | { type: "DELETE_SCENE"; index: number }
  | { type: "ADD_SCHEDULE"; schedule: Schedule }
  | { type: "UPDATE_SCHEDULE"; index: number; schedule: Partial<Schedule> }
  | { type: "DELETE_SCHEDULE"; index: number }
  | {
      type: "UPDATE_LIGHT";
      sceneIndex: number;
      lightIndex: number;
      light: Partial<Light>;
    }
  | { type: "ADD_LIGHT"; sceneIndex: number; light: Light }
  | { type: "DELETE_LIGHT"; sceneIndex: number; lightIndex: number };

// Separate reducer actions by domain
const sceneReducer = (scenes: Scene[], action: Action): Scene[] => {
  switch (action.type) {
    case "SET_SCENES":
      return action.scenes;
    case "ADD_SCENE":
      return [...scenes, action.scene];
    case "UPDATE_SCENE":
      return scenes.map((scene, idx) =>
        idx === action.index ? { ...scene, ...action.scene } : scene
      );
    case "DELETE_SCENE":
      return scenes.filter((_, idx) => idx !== action.index);
    case "UPDATE_LIGHT":
      return scenes.map((scene, sceneIdx) =>
        sceneIdx === action.sceneIndex
          ? {
              ...scene,
              lights: scene.lights.map((light, lightIdx) =>
                lightIdx === action.lightIndex
                  ? { ...light, ...action.light }
                  : light
              ),
            }
          : scene
      );
    case "ADD_LIGHT": {
      const newScenes = [...scenes];
      newScenes[action.sceneIndex] = {
        ...newScenes[action.sceneIndex],
        lights: [...newScenes[action.sceneIndex].lights, action.light],
        amount: newScenes[action.sceneIndex].lights.length + 1,
      };
      return newScenes;
    }
    case "DELETE_LIGHT": {
      const sceneIndex = action.sceneIndex;
      const lightIndex = action.lightIndex;

      if (scenes[sceneIndex].lights.length <= 1) {
        return scenes; // Don't delete the last light
      }

      const newScenes = [...scenes];
      newScenes[sceneIndex] = {
        ...newScenes[sceneIndex],
        lights: newScenes[sceneIndex].lights.filter(
          (_, idx) => idx !== lightIndex
        ),
        amount: newScenes[sceneIndex].lights.length - 1,
      };

      return newScenes;
    }
    default:
      return scenes;
  }
};

const scheduleReducer = (schedules: Schedule[], action: Action): Schedule[] => {
  switch (action.type) {
    case "SET_SCHEDULES":
      return action.schedules;
    case "ADD_SCHEDULE":
      return [...schedules, action.schedule];
    case "UPDATE_SCHEDULE":
      return schedules.map((schedule, idx) =>
        idx === action.index ? { ...schedule, ...action.schedule } : schedule
      );
    case "DELETE_SCHEDULE":
      return schedules.filter((_, idx) => idx !== action.index);
    case "DELETE_SCENE": {
      // Delete scene references in schedules when a scene is deleted
      const deletedSceneNumber = action.index + 1;
      return schedules.map((schedule) => {
        const newSceneGroup = schedule.sceneGroup
          .filter((group) => group !== deletedSceneNumber)
          .map((group) => (group > deletedSceneNumber ? group - 1 : group));

        return {
          ...schedule,
          sceneGroup: newSceneGroup,
          sceneAmount: newSceneGroup.length,
        };
      });
    }
    default:
      return schedules;
  }
};

// Combined reducer with optimized domain-specific reducers
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.tab };

    case "SET_SCENES":
    case "ADD_SCENE":
    case "UPDATE_SCENE":
    case "UPDATE_LIGHT":
    case "ADD_LIGHT":
    case "DELETE_LIGHT":
      return { ...state, scenes: sceneReducer(state.scenes, action) };

    case "SET_SCHEDULES":
    case "ADD_SCHEDULE":
    case "UPDATE_SCHEDULE":
      return { ...state, schedules: scheduleReducer(state.schedules, action) };

    case "DELETE_SCENE":
      return {
        ...state,
        scenes: sceneReducer(state.scenes, action),
        schedules: scheduleReducer(state.schedules, action),
      };

    case "DELETE_SCHEDULE":
      return { ...state, schedules: scheduleReducer(state.schedules, action) };

    default:
      return state;
  }
}

// Initial state
const initialState: State = {
  scenes: [
    {
      name: "Scene 1",
      amount: 1,
      lights: [{ group: 1, value: 100, name: "Đèn 1" }],
      isSequential: false,
    },
  ],
  schedules: [
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
  ],
  activeTab: "scene",
};

// Props for SceneItem component
interface SceneItemProps {
  scene: Scene;
  sceneIndex: number;
  handleSceneNameChange: (sceneIndex: number, name: string) => void;
  handleCopyScene: (sceneIndex: number) => void;
  handleDeleteScene: (sceneIndex: number) => void;
  handleSequentialToggle: (sceneIndex: number) => void;
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
  canDelete: boolean;
  handleBulkAddLights?: (sceneIndex: number, lights: Light[]) => void;
}

// Scene component for individual scene controls
const SceneItem = memo<SceneItemProps>(
  ({
    scene,
    sceneIndex,
    handleSceneNameChange,
    handleCopyScene,
    handleDeleteScene,
    handleSequentialToggle,
    handleAmountChange,
    handleStartGroupChange,
    handleLightChange,
    handleLightNameChange,
    handleDeleteLight,
    handleAddLight,
    canDelete,
    handleBulkAddLights,
  }) => {
    const onNameChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleSceneNameChange(sceneIndex, e.target.value);
      },
      [handleSceneNameChange, sceneIndex]
    );

    const onCopy = useCallback(() => {
      handleCopyScene(sceneIndex);
    }, [handleCopyScene, sceneIndex]);

    const onDelete = useCallback(() => {
      handleDeleteScene(sceneIndex);
    }, [handleDeleteScene, sceneIndex]);

    const onToggleSequential = useCallback(() => {
      handleSequentialToggle(sceneIndex);
    }, [handleSequentialToggle, sceneIndex]);

    return (
      <div>
        {sceneIndex >= 1 && (
          <div className="flex flex-col items-center gap-2 pointer-events-none select-none">
            <div className="w-px h-4 bg-gray-200" />
            <div className="px-4 py-1 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
              Scene #{sceneIndex + 1}
            </div>
            <div className="w-px h-4 bg-gray-200" />
          </div>
        )}
        <div className="border p-4 rounded-lg shadow-sm relative bg-[#f3f4f641]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 mr-6 lg:mr-12 relative">
              <PenLine className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                value={scene.name}
                onChange={onNameChange}
                className="font-bold text-red-600 lg:text-lg shadow-sm pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onCopy}
                className="shadow-sm"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={onDelete}
                  className="shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              checked={scene.isSequential}
              onCheckedChange={onToggleSequential}
            />
            <Label>Group đèn liên tục</Label>
          </div>
          <LightList
            scene={scene}
            sceneIndex={sceneIndex}
            handleAmountChange={handleAmountChange}
            handleStartGroupChange={handleStartGroupChange}
            handleLightChange={handleLightChange}
            handleLightNameChange={handleLightNameChange}
            handleDeleteLight={handleDeleteLight}
            handleAddLight={handleAddLight}
            handleBulkAddLights={handleBulkAddLights}
          />
        </div>
      </div>
    );
  }
);
SceneItem.displayName = "SceneItem";

// Props for ScheduleItem component
interface ScheduleItemProps {
  schedule: Schedule;
  scheduleIndex: number;
  scenes: Scene[];
  handleScheduleNameChange: (scheduleIndex: number, name: string) => void;
  handleCopySchedule: (scheduleIndex: number) => void;
  handleDeleteSchedule: (scheduleIndex: number) => void;
  handleScheduleChange: <K extends keyof Schedule>(
    scheduleIndex: number,
    field: K,
    value: Schedule[K]
  ) => void;
  handleSceneSelection: (
    scheduleIndex: number,
    selectedScenes: number[]
  ) => void;
  canDelete: boolean;
}

// Schedule component for individual schedule controls
const ScheduleItem = memo<ScheduleItemProps>(
  ({
    schedule,
    scheduleIndex,
    scenes,
    handleScheduleNameChange,
    handleCopySchedule,
    handleDeleteSchedule,
    handleScheduleChange,
    handleSceneSelection,
    canDelete,
  }) => {
    const onNameChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleScheduleNameChange(scheduleIndex, e.target.value);
      },
      [handleScheduleNameChange, scheduleIndex]
    );

    const onCopy = useCallback(() => {
      handleCopySchedule(scheduleIndex);
    }, [handleCopySchedule, scheduleIndex]);

    const onDelete = useCallback(() => {
      handleDeleteSchedule(scheduleIndex);
    }, [handleDeleteSchedule, scheduleIndex]);

    const onEnableChange = useCallback(
      (checked: boolean) => {
        handleScheduleChange(scheduleIndex, "enable", checked);
      },
      [handleScheduleChange, scheduleIndex]
    );

    const onHourChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleScheduleChange(
          scheduleIndex,
          "hour",
          parseInt(e.target.value) || 0
        );
      },
      [handleScheduleChange, scheduleIndex]
    );

    const onMinuteChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleScheduleChange(
          scheduleIndex,
          "minute",
          parseInt(e.target.value) || 0
        );
      },
      [handleScheduleChange, scheduleIndex]
    );

    const weekdays = useMemo(
      () =>
        [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ] as const,
      []
    );

    // Memoize the scene selection handler for each scene
    const createSceneSelectionHandler = useCallback(
      (sceneIndex: number) => (checked: boolean) => {
        const newSelection = checked
          ? [...schedule.sceneGroup, sceneIndex + 1].sort((a, b) => a - b)
          : schedule.sceneGroup.filter((num) => num !== sceneIndex + 1);
        handleSceneSelection(scheduleIndex, newSelection);
      },
      [schedule.sceneGroup, handleSceneSelection, scheduleIndex]
    );

    return (
      <div>
        {scheduleIndex >= 1 && (
          <div className="flex flex-col items-center gap-2 pointer-events-none select-none">
            <div className="w-px h-4 bg-gray-200" />
            <div className="px-4 py-1 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
              Schedule #{scheduleIndex + 1}
            </div>
            <div className="w-px h-4 bg-gray-200" />
          </div>
        )}
        <div className="border p-4 rounded-lg space-y-4 shadow-sm relative bg-[#f3f4f641]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 mr-6 lg:mr-12 relative">
              <PenLine className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                value={schedule.name}
                onChange={onNameChange}
                className="font-bold text-red-600 lg:text-lg shadow-sm pl-8"
              />
            </div>
            <div className="flex gap-2">
              {canDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={onDelete}
                  className="shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={onCopy}
                className="shadow-sm"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={schedule.enable}
              onCheckedChange={onEnableChange}
            />
            <Label>Kích hoạt</Label>
          </div>

          <div className="space-y-2">
            <Label>Chọn các Scene cho Schedule này:</Label>
            <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg bg-gray-50">
              {scenes.map((scene, i) => {
                const onSceneSelectionChange = createSceneSelectionHandler(i);
                return (
                  <div key={i} className="flex items-center space-x-2">
                    <Checkbox
                      checked={schedule.sceneGroup.includes(i + 1)}
                      onCheckedChange={onSceneSelectionChange}
                    />
                    <Label>{scene.name}</Label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Giờ kích hoạt:</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={schedule.hour}
                onChange={onHourChange}
              />
            </div>
            <div>
              <Label>Phút (nếu có):</Label>
              <Input
                type="number"
                min="0"
                max="59"
                value={schedule.minute}
                onChange={onMinuteChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {weekdays.map((day) => {
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const onDayChange = useCallback(
                (checked: boolean) => {
                  handleScheduleChange(scheduleIndex, day, checked);
                },
                [day]
              );

              return (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    checked={schedule[day]}
                    onCheckedChange={onDayChange}
                  />
                  <Label className="capitalize">{day}</Label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
ScheduleItem.displayName = "ScheduleItem";

const MemoizedCodeBlock = memo(CodeBlock);

interface OverviewDialogProps {
  scenes: Scene[];
  setScenes: (scenes: Scene[]) => void;
  schedules: Schedule[];
  setSchedules: (schedules: Schedule[]) => void;
}

// Main Component
export default function Generator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { scenes, schedules, activeTab } = state;

  const [generatedCode, setGeneratedCode] = useState<string>(
    "/*\n  Để tối ưu hiệu năng, chức năng tạo code thời gian thực sẽ bị loại bỏ.\n  Hiện tại nếu muốn xem code, hãy ấn nút Refresh ở cạnh nút Download.\n*/\n"
  );

  const generateScheduleCode = useCallback(() => {
    const sceneIndexMap = new Map<number, number[]>();
    let expandedIndex = 0;

    scenes.forEach((scene, originalIndex) => {
      if (!scene.isSequential && scene.lights.length > 60) {
        const parts = Math.ceil(scene.lights.length / 60);
        const indices = [];
        for (let i = 0; i < parts; i++) {
          indices.push(expandedIndex++);
        }
        sceneIndexMap.set(originalIndex + 1, indices);
      } else {
        sceneIndexMap.set(originalIndex + 1, [expandedIndex++]);
      }
    });

    return schedules
      .map((schedule, index) => {
        let code = `// ${schedule.name}\n`;
        code += `schedule[${index}].enable = ${schedule.enable ? 1 : 0};\n`;
        const expandedSceneGroups: number[] = [];
        schedule.sceneGroup.forEach((originalSceneIndex) => {
          const expandedIndices = sceneIndexMap.get(originalSceneIndex) || [];
          expandedSceneGroups.push(...expandedIndices);
        });

        code += `schedule[${index}].sceneAmount = ${expandedSceneGroups.length};\n`;

        expandedSceneGroups.forEach((group, groupIndex) => {
          code += `schedule[${index}].sceneGroup[${groupIndex}] = ${
            group + 1
          };\n`;
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
        code += `schedule[${index}].minute = ${schedule.minute};\n`;

        return code + "\n";
      })
      .join("");
  }, [scenes, schedules]);

  // Handler functions with memoization
  const handleSceneNameChange = useCallback(
    (sceneIndex: number, name: string) => {
      dispatch({ type: "UPDATE_SCENE", index: sceneIndex, scene: { name } });
    },
    []
  );

  const handleScheduleNameChange = useCallback(
    (scheduleIndex: number, name: string) => {
      dispatch({
        type: "UPDATE_SCHEDULE",
        index: scheduleIndex,
        schedule: { name },
      });
    },
    []
  );

  const handleCopyScene = useCallback(
    (sceneIndex: number) => {
      const sceneToCopy = cloneDeep(scenes[sceneIndex]);
      const newScene = {
        ...sceneToCopy,
        name: `${sceneToCopy.name} (Copy)`,
      };
      dispatch({ type: "ADD_SCENE", scene: newScene });
      toast.success("Sao chép scene thành công!", {
        description: "Scene được sao chép sẽ nằm ở cuối danh sách.",
        duration: 6000,
      });
    },
    [scenes]
  );

  const handleCopySchedule = useCallback(
    (scheduleIndex: number) => {
      const scheduleToCopy = cloneDeep(schedules[scheduleIndex]);
      const newSchedule = {
        ...scheduleToCopy,
        name: `${scheduleToCopy.name} (Copy)`,
      };
      dispatch({ type: "ADD_SCHEDULE", schedule: newSchedule });
      toast.success("Sao chép schedule thành công!", {
        description: "Schedule được sao chép sẽ nằm ở cuối danh sách.",
        duration: 6000,
      });
    },
    [schedules]
  );

  const handleAmountChange = useCallback(
    (sceneIndex: number, value: string) => {
      const amount = parseInt(value) || 1;
      const scene = scenes[sceneIndex];

      if (scene.isSequential) {
        dispatch({
          type: "UPDATE_SCENE",
          index: sceneIndex,
          scene: { amount },
        });
      } else {
        // Adjust lights array based on new amount
        let updatedLights = [...scene.lights];

        if (amount > scene.lights.length) {
          // Add new lights
          while (updatedLights.length < amount) {
            const newIndex = updatedLights.length + 1;
            updatedLights.push({
              group: 1,
              value: 100,
              name: `Đèn ${newIndex}`,
            });
          }
        } else {
          // Remove excess lights
          updatedLights = updatedLights.slice(0, amount);
        }

        dispatch({
          type: "UPDATE_SCENE",
          index: sceneIndex,
          scene: { amount, lights: updatedLights },
        });
      }
    },
    [scenes]
  );

  const handleSequentialToggle = useCallback(
    (sceneIndex: number) => {
      const scene = scenes[sceneIndex];
      const isSequential = !scene.isSequential;
      let updates: Partial<Scene> = { isSequential };

      if (isSequential) {
        updates = {
          ...updates,
          startGroup: 1,
          lights: [{ group: 1, value: 100, name: "Đèn 1" }],
        };
      }

      dispatch({ type: "UPDATE_SCENE", index: sceneIndex, scene: updates });
    },
    [scenes]
  );

  const handleStartGroupChange = useCallback(
    (sceneIndex: number, value: string) => {
      const startGroup = parseInt(value) || 1;
      dispatch({
        type: "UPDATE_SCENE",
        index: sceneIndex,
        scene: { startGroup },
      });
    },
    []
  );

  const handleLightChange = useCallback(
    (
      sceneIndex: number,
      lightIndex: number,
      field: "group" | "value",
      value: string
    ) => {
      const updatedValue = parseInt(value) || 0;
      dispatch({
        type: "UPDATE_LIGHT",
        sceneIndex,
        lightIndex,
        light: { [field]: updatedValue },
      });
    },
    []
  );

  const handleLightNameChange = useCallback(
    (sceneIndex: number, lightIndex: number, name: string) => {
      dispatch({
        type: "UPDATE_LIGHT",
        sceneIndex,
        lightIndex,
        light: { name },
      });
    },
    []
  );

  const handleAddLight = useCallback(
    (sceneIndex: number) => {
      const newLightIndex = scenes[sceneIndex].lights.length + 1;
      dispatch({
        type: "ADD_LIGHT",
        sceneIndex,
        light: {
          group: 1,
          value: 100,
          name: `Đèn ${newLightIndex}`,
        },
      });
      toast.success("Thêm line đèn thành công!", {
        description: "Line đèn mới đã được thêm vào danh sách.",
        duration: 6000,
      });
    },
    [scenes]
  );

  const handleDeleteLight = useCallback(
    (sceneIndex: number, lightIndex: number) => {
      if (scenes[sceneIndex].lights.length > 1) {
        dispatch({
          type: "DELETE_LIGHT",
          sceneIndex,
          lightIndex,
        });
        toast.success("Đã xóa line đèn!", {
          description: "Line đèn đã được xóa khỏi danh sách.",
          duration: 6000,
        });
      }
    },
    [scenes]
  );

  const handleScheduleChange = useCallback(
    <K extends keyof Schedule>(
      scheduleIndex: number,
      field: K,
      value: Schedule[K]
    ) => {
      if (field === "sceneAmount") {
        // Need to type cast value since TypeScript doesn't know we're comparing the field
        const amount =
          typeof value === "number" ? value : parseInt(String(value)) || 1;
        const schedule = schedules[scheduleIndex];

        // Adjust sceneGroup array
        let newSceneGroup = [...schedule.sceneGroup];
        if (amount > schedule.sceneGroup.length) {
          while (newSceneGroup.length < amount) {
            newSceneGroup.push(1);
          }
        } else {
          newSceneGroup = newSceneGroup.slice(0, amount);
        }

        dispatch({
          type: "UPDATE_SCHEDULE",
          index: scheduleIndex,
          schedule: {
            sceneAmount: amount,
            sceneGroup: newSceneGroup,
          } as Partial<Schedule>,
        });
      } else {
        dispatch({
          type: "UPDATE_SCHEDULE",
          index: scheduleIndex,
          schedule: { [field]: value } as Partial<Schedule>,
        });
      }
    },
    [schedules]
  );

  const handleSceneSelection = useCallback(
    (scheduleIndex: number, selectedScenes: number[]) => {
      dispatch({
        type: "UPDATE_SCHEDULE",
        index: scheduleIndex,
        schedule: {
          sceneAmount: selectedScenes.length,
          sceneGroup: selectedScenes,
        },
      });
    },
    []
  );

  const handleAddScene = useCallback(() => {
    dispatch({
      type: "ADD_SCENE",
      scene: {
        name: `Scene ${scenes.length + 1}`,
        amount: 1,
        lights: [{ group: 1, value: 100, name: "Đèn 1" }],
        isSequential: false,
      },
    });
    toast.success("Thêm scene mới thành công!", {
      description: "Scene được tạo sẽ nằm ở cuối danh sách.",
      duration: 6000,
    });
  }, [scenes.length]);

  const handleAddSchedule = useCallback(() => {
    dispatch({
      type: "ADD_SCHEDULE",
      schedule: {
        name: `Schedule ${schedules.length + 1}`,
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
    });
    toast.success("Thêm schedule mới thành công!", {
      description: "Schedule được tạo sẽ nằm ở cuối danh sách.",
      duration: 6000,
    });
  }, [schedules.length]);

  const handleDeleteScene = useCallback(
    (sceneIndex: number) => {
      if (scenes.length > 1) {
        dispatch({ type: "DELETE_SCENE", index: sceneIndex });
        toast.success("Đã xóa scene!", {
          description: "Scene đã được xóa khỏi danh sách.",
          duration: 6000,
        });
      }
    },
    [scenes.length]
  );

  const handleDeleteSchedule = useCallback(
    (scheduleIndex: number) => {
      if (schedules.length > 1) {
        dispatch({ type: "DELETE_SCHEDULE", index: scheduleIndex });
        toast.success("Đã xóa schedule!", {
          description: "Schedule đã được xóa khỏi danh sách.",
          duration: 6000,
        });
      }
    },
    [schedules.length]
  );

  const handleTabChange = useCallback((value: string) => {
    dispatch({ type: "SET_ACTIVE_TAB", tab: value });
  }, []);

  const splitSceneForCodeGeneration = (scene: Scene): Scene[] => {
    if (!scene.isSequential && scene.lights.length > 60) {
      const numberOfScenes = Math.ceil(scene.lights.length / 60);
      const result: Scene[] = [];

      for (let i = 0; i < numberOfScenes; i++) {
        const startIndex = i * 60;
        const endIndex = Math.min((i + 1) * 60, scene.lights.length);
        const sceneLights = scene.lights.slice(startIndex, endIndex);

        result.push({
          ...scene,
          name: i === 0 ? scene.name : `${scene.name} (phần ${i + 1})`,
          amount: sceneLights.length,
          lights: sceneLights,
        });
      }

      return result;
    }
    return [scene];
  };

  const generateOptimizedSceneCode = useCallback((scenes: Scene[]): string => {
    const expandedScenes: Scene[] = [];
    scenes.forEach((scene) => {
      expandedScenes.push(...splitSceneForCodeGeneration(scene));
    });

    return expandedScenes
      .map((scene, sceneIndex) => {
        let code = `// ${scene.name}\n`;
        code += `sceneObj[${sceneIndex}].amount = ${scene.amount};\n`;

        if (scene.isSequential) {
          code += `for(i=0; i<sceneObj[${sceneIndex}].amount; i++) {\n`;
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
        return code + "\n";
      })
      .join("");
  }, []);

  const handleRefresh = useCallback(() => {
    const sceneCode = generateOptimizedSceneCode(scenes);
    const scheduleCode = generateScheduleCode();
    const fullCode = `// Scene Configuration\n${sceneCode}\n// Schedule Configuration\n${scheduleCode}`;

    setGeneratedCode(fullCode);
  }, [generateOptimizedSceneCode, generateScheduleCode, scenes]);

  const handleDownload = useCallback(() => {
    const sceneCode = generateOptimizedSceneCode(scenes);
    const scheduleCode = generateScheduleCode();

    const scenesWithManyLights = scenes.filter(
      (scene) => !scene.isSequential && scene.lights.length > 60
    );

    const fullCode = `// Scene Configuration\n${sceneCode}\n// Schedule Configuration\n${scheduleCode}`;

    setGeneratedCode(fullCode);

    if (scenesWithManyLights.length > 0) {
      const sceneNames = scenesWithManyLights
        .map((scene) => scene.name)
        .join(", ");
      const totalScenesAfterSplit =
        scenes.length +
        scenesWithManyLights.reduce(
          (acc, scene) => acc + Math.ceil(scene.lights.length / 60) - 1,
          0
        );

      toast.info("Một số scene đã được tách khi tạo code!", {
        description: `${sceneNames} có nhiều hơn 60 đèn và đã được tách thành nhiều scene trong code. Tổng số scene trong code: ${totalScenesAfterSplit}.`,
        duration: 8000,
      });
    }

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
  }, [generateOptimizedSceneCode, generateScheduleCode, scenes]);

  // Memoized CodeBlock props to prevent re-renders when unrelated state changes
  const codeBlockProps = useMemo(() => {
    return {
      language: "js",
      code: generatedCode,
      showCopyButton: false,
    };
  }, [generatedCode]);

  // Memoized props for OverviewDialog
  const overviewDialogProps = useMemo((): OverviewDialogProps => {
    return {
      scenes,
      setScenes: (newScenes) =>
        dispatch({ type: "SET_SCENES", scenes: newScenes }),
      schedules,
      setSchedules: (newSchedules) =>
        dispatch({ type: "SET_SCHEDULES", schedules: newSchedules }),
    };
  }, [scenes, schedules]);

  const handleBulkAddLights = useCallback(
    (sceneIndex: number, newLights: Light[]) => {
      if (newLights.length === 0) return;

      const currentScene = scenes[sceneIndex];
      const updatedScene = cloneDeep(currentScene);

      updatedScene.lights = [...updatedScene.lights, ...newLights];
      updatedScene.amount = updatedScene.lights.length;

      dispatch({
        type: "UPDATE_SCENE",
        index: sceneIndex,
        scene: updatedScene,
      });

      toast.success(`Đã thêm ${newLights.length} đèn vào scene!`, {
        description: "Các đèn mới đã được thêm vào danh sách.",
        duration: 6000,
      });
    },
    [scenes]
  );

  // Render scenes list memoized
  const renderScenes = useMemo(() => {
    return scenes.map((scene, sceneIndex) => (
      <SceneItem
        key={sceneIndex}
        scene={scene}
        sceneIndex={sceneIndex}
        handleSceneNameChange={handleSceneNameChange}
        handleCopyScene={handleCopyScene}
        handleDeleteScene={handleDeleteScene}
        handleSequentialToggle={handleSequentialToggle}
        handleAmountChange={handleAmountChange}
        handleStartGroupChange={handleStartGroupChange}
        handleLightChange={handleLightChange}
        handleLightNameChange={handleLightNameChange}
        handleDeleteLight={handleDeleteLight}
        handleAddLight={handleAddLight}
        canDelete={scenes.length > 1}
        handleBulkAddLights={handleBulkAddLights}
      />
    ));
  }, [
    scenes,
    handleSceneNameChange,
    handleCopyScene,
    handleDeleteScene,
    handleSequentialToggle,
    handleAmountChange,
    handleStartGroupChange,
    handleLightChange,
    handleLightNameChange,
    handleDeleteLight,
    handleAddLight,
    handleBulkAddLights,
  ]);

  // Render schedules list memoized
  const renderSchedules = useMemo(() => {
    return schedules.map((schedule, scheduleIndex) => (
      <ScheduleItem
        key={scheduleIndex}
        schedule={schedule}
        scheduleIndex={scheduleIndex}
        scenes={scenes}
        handleScheduleNameChange={handleScheduleNameChange}
        handleCopySchedule={handleCopySchedule}
        handleDeleteSchedule={handleDeleteSchedule}
        handleScheduleChange={handleScheduleChange}
        handleSceneSelection={handleSceneSelection}
        canDelete={schedules.length > 1}
      />
    ));
  }, [
    schedules,
    scenes,
    handleScheduleNameChange,
    handleCopySchedule,
    handleDeleteSchedule,
    handleScheduleChange,
    handleSceneSelection,
  ]);

  // Loading fallback for lazy components
  const loadingFallback = useMemo(
    () => (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    ),
    []
  );

  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-red-500">
          Đã xảy ra lỗi! Vui lòng tải lại trang.
        </div>
      }
    >
      <div className="p-4 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Input Form */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
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
                    <Alert className="mb-4 shadow-sm">
                      <Terminal className="h-4 w-4" />
                      <AlertTitle className="font-bold">Ghi chú!</AlertTitle>
                      <AlertDescription>
                        <p>
                          Không cần tách ra 60 line đèn cho mỗi scene, hãy{" "}
                          <strong className="text-red-600">
                            nhập hết toàn bộ
                          </strong>{" "}
                          mọi line đèn cho scene tương ứng luôn để dễ quản lý,
                          hệ thống sẽ làm hết phần còn lại.
                        </p>
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-0">{renderScenes}</div>
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
                    <div className="space-y-0">{renderSchedules}</div>
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
                    <Suspense fallback={loadingFallback}>
                      <OverviewDialog {...overviewDialogProps} />
                    </Suspense>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRefresh}
                    >
                      <RefreshCw className="h-4 w-4" />
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
                  <MemoizedCodeBlock {...codeBlockProps} />
                </div>
              </CardContent>
              <CardFooter>
                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle className="font-bold">Ghi chú!</AlertTitle>
                  <AlertDescription>
                    <p>
                      - Nhấn nút{" "}
                      <strong className="text-red-600">Refresh</strong> để xem
                      code đã được tạo nếu muốn.
                    </p>
                    <p>
                      - Sau khi thêm scene & schedule xong xuôi toàn bộ, nhấn{" "}
                      <strong className="text-red-600">Download</strong> và gửi
                      file này cho anh Hoài An là được.
                    </p>
                  </AlertDescription>
                </Alert>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
