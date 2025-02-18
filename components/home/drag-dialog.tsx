import React, { useState } from "react";
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

const SortableItem: React.FC<SortableItemProps> = ({ id, children }) => {
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
};

const OverviewDialog: React.FC<OverviewDialogProps> = ({
  scenes,
  setScenes,
  schedules,
  setSchedules,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>("scenes");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateScheduleReferences = (
    oldScenes: Scene[],
    newScenes: Scene[],
    currentSchedules: Schedule[]
  ): Schedule[] => {
    // Create mapping of old positions to new positions
    const scenePositionMap = new Map<number, number>();
    oldScenes.forEach((scene, oldIndex) => {
      const newIndex = newScenes.findIndex(
        (newScene) => newScene.name === scene.name
      );
      scenePositionMap.set(oldIndex + 1, newIndex + 1);
    });

    // Update all schedule references
    return currentSchedules.map((schedule) => ({
      ...schedule,
      sceneGroup: schedule.sceneGroup.map(
        (oldSceneNumber) =>
          scenePositionMap.get(oldSceneNumber) || oldSceneNumber
      ),
    }));
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      if (activeTab === "scenes") {
        const oldScenes = [...scenes];
        const oldIndex = scenes.findIndex(
          (scene) => `scenes-${scene.name}` === active.id
        );
        const newIndex = scenes.findIndex(
          (scene) => `scenes-${scene.name}` === over?.id
        );

        const newScenes = [...scenes];
        const [removed] = newScenes.splice(oldIndex, 1);
        newScenes.splice(newIndex, 0, removed);

        // Update scenes and their references in schedules
        setScenes(newScenes);
        const updatedSchedules = updateScheduleReferences(
          oldScenes,
          newScenes,
          schedules
        );
        setSchedules(updatedSchedules);
      } else {
        // Handle schedule reordering
        const oldIndex = schedules.findIndex(
          (schedule) => `schedules-${schedule.name}` === active.id
        );
        const newIndex = schedules.findIndex(
          (schedule) => `schedules-${schedule.name}` === over?.id
        );

        const newSchedules = [...schedules];
        const [removed] = newSchedules.splice(oldIndex, 1);
        newSchedules.splice(newIndex, 0, removed);

        setSchedules(newSchedules);
      }
    }
  };

  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  };

  const getActiveDays = (schedule: Schedule): string => {
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
  };

  const getSceneNameById = (sceneId: number): string => {
    return scenes[sceneId - 1]?.name || `Scene ${sceneId}`;
  };

  const renderSceneItem = (scene: Scene, index: number): React.ReactNode => (
    <div>
      <h3 className="font-bold text-red-600">{scene.name}</h3>
      <div className="mt-2 text-sm text-gray-600">
        <p className="text-gray-400">Scene {index + 1}</p>
        <p>Số line đèn: {scene.amount}</p>
        <p>
          Chế độ:{" "}
          {scene.isSequential ? "Group đèn liên tục" : "Group đèn rời rạc"}
        </p>
        {scene.isSequential ? (
          <p>Group bắt đầu: {scene.startGroup}</p>
        ) : (
          <p>Groups: {scene.lights.map((light) => light.group).join(", ")}</p>
        )}
      </div>
    </div>
  );

  const renderScheduleItem = (schedule: Schedule): React.ReactNode => (
    <div>
      <h3 className="font-bold text-red-600">{schedule.name}</h3>
      <div className="mt-2 text-sm text-gray-600">
        <p>Trạng thái: {schedule.enable ? "Kích hoạt" : "Vô hiệu"}</p>
        <p>Thời gian: {formatTime(schedule.hour, schedule.minute)}</p>
        <p>
          Scenes:{" "}
          {schedule.sceneGroup.map((id) => getSceneNameById(id)).join(", ")}
        </p>
        <p>Ngày trong tuần: {getActiveDays(schedule)}</p>
      </div>
    </div>
  );

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
          <DialogTitle>Tổng quan Scene & Schedule</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex space-x-2 mb-4">
            <Button
              variant={activeTab === "scenes" ? "default" : "outline"}
              onClick={() => setActiveTab("scenes")}
              className="flex-1"
            >
              Scenes ({scenes.length})
            </Button>
            <Button
              variant={activeTab === "schedules" ? "default" : "outline"}
              onClick={() => setActiveTab("schedules")}
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
                <SortableContext
                  items={scenes.map((scene) => `scenes-${scene.name}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {scenes.map((scene, index) => (
                    <SortableItem
                      key={`scenes-${scene.name}`}
                      id={`scenes-${scene.name}`}
                    >
                      {renderSceneItem(scene, index)}
                    </SortableItem>
                  ))}
                </SortableContext>
              ) : (
                <SortableContext
                  items={schedules.map(
                    (schedule) => `schedules-${schedule.name}`
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  {schedules.map((schedule) => (
                    <SortableItem
                      key={`schedules-${schedule.name}`}
                      id={`schedules-${schedule.name}`}
                    >
                      {renderScheduleItem(schedule)}
                    </SortableItem>
                  ))}
                </SortableContext>
              )}
            </DndContext>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OverviewDialog;
