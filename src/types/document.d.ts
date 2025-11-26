export interface Document {
  id: string;
  name: string;
  content: string;
  filePath: string | null;
  dirty?: boolean; // Track if document has unsaved changes
  lastSavedContent?: string; // Track last saved content to detect changes
}

export interface DraggableDocument extends Document {
  dragId: string;
}
