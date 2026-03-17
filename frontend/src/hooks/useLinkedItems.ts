"use client";
import { useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LinkedItem {
  sourceModule: string;
  sourceId: number;
  targetModule: string;
  targetId: number;
  createdAt: string;
}

const STORAGE_KEY = "leanpilot_linked_items";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function readAll(): LinkedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LinkedItem[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: LinkedItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Manages cross-module linked items stored in localStorage.
 *
 * @param module  - The current module identifier (e.g. "kaizen", "five-why")
 * @param itemId  - The specific item ID within that module
 */
export function useLinkedItems(module: string, itemId?: number) {
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);

  /* Load items that reference this module/item — either as source or target */
  const refresh = useCallback(() => {
    const all = readAll();
    if (itemId == null) {
      // Return everything for this module
      const filtered = all.filter(
        (l) => l.sourceModule === module || l.targetModule === module,
      );
      setLinkedItems(filtered);
    } else {
      const filtered = all.filter(
        (l) =>
          (l.sourceModule === module && l.sourceId === itemId) ||
          (l.targetModule === module && l.targetId === itemId),
      );
      setLinkedItems(filtered);
    }
  }, [module, itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Create a new link */
  const addLink = useCallback(
    (target: { targetModule: string; targetId: number }) => {
      if (itemId == null) return;
      const link: LinkedItem = {
        sourceModule: module,
        sourceId: itemId,
        targetModule: target.targetModule,
        targetId: target.targetId,
        createdAt: new Date().toISOString(),
      };
      const all = readAll();
      all.push(link);
      writeAll(all);
      refresh();
      return link;
    },
    [module, itemId, refresh],
  );

  /* Remove a link */
  const removeLink = useCallback(
    (targetModule: string, targetId: number) => {
      if (itemId == null) return;
      const all = readAll().filter(
        (l) =>
          !(
            l.sourceModule === module &&
            l.sourceId === itemId &&
            l.targetModule === targetModule &&
            l.targetId === targetId
          ),
      );
      writeAll(all);
      refresh();
    },
    [module, itemId, refresh],
  );

  return { linkedItems, addLink, removeLink, refresh };
}
