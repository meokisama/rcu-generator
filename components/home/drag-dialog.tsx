import React, { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

interface OverviewDialogProps {
  scenes: Scene[];
  setScenes: (scenes: Scene[]) => void;
  schedules: Schedule[];
  setSchedules: (schedules: Schedule[]) => void;
}

type TabType = "scenes" | "schedules";

const SortableItem = React.memo<SortableItemProps>(({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg shadow-sm mb-2 cursor-move border hover:border-blue-500 transition-colors"
    >
      {children}
    </div>
  );
});
SortableItem.displayName = "SortableItem";

const OverviewDialog: React.FC<OverviewDialogProps> = ({
  scenes,
  setScenes,
  schedules,
  setSchedules,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>("scenes");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateScheduleReferences = useCallback(
    (
      oldScenes: Scene[],
      newScenes: Scene[],
      currentSchedules: Schedule[]
    ): Schedule[] => {
      const scenePositionMap = new Map<number, number>();

      oldScenes.forEach((scene, oldIndex) => {
        const newIndex = newScenes.findIndex(
          (newScene) =>
            newScene.name === scene.name &&
            JSON.stringify(newScene.lights) === JSON.stringify(scene.lights)
        );

        if (newIndex !== -1) {
          scenePositionMap.set(oldIndex + 1, newIndex + 1);
        }
      });

      return currentSchedules.map((schedule) => ({
        ...schedule,
        sceneGroup: schedule.sceneGroup
          .map((oldSceneNumber) =>
            scenePositionMap.has(oldSceneNumber)
              ? scenePositionMap.get(oldSceneNumber)
              : oldSceneNumber
          )
          .filter((num): num is number => num !== undefined),
      }));
    },
    []
  );

  // Handle drag end with memoization
  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        if (activeTab === "scenes") {
          const oldScenes = [...scenes];
          const oldIndex = scenes.findIndex(
            (scene, idx) => `scenes-${scene.name}-${idx}` === active.id
          );

          const newIndex = scenes.findIndex(
            (scene, idx) => `scenes-${scene.name}-${idx}` === over.id
          );

          if (oldIndex !== -1 && newIndex !== -1) {
            const newScenes = [...scenes];
            const [movedScene] = newScenes.splice(oldIndex, 1);
            newScenes.splice(newIndex, 0, movedScene);

            setScenes(newScenes);

            const updatedSchedules = updateScheduleReferences(
              oldScenes,
              newScenes,
              schedules
            );
            setSchedules(updatedSchedules);
          }
        } else {
          const oldIndex = schedules.findIndex(
            (schedule, idx) => `schedules-${schedule.name}-${idx}` === active.id
          );

          const newIndex = schedules.findIndex(
            (schedule, idx) => `schedules-${schedule.name}-${idx}` === over.id
          );

          // Ensure both indices are valid before proceeding
          if (oldIndex !== -1 && newIndex !== -1) {
            const newSchedules = [...schedules];
            const [movedSchedule] = newSchedules.splice(oldIndex, 1);
            newSchedules.splice(newIndex, 0, movedSchedule);

            setSchedules(newSchedules);
          }
        }
      }
    },
    [
      activeTab,
      scenes,
      schedules,
      setScenes,
      setSchedules,
      updateScheduleReferences,
    ]
  );

  const formatTime = useCallback((hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const getActiveDays = useCallback((schedule: Schedule): string => {
    const days: { [key: string]: boolean } = {
      T2: schedule.monday,
      T3: schedule.tuesday,
      T4: schedule.wednesday,
      T5: schedule.thursday,
      T6: schedule.friday,
      T7: schedule.saturday,
      CN: schedule.sunday,
    };

    return (
      Object.entries(days)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, active]) => active)
        .map(([day]) => day)
        .join(", ")
    );
  }, []);

  const getSceneNameById = useCallback(
    (sceneId: number): string => {
      if (sceneId <= 0 || sceneId > scenes.length) {
        return `Unknown Scene`;
      }
      const scene = scenes[sceneId - 1];
      return scene?.name || `Scene ${sceneId}`;
    },
    [scenes]
  );

  const renderSceneItem = useCallback(
    (scene: Scene, index: number): React.ReactNode => (
      <div className="relative">
        <h3 className="font-bold text-red-600">{scene.name}</h3>
        <p className="text-gray-400 absolute right-0 top-0"># {index + 1}</p>
        <div className="mt-2 text-sm text-gray-600 lg:leading-8">
          <p>
            - Gồm <span className="font-semibold">{scene.amount}</span> line
            đèn.
          </p>
          {scene.isSequential ? (
            <p>
              - Với các group từ{" "}
              <span className="bg-slate-200 px-2 py-1 text-gray-500 rounded-sm">
                {scene.startGroup || 1}
              </span>{" "}
              đến{" "}
              <span className="bg-slate-200 px-2 py-1 text-gray-500 rounded-sm">
                {(scene.startGroup || 1) + scene.amount - 1}
              </span>
            </p>
          ) : (
            <p>
              - Với các group:{" "}
              {scene.lights.map((light, i) => (
                <span
                  key={i}
                  className="bg-slate-200 px-2 py-1 text-gray-500 rounded-sm mr-1"
                >
                  {light.group}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    ),
    []
  );

  const renderScheduleItem = useCallback(
    (schedule: Schedule, index: number): React.ReactNode => (
      <div className="relative">
        <p className="text-gray-400 absolute right-0 top-0"># {index + 1}</p>
        <h3 className="font-bold text-red-600">{schedule.name}</h3>
        <div className="mt-2 text-sm text-gray-600 lg:leading-8">
          <p>
            - Kích hoạt vào{" "}
            <span className="font-bold">
              {formatTime(schedule.hour, schedule.minute)}
            </span>{" "}
            các ngày{" "}
            <span className="font-bold">{getActiveDays(schedule)}</span>
          </p>
          <p>
            - Gồm các scene:{" "}
            {schedule.sceneGroup.length > 0 ? (
              schedule.sceneGroup.map((id, i) => (
                <span
                  key={i}
                  className="bg-slate-200 px-2 py-1 text-gray-500 rounded-sm mr-1"
                >
                  {getSceneNameById(id)}
                </span>
              ))
            ) : (
              <span className="text-gray-400">Chưa chọn scene nào</span>
            )}
          </p>
        </div>
      </div>
    ),
    [formatTime, getActiveDays, getSceneNameById]
  );

  const sceneIds = useMemo(
    () => scenes.map((scene, idx) => `scenes-${scene.name}-${idx}`),
    [scenes]
  );

  const scheduleIds = useMemo(
    () => schedules.map((schedule, idx) => `schedules-${schedule.name}-${idx}`),
    [schedules]
  );

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <List className="h-4 w-4" />
          Tổng quan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-center">
            Scene & Schedule đã tạo
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex space-x-2 mb-4">
            <Button
              variant={activeTab === "scenes" ? "default" : "outline"}
              onClick={() => handleTabChange("scenes")}
              className="flex-1"
            >
              Scenes ({scenes.length})
            </Button>
            <Button
              variant={activeTab === "schedules" ? "default" : "outline"}
              onClick={() => handleTabChange("schedules")}
              className="flex-1"
            >
              Schedules ({schedules.length})
            </Button>
          </div>

          <div className="overflow-y-auto max-h-[60vh] p-4 bg-gray-50 rounded-lg">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {activeTab === "scenes" ? (
                scenes.length > 0 ? (
                  <SortableContext
                    items={sceneIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {scenes.map((scene, index) => (
                      <SortableItem key={sceneIds[index]} id={sceneIds[index]}>
                        {renderSceneItem(scene, index)}
                      </SortableItem>
                    ))}
                  </SortableContext>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    Không có Scene nào được tạo.
                  </div>
                )
              ) : schedules.length > 0 ? (
                <SortableContext
                  items={scheduleIds}
                  strategy={verticalListSortingStrategy}
                >
                  {schedules.map((schedule, index) => (
                    <SortableItem
                      key={scheduleIds[index]}
                      id={scheduleIds[index]}
                    >
                      {renderScheduleItem(schedule, index)}
                    </SortableItem>
                  ))}
                </SortableContext>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  Không có Schedule nào được tạo.
                </div>
              )}
            </DndContext>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(OverviewDialog);
