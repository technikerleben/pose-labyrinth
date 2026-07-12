export type Action = 'left' | 'right' | 'up' | 'down' | 'neutral';

export type PoseClass = {
  id: string;
  name: string;
  action: Action;
  samples: number[][];
};

export type Prediction = {
  classId: string;
  name: string;
  action: Action;
  confidence: number;
};
