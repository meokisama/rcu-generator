// Light definition
export interface Light {
  group: number;
  value: number;
  name: string;
}

// Scene definition
export interface Scene {
  name: string;
  amount: number;
  lights: Light[];
  isSequential: boolean;
  startGroup?: number;
}

// Schedule definition
export interface Schedule {
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
