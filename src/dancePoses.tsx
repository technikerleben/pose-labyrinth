import type { ReactNode } from 'react';

export type DancePoseId = 'tpose' | 'ypose' | 'touchdown' | 'left-up' | 'right-up';

export type DancePoseDef = {
  id: DancePoseId;
  name: string;
  tip: string;
  svg: ReactNode;
};

function BasePose({
  leftUpperArm,
  rightUpperArm,
  leftLowerArm,
  rightLowerArm,
}: {
  leftUpperArm: string;
  rightUpperArm: string;
  leftLowerArm: string;
  rightLowerArm: string;
}) {
  return (
    <svg viewBox="0 0 200 220" role="img" aria-label="Vereinfachte Körperpose">
      <rect x="0" y="0" width="200" height="220" rx="24" fill="#F5F4F1" />
      <circle cx="100" cy="38" r="18" fill="#D0DCE6" stroke="#2C3D4C" strokeWidth="6" />
      <path d="M100 58 L100 122" stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <path d={leftUpperArm} stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <path d={rightUpperArm} stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <path d={leftLowerArm} stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <path d={rightLowerArm} stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <path d="M100 122 L72 190" stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <path d="M100 122 L128 190" stroke="#2C3D4C" strokeWidth="10" strokeLinecap="round" />
      <circle cx="24" cy="72" r="6" fill="#D97A4A" />
      <circle cx="176" cy="72" r="6" fill="#D97A4A" />
    </svg>
  );
}

export const DANCE_POSES: DancePoseDef[] = [
  {
    id: 'tpose',
    name: 'T-Pose',
    tip: 'Beide Arme seitlich waagerecht ausstrecken.',
    svg: <BasePose leftUpperArm="M100 72 L52 72" rightUpperArm="M100 72 L148 72" leftLowerArm="M52 72 L24 72" rightLowerArm="M148 72 L176 72" />,
  },
  {
    id: 'ypose',
    name: 'Y-Pose',
    tip: 'Beide Arme schräg nach oben strecken.',
    svg: <BasePose leftUpperArm="M100 72 L65 45" rightUpperArm="M100 72 L135 45" leftLowerArm="M65 45 L40 20" rightLowerArm="M135 45 L160 20" />,
  },
  {
    id: 'touchdown',
    name: 'Touchdown',
    tip: 'Oberarme seitlich, Unterarme nach oben.',
    svg: <BasePose leftUpperArm="M100 72 L64 72" rightUpperArm="M100 72 L136 72" leftLowerArm="M64 72 L64 26" rightLowerArm="M136 72 L136 26" />,
  },
  {
    id: 'left-up',
    name: 'Links oben',
    tip: 'Linken Arm seitlich, rechten Arm schräg nach oben.',
    svg: <BasePose leftUpperArm="M100 72 L52 72" rightUpperArm="M100 72 L132 46" leftLowerArm="M52 72 L24 72" rightLowerArm="M132 46 L156 22" />,
  },
  {
    id: 'right-up',
    name: 'Rechts oben',
    tip: 'Rechten Arm seitlich, linken Arm schräg nach oben.',
    svg: <BasePose leftUpperArm="M100 72 L68 46" rightUpperArm="M100 72 L148 72" leftLowerArm="M68 46 L44 22" rightLowerArm="M148 72 L176 72" />,
  },
];
