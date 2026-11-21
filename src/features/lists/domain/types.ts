import type { ItemDetails } from './itemDetails';
import type { ListKind } from './listKinds';

export interface ListSummary {
  id: string;
  ownerId: string;
  visibility: 'private' | 'household';
  kind: ListKind;
  title: string;
  emoji: string;
  description: string | null;
  isArchived: boolean;
  openCount: number;
  doneCount: number;
}

export interface ListItem {
  id: string;
  text: string;
  note: string | null;
  isDone: boolean;
  doneBy: string | null;
  position: string;
  details: ItemDetails;
  revision: number;
}
