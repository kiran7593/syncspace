import type { Node, Edge } from "@xyflow/react";

const STORAGE_KEY = "syncspace-board";

export type BoardData = {
  nodes: Node[];
  edges: Edge[];
};

export const saveBoard = (board: BoardData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
};

export const loadBoard = (): BoardData | null => {
  const savedBoard = localStorage.getItem(STORAGE_KEY);

  if (!savedBoard) {
    return null;
  }

  try {
    return JSON.parse(savedBoard) as BoardData;
  } catch {
    console.error("Could not load the saved board.");
    return null;
  }
};