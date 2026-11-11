import { useState, useEffect, useRef } from "react";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Connection,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";

import { loadBoard, saveBoard } from "./boardStorage";
import { socket } from "../../lib/socket";
import { apiRequest } from "../../lib/api";

const initialNodes: Node[] = [
  {
    id: "1",
    position: { x: 100, y: 100 },
    data: { label: "Start" },
  },
  {
    id: "2",
    position: { x: 400, y: 100 },
    data: { label: "Next Step" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
  },
];

type BoardData = {
  nodes: Node[];
  edges: Edge[];
};

type SaveAcknowledgement = {
  success: boolean;
  revision?: number;
  status?: number;
  message?: string;
  board?: BoardData;
};

function Board() {
  const [savedBoard] = useState(() => loadBoard());

  const [isBoardLoaded, setIsBoardLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved");

  const [nodes, setNodes] = useNodesState(savedBoard?.nodes ?? initialNodes);

  const [edges, setEdges] = useEdgesState(savedBoard?.edges ?? initialEdges);

  const [nodeCount, setNodeCount] = useState(2);

  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  const [newLabel, setNewLabel] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");

  const revisionRef = useRef<number | null>(null);
  const pendingBoardRef = useRef<BoardData | null>(null);
  const isSavingRef = useRef(false);
  const isBoardDirtyRef = useRef(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBoardSaveRef = useRef<() => void>(() => {});

  const flushBoardSave = () => {
    if (
      !isBoardLoaded ||
      revisionRef.current === null ||
      isSavingRef.current ||
      !isBoardDirtyRef.current ||
      !pendingBoardRef.current ||
      !socket.connected
    ) {
      return;
    }

    const boardToSave = pendingBoardRef.current;
    const revision = revisionRef.current;

    pendingBoardRef.current = null;
    isBoardDirtyRef.current = false;
    isSavingRef.current = true;

    setSaveStatus("Saving...");

    socket.timeout(10000).emit(
      "board-update",
      {
        ...boardToSave,
        revision,
      },
      (error: Error | null, acknowledgement: SaveAcknowledgement) => {
        isSavingRef.current = false;

        if (error || !acknowledgement) {
          if (!pendingBoardRef.current) {
            pendingBoardRef.current = boardToSave;
            isBoardDirtyRef.current = true;
          }

          setSaveStatus("Save failed");
          return;
        }

        if (!acknowledgement.success) {
          if (
            acknowledgement.status === 409 &&
            acknowledgement.board &&
            typeof acknowledgement.revision === "number"
          ) {
            revisionRef.current = acknowledgement.revision;

            pendingBoardRef.current = null;
            isBoardDirtyRef.current = false;

            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }

            setNodes(acknowledgement.board.nodes);
            setEdges(acknowledgement.board.edges);

            setNodeCount(
              acknowledgement.board.nodes.reduce(
                (highest, node) => Math.max(highest, Number(node.id) || 0),
                0,
              ),
            );

            setSaveStatus("Board changed elsewhere");
            return;
          }

          if (!pendingBoardRef.current) {
            pendingBoardRef.current = boardToSave;
            isBoardDirtyRef.current = true;
          }

          setSaveStatus("Save failed");
          return;
        }

        if (typeof acknowledgement.revision === "number") {
          revisionRef.current = acknowledgement.revision;
        }

        if (isBoardDirtyRef.current) {
          flushBoardSaveRef.current();
        } else {
          setSaveStatus("Saved");
        }
      },
    );
  };

  useEffect(() => {
    flushBoardSaveRef.current = flushBoardSave;
  });

  const queueBoardSave = (board: BoardData) => {
    pendingBoardRef.current = board;
    isBoardDirtyRef.current = true;

    setSaveStatus("Unsaved changes");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      flushBoardSaveRef.current();
    }, 500);
  };

  const handleNodesChange = (changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes);

    setNodes(updatedNodes);

    const hasDocumentChange = changes.some(
      (change) =>
        change.type === "position" ||
        change.type === "remove" ||
        change.type === "add" ||
        change.type === "replace",
    );

    if (hasDocumentChange) {
      queueBoardSave({
        nodes: updatedNodes,
        edges,
      });
    }
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, edges);

    setEdges(updatedEdges);

    const hasDocumentChange = changes.some(
      (change) =>
        change.type === "remove" ||
        change.type === "add" ||
        change.type === "replace",
    );

    if (hasDocumentChange) {
      queueBoardSave({
        nodes,
        edges: updatedEdges,
      });
    }
  };

  const hasSelectedNode = nodes.some((node) => node.selected);

  const saveHistory = () => {
    setPast((currentPast) => [...currentPast, { nodes, edges }]);

    setFuture([]);
  };

  const undo = () => {
    if (past.length === 0) {
      return;
    }

    const previousState = past[past.length - 1];

    setFuture((currentFuture) => [{ nodes, edges }, ...currentFuture]);

    setNodes(previousState.nodes);
    setEdges(previousState.edges);

    queueBoardSave({
      nodes: previousState.nodes,
      edges: previousState.edges,
    });

    setPast((currentPast) => currentPast.slice(0, -1));
  };

  const redo = () => {
    if (future.length === 0) {
      return;
    }

    const nextState = future[0];

    setPast((currentPast) => [...currentPast, { nodes, edges }]);

    setNodes(nextState.nodes);
    setEdges(nextState.edges);

    queueBoardSave({
      nodes: nextState.nodes,
      edges: nextState.edges,
    });

    setFuture((currentFuture) => currentFuture.slice(1));
  };

  const onConnect = (params: Connection) => {
    saveHistory();

    const updatedEdges = addEdge(params, edges);

    setEdges(updatedEdges);

    queueBoardSave({
      nodes,
      edges: updatedEdges,
    });
  };

  const onNodeClick = (_: React.MouseEvent, clickedNode: Node) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: node.id === clickedNode.id,
      })),
    );
  };

  const addNode = () => {
    saveHistory();

    const newNode: Node = {
      id: String(nodeCount + 1),
      position: {
        x: 100 + nodeCount * 50,
        y: 250,
      },
      data: {
        label: newNodeLabel.trim() || `New Node ${nodeCount + 1}`,
      },
    };

    const updatedNodes = [...nodes, newNode];

    setNodes(updatedNodes);

    queueBoardSave({
      nodes: updatedNodes,
      edges,
    });

    setNodeCount((count) => count + 1);
  };

  const deleteSelectedNodes = () => {
    if (!nodes.some((node) => node.selected)) {
      return;
    }

    saveHistory();

    const selectedNodeIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    );

    const updatedNodes = nodes.filter((node) => !selectedNodeIds.has(node.id));

    const updatedEdges = edges.filter(
      (edge) =>
        !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target),
    );

    setNodes(updatedNodes);
    setEdges(updatedEdges);

    queueBoardSave({
      nodes: updatedNodes,
      edges: updatedEdges,
    });
  };

  const updateSelectedNodeLabel = () => {
    const trimmedLabel = newLabel.trim();

    if (!trimmedLabel || !hasSelectedNode) {
      return;
    }

    saveHistory();

    const updatedNodes = nodes.map((node) =>
      node.selected
        ? {
            ...node,
            data: {
              ...node.data,
              label: trimmedLabel,
            },
          }
        : node,
    );

    setNodes(updatedNodes);

    queueBoardSave({
      nodes: updatedNodes,
      edges,
    });

    setNewLabel("");
  };

  // Listen for updates from other collaborators.
  useEffect(() => {
    const handleBoardUpdate = (board: {
      nodes: Node[];
      edges: Edge[];
      revision: number;
    }) => {
      revisionRef.current = board.revision;

      setNodes(board.nodes);
      setEdges(board.edges);

      const highestNodeNumber = board.nodes.reduce(
        (highest, node) => Math.max(highest, Number(node.id) || 0),
        0,
      );

      setNodeCount(highestNodeNumber);
    };

    const handleBoardSaved = (data: { revision: number }) => {
      revisionRef.current = data.revision;
    };

    socket.on("board-update", handleBoardUpdate);
    socket.on("board-saved", handleBoardSaved);

    return () => {
      socket.off("board-update", handleBoardUpdate);
      socket.off("board-saved", handleBoardSaved);
    };
  }, [setNodes, setEdges]);

  // Load the latest board and revision from the backend.
  useEffect(() => {
    let isActive = true;

    const loadBoardFromBackend = async () => {
      try {
        const data = await apiRequest("/api/boards");

        if (!isActive) {
          return;
        }

        if (data.board) {
          revisionRef.current = data.revision;

          setNodes(data.board.nodes);
          setEdges(data.board.edges);

          const highestNodeNumber = data.board.nodes.reduce(
            (highest: number, node: { id: string }) =>
              Math.max(highest, Number(node.id) || 0),
            0,
          );

          setNodeCount(highestNodeNumber);
        }
      } catch (error) {
        console.error(
          "Could not load board from backend. Using local storage instead:",
          error,
        );
      } finally {
        if (isActive) {
          setIsBoardLoaded(true);
        }
      }
    };

    loadBoardFromBackend();

    return () => {
      isActive = false;
    };
  }, [setNodes, setEdges]);

  // Save a local copy whenever the board changes.
  useEffect(() => {
    if (!isBoardLoaded) {
      return;
    }

    saveBoard({ nodes, edges });
  }, [nodes, edges, isBoardLoaded]);

  // Retry pending saves after the Socket.IO connection returns.
  useEffect(() => {
    const handleSocketConnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = setTimeout(() => {
        flushBoardSaveRef.current();
      }, 100);
    };

    socket.on("connect", handleSocketConnect);

    return () => {
      socket.off("connect", handleSocketConnect);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Clean up pending timers when the component unmounts.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Prevent edits while the initial backend load is in progress.
  if (!isBoardLoaded) {
    return (
      <div className="board-container">
        <p>Loading board...</p>
      </div>
    );
  }

  return (
    <div className="board-container">
      <div className="board-toolbar">
        <span className="save-status">Save status: {saveStatus}</span>

        <input
          type="text"
          placeholder="Name your new node"
          value={newNodeLabel}
          onChange={(event) => setNewNodeLabel(event.target.value)}
        />

        <button onClick={undo} disabled={past.length === 0}>
          Undo
        </button>

        <button onClick={redo} disabled={future.length === 0}>
          Redo
        </button>

        <button className="add-node-button" onClick={addNode}>
          + Add Node
        </button>

        <input
          type="text"
          placeholder="Enter new node label"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />

        <button
          onClick={updateSelectedNodeLabel}
          disabled={!hasSelectedNode || !newLabel.trim()}
        >
          Update Label
        </button>

        <button
          className="delete-node-button"
          onClick={deleteSelectedNodes}
          disabled={!hasSelectedNode}
        >
          Delete Selected Node
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        onNodesChange={handleNodesChange}
        onNodeDragStart={saveHistory}
        snapToGrid={true}
        snapGrid={[20, 20]}
        edges={edges}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        defaultEdgeOptions={{
          style: {
            stroke: "#38bdf8",
            strokeWidth: 2,
          },
        }}
      >
        <Background color="#334155" gap={24} size={1.2} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.selected) return "#f59e0b";
            return "#38bdf8";
          }}
          nodeStrokeColor="#e2e8f0"
          nodeStrokeWidth={2}
          maskColor="rgba(15, 23, 42, 0.75)"
          style={{
            backgroundColor: "#1e293b",
            border: "1px solid #475569",
            borderRadius: "12px",
            width: 220,
            height: 150,
          }}
          maskStrokeColor="#f8fafc"
          maskStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}

export default Board;
