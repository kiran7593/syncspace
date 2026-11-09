import { useState } from "react";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Connection,
} from "@xyflow/react";

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

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
  },
];

function Board() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeCount, setNodeCount] = useState(2);
  const [newLabel, setNewLabel] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");

  const hasSelectedNode = nodes.some((node) => node.selected);

  const onConnect = (params: Connection) => {
    setEdges((currentEdges) => addEdge(params, currentEdges));
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

    setNodes((currentNodes) => [...currentNodes, newNode]);
    setNodeCount((count) => count + 1);
  };

  const deleteSelectedNodes = () => {
    const selectedNodeIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    );

    setNodes((currentNodes) =>
      currentNodes.filter((node) => !selectedNodeIds.has(node.id)),
    );

    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target),
      ),
    );
  };

  const updateSelectedNodeLabel = () => {
    const trimmedLabel = newLabel.trim();

    if (!trimmedLabel) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.selected
          ? {
              ...node,
              data: {
                ...node.data,
                label: trimmedLabel,
              },
            }
          : node,
      ),
    );

    setNewLabel("");
  };

  return (
    <div className="board-container">
      <div className="board-toolbar">
        <input
          type="text"
          placeholder="Name your new node"
          value={newNodeLabel}
          onChange={(event) => setNewNodeLabel(event.target.value)}
        />

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
        onNodesChange={onNodesChange}
        snapToGrid={true}
        snapGrid={[20, 20]}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default Board;
