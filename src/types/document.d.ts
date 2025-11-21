export interface Document {
  id: string;
  name: string;
  content: string;
  filePath: string | null;
}

export interface DraggableDocument extends Document {
  dragId: string;
}
