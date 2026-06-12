"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { posBetween } from "@/lib/position";
import { startTimer } from "@/lib/timer";
import type { BoardColumn, Membership, Task } from "@/lib/types";
import BoardCard from "@/components/BoardCard";
import CardModal from "@/components/CardModal";

type CardsByCol = Record<string, Task[]>;

const COL_PREFIX = "col:";

function colDndId(id: string) {
  return `${COL_PREFIX}${id}`;
}

function isColId(id: string) {
  return id.startsWith(COL_PREFIX);
}

function stripCol(id: string) {
  return id.slice(COL_PREFIX.length);
}

export default function BoardView({
  wsId,
  projectId,
  projectName,
  userId,
}: {
  wsId: string;
  projectId: string;
  projectName: string;
  userId: string;
}) {
  const supabase = createClient();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [cards, setCards] = useState<CardsByCol>({});
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [activeCard, setActiveCard] = useState<Task | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = useCallback(async () => {
    const [colRes, taskRes, memRes] = await Promise.all([
      supabase
        .from("board_columns")
        .select("*")
        .eq("project_id", projectId)
        .order("position"),
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position"),
      supabase
        .from("workspace_members")
        .select("user_id, role, profiles(id, email, full_name, is_super_admin)")
        .eq("workspace_id", wsId),
    ]);
    const cols = (colRes.data as BoardColumn[]) ?? [];
    const tasks = (taskRes.data as Task[]) ?? [];
    const byCol: CardsByCol = {};
    for (const col of cols) byCol[col.id] = [];
    for (const task of tasks) {
      if (task.column_id && byCol[task.column_id]) byCol[task.column_id].push(task);
      else if (cols[0]) byCol[cols[0].id].push(task); // karty bez sloupce → první sloupec
    }
    setColumns(cols);
    setCards(byCol);
    setMembers((memRes.data as unknown as Membership[]) ?? []);
    setLoading(false);
  }, [supabase, projectId, wsId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------------------------------------------------------------- sloupce

  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    const last = columns[columns.length - 1];
    await supabase.from("board_columns").insert({
      workspace_id: wsId,
      project_id: projectId,
      name: newColumnName.trim(),
      position: posBetween(last?.position, undefined),
    });
    setNewColumnName("");
    load();
  }

  async function renameColumn(col: BoardColumn) {
    const name = prompt("Název sloupce:", col.name);
    if (!name?.trim() || name.trim() === col.name) return;
    await supabase.from("board_columns").update({ name: name.trim() }).eq("id", col.id);
    load();
  }

  async function deleteColumn(col: BoardColumn) {
    if ((cards[col.id] ?? []).length > 0) {
      alert("Sloupec není prázdný — nejdřív přesuň karty jinam.");
      return;
    }
    if (!confirm(`Smazat sloupec „${col.name}"?`)) return;
    await supabase.from("board_columns").delete().eq("id", col.id);
    load();
  }

  // ---------------------------------------------------------------- karty

  async function addCard(colId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    const list = cards[colId] ?? [];
    await supabase.from("tasks").insert({
      workspace_id: wsId,
      project_id: projectId,
      column_id: colId,
      title: newCardTitle.trim(),
      position: posBetween(list[list.length - 1]?.position, undefined),
    });
    setNewCardTitle("");
    load();
  }

  function findColumnOf(cardId: string): string | undefined {
    return Object.keys(cards).find((colId) =>
      cards[colId].some((t) => t.id === cardId)
    );
  }

  // ---------------------------------------------------------------- drag & drop

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (!isColId(id)) {
      const colId = findColumnOf(id);
      setActiveCard(cards[colId ?? ""]?.find((t) => t.id === id) ?? null);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (isColId(activeId)) return; // přesun sloupců řeší až dragEnd

    const fromCol = findColumnOf(activeId);
    const toCol = isColId(overId) ? stripCol(overId) : findColumnOf(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;

    // optimistický přesun mezi sloupci, ať je vidět "díra"
    setCards((prev) => {
      const moving = prev[fromCol].find((t) => t.id === activeId);
      if (!moving) return prev;
      const fromList = prev[fromCol].filter((t) => t.id !== activeId);
      const toList = [...prev[toCol]];
      const overIndex = toList.findIndex((t) => t.id === overId);
      toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, {
        ...moving,
        column_id: toCol,
      });
      return { ...prev, [fromCol]: fromList, [toCol]: toList };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // přeřazení sloupců
    if (isColId(activeId)) {
      if (activeId === overId || !isColId(overId)) return;
      const oldIndex = columns.findIndex((c) => colDndId(c.id) === activeId);
      const newIndex = columns.findIndex((c) => colDndId(c.id) === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(columns, oldIndex, newIndex);
      const moved = reordered[newIndex];
      const position = posBetween(
        reordered[newIndex - 1]?.position,
        reordered[newIndex + 1]?.position
      );
      setColumns(reordered.map((c) => (c.id === moved.id ? { ...c, position } : c)));
      await supabase.from("board_columns").update({ position }).eq("id", moved.id);
      return;
    }

    // dokončení přesunu karty
    const colId = findColumnOf(activeId);
    if (!colId) return;
    let list = cards[colId];
    const oldIndex = list.findIndex((t) => t.id === activeId);
    const overIndex = list.findIndex((t) => t.id === overId);
    if (overIndex >= 0 && oldIndex !== overIndex) {
      list = arrayMove(list, oldIndex, overIndex);
    }
    const newIndex = list.findIndex((t) => t.id === activeId);
    const position = posBetween(
      list[newIndex - 1]?.position,
      list[newIndex + 1]?.position
    );
    const updated = list.map((t) =>
      t.id === activeId ? { ...t, position, column_id: colId } : t
    );
    setCards((prev) => ({ ...prev, [colId]: updated }));
    await supabase
      .from("tasks")
      .update({ column_id: colId, position })
      .eq("id", activeId);
  }

  if (loading) return <p className="p-4 text-ink-soft/70">Načítám…</p>;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{projectName}</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          <SortableContext
            items={columns.map((c) => colDndId(c.id))}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                onRename={() => renameColumn(col)}
                onDelete={() => deleteColumn(col)}
              >
                <SortableContext
                  items={(cards[col.id] ?? []).map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex min-h-2 flex-col gap-2">
                    {(cards[col.id] ?? []).map((task) => (
                      <BoardCard
                        key={task.id}
                        task={task}
                        members={members}
                        onOpen={() => setOpenTask(task)}
                        onStart={() =>
                          startTimer(supabase, userId, {
                            workspace_id: wsId,
                            project_id: projectId,
                            task_id: task.id,
                          })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>

                {addingTo === col.id ? (
                  <form onSubmit={(e) => addCard(col.id, e)} className="mt-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Název karty…"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onBlur={() => !newCardTitle.trim() && setAddingTo(null)}
                      className="w-full input px-2"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setAddingTo(col.id);
                      setNewCardTitle("");
                    }}
                    className="mt-2 w-full rounded-md px-2 py-1 text-left text-xs text-ink-soft/70 hover:bg-black/10 hover:text-ink-soft"
                  >
                    + Karta
                  </button>
                )}
              </SortableColumn>
            ))}
          </SortableContext>

          <form onSubmit={addColumn} className="w-64 shrink-0">
            <input
              type="text"
              placeholder="+ Nový sloupec…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="w-full rounded-lg border border-dashed border-line bg-transparent px-3 py-2 text-sm placeholder:text-ink-soft/70"
            />
          </form>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="rounded-lg border border-line bg-surface p-2 shadow-lg">
              <p className="text-sm">{activeCard.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openTask && (
        <CardModal
          task={openTask}
          members={members}
          userId={userId}
          onClose={() => setOpenTask(null)}
          onChanged={() => {
            setOpenTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SortableColumn({
  column,
  children,
  onRename,
  onDelete,
}: {
  column: BoardColumn;
  children: React.ReactNode;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: colDndId(column.id), data: { type: "column" } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`w-64 shrink-0 rounded-xl bg-black/5 p-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="mb-2 flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded px-1 text-ink-soft/70 hover:bg-black/10"
          title="Přetáhnout sloupec"
        >
          ⠿
        </button>
        <span className="flex-1 truncate text-sm font-semibold">{column.name}</span>
        <button
          onClick={onRename}
          className="rounded px-1 text-xs text-ink-soft/70 hover:bg-black/10"
          title="Přejmenovat"
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          className="rounded px-1 text-xs text-ink-soft/70 hover:bg-black/10"
          title="Smazat sloupec"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}
