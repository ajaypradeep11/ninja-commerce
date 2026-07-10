import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HTMLAttributes, ReactNode } from 'react';

export type DragHandleProps = HTMLAttributes<HTMLElement>;

interface SortableItemProps<T> {
  id: string;
  item: T;
  renderItem: (item: T, handleProps: DragHandleProps) => ReactNode;
}

function SortableItem<T>({ id, item, renderItem }: SortableItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {renderItem(item, { ...attributes, ...listeners })}
    </div>
  );
}

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (reordered: T[]) => void;
  renderItem: (item: T, handleProps: DragHandleProps) => ReactNode;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(getId)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem
            key={getId(item)}
            id={getId(item)}
            item={item}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
